/**
 * Rep Journal Generator
 *
 * Generates daily AI summaries for each active rep.
 * Called by the 11pm cron job.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";

const REP_JOURNAL_PROMPT = `You are Scout, the AI brain of the New Again Houses franchise sales platform.
Generate a daily performance journal for this franchise development rep.

Be encouraging but honest. Include:
- Brief summary of today's activity
- Coaching notes: patterns you noticed (positive or concerning)
- Focus suggestion for tomorrow (1-2 sentences)

Format as 2-3 concise paragraphs.`;

export async function generateRepJournal(
  userId: string,
  date: string
): Promise<string | null> {
  const supabase = createServerClient();
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  // Count sub-task logs by this user today
  const { count: subTaskCount } = await supabase
    .from("contact_sub_task_logs")
    .select("id", { count: "exact", head: true })
    .eq("logged_by_user_id", userId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .is("deleted_at", null);

  // Count calls hosted by this user today
  const { count: callCount } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("hosted_by_user_id", userId)
    .eq("status", "completed")
    .gte("started_at", startOfDay)
    .lte("started_at", endOfDay);

  // Count distinct contacts touched
  const { data: contactsTouched } = await supabase
    .from("contact_sub_task_logs")
    .select("contact_id")
    .eq("logged_by_user_id", userId)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .is("deleted_at", null);
  const uniqueContacts = new Set(
    (contactsTouched ?? []).map((r) => r.contact_id)
  ).size;

  // Count Scout actions for this user
  const { count: ghlActionCount } = await supabase
    .from("scout_action_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_status", "executed")
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay);

  // Skip if no activity
  const totalActivity =
    (subTaskCount ?? 0) + (callCount ?? 0) + (ghlActionCount ?? 0);
  if (totalActivity === 0) {
    return null;
  }

  // Get user name
  const { data: user } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .single();

  // Generate via Claude
  const anthropic = new Anthropic();
  const activitySummary = {
    rep_name: user?.full_name ?? "Unknown",
    date,
    contacts_touched: uniqueContacts,
    calls_completed: callCount ?? 0,
    sub_tasks_logged: subTaskCount ?? 0,
    ghl_actions_fired: ghlActionCount ?? 0,
  };

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `${REP_JOURNAL_PROMPT}\n\nActivity data:\n${JSON.stringify(activitySummary, null, 2)}`,
      },
    ],
  });

  const fullResponse =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse coaching notes and focus (simple split on double newline)
  const paragraphs = fullResponse.split(/\n\n+/);
  const summary = paragraphs[0] ?? fullResponse;
  const coachingNotes = paragraphs[1] ?? null;
  const focusTomorrow = paragraphs[2] ?? null;

  const { data: journal, error } = await supabase
    .from("rep_journals")
    .upsert(
      {
        user_id: userId,
        journal_date: date,
        summary,
        contacts_touched: uniqueContacts,
        calls_completed: callCount ?? 0,
        sub_tasks_logged: subTaskCount ?? 0,
        ghl_actions_fired: ghlActionCount ?? 0,
        coaching_notes: coachingNotes,
        focus_tomorrow: focusTomorrow,
      },
      { onConflict: "user_id,journal_date" }
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save rep journal: ${error.message}`);
  }

  return journal.id;
}

/**
 * Run rep journal generation for all active users.
 */
export async function runRepJournalCron(
  date?: string
): Promise<{ processed: number; skipped: number; failed: number }> {
  const supabase = createServerClient();
  const journalDate = date ?? new Date().toISOString().split("T")[0];

  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  const results = { processed: 0, skipped: 0, failed: 0 };

  for (const user of users ?? []) {
    try {
      const journalId = await generateRepJournal(user.id, journalDate);
      if (journalId) {
        results.processed++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Rep journal failed for ${user.id}: ${msg}`);
    }
  }

  return results;
}
