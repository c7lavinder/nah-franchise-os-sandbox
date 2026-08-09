/**
 * Replay MasterSuite-native FranDev writes into this app (Supabase master).
 *
 * MasterSuite's FranDev module (Scout approval cards) writes natively to its
 * MySQL copy AND journals each write to `frandev_native_write`. Until the
 * source-of-truth flip, Supabase stays master and the nightly push is a blind
 * upsert-by-PK — so pending journal rows must be applied here (which also fires
 * the real side effects: GHL stage sync, GHL task creation) BEFORE the push, or
 * the push clobbers the native change. Runs from the apply-mastersuite-writes
 * cron (every 15 min) and again at the start of the nightly push.
 *
 * Id discipline: the journal carries the UUIDs MasterSuite generated (state row,
 * history row, task row), and this replay writes those SAME ids into Supabase —
 * the next push then upserts onto the native rows instead of duplicating them.
 */

import type { Pool, RowDataPacket } from "mysql2/promise";
import { getServiceSupabase } from "./supabase";
import { getMasterSuiteWritePool, isWriteConfigured } from "./write-client";
import { syncStageToGHL } from "@/lib/ghl/stage-sync";
import { carryForwardContactEos } from "@/lib/eos/carry-forward";
import { markJourneyBriefStale } from "@/lib/briefs/mark-journey-brief-stale";
import { isSubStageMoveLog, SUB_STAGE_MOVE_METADATA_KIND } from "@/lib/contacts/stage-visual-state";
import { mergeContact } from "@/lib/contacts/merge";
import { matchWorkflowTriggers } from "@/lib/workflows/trigger-matcher";
import { runContactResearch } from "@/lib/agents/contact-research";
import * as ghl from "@/lib/ghl";
import { customerFacingSendsDisabledReason, customerFacingSendsEnabled } from "@/lib/ghl/action-safety";
import { updateTouchFields } from "@/lib/ghl/touch-fields";
import { sendContactSmsViaActiveProvider } from "@/lib/sms/contact-sms";
import { executeGHLAction } from "@/lib/ghl/actions/executor";
import type { GHLActionCode } from "@/lib/ghl/permissions";
import { prepareEmailForTracking } from "@/lib/workflows/tracking";
import { advanceDay } from "@/lib/workflows/enrollment";
import { personalizeWorkflowText } from "@/lib/workflows/personalization";
import { isValidFieldName } from "@/lib/profile/field-registry";
import { resolveCallTypeBySlug } from "@/lib/calls/resolve-call-type";

interface JournalRow extends RowDataPacket {
  Id: number;
  WriteType: string;
  PayloadJson: string;
}

interface AdvancePayload {
  history_id: string;
  state_id: string;
  journey_id: string;
  pipeline_id: string;
  pipeline_slug: string;
  from_stage_id: string;
  to_stage_id: string;
  to_stage_slug: string;
  contact_id: string;
  reason: string | null;
  moved_by: string;
}

interface DropPayload {
  journey_id: string;
  pipeline_id: string;
  destination: "followup" | "nurture";
  reason: string | null;
  closed: Array<{ state_id: string; stage_id: string; history_id: string }>;
  new_state_id: string | null;
  moved_by: string;
}

interface CloseJourneyPayload {
  journey_id: string;
  pipeline_id: string;
  pipeline_slug: string;
  to_stage_id: string;
  to_stage_slug: string;
  contact_id: string;
  ghl_contact_id: string | null;
  reason: string | null;
  moved_by: string;
  closed: Array<{ state_id: string; from_stage_id: string; history_id: string }>;
  spawn: { pipeline_id: string; pipeline_slug: string; stage_id: string; stage_slug: string } | null;
  spawned: Array<{ state_id: string; territory_slug: string | null }>;
}

interface CreateTaskPayload {
  task_id: string;
  contact_id: string;
  ghl_contact_id: string | null;
  title: string;
  body: string | null;
  due_date: string | null; // "YYYY-MM-DD HH:MM:SS" or null
  requested_by: string;
}

interface ScoutMemoryMergePayload {
  user_id: string;
  content: string;
  requested_by: string;
}

interface MarkSmsReadPayload {
  user_id: string;
  conversation_key: string;
  read_at: string; // "YYYY-MM-DD HH:MM:SS" UTC
}

interface ToggleTaskPayload {
  task_id: string;
  contact_id: string;
  ghl_contact_id: string | null;
  completed: boolean;
  toggled_by: string;
}

interface SubTaskLogPayload {
  log_id: string;
  state_id: string;
  journey_id: string;
  sub_task_id: string;
  contact_id: string;
  territory_slug: string | null;
  completed: boolean;
  note: string | null;
  logged_by: string;
}

interface WorkflowStatusPayload {
  workflow_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
}

interface CreateContactPayload {
  contact_id: string;
  journey_id: string;
  journey_contact_id: string;
  state_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  sub_source: string | null;
  journey_slug: string;
  journey_name: string;
  created_by: string;
}

interface UpdateContactPayload {
  contact_id: string;
  ghl_contact_id: string | null;
  phone: string | null;
  email: string | null;
  updated_by: string;
}

interface BoardMovePayload {
  state_id: string;
  journey_id: string;
  contact_id: string;
  pipeline_slug: string;
  target_type: "subtask" | "unsorted";
  target_stage_id: string;
  target_sub_task_id: string | null; // null for "unsorted"
  to_stage_slug: string | null;
  from_stage_id: string | null;
  from_sub_task_id: string | null;
  stage_changed: boolean;
  sub_task_changed: boolean;
  history_id: string | null; // minted natively, only when stage_changed
  sub_task_log_id: string | null; // minted natively, only when moving into a real sub-task
  sub_task_name: string | null;
  moved_by: string;
}

interface SendSmsPayload {
  send_id: string; // minted natively — journal reference only, no Supabase row carries it
  contact_id: string | null; // Supabase contact uuid
  ghl_contact_id: string | null;
  from_number: string | null; // the thread's owned sending number
  body: string;
  requested_by: string;
}

interface SendEmailPayload {
  send_id: string;
  contact_id: string | null;
  ghl_contact_id: string | null;
  subject: string;
  html: string;
  email_from: string | null;
  requested_by: string;
}

interface ApproveWorkflowStepPayload {
  log_id: string; // workflow_step_logs.id — the queue row being approved
  approved_by: string;
}

interface RejectWorkflowStepPayload {
  log_id: string;
  rejected_by: string;
}

/** MasterSuite's Profile-tab inline edit (its #686). `field_value` null CLEARS the field. */
interface UpdateProfileFieldPayload {
  contact_id: string;
  ghl_contact_id: string | null;
  field_name: string;
  field_label: string;
  field_value: string | null;
  previous_value: string | null;
  source: string;
  updated_by: string;
}

/** MasterSuite's journey rename (its #678). */
interface RenameJourneyPayload {
  journey_id: string;
  journey_slug: string | null;
  previous_name: string | null;
  name: string;
  updated_by: string;
}

/** MasterSuite's drag-retype on the CallsV2 board. */
interface SetCallTypePayload {
  call_id: string;
  type_slug: string;
  changed_by: string;
}

/**
 * Every WriteType the dispatcher below knows how to apply.
 *
 * ⚠ This list is HALF of a contract. The other half lives in MasterSuite, and nothing
 * mechanically ties them together — a write type added there and not here journals fine,
 * fails replay, and then gets clobbered by the nightly push, because `journeys` and
 * `contact_profile_fields` are both on the push's table list.
 *
 * That is not hypothetical: `update_profile_field`, `rename_journey` and `set_call_type`
 * all shipped to production with no handler here and were found by diffing the two sides
 * by hand on 2026-08-08. Nothing was lost only because `frandev_native_write` still held
 * zero rows.
 *
 * To re-derive MasterSuite's side, from its repo root:
 *   grep -rhon 'JournalNativeWrite(conn, tx, "[a-z_]*"' MasterSuite.Modules.Frandev/ \
 *     | sed 's/.*"\(.*\)"/\1/' | sort -u
 * Every name it prints must appear below. `applyNativeWrites` reports anything that does
 * not as `unhandledTypes` so the gap is one named line in the cron result rather than a
 * stack of per-row errors nobody reads.
 */
export const HANDLED_WRITE_TYPES = [
  "advance_stage",
  "approve_workflow_step",
  "archive_journey",
  "board_move",
  "close_journey",
  "create_contact",
  "create_eos_habit",
  "create_eos_item",
  "create_stakeholder",
  "create_note",
  "create_task",
  "delete_contact",
  "delete_journey",
  "delete_note",
  "drop_journey",
  "mark_sms_read",
  "merge_contact",
  "reject_workflow_step",
  "remove_stakeholder",
  "rename_journey",
  "retire_territory",
  "revert_stage",
  "scout_memory_merge",
  "send_email",
  "send_sms",
  "set_call_type",
  "sub_task_log",
  "toggle_task",
  "transfer_territory",
  "update_contact",
  "update_note",
  "update_profile_field",
  "workflow_status",
] as const;

const HANDLED = new Set<string>(HANDLED_WRITE_TYPES);

/** MasterSuite's Personal EOS add boxes (its T8). `kind` is "issue" or "todo". */
interface CreateEosItemPayload {
  item_id: string;
  contact_id: string;
  kind: "issue" | "todo";
  text: string;
  source: string;
  created_by: string;
}

interface CreateEosHabitPayload {
  habit_id: string;
  contact_id: string;
  habit_text: string;
  /** Already normalised MasterSuite-side to the five values our CHECK allows. */
  cadence: string;
  source: string;
  created_by: string;
}

interface CreateStakeholderPayload {
  stakeholder_id: string;
  ms_slug: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string;
  created_by: string;
}

interface RemoveStakeholderPayload {
  stakeholder_id: string;
  ms_slug: string;
  removed_by: string;
}

/** MasterSuite's "Retire journey" header action. Status goes to `archived`. */
interface ArchiveJourneyPayload {
  journey_id: string;
  previous_status: string | null;
  reason: string | null;
  archived_by: string;
}

/** MasterSuite's "Delete journey". ⚠ A real delete — Supabase's FKs cascade the children. */
interface DeleteJourneyPayload {
  journey_id: string;
  journey_name: string;
  previous_status: string | null;
  deleted_by: string;
}

/** MasterSuite's "Retire territory". Status goes to `inactive`. */
interface RetireTerritoryPayload {
  ms_slug: string;
  previous_status: string | null;
  retired_by: string;
}

/** MasterSuite's "Transfer". The outgoing owner is end-dated, never removed. */
interface TransferTerritoryPayload {
  owner_id: string;
  ms_slug: string;
  new_contact_id: string;
  new_ghl_contact_id: string | null;
  notes: string | null;
  transferred_by: string;
}

/**
 * The Notes panel on MasterSuite's three record pages (journey / territory / contact).
 *
 * ⚠ `scope` decides which ONE of the three target fields is set, and `notes` carries a CHECK
 * that enforces exactly that. A payload naming the wrong pair is rejected by Postgres, so
 * these handlers check it first and fail with a sentence instead of a constraint dump.
 *
 * ⚠ The rollup — "a territory or contact note also shows on that person's active journeys"
 * — is a READ, not a row. Nothing here fans a note out to journeys. Writing a copy per
 * journey would mean an edit or delete has to find every copy, which is the duplicated-state
 * bug this module has already produced twice.
 */
interface CreateNotePayload {
  note_id: string;
  scope: "journey" | "territory" | "contact";
  journey_id: string | null;
  contact_id: string | null;
  ms_slug: string | null;
  body: string;
  author_email: string;
  author_name: string | null;
  source: string;
}

