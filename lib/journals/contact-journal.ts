/**
 * Contact Journal Generator
 *
 * Generates daily AI summaries for contacts that had any interaction today.
 * Called by the 11pm cron job.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { embedJournalEntry } from "@/lib/rag/embedder";

const JOURNAL_PROMPT = `You are Scout, the AI brain of the New Again Houses franchise sales platform.
Generate a structured daily journal entry for this contact based on today's interactions.

Be concise and factual. Focus on:
- Key events that happened today
- New information learned about this contact
- Changes in engagement or sentiment
- Action items or follow-ups needed

Format your response as a brief paragraph (3-5 sentences) summarizing the day's activity.`;

interface DayInteraction {
  type: string;
  timestamp: string;
  key_signals: string[];
  sub_task_logged?: string;
  action_taken?: string;
}

export async function generateContactJournal(
  contactId: string,
  date: string
): Promise<string | null> {
  const supabase = createServerClient();

  // Gather today's activity for this contact
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  // Fetch sub-task logs
  const { data: subTaskLogs } = await supabase
    .from("contact_sub_task_logs")
    .select("id, sub_task_id, content_type, content, logged_by_user_id, created_at")
    .eq("contact_id", contactId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .is("deleted_at", null);

  // Fetch stage history changes
  const { data: stageChanges } = await supabase
    .from("pipeline_stage_history")
    .select("id, from_stage_id, to_stage_id, moved_by_user_id, reason, created_at")
    .eq("contact_id", contactId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);

  // Fetch calls
  const { data: calls } = await supabase
    .from("calls")
    .select("id, call_type_id, status, duration_seconds, started_at")
    .eq("contact_id", contactId)
    .gte("started_at", startOfDay)
    .lte("started_at", endOfDay);

  // Fetch Scout action logs
  const { data: scoutActions } = await supabase
    .from("scout_action_logs")
    .select("id, action_type, action_status, created_at")
    .eq("ghl_contact_id", contactId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);

  // Build interactions array
  const interactions: DayInteraction[] = [];

  for (const log of subTaskLogs ?? []) {
    interactions.push({
      type: "sub_task_log",
      timestamp: log.created_at,
      key_signals: [log.content_type, log.content?.substring(0, 200) ?? ""].filter(Boolean),
      sub_task_logged: log.sub_task_id,
    });
  }

  for (const change of stageChanges ?? []) {
    interactions.push({
      type: "stage_change",
      timestamp: change.created_at,
      key_signals: [`Stage move: ${change.from_stage_id} → ${change.to_stage_id}`, change.reason].filter(Boolean),
    });
  }

  for (const call of calls ?? []) {
    interactions.push({
      type: "call",
      timestamp: call.started_at ?? call.id,
      key_signals: [`Call status: ${call.status}`, `Duration: ${call.duration_seconds ?? 0}s`],
    });
  }

  for (const action of scoutActions ?? []) {
    interactions.push({
      type: "scout_action",
      timestamp: action.created_at,
      key_signals: [`${action.action_type}: ${action.action_status}`],
      action_taken: action.action_type,
    });
  }

  // Skip if no interactions today
  if (interactions.length === 0) {
    return null;
  }

  // Generate summary via Claude
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `${JOURNAL_PROMPT}\n\nContact ID: ${contactId}\nDate: ${date}\n\nToday's interactions:\n${JSON.stringify(interactions, null, 2)}`,
      },
    ],
  });

  const summary =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Upsert journal entry
  const { data: journal, error } = await supabase
    .from("contact_journals")
    .upsert(
      {
        contact_id: contactId,
        journal_date: date,
        summary,
        interactions: interactions,
        signals_extracted: [],
      },
      { onConflict: "contact_id,journal_date" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save contact journal: ${error.message}`);
  }

  // Embed the journal entry
  try {
    await embedJournalEntry(journal.id);
  } catch (embedErr) {
    // Log but don't fail — embedding is secondary
    const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
    console.error(`Failed to embed journal ${journal.id}: ${msg}`);
  }

  return journal.id;
}

/**
 * Run contact journal generation for all contacts with activity today.
 */
export async function runContactJournalCron(
  date?: string
): Promise<{ processed: number; skipped: number; failed: number }> {
  const supabase = createServerClient();
  const journalDate = date ?? new Date().toISOString().split("T")[0];
  const startOfDay = `${journalDate}T00:00:00Z`;
  const endOfDay = `${journalDate}T23:59:59Z`;

  // Find all contacts with activity today
  const contactIds = new Set<string>();

  // From sub-task logs
  const { data: stLogs } = await supabase
    .from("contact_sub_task_logs")
    .select("contact_id")
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .is("deleted_at", null);
  for (const row of stLogs ?? []) contactIds.add(row.contact_id);

  // From calls
  const { data: callRows } = await supabase
    .from("calls")
    .select("contact_id")
    .gte("started_at", startOfDay)
    .lte("started_at", endOfDay)
    .not("contact_id", "is", null);
  for (const row of callRows ?? []) {
    if (row.contact_id) contactIds.add(row.contact_id);
  }

  // From stage history
  const { data: histRows } = await supabase
    .from("pipeline_stage_history")
    .select("contact_id")
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);
  for (const row of histRows ?? []) contactIds.add(row.contact_id);

  const results = { processed: 0, skipped: 0, failed: 0 };

  for (const contactId of contactIds) {
    try {
      const journalId = await generateContactJournal(contactId, journalDate);
      if (journalId) {
        results.processed++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Contact journal failed for ${contactId}: ${msg}`);
    }
  }

  return results;
}
