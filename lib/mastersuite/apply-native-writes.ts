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
import { markJourneyBriefStale } from "@/lib/briefs/mark-journey-brief-stale";
import { isSubStageMoveLog } from "@/lib/contacts/stage-visual-state";
import * as ghl from "@/lib/ghl";

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

interface CreateTaskPayload {
  task_id: string;
  contact_id: string;
  ghl_contact_id: string | null;
  title: string;
  body: string | null;
  due_date: string | null; // "YYYY-MM-DD HH:MM:SS" or null
  requested_by: string;
}

export interface ApplyResult {
  pending: number;
  applied: number;
  failed: number;
  skipped?: string;
  errors: string[];
}

export async function applyNativeWrites(limit = 50): Promise<ApplyResult> {
  const result: ApplyResult = { pending: 0, applied: 0, failed: 0, errors: [] };
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
      } else if (row.WriteType === "create_task") {
        await applyCreateTask(pool, JSON.parse(row.PayloadJson) as CreateTaskPayload);
      } else {
        throw new Error(`Unknown WriteType '${row.WriteType}'`);
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

function attributed(text: string | null, username: string): string {
  const suffix = `(via MasterSuite by ${username})`;
  return text ? `${text} ${suffix}` : suffix;
}