/** An edit in place. Only the body changes; the note keeps its home and its author. */
interface UpdateNotePayload {
  note_id: string;
  body: string;
  edited_by: string;
}

/**
 * ⚠ A SOFT delete — `deleted_at`, never a row removal. The nightly push into MasterSuite is
 * an upsert-by-primary-key with no way to say "this row is gone", so a hard delete here
 * would clear the note in Supabase and leave it in `frandev_note` forever.
 */
interface DeleteNotePayload {
  note_id: string;
  deleted_by: string;
}

/**
 * MasterSuite's Merge button (Journey + Contact pages — the walkthrough's Merge ×2).
 * The replay calls lib/contacts/merge.ts — the SAME extracted function the app's own
 * merge route runs — so there is exactly one merge implementation across both worlds.
 * MasterSuite already marked its mirror (MergedIntoContactId + journey re-pointing);
 * this applies the real thing to Supabase + GHL.
 */
interface MergeContactPayload {
  dup_contact_id: string;
  keep_contact_id: string;
  reason: string | null;
  requested_by: string;
}

/**
 * MasterSuite's Delete-contact button. The mirror side already deleted its rows from a
 * GENERATED child list; this applies the same delete to Supabase.
 */
interface DeleteContactPayload {
  contact_id: string;
  ghl_contact_id: string | null;
  requested_by: string;
}

export interface ApplyResult {
  pending: number;
  applied: number;
  failed: number;
  skipped?: string;
  errors: string[];
  /**
   * Distinct WriteTypes seen that this app has no handler for — i.e. MasterSuite has
   * shipped a write we cannot replay. Separated from `errors` because the fix is a code
   * change here, not a retry.
   */
  unhandledTypes?: string[];
}

export async function applyNativeWrites(limit = 50): Promise<ApplyResult> {
  const result: ApplyResult = { pending: 0, applied: 0, failed: 0, errors: [] };
  const unhandled = new Set<string>();
  if (!isWriteConfigured()) {
    result.skipped = "dev_db_not_configured";
    return result;
  }

  const pool = getMasterSuiteWritePool();
  const [rows] = await pool.query<JournalRow[]>(
    "SELECT Id, WriteType, PayloadJson FROM frandev_native_write WHERE Status = 'pending' ORDER BY Id LIMIT ?",
    [limit]
  );
  result.pending = rows.length;

  for (const row of rows) {
    try {
      if (row.WriteType === "advance_stage") {
        await applyAdvanceStage(JSON.parse(row.PayloadJson) as AdvancePayload);
      } else if (row.WriteType === "revert_stage") {
        await applyRevertStage(JSON.parse(row.PayloadJson) as AdvancePayload);
      } else if (row.WriteType === "drop_journey") {
        await applyDropJourney(JSON.parse(row.PayloadJson) as DropPayload);
      } else if (row.WriteType === "close_journey") {
        await applyCloseJourney(JSON.parse(row.PayloadJson) as CloseJourneyPayload);
      } else if (row.WriteType === "create_task") {
        await applyCreateTask(pool, JSON.parse(row.PayloadJson) as CreateTaskPayload);
      } else if (row.WriteType === "scout_memory_merge") {
        await applyScoutMemoryMerge(JSON.parse(row.PayloadJson) as ScoutMemoryMergePayload);
      } else if (row.WriteType === "mark_sms_read") {
        await applyMarkSmsRead(JSON.parse(row.PayloadJson) as MarkSmsReadPayload);
      } else if (row.WriteType === "toggle_task") {
        await applyToggleTask(JSON.parse(row.PayloadJson) as ToggleTaskPayload);
      } else if (row.WriteType === "sub_task_log") {
        await applySubTaskLog(JSON.parse(row.PayloadJson) as SubTaskLogPayload);
      } else if (row.WriteType === "workflow_status") {
        await applyWorkflowStatus(JSON.parse(row.PayloadJson) as WorkflowStatusPayload);
      } else if (row.WriteType === "create_contact") {
        await applyCreateContact(JSON.parse(row.PayloadJson) as CreateContactPayload);
      } else if (row.WriteType === "update_contact") {
        await applyUpdateContact(JSON.parse(row.PayloadJson) as UpdateContactPayload);
      } else if (row.WriteType === "board_move") {
        await applyBoardMove(JSON.parse(row.PayloadJson) as BoardMovePayload);
      } else if (row.WriteType === "send_sms") {
        await applySendSms(pool, row.Id, JSON.parse(row.PayloadJson) as SendSmsPayload);
      } else if (row.WriteType === "send_email") {
        await applySendEmail(pool, row.Id, JSON.parse(row.PayloadJson) as SendEmailPayload);
      } else if (row.WriteType === "approve_workflow_step") {
        await applyApproveWorkflowStep(pool, row.Id, JSON.parse(row.PayloadJson) as ApproveWorkflowStepPayload);
      } else if (row.WriteType === "reject_workflow_step") {
        await applyRejectWorkflowStep(JSON.parse(row.PayloadJson) as RejectWorkflowStepPayload);
      } else if (row.WriteType === "update_profile_field") {
        await applyUpdateProfileField(JSON.parse(row.PayloadJson) as UpdateProfileFieldPayload);
      } else if (row.WriteType === "rename_journey") {
        await applyRenameJourney(JSON.parse(row.PayloadJson) as RenameJourneyPayload);
      } else if (row.WriteType === "set_call_type") {
        await applySetCallType(JSON.parse(row.PayloadJson) as SetCallTypePayload);
      } else if (row.WriteType === "create_eos_item") {
        await applyCreateEosItem(JSON.parse(row.PayloadJson) as CreateEosItemPayload);
      } else if (row.WriteType === "create_eos_habit") {
        await applyCreateEosHabit(JSON.parse(row.PayloadJson) as CreateEosHabitPayload);
      } else if (row.WriteType === "create_stakeholder") {
        await applyCreateStakeholder(JSON.parse(row.PayloadJson) as CreateStakeholderPayload);
      } else if (row.WriteType === "remove_stakeholder") {
        await applyRemoveStakeholder(JSON.parse(row.PayloadJson) as RemoveStakeholderPayload);
      } else if (row.WriteType === "archive_journey") {
        await applyArchiveJourney(JSON.parse(row.PayloadJson) as ArchiveJourneyPayload);
      } else if (row.WriteType === "delete_journey") {
        await applyDeleteJourney(JSON.parse(row.PayloadJson) as DeleteJourneyPayload);
      } else if (row.WriteType === "retire_territory") {
        await applyRetireTerritory(JSON.parse(row.PayloadJson) as RetireTerritoryPayload);
      } else if (row.WriteType === "transfer_territory") {
        await applyTransferTerritory(JSON.parse(row.PayloadJson) as TransferTerritoryPayload);
      } else if (row.WriteType === "create_note") {
        await applyCreateNote(JSON.parse(row.PayloadJson) as CreateNotePayload);
      } else if (row.WriteType === "update_note") {
        await applyUpdateNote(JSON.parse(row.PayloadJson) as UpdateNotePayload);
      } else if (row.WriteType === "delete_note") {
        await applyDeleteNote(JSON.parse(row.PayloadJson) as DeleteNotePayload);
      } else if (row.WriteType === "merge_contact") {
        await applyMergeContact(JSON.parse(row.PayloadJson) as MergeContactPayload);
      } else if (row.WriteType === "delete_contact") {
        await applyDeleteContact(JSON.parse(row.PayloadJson) as DeleteContactPayload);
      } else {
        unhandled.add(row.WriteType);
        throw new Error(
          `Unknown WriteType '${row.WriteType}' — MasterSuite journals a write this app cannot replay. ` +
            `Add a handler and list it in HANDLED_WRITE_TYPES; the nightly push will otherwise overwrite it.`
        );
      }
      await pool.query(
        "UPDATE frandev_native_write SET Status = 'applied', AppliedAt = UTC_TIMESTAMP(), Error = NULL WHERE Id = ?",
        [row.Id]
      );
      result.applied += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await pool.query(
        "UPDATE frandev_native_write SET Status = 'failed', AppliedAt = UTC_TIMESTAMP(), Error = ? WHERE Id = ?",
        [message.slice(0, 2000), row.Id]
      );
      result.failed += 1;
      result.errors.push(`#${row.Id} ${row.WriteType}: ${message}`);
    }
  }

  if (unhandled.size > 0) result.unhandledTypes = [...unhandled].sort();
  return result;
}

/**
 * Mirror of the advance route's core moves, minus what doesn't apply to a
 * replay: the stage was already chosen in MasterSuite (so no next-stage math,
 * no required-sub-task gate), and terminal stages were refused at the source
 * (so no auto-spawn handling). Conflict rule: if the Supabase row is no longer
 * at from_stage, someone moved it in the app since — fail the journal row
 * rather than fight; the nightly push then restores MySQL to app truth.
 */
async function applyAdvanceStage(payload: AdvancePayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: jps, error: jpsError } = await supabase
    .from("journey_pipeline_state")
    .select("id, current_stage_id, is_active")
    .eq("id", payload.state_id)
    .maybeSingle();
  if (jpsError) throw new Error(`jps read failed: ${jpsError.message}`);
  if (!jps) throw new Error(`journey_pipeline_state ${payload.state_id} not found in Supabase`);
  if (jps.current_stage_id === payload.to_stage_id) return; // already there — idempotent
  if (jps.current_stage_id !== payload.from_stage_id)
    throw new Error(
      `conflict: state is at ${jps.current_stage_id}, expected ${payload.from_stage_id} — moved in the app since`
    );

  await autoCompleteStageSubTasks(supabase, payload.state_id, payload.from_stage_id, now, payload.moved_by);

  const { data: firstSubTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("stage_id", payload.to_stage_id)
    .order("sort_order")
    .limit(1)
    .maybeSingle();

  const { error: updError } = await supabase
    .from("journey_pipeline_state")
    .update({
      current_stage_id: payload.to_stage_id,
      entered_current_stage_at: now,
      current_sub_task_id: firstSubTask?.id ?? null,
      current_sub_task_started_at: now,
      updated_at: now,
    })
    .eq("id", payload.state_id)
    .eq("current_stage_id", payload.from_stage_id); // optimistic guard
  if (updError) throw new Error(`jps update failed: ${updError.message}`);

  // Same row id as the native history entry — the push upserts onto it.
  const { error: histError } = await supabase.from("pipeline_stage_history").insert({
    id: payload.history_id,
    journey_pipeline_state_id: payload.state_id,
    from_stage_id: payload.from_stage_id,
    to_stage_id: payload.to_stage_id,
    moved_by_user_id: null,
    reason: attributed(payload.reason, payload.moved_by),
    was_skip: false,
    was_revert: false,
    was_auto: false,
    created_at: now,
  });
  if (histError && !histError.message.includes("duplicate")) {
    throw new Error(`history insert failed: ${histError.message}`);
  }

  // Side effects — best-effort, never fail the replay over them.
  try {
    await syncStageToGHL(payload.contact_id, payload.pipeline_slug, payload.to_stage_slug);
  } catch (err) {
    console.error("[apply-native-writes] GHL stage sync failed:", err instanceof Error ? err.message : err);
  }
  try {
    await markJourneyBriefStale(payload.journey_id);
  } catch {
    /* brief refresh is cosmetic */
  }
}

/**
 * Revert replay: same shape as advance minus the sub-task auto-complete (the
 * app's revert doesn't complete anything), with was_revert on the history row.
 */
async function applyRevertStage(payload: AdvancePayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: jps, error: jpsError } = await supabase
    .from("journey_pipeline_state")
    .select("id, current_stage_id, is_active")
    .eq("id", payload.state_id)
    .maybeSingle();
  if (jpsError) throw new Error(`jps read failed: ${jpsError.message}`);
  if (!jps) throw new Error(`journey_pipeline_state ${payload.state_id} not found in Supabase`);
  if (jps.current_stage_id === payload.to_stage_id) return; // already there — idempotent
  if (jps.current_stage_id !== payload.from_stage_id)
    throw new Error(
      `conflict: state is at ${jps.current_stage_id}, expected ${payload.from_stage_id} — moved in the app since`
    );

  const { data: firstSubTask } = await supabase
    .from("pipeline_sub_tasks")
    .select("id")
    .eq("stage_id", payload.to_stage_id)
    .order("sort_order")
    .limit(1)
    .maybeSingle();

  const { error: updError } = await supabase
    .from("journey_pipeline_state")
    .update({
      current_stage_id: payload.to_stage_id,
      entered_current_stage_at: now,
      current_sub_task_id: firstSubTask?.id ?? null,
      current_sub_task_started_at: now,
      updated_at: now,
    })
    .eq("id", payload.state_id)
    .eq("current_stage_id", payload.from_stage_id);
  if (updError) throw new Error(`jps update failed: ${updError.message}`);

  const { error: histError } = await supabase.from("pipeline_stage_history").insert({
    id: payload.history_id,
    journey_pipeline_state_id: payload.state_id,
    from_stage_id: payload.from_stage_id,
    to_stage_id: payload.to_stage_id,
    moved_by_user_id: null,
    reason: attributed(payload.reason, payload.moved_by),
    was_skip: false,
    was_revert: true,
    was_auto: false,
    created_at: now,
  });
  if (histError && !histError.message.includes("duplicate")) {
    throw new Error(`history insert failed: ${histError.message}`);
  }

  try {
    await syncStageToGHL(payload.contact_id, payload.pipeline_slug, payload.to_stage_slug);
  } catch (err) {
    console.error("[apply-native-writes] GHL stage sync failed:", err instanceof Error ? err.message : err);
  }
  try {
    await markJourneyBriefStale(payload.journey_id);
  } catch {
    /* cosmetic */
  }
}

/**
 * Kanban board move replay — mirrors POST /api/pipeline/board/move. Repositions a
 * state to a new sub-task and/or stage. Unlike advance/revert this can jump any
 * number of stages (or none — a pure sub-task move within a stage). Idempotent:
 * a no-op when the Supabase row already sits at the target stage + sub-task.
 * Optimistic guard: if the row moved in the app since (no longer at from_stage),
 * fail the journal row rather than fight — the nightly push restores MySQL truth.
 */
async function applyBoardMove(payload: BoardMovePayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: jps, error: jpsError } = await supabase
    .from("journey_pipeline_state")
    .select("id, current_stage_id, current_sub_task_id")
    .eq("id", payload.state_id)
    .maybeSingle();
  if (jpsError) throw new Error(`jps read failed: ${jpsError.message}`);
  if (!jps) throw new Error(`journey_pipeline_state ${payload.state_id} not found in Supabase`);

  const atTargetStage = jps.current_stage_id === payload.target_stage_id;
  const atTargetSubTask = (jps.current_sub_task_id ?? null) === payload.target_sub_task_id;
  if (atTargetStage && atTargetSubTask) return; // already there — idempotent

  if (payload.stage_changed && payload.from_stage_id && jps.current_stage_id !== payload.from_stage_id)
    throw new Error(
      `conflict: state is at ${jps.current_stage_id}, expected ${payload.from_stage_id} — moved in the app since`
    );

  const update: Record<string, unknown> = {
    current_sub_task_id: payload.target_sub_task_id,
    current_sub_task_started_at: now,
    updated_at: now,
  };
  if (payload.stage_changed) {
    update.current_stage_id = payload.target_stage_id;
    update.entered_current_stage_at = now;
  }
  let upd = supabase.from("journey_pipeline_state").update(update).eq("id", payload.state_id);
  if (payload.stage_changed && payload.from_stage_id) upd = upd.eq("current_stage_id", payload.from_stage_id);
  const { error: updError } = await upd;
  if (updError) throw new Error(`jps update failed: ${updError.message}`);

  // Stage transition history — same minted id as the native row so the push upserts onto it.
  if (payload.stage_changed && payload.history_id && payload.from_stage_id) {
    const { error: histError } = await supabase.from("pipeline_stage_history").insert({
      id: payload.history_id,
      journey_pipeline_state_id: payload.state_id,
      from_stage_id: payload.from_stage_id,
      to_stage_id: payload.target_stage_id,
      moved_by_user_id: null,
      reason: attributed("Moved on pipeline board", payload.moved_by),
      was_skip: false,
      was_revert: false,
      was_auto: false,
      created_at: now,
    });
    if (histError && !histError.message.includes("duplicate")) {
      throw new Error(`history insert failed: ${histError.message}`);
    }
  }

  // "Moved into X" sub-task note — carries the SUB_STAGE_MOVE metadata kind so the
  // app renders it as a move, not a completion. Same minted id as the native row.
  if (payload.sub_task_changed && payload.sub_task_log_id && payload.target_sub_task_id) {
    const { error: logError } = await supabase.from("contact_sub_task_logs").insert({
      id: payload.sub_task_log_id,
      journey_pipeline_state_id: payload.state_id,
      sub_task_id: payload.target_sub_task_id,
      logger_user_id: null,
      source: "api",
      state_advance: null,
      content_type: "note",
      content_text: `Moved into ${payload.sub_task_name ?? "sub-task"} (via MasterSuite by ${payload.moved_by}).`,
      metadata: {
        kind: SUB_STAGE_MOVE_METADATA_KIND,
        source: "mastersuite_board",
        from_stage_id: payload.from_stage_id,
        to_stage_id: payload.target_stage_id,
        from_sub_task_id: payload.from_sub_task_id,
        to_sub_task_id: payload.target_sub_task_id,
      },
      created_at: now,
    });
    if (logError && !logError.message.includes("duplicate")) {
      throw new Error(`sub-task log insert failed: ${logError.message}`);
    }
  }

  // Side effects on a stage change — best-effort, never fail the replay over them.
  if (payload.stage_changed && payload.to_stage_slug) {
    try {
      await syncStageToGHL(payload.contact_id, payload.pipeline_slug, payload.to_stage_slug);
    } catch (err) {
      console.error("[apply-native-writes] GHL stage sync failed:", err instanceof Error ? err.message : err);
    }
    try {
      await markJourneyBriefStale(payload.journey_id);
    } catch {
      /* cosmetic */
    }
  }
}

// Fixed seed ids, same constants as the app's drop route.
const FOLLOWUP_PIPELINE_ID = "a0000000-0000-0000-0000-000000000002";
const FOLLOWUP_STAGE_ID = "c0000000-0000-0000-0000-000000000001";
const NURTURE_STAGE_ID = "c0000000-0000-0000-0000-000000000002";

/**
 * Drop replay (§1.13 contact-wide drop): close the recorded states, mirror the
 * history rows by id, and spawn the Follow-up state with the id MasterSuite
 * minted. Each step is idempotent so a partial failure can be safely re-run.
 */
async function applyDropJourney(payload: DropPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const closedReason = payload.destination === "followup" ? "dropped_to_followup" : "dropped_to_nurture";

  for (const closed of payload.closed) {
    const { data: jps, error: readError } = await supabase
      .from("journey_pipeline_state")
      .select("id, is_active")
      .eq("id", closed.state_id)
      .maybeSingle();
    if (readError) throw new Error(`jps read failed: ${readError.message}`);
    if (!jps) throw new Error(`journey_pipeline_state ${closed.state_id} not found in Supabase`);

    if (jps.is_active) {
      const { error: closeError } = await supabase
        .from("journey_pipeline_state")
        .update({ is_active: false, closed_reason: closedReason, closed_at: now, updated_at: now })
        .eq("id", closed.state_id);
      if (closeError) throw new Error(`jps close failed: ${closeError.message}`);
    }

    const { error: histError } = await supabase.from("pipeline_stage_history").insert({
      id: closed.history_id,
      journey_pipeline_state_id: closed.state_id,
      from_stage_id: closed.stage_id,
      to_stage_id: closed.stage_id,
      moved_by_user_id: null,
      reason: attributed(payload.reason ?? `Dropped to ${payload.destination}`, payload.moved_by),
      was_skip: false,
      was_revert: false,
      was_auto: false,
      created_at: now,
    });
    if (histError && !histError.message.includes("duplicate")) {
      throw new Error(`history insert failed: ${histError.message}`);
    }
  }

  if (payload.new_state_id) {
    const { data: existing } = await supabase
      .from("journey_pipeline_state")
      .select("id")
      .eq("id", payload.new_state_id)
      .maybeSingle();
    if (!existing) {
      const { error: spawnError } = await supabase.from("journey_pipeline_state").insert({
        id: payload.new_state_id,
        journey_id: payload.journey_id,
        pipeline_id: FOLLOWUP_PIPELINE_ID,
        TerritorySlug: null,
        current_stage_id: payload.destination === "followup" ? FOLLOWUP_STAGE_ID : NURTURE_STAGE_ID,
        current_sub_task_id: null,
        current_sub_task_started_at: null,
        entered_pipeline_at: now,
        entered_current_stage_at: now,
        is_active: true,
      });
      if (spawnError) throw new Error(`follow-up spawn failed: ${spawnError.message}`);
    }
  }

  try {
    await markJourneyBriefStale(payload.journey_id);
  } catch {
    /* cosmetic */
  }
}

/**
 * Close (win) replay — the advance route's terminal branch, mirrored by id.
 * Each recorded state gets full advance semantics (sub-task auto-complete,
 * optimistic stage guard, history row with MasterSuite's minted id), then the
 * spawned follow-on states land with their minted ids, EOS carries forward per
 * territory, and the GHL stage field syncs. Every step is idempotent so a
 * partially failed row can be safely re-run.
 */
async function applyCloseJourney(payload: CloseJourneyPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  for (const moved of payload.closed) {
    const { data: jps, error: jpsError } = await supabase
      .from("journey_pipeline_state")
      .select("id, current_stage_id, is_active")
      .eq("id", moved.state_id)
      .maybeSingle();
    if (jpsError) throw new Error(`jps read failed: ${jpsError.message}`);
    if (!jps) throw new Error(`journey_pipeline_state ${moved.state_id} not found in Supabase`);
    if (jps.current_stage_id !== payload.to_stage_id) {
      if (jps.current_stage_id !== moved.from_stage_id)
        throw new Error(
          `conflict: state ${moved.state_id} is at ${jps.current_stage_id}, expected ${moved.from_stage_id} — moved in the app since`
        );

      await autoCompleteStageSubTasks(supabase, moved.state_id, moved.from_stage_id, now, payload.moved_by);

      const { error: updError } = await supabase
        .from("journey_pipeline_state")
        .update({
          current_stage_id: payload.to_stage_id,
          entered_current_stage_at: now,
          current_sub_task_id: null, // terminal stages have no sub-tasks
          current_sub_task_started_at: now,
          updated_at: now,
        })
        .eq("id", moved.state_id)
        .eq("current_stage_id", moved.from_stage_id); // optimistic guard
      if (updError) throw new Error(`jps update failed: ${updError.message}`);
    }

    const { error: histError } = await supabase.from("pipeline_stage_history").insert({
      id: moved.history_id,
      journey_pipeline_state_id: moved.state_id,
      from_stage_id: moved.from_stage_id,
      to_stage_id: payload.to_stage_id,
      moved_by_user_id: null,
      reason: attributed(payload.reason ?? "Closed (won)", payload.moved_by),
      was_skip: false,
      was_revert: false,
      was_auto: false,
      created_at: now,
    });
    if (histError && !histError.message.includes("duplicate")) {
      throw new Error(`history insert failed: ${histError.message}`);
    }
  }

  // Spawned follow-on states (sales → Onboarding fan-out) with MasterSuite's
  // minted ids — the push then upserts onto the native rows.
  if (payload.spawn && payload.spawned.length > 0) {
    const { data: firstSubTask } = await supabase
      .from("pipeline_sub_tasks")
      .select("id")
      .eq("stage_id", payload.spawn.stage_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    for (const sp of payload.spawned) {
      const { data: existing } = await supabase
        .from("journey_pipeline_state")
        .select("id")
        .eq("id", sp.state_id)
        .maybeSingle();
      if (existing) continue;
      const { error: spawnError } = await supabase.from("journey_pipeline_state").insert({
        id: sp.state_id,
        journey_id: payload.journey_id,
        pipeline_id: payload.spawn.pipeline_id,
        TerritorySlug: sp.territory_slug,
        current_stage_id: payload.spawn.stage_id,
        current_sub_task_id: firstSubTask?.id ?? null,
        current_sub_task_started_at: now,
        entered_pipeline_at: now,
        entered_current_stage_at: now,
        is_active: true,
      });
      if (spawnError && !spawnError.message.includes("duplicate")) {
        throw new Error(`${payload.spawn.pipeline_slug} spawn failed: ${spawnError.message}`);
      }
    }

    // EOS carry-forward per territory — same rule as the advance route's
    // fan-out; idempotent internally (already_carried short-circuits).
    if (payload.spawn.pipeline_slug === "onboarding" || payload.spawn.pipeline_slug === "runway") {
      for (const sp of payload.spawned) {
        if (!sp.territory_slug) continue;
        try {
          await carryForwardContactEos(payload.contact_id, sp.territory_slug);
        } catch (err) {
          console.error(
            "[apply-native-writes] EOS carry-forward failed:",
            sp.territory_slug,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  }

  // Side effects — best-effort, never fail the replay over them.
  try {
    await syncStageToGHL(payload.contact_id, payload.pipeline_slug, payload.to_stage_slug);
  } catch (err) {
    console.error("[apply-native-writes] GHL stage sync failed:", err instanceof Error ? err.message : err);
  }
  try {
    await markJourneyBriefStale(payload.journey_id);
  } catch {
    /* cosmetic */
  }
}

/** Copy of the advance route's helper, with logger_user_id null and MasterSuite attribution. */
async function autoCompleteStageSubTasks(
  supabase: ReturnType<typeof getServiceSupabase>,
  journeyPipelineStateId: string,
  stageId: string,
  timestamp: string,
  movedBy: string
): Promise<void> {
  const { data: subTasks } = await supabase.from("pipeline_sub_tasks").select("id, state_type").eq("stage_id", stageId);

  for (const task of subTasks ?? []) {
    const { data: logs } = await supabase
      .from("contact_sub_task_logs")
      .select("state_advance, metadata")
      .eq("journey_pipeline_state_id", journeyPipelineStateId)
      .eq("sub_task_id", task.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    const latest = logs?.find((log) => !isSubStageMoveLog(log));
    const alreadyComplete = task.state_type === "single" ? !!latest : latest?.state_advance === "second";
    if (alreadyComplete) continue;

    await supabase.from("contact_sub_task_logs").insert({
      journey_pipeline_state_id: journeyPipelineStateId,
      sub_task_id: task.id,
      logger_user_id: null,
      source: "api",
      state_advance: task.state_type === "two_state" ? "second" : null,
      content_type: "note",
      content_text: `Auto-completed when advanced to the next stage (via MasterSuite by ${movedBy}).`,
      created_at: timestamp,
    });
  }
}

/**
 * Task replay: insert the Supabase tasks row with the SAME uuid as the native
 * frandev_task row, push to GHL (best-effort — placeholder pto_ contacts are
 * skipped), and back-fill ghl_task_id on BOTH sides so the panels agree.
 */
async function applyCreateTask(pool: Pool, payload: CreateTaskPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const dueIso = payload.due_date
    ? new Date(payload.due_date.replace(" ", "T") + "Z").toISOString()
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // GHL requires one

  const { data: existing } = await supabase.from("tasks").select("id").eq("id", payload.task_id).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("tasks").insert({
      id: payload.task_id,
      contact_id: payload.contact_id,
      ghl_contact_id: payload.ghl_contact_id,
      title: payload.title,
      body: payload.body
        ? attributed(payload.body, payload.requested_by)
        : `Created via MasterSuite by ${payload.requested_by}.`,
      due_date: dueIso,
      source: "mastersuite",
      completed: false,
    });
    if (error) throw new Error(`tasks insert failed: ${error.message}`);
  }

  if (!payload.ghl_contact_id || payload.ghl_contact_id.startsWith("pto_")) return; // placeholder contact — GHL skip

  try {
    const ghlTask = await ghl.createTask(payload.ghl_contact_id, {
      title: payload.title,
      body: payload.body ?? undefined,
      dueDate: dueIso,
    });
    const syncedAt = new Date().toISOString();
    await supabase.from("tasks").update({ ghl_task_id: ghlTask.id, ghl_synced_at: syncedAt }).eq("id", payload.task_id);
    await pool.query("UPDATE frandev_task SET GhlTaskId = ?, GhlSyncedAt = UTC_TIMESTAMP() WHERE Id = ?", [
      ghlTask.id,
      payload.task_id,
    ]);
  } catch (err) {
    console.error("[apply-native-writes] GHL task push failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Memory replay: land the natively merged blob in Supabase (master) so the
 * nightly push re-mirrors the same content instead of clobbering the native
 * merge. Last-write-wins on content by design — if the user also chatted in
 * this app between the native turn and this replay (≤15 min window), the
 * native blob overwrites that merge; both blobs contain the same durable-fact
 * distillation, so the loss is a nuance, not a record.
 */
async function applyScoutMemoryMerge(payload: ScoutMemoryMergePayload): Promise<void> {
  if (!payload.user_id || !payload.content) throw new Error("scout_memory_merge payload missing user_id/content");
  const supabase = getServiceSupabase();
  const { data: existing } = await supabase
    .from("scout_user_memory")
    .select("turn_count")
    .eq("user_id", payload.user_id)
    .maybeSingle();
  const { error } = await supabase.from("scout_user_memory").upsert(
    {
      user_id: payload.user_id,
      content: payload.content.slice(0, 4000),
      turn_count: ((existing as { turn_count?: number } | null)?.turn_count ?? 0) + 1,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`scout_user_memory upsert failed: ${error.message}`);
}

/**
 * Read-mark replay: land the native "opened this thread" mark in Supabase so
 * the app's inbox stops showing the conversation as unread. Newest read_at
 * wins — if the user also opened the thread in this app after the native
 * open, the later mark is kept.
 */
async function applyMarkSmsRead(payload: MarkSmsReadPayload): Promise<void> {
  if (!payload.user_id || !payload.conversation_key || !payload.read_at)
    throw new Error("mark_sms_read payload missing user_id/conversation_key/read_at");
  const supabase = getServiceSupabase();
  const readAtIso = new Date(payload.read_at.replace(" ", "T") + "Z").toISOString();
  const { data: existing } = await supabase
    .from("sms_conversation_reads")
    .select("read_at")
    .eq("user_id", payload.user_id)
    .eq("conversation_key", payload.conversation_key)
    .maybeSingle();
  const current = (existing as { read_at?: string } | null)?.read_at;
  if (current && new Date(current).getTime() >= new Date(readAtIso).getTime()) return; // app-side mark is newer
  const { error } = await supabase.from("sms_conversation_reads").upsert(
    {
      user_id: payload.user_id,
      conversation_key: payload.conversation_key,
      read_at: readAtIso,
    },
    { onConflict: "user_id,conversation_key" }
  );
  if (error) throw new Error(`sms_conversation_reads upsert failed: ${error.message}`);
}

/**
 * Claim a send-type journal row before touching the provider. Sends are the
 * one write type whose side effect (an outbound message to a real prospect)
 * cannot be made idempotent by a minted id, so the row is flipped
 * pending → sending first: a concurrent cron run, or a rerun after a crash
 * that lost the final status update, finds the row out of 'pending' and can
 * never double-send. A row stuck in 'sending' means the send outcome is
 * unknown — surface it for a human instead of retrying. The runner's normal
 * applied/failed update then overwrites 'sending' with the final status.
 */
async function claimSendRow(pool: Pool, journalId: number, writeType: string): Promise<void> {
  const [res] = await pool.query(
    "UPDATE frandev_native_write SET Status = 'sending' WHERE Id = ? AND Status = 'pending'",
    [journalId]
  );
  const affected = (res as { affectedRows?: number }).affectedRows ?? 0;
  if (affected !== 1)
    throw new Error(
      `${writeType} #${journalId} could not be claimed (row not in 'pending' — a previous attempt may have sent already; check before retrying)`
    );
}

/**
 * Native SMS send replay — the deployed twin of POST /api/inbox/send for a
 * MasterSuite composer. The human confirmed the send natively (DRC holds:
 * the click IS the approval); this executes it through the app's one send
 * dispatcher, which picks the active provider (Vonage → SignalHouse → GHL)
 * and logs the outbound sms_messages row so the thread shows the message
 * and the delivery webhook can land receipts. Honors the customer-facing
 * kill-switch, so an unconfigured sandbox stays inert (row fails with the
 * reason instead of sending). Touch tracking mirrors the route: best-effort,
 * never fails the send.
 */
async function applySendSms(pool: Pool, journalId: number, payload: SendSmsPayload): Promise<void> {
  if (!payload.body || !payload.body.trim()) throw new Error("send_sms payload has an empty body");
  const contactKey =
    payload.contact_id ??
    (payload.ghl_contact_id &&
    !payload.ghl_contact_id.startsWith("pto_") &&
    !payload.ghl_contact_id.startsWith("ms_native_")
      ? payload.ghl_contact_id
      : null);
  if (!contactKey) throw new Error("send_sms payload has no usable contact_id/ghl_contact_id");
  if (!customerFacingSendsEnabled()) throw new Error(customerFacingSendsDisabledReason());

  await claimSendRow(pool, journalId, "send_sms");
  await sendContactSmsViaActiveProvider(contactKey, payload.body, { fromNumber: payload.from_number });

  if (
    payload.ghl_contact_id &&
    !payload.ghl_contact_id.startsWith("pto_") &&
    !payload.ghl_contact_id.startsWith("ms_native_")
  ) {
    await updateTouchFields(payload.ghl_contact_id, "SMS"); // never throws
  }
}

/**
 * Native email send replay — GHL is the only email provider (same as the
 * app's send routes), so this is ghl.sendMessage with the route's defaults.
 * Same claim-first non-idempotence guard and kill-switch as send_sms.
 */
async function applySendEmail(pool: Pool, journalId: number, payload: SendEmailPayload): Promise<void> {
  if (!payload.subject || !payload.html) throw new Error("send_email payload missing subject/html");
  const ghlContactId =
    payload.ghl_contact_id &&
    !payload.ghl_contact_id.startsWith("pto_") &&
    !payload.ghl_contact_id.startsWith("ms_native_")
      ? payload.ghl_contact_id
      : null;
  if (!ghlContactId) throw new Error("send_email payload has no synced ghl_contact_id (email sends through GHL)");
  if (!customerFacingSendsEnabled()) throw new Error(customerFacingSendsDisabledReason());

  await claimSendRow(pool, journalId, "send_email");
  await ghl.sendMessage({
    type: "Email",
    contactId: ghlContactId,
    html: payload.html,
    subject: payload.subject,
    emailFrom: payload.email_from ?? "chad@newagainhouses.com",
  });

  await updateTouchFields(ghlContactId, "Email"); // never throws
}

/** Maps sendable workflow step types to GHL action codes (same as the app's
 *  pending-steps confirm route and the scheduler). */
const WORKFLOW_STEP_ACTION_MAP: Record<string, GHLActionCode> = {
  sms: "C1",
  email: "C2",
  send_reminder: "A5",
};

type PendingStepLog = {
  id: string;
  enrollment_id: string;
  confirmed_at: string | null;
  executed_at: string | null;
  delivery_data: Record<string, unknown> | null;
  workflow_enrollments: { id: string; ghl_contact_id: string; contact_name: string | null };
  workflow_steps: {
    id: string;
    step_type: string;
    content: string | null;
    subject: string | null;
    condition_config: Record<string, unknown> | null;
  };
};

async function loadPendingStepLog(logId: string): Promise<PendingStepLog> {
  const supabase = getServiceSupabase();
  const { data: log, error } = await supabase
    .from("workflow_step_logs")
    .select(
      `id, enrollment_id, confirmed_at, executed_at, delivery_data,
       workflow_enrollments!inner ( id, ghl_contact_id, contact_name ),
       workflow_steps!inner ( id, step_type, content, subject, condition_config )`
    )
    .eq("id", logId)
    .maybeSingle();
  if (error) throw new Error(`workflow_step_logs read failed: ${error.message}`);
  if (!log) throw new Error(`workflow_step_logs ${logId} not found in Supabase`);
  return log as unknown as PendingStepLog;
}

/** Resolve a MasterSuite username (email) to a Supabase users.id for the
 *  log's confirmed_by column. Best-effort — the display name still lands in
 *  delivery_data even when no user row matches. */
async function resolveApproverUserId(username: string | null | undefined): Promise<string | null> {
  if (!username?.trim()) return null;
  const supabase = getServiceSupabase();
  const { data } = await supabase.from("users").select("id").ilike("email", username.trim()).maybeSingle();
  return data?.id ?? null;
}

/** Mirror of the confirm route's post-send day advance: when every step of the
 *  enrollment's current day has executed, advance immediately instead of
 *  waiting for the scheduler. Best-effort — the scheduler catches up anyway. */
async function advanceDayIfComplete(enrollmentId: string): Promise<void> {
  const supabase = getServiceSupabase();
  try {
    const { data: enrollment } = await supabase
      .from("workflow_enrollments")
      .select("id, workflow_version_id, current_day")
      .eq("id", enrollmentId)
      .eq("status", "active")
      .single();
    if (!enrollment) return;

    const [{ data: daySteps }, { data: executedLogs }] = await Promise.all([
      supabase
        .from("workflow_steps")
        .select("id")
        .eq("workflow_version_id", enrollment.workflow_version_id)
        .eq("day_number", enrollment.current_day),
      supabase
        .from("workflow_step_logs")
        .select("step_id")
        .eq("enrollment_id", enrollment.id)
        .not("executed_at", "is", null),
    ]);

    const executedStepIds = new Set((executedLogs ?? []).map((l) => l.step_id));
    const allDone = (daySteps ?? []).every((s) => executedStepIds.has(s.id));
    if (allDone && (daySteps ?? []).length > 0) {
      await advanceDay(enrollment.id);
    }
  } catch (err) {
    console.error(`[apply-native-writes] day advance check failed for enrollment ${enrollmentId}:`, err);
  }
}

/**
 * Workflow pending-step approval replay — the deployed twin of
 * PATCH /api/workflows/pending-steps/:logId {action:"confirm"} for the native
 * MasterSuite DRC queue. Approving IS the send (the app route sends
 * immediately, not "mark for scheduler"), so this is a send-type write:
 * claim-first non-idempotence guard + kill-switch, like send_sms/send_email.
 * Content is re-read from the step definition and personalized at send time,
 * exactly like the app route.
 */
async function applyApproveWorkflowStep(
  pool: Pool,
  journalId: number,
  payload: ApproveWorkflowStepPayload
): Promise<void> {
  if (!payload.log_id) throw new Error("approve_workflow_step payload missing log_id");
  const supabase = getServiceSupabase();
  const log = await loadPendingStepLog(payload.log_id);

  if (log.executed_at) return; // already sent (app-side or earlier replay) — idempotent
  if (log.confirmed_at)
    throw new Error(
      `conflict: step log ${payload.log_id} was already resolved in the app (${
        (log.delivery_data as { rejected?: boolean } | null)?.rejected ? "rejected" : "confirmed"
      }) — not resending`
    );

  const step = log.workflow_steps;
  const enrollment = log.workflow_enrollments;
  const actionCode = WORKFLOW_STEP_ACTION_MAP[step.step_type];
  if (!actionCode) throw new Error(`step type "${step.step_type}" cannot be confirmed — not a sendable action`);
  if (!customerFacingSendsEnabled()) throw new Error(customerFacingSendsDisabledReason());

  await claimSendRow(pool, journalId, "approve_workflow_step");

  const approverUserId = await resolveApproverUserId(payload.approved_by);
  const content = await personalizeWorkflowText({
    text: step.content,
    contactName: enrollment.contact_name,
    ghlContactId: enrollment.ghl_contact_id,
  });

  const condConfig = (step.condition_config ?? {}) as Record<string, unknown>;
  let actionParams: Record<string, unknown>;
  if (step.step_type === "sms") {
    actionParams = {
      contactId: enrollment.ghl_contact_id,
      message: content,
      fromNumber: condConfig.fromNumber ?? undefined,
    };
  } else if (step.step_type === "send_reminder") {
    actionParams = {
      contactId: enrollment.ghl_contact_id,
      reminderMessage: content || "Reminder: You have an upcoming call with New Again Houses.",
      fromNumber: condConfig.fromNumber ?? undefined,
    };
  } else {
    actionParams = {
      contactId: enrollment.ghl_contact_id,
      html: prepareEmailForTracking(content, payload.log_id),
      subject: await personalizeWorkflowText({
        text: step.subject,
        contactName: enrollment.contact_name,
        ghlContactId: enrollment.ghl_contact_id,
      }),
      emailFrom: condConfig.emailFrom ?? process.env.GHL_DEFAULT_EMAIL_FROM ?? "franchise@newagainhouses.com",
    };
  }

  const result = await executeGHLAction(actionCode, actionParams, approverUserId ?? "", enrollment.ghl_contact_id);

  if (!result.success) {
    await supabase
      .from("workflow_step_logs")
      .update({
        confirmed_by: approverUserId,
        confirmed_at: new Date().toISOString(),
        delivery_data: { queued: false, error: result.error, confirmedBy: payload.approved_by },
      })
      .eq("id", payload.log_id);
    throw new Error(`GHL action failed: ${result.error ?? "unknown error"}`);
  }

  const ghlMessageId = (result.data as { id?: string } | null)?.id ?? null;
  const { error: updError } = await supabase
    .from("workflow_step_logs")
    .update({
      confirmed_by: approverUserId,
      confirmed_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      ghl_message_id: ghlMessageId,
      delivered: false,
      delivery_data: {
        queued: false,
        confirmedBy: payload.approved_by,
        providerAccepted: true,
        source: "mastersuite_native",
      },
    })
    .eq("id", payload.log_id);
  if (updError) throw new Error(`step log update failed AFTER send (message went out): ${updError.message}`);

  await advanceDayIfComplete(log.enrollment_id);
}

/**
 * Workflow pending-step rejection replay — twin of the app route's
 * {action:"reject"}: resolve the queue row, nothing sends. Idempotent: an
 * already-rejected row is a no-op; a row that was confirmed/sent in the app
 * meanwhile is a conflict (the native reject came too late).
 */
async function applyRejectWorkflowStep(payload: RejectWorkflowStepPayload): Promise<void> {
  if (!payload.log_id) throw new Error("reject_workflow_step payload missing log_id");
  const supabase = getServiceSupabase();
  const log = await loadPendingStepLog(payload.log_id);

  if (log.confirmed_at || log.executed_at) {
    if ((log.delivery_data as { rejected?: boolean } | null)?.rejected) return; // already rejected — idempotent
    throw new Error(`conflict: step log ${payload.log_id} was already sent/confirmed in the app — cannot reject`);
  }

  const approverUserId = await resolveApproverUserId(payload.rejected_by);
  const { error } = await supabase
    .from("workflow_step_logs")
    .update({
      confirmed_by: approverUserId,
      confirmed_at: new Date().toISOString(),
      delivery_data: { queued: false, rejected: true, rejectedBy: payload.rejected_by, source: "mastersuite_native" },
    })
    .eq("id", payload.log_id)
    .is("confirmed_at", null);
  if (error) throw new Error(`step log reject update failed: ${error.message}`);
}

/**
 * Task toggle replay — mirror of lib/tasks/sync.ts updateTask (which backs the
 * app's PUT task route): flip completed/completed_at on the Supabase row, then
 * best-effort push the same flag to GHL. Idempotent: already at the requested
 * state means no Supabase write (GHL push still runs — it's a no-op there too).
 */
async function applyToggleTask(payload: ToggleTaskPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("id, completed, ghl_task_id, ghl_contact_id")
    .eq("id", payload.task_id)
    .maybeSingle();
  if (readError) throw new Error(`task read failed: ${readError.message}`);
  if (!task) throw new Error(`task ${payload.task_id} not found in Supabase`);

  const now = new Date().toISOString();
  if (task.completed !== payload.completed) {
    const { error: updError } = await supabase
      .from("tasks")
      .update({
        completed: payload.completed,
        completed_at: payload.completed ? now : null,
        updated_at: now,
      })
      .eq("id", payload.task_id);
    if (updError) throw new Error(`task update failed: ${updError.message}`);
  }

  // Best-effort GHL sync — placeholder pto_ contacts and unsynced tasks skip.
  const ghlContactId = payload.ghl_contact_id ?? (task.ghl_contact_id as string | null);
  if (!task.ghl_task_id || !ghlContactId || ghlContactId.startsWith("pto_")) return;
  try {
    await ghl.updateTask(ghlContactId, task.ghl_task_id as string, { completed: payload.completed });
  } catch (err) {
    console.error("[apply-native-writes] GHL task update failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Sub-task log replay. completed=true: insert the log with MasterSuite's
 * minted id (the push then upserts onto the native row), same row shape and
 * attribution as the app's log route — state_advance "second" completes a
 * two-state sub-task. completed=false: soft-delete the live log(s) for
 * (state, sub_task), matching the app's DELETE /api/sub-task-logs behavior.
 * Idempotent both ways: insert skipped if the id or a live (state, sub_task)
 * log already exists; deleting an absent log matches zero rows.
 */
async function applySubTaskLog(payload: SubTaskLogPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  if (payload.completed) {
    const { data: byId, error: idError } = await supabase
      .from("contact_sub_task_logs")
      .select("id")
      .eq("id", payload.log_id)
      .maybeSingle();
    if (idError) throw new Error(`log read failed: ${idError.message}`);

    if (!byId) {
      const { data: existing } = await supabase
        .from("contact_sub_task_logs")
        .select("id")
        .eq("journey_pipeline_state_id", payload.state_id)
        .eq("sub_task_id", payload.sub_task_id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        const { data: subTask } = await supabase
          .from("pipeline_sub_tasks")
          .select("state_type")
          .eq("id", payload.sub_task_id)
          .maybeSingle();

        const { error: insError } = await supabase.from("contact_sub_task_logs").insert({
          id: payload.log_id,
          journey_pipeline_state_id: payload.state_id,
          sub_task_id: payload.sub_task_id,
          logger_user_id: null,
          source: "manual",
          state_advance: subTask?.state_type === "two_state" ? "second" : null,
          content_type: "note",
          content_text: attributed(payload.note, payload.logged_by),
          created_at: now,
        });
        if (insError && !insError.message.includes("duplicate")) {
          throw new Error(`sub-task log insert failed: ${insError.message}`);
        }
      }
    }
  } else {
    // Un-complete: soft-delete like the app route (deleted_at, never a hard delete).
    // Prefer the exact log_id MasterSuite recorded; fall back to matching by
    // (state, sub_task) only if that row is already gone or already deleted.
    const { data: byId, error: idDelError } = await supabase
      .from("contact_sub_task_logs")
      .update({ deleted_at: now })
      .eq("id", payload.log_id)
      .is("deleted_at", null)
      .select("id");
    if (idDelError) throw new Error(`sub-task log delete failed: ${idDelError.message}`);

    if (!byId || byId.length === 0) {
      const { error: delError } = await supabase
        .from("contact_sub_task_logs")
        .update({ deleted_at: now })
        .eq("journey_pipeline_state_id", payload.state_id)
        .eq("sub_task_id", payload.sub_task_id)
        .is("deleted_at", null);
      if (delError) throw new Error(`sub-task log delete failed: ${delError.message}`);
    }
  }

  try {
    await markJourneyBriefStale(payload.journey_id);
  } catch {
    /* cosmetic */
  }
}

/**
 * Workflow status replay — the PATCH route's status change with an optimistic
 * from_status guard. Transition validity was enforced at the source; here the
 * only question is whether the app moved the workflow since. Conflict rule
 * matches advance_stage: fail the journal row, the push restores MySQL.
 */
async function applyWorkflowStatus(payload: WorkflowStatusPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const { data: workflow, error: readError } = await supabase
    .from("workflows")
    .select("id, status")
    .eq("id", payload.workflow_id)
    .maybeSingle();
  if (readError) throw new Error(`workflow read failed: ${readError.message}`);
  if (!workflow) throw new Error(`workflow ${payload.workflow_id} not found in Supabase`);
  if (workflow.status === payload.to_status) return; // already there — idempotent
  if (workflow.status !== payload.from_status)
    throw new Error(
      `conflict: workflow is '${workflow.status}', expected '${payload.from_status}' — changed in the app since`
    );

  const { error: updError } = await supabase
    .from("workflows")
    .update({ status: payload.to_status, updated_at: new Date().toISOString() })
    .eq("id", payload.workflow_id)
    .eq("status", payload.from_status); // optimistic guard
  if (updError) throw new Error(`workflow update failed: ${updError.message}`);
}

/**
 * Contact-create replay — the full /api/contacts/create flow with the ids
 * MasterSuite minted. GHL upsert runs first (dedup by email/phone; an existing
 * GHL contact still lands on OUR minted Supabase row, storing the returned
 * ghl_contact_id), then contacts/journeys/journey_contacts/journey_pipeline_state
 * insert with those exact ids so the push upserts onto the native rows.
 * Follow-ups (workflow trigger, retro-link calls, EOS seed, research agent)
 * are best-effort like the route. Idempotent: every insert is existence-guarded,
 * so a partially failed row can be safely re-run.
 */
async function applyCreateContact(payload: CreateContactPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { data: existingContact, error: readError } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .eq("id", payload.contact_id)
    .maybeSingle();
  if (readError) throw new Error(`contact read failed: ${readError.message}`);

  let ghlContactId = (existingContact?.ghl_contact_id as string | null) ?? null;

  if (!existingContact) {
    // 1. GHL first — required, like the route. Dedup is GHL's (email/phone).
    const ghlResult = await ghl.upsertContact({
      firstName: payload.first_name,
      lastName: payload.last_name,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phone ? { phone: payload.phone } : {}),
      ...(payload.city ? { city: payload.city } : {}),
      ...(payload.state ? { state: payload.state } : {}),
      ...(payload.source ? { source: payload.source } : {}),
    });
    ghlContactId = ghlResult.contact.id;

    // 2. Supabase mirror with the minted id (id precheck above covers re-runs,
    // so a duplicate here means the GHL contact is already mirrored under a
    // different row — a real conflict worth failing on).
    const { error: insError } = await supabase.from("contacts").insert({
      id: payload.contact_id,
      ghl_contact_id: ghlContactId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      opportunity_source: payload.source ?? null,
      sub_source: payload.sub_source ?? null,
      last_synced_at: now,
    });
    if (insError) throw new Error(`contacts insert failed: ${insError.message}`);
  }

  // 3. Journey + primary membership with minted ids.
  const { data: existingJourney } = await supabase
    .from("journeys")
    .select("id")
    .eq("id", payload.journey_id)
    .maybeSingle();
  if (!existingJourney) {
    const { error: jError } = await supabase.from("journeys").insert({
      id: payload.journey_id,
      primary_contact_id: payload.contact_id,
      name: payload.journey_name,
      slug: payload.journey_slug,
      status: "active",
    });
    if (jError && !jError.message.includes("duplicate")) throw new Error(`journey insert failed: ${jError.message}`);
  }

  const { data: existingMember } = await supabase
    .from("journey_contacts")
    .select("id")
    .eq("id", payload.journey_contact_id)
    .maybeSingle();
  if (!existingMember) {
    const { error: mError } = await supabase.from("journey_contacts").insert({
      id: payload.journey_contact_id,
      journey_id: payload.journey_id,
      contact_id: payload.contact_id,
      role: "primary",
    });
    if (mError && !mError.message.includes("duplicate") && !mError.message.includes("uniq_active_journey_contact")) {
      throw new Error(`journey member insert failed: ${mError.message}`);
    }
  }

  // 4. Sales pipeline → first stage, single NULL-territory jps row, minted id.
  const { data: existingState } = await supabase
    .from("journey_pipeline_state")
    .select("id")
    .eq("id", payload.state_id)
    .maybeSingle();
  if (!existingState) {
    const { data: salesPipeline } = await supabase.from("pipelines").select("id").eq("slug", "sales").maybeSingle();
    if (!salesPipeline) throw new Error("sales pipeline not found in Supabase");

    const { data: dupState } = await supabase
      .from("journey_pipeline_state")
      .select("id")
      .eq("journey_id", payload.journey_id)
      .eq("pipeline_id", salesPipeline.id)
      .maybeSingle();

    if (!dupState) {
      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", salesPipeline.id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!firstStage) throw new Error("sales first stage not found in Supabase");

      const { data: firstSubTask } = await supabase
        .from("pipeline_sub_tasks")
        .select("id")
        .eq("stage_id", firstStage.id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: chadOwner } = await supabase
        .from("users")
        .select("id")
        .eq("email", "chad@newagainhouses.com")
        .maybeSingle();

      const { error: sError } = await supabase.from("journey_pipeline_state").insert({
        id: payload.state_id,
        journey_id: payload.journey_id,
        TerritorySlug: null,
        pipeline_id: salesPipeline.id,
        current_stage_id: firstStage.id,
        current_sub_task_id: firstSubTask?.id ?? null,
        assigned_user_id: chadOwner?.id ?? null,
        is_active: true,
      });
      if (sError && !sError.message.includes("duplicate")) {
        throw new Error(`pipeline state insert failed: ${sError.message}`);
      }
    }
  }

  // 5. Follow-ups. Trigger + research only on the first pass (fresh contact) so
  // re-runs don't re-enroll workflows; retro-link + EOS seed are inherently
  // idempotent and run every pass. All best-effort like the route.
  if (!existingContact && ghlContactId) {
    try {
      await matchWorkflowTriggers("journey.created", ghlContactId, {
        pipelineName: "Sales — Path to Ownership",
        pipelineSlug: "sales",
        stageName: "Engagement",
        contactName: `${payload.first_name} ${payload.last_name}`.trim(),
      });
    } catch (err) {
      console.error("[apply-native-writes] journey.created trigger failed:", err instanceof Error ? err.message : err);
    }
  }

  try {
    await retroLinkCallsForContact(supabase, payload.contact_id, payload);
  } catch (err) {
    console.error("[apply-native-writes] call retro-link failed:", err instanceof Error ? err.message : err);
  }

  try {
    await supabase
      .from("eos_contact_goals")
      .upsert(
        { contact_id: payload.contact_id, source: "system" },
        { onConflict: "contact_id", ignoreDuplicates: true }
      );
  } catch (err) {
    console.error("[apply-native-writes] EOS goals seed failed:", err instanceof Error ? err.message : err);
  }

  if (!existingContact && ghlContactId && !ghlContactId.startsWith("pto_")) {
    // Non-blocking like the route — the research agent can take minutes.
    runContactResearch(ghlContactId, true).catch((err) => {
      console.error("[apply-native-writes] background research failed:", err instanceof Error ? err.message : err);
    });
  }
}

/** Mirror of the create route's step 4: link existing calls/participants by email or display name. */
async function retroLinkCallsForContact(
  supabase: ReturnType<typeof getServiceSupabase>,
  contactId: string,
  payload: Pick<CreateContactPayload, "first_name" | "last_name" | "email">
): Promise<void> {
  const displayName = `${payload.first_name} ${payload.last_name}`.trim();
  const emailsToLink: string[] = [];

  const contactEmail = payload.email?.trim()?.toLowerCase();
  if (contactEmail) emailsToLink.push(contactEmail);

  const { data: relatedPeople } = await supabase
    .from("contact_related_people")
    .select("email")
    .eq("contact_id", contactId)
    .not("email", "is", null);
  for (const rp of relatedPeople ?? []) {
    if (rp.email) {
      const rpEmail = (rp.email as string).trim().toLowerCase();
      if (rpEmail && !emailsToLink.includes(rpEmail)) emailsToLink.push(rpEmail);
    }
  }

  const { data: nameMatchParticipants } = await supabase
    .from("call_participants")
    .select("call_id, email")
    .eq("display_name", displayName)
    .is("contact_id", null);
  for (const p of nameMatchParticipants ?? []) {
    if (p.email) {
      const pEmail = (p.email as string).trim().toLowerCase();
      if (!emailsToLink.includes(pEmail)) emailsToLink.push(pEmail);
    }
  }

  for (const email of emailsToLink) {
    await supabase
      .from("call_participants")
      .update({ contact_id: contactId, role: "prospect", display_name: displayName })
      .eq("email", email)
      .is("contact_id", null);

    const { data: sessions } = await supabase
      .from("read_ai_sessions")
      .select("session_id")
      .contains("participant_emails", [email]);
    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: { session_id: string }) => s.session_id);
      await supabase
        .from("calls")
        .update({ contact_id: contactId })
        .in("read_ai_session_id", sessionIds)
        .is("contact_id", null);
    }
  }
}

/**
 * Contact field-update replay — the PATCH route's phone/email path. Phone
 * patches contacts directly; a new primary email routes through contact_emails
 * (the trigger keeps contacts.email in sync). GHL sync is best-effort. Both
 * writes are naturally idempotent.
 */
async function applyUpdateContact(payload: UpdateContactPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const phone = payload.phone?.trim() || null;
  const email = payload.email?.trim() || null;
  if (!phone && !email) return; // nothing to patch

  if (email) {
    await supabase
      .from("contact_emails")
      .update({ is_primary: false })
      .eq("contact_id", payload.contact_id)
      .eq("is_primary", true);
    const { error: emailError } = await supabase
      .from("contact_emails")
      .upsert(
        { contact_id: payload.contact_id, email, is_primary: true, source: "manual" },
        { onConflict: "contact_id,email" }
      );
    if (emailError) throw new Error(`contact_emails upsert failed: ${emailError.message}`);
  }

  if (phone) {
    const { error } = await supabase.from("contacts").update({ phone }).eq("id", payload.contact_id);
    if (error) throw new Error(`contact update failed: ${error.message}`);
  }

  // Best-effort GHL sync (the PATCH route's ghlFields block — including email,
  // which the journal payload carries directly).
  const ghlFields: Record<string, string> = {};
  if (phone) ghlFields.phone = phone;
  if (email) ghlFields.email = email;

  let ghlContactId = payload.ghl_contact_id;
  if (!ghlContactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("ghl_contact_id")
      .eq("id", payload.contact_id)
      .maybeSingle();
    ghlContactId = (contact?.ghl_contact_id as string | null) ?? null;
  }
  if (!ghlContactId || ghlContactId.startsWith("pto_")) return;
  try {
    await ghl.updateContact(ghlContactId, ghlFields);
  } catch (err) {
    console.error("[apply-native-writes] GHL contact sync failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Replay MasterSuite's Profile-tab inline edit into `contact_profile_fields`.
 *
 * MasterSuite already resolved the name against its own catalog before writing, and all
 * 212 of its catalog fields were diffed against this app's 224-field registry — so a
 * well-formed journal row always passes `isValidFieldName`. It is still checked here:
 * the two catalogs are separate lists that can drift, and a name this app does not know
 * would otherwise land an unreadable row in the EAV table instead of a named failure on
 * the journal row.
 *
 * `field_value: null` CLEARS the field rather than storing JSON `null`, matching what
 * MasterSuite stores (SQL NULL) — reads filter on `field_value is not null`, so only a
 * real null makes a "n of m filled" count fall on either side.
 *
 * `source: "ai-auto"` rows come from the native post-call agent's auto-save, not the
 * Profile tab. They keep their `ai-auto` label (labeling them "manual" would make the
 * manual-protection rule freeze them against every future auto-save), and they never
 * overwrite a value a human typed — the agent checked the mirror, but a same-day manual
 * edit here may not have pushed back yet.
 */
async function applyUpdateProfileField(payload: UpdateProfileFieldPayload): Promise<void> {
  if (!isValidFieldName(payload.field_name)) {
    throw new Error(
      `Unknown profile field '${payload.field_name}' — MasterSuite's catalog and this app's field registry have drifted`
    );
  }

  const supabase = getServiceSupabase();
  const value = payload.field_value?.trim() ? payload.field_value.trim() : null;
  const isAiAuto = payload.source === "ai-auto";

  if (isAiAuto) {
    const { data: existing, error: readError } = await supabase
      .from("contact_profile_fields")
      .select("last_updated_by")
      .eq("contact_id", payload.contact_id)
      .eq("field_name", payload.field_name)
      .maybeSingle();
    if (readError) throw new Error(`contact_profile_fields read failed: ${readError.message}`);
    if (existing?.last_updated_by === "manual") return; // manual wins, silently
  }

  const { error } = await supabase.from("contact_profile_fields").upsert(
    {
      contact_id: payload.contact_id,
      field_name: payload.field_name,
      field_value: value === null ? null : JSON.stringify(value),
      last_updated_by: isAiAuto ? "ai-auto" : "manual",
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id,field_name" }
  );
  if (error) throw new Error(`contact_profile_fields upsert failed: ${error.message}`);
}

/**
 * Replay MasterSuite's journey rename into `journeys.name`.
 *
 * ⚠ There is no `name_custom` column here — that flag is MasterSuite-only (its migration
 * 244), and it is what makes a hand-typed name win over the derived one. The push maps
 * only columns both sides share, so `NameCustom` is never in its UPDATE clause and
 * survives untouched. Without this handler, though, `Name` IS shared: the rename failed
 * replay, the push wrote the old Supabase name back over it, and `NameCustom = 1` then
 * made the page display that stale name with full confidence.
 */
async function applyRenameJourney(payload: RenameJourneyPayload): Promise<void> {
  const name = payload.name?.trim();
  if (!name) throw new Error("rename_journey carried an empty name");

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("journeys").update({ name }).eq("id", payload.journey_id);
  if (error) throw new Error(`journey rename failed: ${error.message}`);
}

/**
 * Replay MasterSuite's drag-retype on the CallsV2 board into `calls.call_type_id`.
 *
 * The slug is resolved to an id FIRST and an unknown one throws, because `call_type_id`
 * is NOT NULL app-side (migration 20260420000200) — the same reason MasterSuite resolves
 * before it writes. A typo must fail the journal row loudly, not null the column.
 */
async function applySetCallType(payload: SetCallTypePayload): Promise<void> {
  const supabase = getServiceSupabase();
  const slug = payload.type_slug?.trim();
  if (!slug) throw new Error("set_call_type carried an empty slug");

  const { id } = await resolveCallTypeBySlug(supabase, slug);
  if (!id) throw new Error(`Unknown call type slug '${slug}'`);

  const { error } = await supabase.from("calls").update({ call_type_id: id }).eq("id", payload.call_id);
  if (error) throw new Error(`call retype failed: ${error.message}`);
}

/**
 * Replay MasterSuite's Personal EOS add box (its T8) into `eos_contact_issues` /
 * `eos_contact_todos`.
 *
 * ⚠ The id comes from the payload, not from `gen_random_uuid()`. MasterSuite already wrote
 * the row into its mirror with that id; minting a second one here would leave the nightly
 * push inserting a duplicate beside the native row instead of upserting onto it. Same id
 * discipline as `create_task` and `sub_task_log`.
 *
 * Idempotent: an upsert on the primary key, so replaying the same journal row twice is a
 * no-op rather than a second issue.
 */
async function applyCreateEosItem(payload: CreateEosItemPayload): Promise<void> {
  if (payload.kind !== "issue" && payload.kind !== "todo") {
    throw new Error(`create_eos_item carried an unknown kind '${payload.kind}'`);
  }
  const text = payload.text?.trim();
  if (!text) throw new Error("create_eos_item carried empty text");

  const supabase = getServiceSupabase();
  const table = payload.kind === "issue" ? "eos_contact_issues" : "eos_contact_todos";
  const textColumn = payload.kind === "issue" ? "issue_text" : "todo_text";

  const { error } = await supabase.from(table).upsert(
    {
      id: payload.item_id,
      contact_id: payload.contact_id,
      [textColumn]: text,
      is_done: false,
      source: "manual",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
}

/**
 * Replay MasterSuite's EOS habit add into `eos_contact_habits`.
 *
 * ⚠ `cadence` carries a CHECK constraint here — `('daily','weekly','biweekly','monthly',
 * 'quarterly')` — that the mirror's plain `varchar(16)` does not. MasterSuite normalises
 * before it writes (its dropdown says "Bi-weekly"), and this checks again: the two lists
 * are separate copies, and a drift would otherwise surface as a raw Postgres constraint
 * error on a row that already looks saved on the page.
 *
 * `grade` is left unset — the CHECK allows only A–D and F, so a never-reviewed habit has
 * no value to write.
 */
const HABIT_CADENCES = new Set(["daily", "weekly", "biweekly", "monthly", "quarterly"]);

async function applyCreateEosHabit(payload: CreateEosHabitPayload): Promise<void> {
  const text = payload.habit_text?.trim();
  if (!text) throw new Error("create_eos_habit carried empty text");
  if (!HABIT_CADENCES.has(payload.cadence)) {
    throw new Error(
      `create_eos_habit carried cadence '${payload.cadence}', which eos_contact_habits.cadence would reject`
    );
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("eos_contact_habits").upsert(
    {
      id: payload.habit_id,
      contact_id: payload.contact_id,
      habit_text: text,
      cadence: payload.cadence,
      source: "manual",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`eos_contact_habits insert failed: ${error.message}`);
}

/**
 * Replay MasterSuite's Ecosystem "Add stakeholder" into `territory_stakeholders`.
 *
 * ⚠ The COLUMN is `TerritorySlug`, not `ms_slug`. Migration 20260509000000 renamed
 * `ms_slug` -> `"TerritorySlug"` across territory_stakeholders, territory_owners and
 * fifteen other tables, to match MasterSuite's naming. The payload KEY is still `ms_slug`
 * because that is what MasterSuite already emits; only the column moved. Every live query
 * confirms it — e.g. lib/calls/resolve-participants.ts selects "TerritorySlug".
 */
async function applyCreateStakeholder(payload: CreateStakeholderPayload): Promise<void> {
  if (!payload.first_name?.trim()) throw new Error("create_stakeholder carried no name");
  if (!payload.ms_slug) throw new Error("create_stakeholder carried no territory");

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("territory_stakeholders").upsert(
    {
      id: payload.stakeholder_id,
      TerritorySlug: payload.ms_slug,
      first_name: payload.first_name.trim(),
      last_name: payload.last_name?.trim() || null,
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      company: payload.company?.trim() || null,
      role: payload.role,
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`territory_stakeholders insert failed: ${error.message}`);
}

/**
 * Replay MasterSuite's stakeholder removal.
 *
 * ⚠ A soft delete — `is_active = false`, matching what MasterSuite writes and what both
 * reads filter on. A hard DELETE here would diverge from the mirror, and the next push
 * (an upsert-by-PK) would put the row back.
 */
async function applyRemoveStakeholder(payload: RemoveStakeholderPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("territory_stakeholders")
    .update({ is_active: false })
    .eq("id", payload.stakeholder_id);
  if (error) throw new Error(`territory_stakeholders remove failed: ${error.message}`);
}

/**
 * Replay MasterSuite's "Retire journey" — `journeys.status` to `archived`.
 *
 * ⚠ `archived` is one of only three values the CHECK allows (active / archived / closed).
 * "Retired" and "inactive" are the words people use; `archived` is what the column takes.
 */
async function applyArchiveJourney(payload: ArchiveJourneyPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("journeys").update({ status: "archived" }).eq("id", payload.journey_id);
  if (error) throw new Error(`journey archive failed: ${error.message}`);
}

/**
 * Replay MasterSuite's "Delete journey" — a real delete, matching the property delete.
 *
 * ⚠ Only the parent row is deleted here. Unlike MasterSuite's mirror, which has no foreign
 * keys and has to remove each child by hand, Supabase declares these relationships with
 * ON DELETE CASCADE — so the children go with it. Deleting them individually first would
 * be redundant and would risk diverging from whatever the schema actually cascades.
 *
 * ⚠ MasterSuite refuses to delete an ACTIVE journey or one that still holds calls. This
 * re-checks the status rather than trusting the payload, because a journey can have been
 * reactivated in the app between the native write and this replay.
 */
async function applyDeleteJourney(payload: DeleteJourneyPayload): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: current } = await supabase.from("journeys").select("status").eq("id", payload.journey_id).maybeSingle();

  if (!current) return; // already gone — replaying a delete twice is a no-op

  if (current.status === "active") {
    throw new Error(
      `journey ${payload.journey_id} is active in the app — it was reactivated after MasterSuite queued the delete`
    );
  }

  const { error } = await supabase.from("journeys").delete().eq("id", payload.journey_id);
  if (error) throw new Error(`journey delete failed: ${error.message}`);
}

/**
 * Replay MasterSuite's "Retire territory" — `territories.status` to `inactive`.
 *
 * ⚠ The column is `TerritorySlug` on both sides — `territories.ms_slug` was renamed by
 * migration 20260509000000. Only the payload KEY still says ms_slug.
 */
async function applyRetireTerritory(payload: RetireTerritoryPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("territories")
    .update({ status: "inactive" })
    .eq("TerritorySlug", payload.ms_slug);
  if (error) throw new Error(`territory retire failed: ${error.message}`);
}

/**
 * Replay MasterSuite's territory transfer.
 *
 * ⚠ Two writes in one action, and the ORDER matters: end-date the sitting owner, then add
 * the new one. Both sides filter "current owner" on `end_date is null`, so doing it the
 * other way round leaves a window where the territory has two current owners — and the
 * territory header picks one of them arbitrarily.
 *
 * ⚠ The outgoing owner is KEPT, end-dated (Corey). Deleting them would lose the ownership
 * history the `end_date` column exists to record.
 */
async function applyTransferTerritory(payload: TransferTerritoryPayload): Promise<void> {
  const supabase = getServiceSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { error: endError } = await supabase
    .from("territory_owners")
    .update({ end_date: today })
    .eq("TerritorySlug", payload.ms_slug)
    .is("end_date", null);
  if (endError) throw new Error(`ending the previous owner failed: ${endError.message}`);

  const { error: addError } = await supabase.from("territory_owners").upsert(
    {
      id: payload.owner_id,
      TerritorySlug: payload.ms_slug,
      // ⚠ contact_id was added later (migration 20260511200000) precisely so a territory
      // lookup does not need a GHL round-trip. Both are written: ghl_contact_id still
      // carries a real FK to contacts(ghl_contact_id).
      contact_id: payload.new_contact_id,
      ghl_contact_id: payload.new_ghl_contact_id,
      role: "owner",
      start_date: today,
      end_date: null,
      transfer_notes: payload.notes,
    },
    { onConflict: "id" }
  );
  if (addError) throw new Error(`adding the new owner failed: ${addError.message}`);
}

function attributed(text: string | null, username: string): string {
  const suffix = `(via MasterSuite by ${username})`;
  return text ? `${text} ${suffix}` : suffix;
}

// ── Notes ───────────────────────────────────────────────────────────────────
//
// The journey / territory / contact triangle Corey settled on 2026-08-08. The panel has been
// on all three record pages with Wired = false since the record-page rebuild because FranDev
// had nowhere to put a note a PERSON wrote — contact_journals is the AI's daily summary, and
// contacts.notes is one free-text column with no author, no history and no delete.
//
// Store shipped 2026-08-09: supabase/migrations/20260809000000_create_notes.sql (app),
// 2026-08-09-246_FrandevNotes.sql (mirror), plus the push list entry beside them.

/** The one target column each scope is allowed to set — mirrors the table's CHECK. */
const NOTE_SCOPES = new Set(["journey", "territory", "contact"]);

/**
 * Replay MasterSuite's "Add note".
 *
 * ⚠ The id comes from the payload. MasterSuite already wrote the row into `frandev_note`
 * with that id; minting a new one here would leave the nightly push inserting a duplicate
 * beside the native row rather than upserting onto it. Same id discipline as create_task,
 * sub_task_log and create_eos_item.
 *
 * ⚠ The scope/target pairing is checked HERE rather than left to the CHECK constraint, so a
 * malformed payload fails with a sentence naming the mismatch instead of a raw Postgres
 * constraint dump on a row that already looks saved on the page.
 *
 * ⚠ `TerritorySlug` is PascalCase on BOTH sides — migration 20260509000000 renamed ms_slug
 * across seventeen tables. Only the payload KEY still says ms_slug, matching create_stakeholder
 * and retire_territory. Getting this wrong is what broke applyCreateStakeholder in #692.
 *
 * Idempotent: an upsert on the primary key, so replaying the same journal row twice is a
 * no-op rather than a second note.
 */
async function applyCreateNote(payload: CreateNotePayload): Promise<void> {
  if (!NOTE_SCOPES.has(payload.scope)) {
    throw new Error(`create_note carried an unknown scope '${payload.scope}'`);
  }
  const body = payload.body?.trim();
  if (!body) throw new Error("create_note carried an empty body");
  if (!payload.author_email?.trim()) throw new Error("create_note carried no author");

  // Exactly one target, and it must be the one `scope` names.
  const target = {
    journey: payload.journey_id,
    contact: payload.contact_id,
    territory: payload.ms_slug,
  }[payload.scope];
  if (!target) {
    throw new Error(`create_note scope '${payload.scope}' carried no matching id`);
  }
  const others = [payload.journey_id, payload.contact_id, payload.ms_slug].filter(Boolean);
  if (others.length > 1) {
    throw new Error(
      `create_note carried ${others.length} targets — a note lives on exactly one record, and notes_exactly_one_target would reject it`
    );
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase.from("notes").upsert(
    {
      id: payload.note_id,
      scope: payload.scope,
      journey_id: payload.scope === "journey" ? payload.journey_id : null,
      contact_id: payload.scope === "contact" ? payload.contact_id : null,
      TerritorySlug: payload.scope === "territory" ? payload.ms_slug : null,
      body,
      author_email: payload.author_email.trim(),
      author_name: payload.author_name,
      source: payload.source || "manual",
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`note insert failed: ${error.message}`);
}

/**
 * Replay an edit. "Anyone can edit or delete" (Corey), so there is no author check — only a
 * record of who touched it.
 *
 * ⚠ Deliberately NOT an upsert. An update against a note that no longer exists must not
 * resurrect it as a fresh row with a null scope, which is exactly what an upsert would do
 * and what the CHECK would then reject. A missing row is a no-op, matching applyDeleteJourney.
 */
async function applyUpdateNote(payload: UpdateNotePayload): Promise<void> {
  const body = payload.body?.trim();
  if (!body) throw new Error("update_note carried an empty body");

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("notes")
    .update({
      body,
      edited_at: new Date().toISOString(),
      edited_by: payload.edited_by,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.note_id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`note update failed: ${error.message}`);
  // Already deleted, or never here. Not an error: the note is gone either way, and failing
  // would park the row as `failed` forever with nothing anyone can do about it.
  if (!data || data.length === 0) return;
}

/**
 * Replay a delete — SOFT, always.
 *
 * ⚠ Do NOT change this to a row delete. The nightly push (lib/mastersuite/push-frandev.ts)
 * is an upsert-by-primary-key and cannot express a removal, so a hard delete would clear the
 * note here and leave it in frandev_note forever. `deleted_at` is how a delete crosses the
 * fold, the same reason ghl_appointments carries one.
 *
 * Idempotent: deleting an already-deleted note changes nothing.
 */
async function applyDeleteNote(payload: DeleteNotePayload): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("notes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: payload.deleted_by,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.note_id)
    .is("deleted_at", null);
  if (error) throw new Error(`note delete failed: ${error.message}`);
}

// ─── Contact lifecycle: MasterSuite's Merge + Delete buttons (walkthrough Merge ×2 +
//     Delete contact, 2026-08-09). Merge replays through lib/contacts/merge.ts — the
//     SAME extracted function the app's own merge route runs, so there is exactly one
//     merge implementation. Delete follows the journey-delete discipline: it can only
//     reach a merged-away duplicate or an untouched record.

/**
 * Replay MasterSuite's Merge.
 *
 * Idempotent by outcome: if the dup is ALREADY merged into this exact keeper (a retried
 * journal row, or the same merge performed app-side first), that is success, not an
 * error. Merged into a DIFFERENT contact is a real conflict and parks the row failed.
 *
 * ⚠ mergeContact marks the dup LAST, so a partial first run (some step failed after
 * mark_merged never ran) retries cleanly — every reassignment is a no-op the second
 * time. If mark_merged DID run and an earlier step had failed, the retry lands in the
 * alreadyMergedIntoKeeper branch; the first run's step failures were already reported.
 */
async function applyMergeContact(payload: MergeContactPayload): Promise<void> {
  if (!payload.dup_contact_id || !payload.keep_contact_id) {
    throw new Error("merge_contact payload missing dup_contact_id/keep_contact_id");
  }
  const result = await mergeContact(
    payload.dup_contact_id,
    payload.keep_contact_id,
    payload.reason || `Merged in MasterSuite by ${payload.requested_by}`
  );
  if (!result.ok) {
    if (result.alreadyMergedIntoKeeper) return; // replay of an applied merge — done
    throw new Error(`merge_contact failed: ${result.error}`);
  }
  const failed = result.steps.filter((s) => !s.ok && s.step !== "ghl_keeper_note" && s.step !== "ghl_dup_tag");
  if (failed.length > 0) {
    throw new Error(
      `merge_contact applied with failing steps: ${failed.map((s) => `${s.step} (${s.detail ?? "failed"})`).join("; ")}`
    );
  }
}

/**
 * The known contact_id children this app's schema owns, deleted before the contact row.
 * ⚠ journey_contacts carries ON DELETE RESTRICT — the guard below refuses any contact
 * that still holds journeys or calls UNLESS it is a merged-away duplicate, and a merge
 * has already MOVED those rows to the keeper, so what remains here is the residue the
 * merge deliberately leaves on the dup.
 */
const DELETE_CONTACT_CHILD_TABLES = [
  "contact_emails",
  "contact_profile_fields",
  "contact_briefs",
  "journey_contacts",
  "eos_contact_issues",
  "eos_contact_todos",
  "eos_contact_habits",
  "eos_contact_goals",
  "candidate_intelligence",
  "candidate_score_history",
  "call_action_items",
  "call_data_extractions",
  "objection_registry",
  "contact_team_members",
  "contact_related_people",
];

/**
 * Replay MasterSuite's Delete contact.
 *
 * ⚠ The app deliberately has NO contact-delete route, and journey_contacts carries
 * ON DELETE RESTRICT — the schema forbids deleting a contact that belongs to a journey.
 * So this refuses anything that is not (a) a merged-away duplicate or (b) a record with
 * no journeys and no calls. Same shape as DeleteJourney's "only the duplicate/merged
 * case Corey authorised".
 *
 * GHL is NOT touched: the client exposes no contact delete, and GHL is the comms record
 * — the app never deletes there.
 *
 * Idempotent: a contact that is already gone is a no-op.
 */
async function applyDeleteContact(payload: DeleteContactPayload): Promise<void> {
  if (!payload.contact_id) throw new Error("delete_contact payload missing contact_id");
  const supabase = getServiceSupabase();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, merged_into_contact_id")
    .eq("id", payload.contact_id)
    .maybeSingle();
  if (!contact) return; // already gone

  if (!contact.merged_into_contact_id) {
    const [{ count: primaries }, { count: memberships }, { count: calls }] = await Promise.all([
      supabase
        .from("journeys")
        .select("id", { count: "exact", head: true })
        .eq("primary_contact_id", payload.contact_id),
      supabase
        .from("journey_contacts")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", payload.contact_id),
      supabase.from("calls").select("id", { count: "exact", head: true }).eq("contact_id", payload.contact_id),
    ]);
    const held = (primaries ?? 0) + (memberships ?? 0) + (calls ?? 0);
    if (held > 0) {
      throw new Error(
        `delete_contact refused: the contact still holds ${primaries ?? 0} journeys, ` +
          `${memberships ?? 0} memberships and ${calls ?? 0} calls, and is not a merged-away duplicate`
      );
    }
  }

  for (const table of DELETE_CONTACT_CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq("contact_id", payload.contact_id);
    if (error) throw new Error(`delete_contact: clearing ${table} failed: ${error.message}`);
  }

  const { error: delError } = await supabase.from("contacts").delete().eq("id", payload.contact_id);
  // A foreign key this list does not know about names itself in the error — that is the
  // honest failure mode for a schema that grows: the row parks failed with the
  // constraint's name, not a silent partial delete.
  if (delError) throw new Error(`delete_contact: contact row delete failed: ${delError.message}`);
}
