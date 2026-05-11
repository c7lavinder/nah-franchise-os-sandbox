export const dynamic = "force-dynamic";

/**
 * POST /api/admin/backfill-sessions
 *
 * One-time backfill: reconstructs Scout conversation sessions from llm_call_logs.
 * Groups log entries by user + time proximity (30-min gap = new session),
 * then creates session records for any conversations not already captured.
 *
 * Admin-only. Idempotent — safe to run multiple times.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/** Gap in minutes between LLM calls that signals a new session */
const SESSION_GAP_MINUTES = 30;

/** Max chars for a tool result stored in conversation history */
const MAX_TOOL_RESULT_CHARS = 2000;

interface LLMLogRow {
  id: string;
  user_id: string;
  model: string;
  input_messages: any[];
  output_content: any[];
  tool_calls: string[];
  iteration: number;
  created_at: string;
  error_message: string | null;
}

interface ReconstructedSession {
  user_id: string;
  conversation_history: any[];
  started_at: string;
  last_activity_at: string;
  log_count: number;
}

/**
 * Cap tool result content to prevent oversized JSONB.
 */
function capToolResults(history: any[]): any[] {
  return history.map((msg: any) => {
    if (msg.role !== "user" || !Array.isArray(msg.content)) return msg;
    const hasToolResult = msg.content.some((b: any) => b.type === "tool_result");
    if (!hasToolResult) return msg;

    return {
      ...msg,
      content: msg.content.map((block: any) => {
        if (block.type !== "tool_result") return block;
        const content = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
        if (content.length <= MAX_TOOL_RESULT_CHARS) return block;
        return {
          ...block,
          content: content.slice(0, MAX_TOOL_RESULT_CHARS) + `\n...[capped from ${content.length} chars]`,
        };
      }),
    };
  });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();

  // 1. Fetch ALL llm_call_logs, ordered by user + time
  //    Use pagination to handle large datasets
  const allLogs: LLMLogRow[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from("llm_call_logs")
      .select("id, user_id, model, input_messages, output_content, tool_calls, iteration, created_at, error_message")
      .order("user_id", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      return NextResponse.json({ error: `Failed to fetch logs: ${error.message}` }, { status: 500 });
    }

    if (!batch || batch.length === 0) break;
    allLogs.push(...(batch as LLMLogRow[]));
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  if (allLogs.length === 0) {
    return NextResponse.json({ message: "No LLM logs found", created: 0, skipped: 0 });
  }

  // 2. Group logs into sessions by user + time gap
  const sessions: ReconstructedSession[] = [];
  let currentGroup: LLMLogRow[] = [];
  let currentUserId = "";

  for (const log of allLogs) {
    if (!log.user_id) continue; // Skip system-initiated calls

    if (log.user_id !== currentUserId) {
      // New user — flush current group
      if (currentGroup.length > 0) {
        const session = buildSessionFromGroup(currentGroup);
        if (session) sessions.push(session);
      }
      currentGroup = [log];
      currentUserId = log.user_id;
      continue;
    }

    // Same user — check time gap
    const lastLog = currentGroup[currentGroup.length - 1];
    const gap = (new Date(log.created_at).getTime() - new Date(lastLog.created_at).getTime()) / 60000;

    if (gap > SESSION_GAP_MINUTES) {
      // Time gap too large — flush and start new group
      const session = buildSessionFromGroup(currentGroup);
      if (session) sessions.push(session);
      currentGroup = [log];
    } else {
      currentGroup.push(log);
    }
  }

  // Flush last group
  if (currentGroup.length > 0) {
    const session = buildSessionFromGroup(currentGroup);
    if (session) sessions.push(session);
  }

  // 3. Check for existing sessions that overlap — avoid duplicates
  const { data: existingSessions } = await supabase
    .from("sessions")
    .select("user_id, started_at, last_activity_at")
    .not("conversation_history", "is", null)
    .not("conversation_history", "eq", "[]");

  const existingSet = new Set(
    (existingSessions ?? []).map((s: any) => `${s.user_id}__${new Date(s.started_at).getTime()}`)
  );

  // Also build time ranges for overlap detection
  const existingRanges = (existingSessions ?? []).map((s: any) => ({
    userId: s.user_id,
    start: new Date(s.started_at).getTime(),
    end: new Date(s.last_activity_at).getTime(),
  }));

  function overlapsExisting(userId: string, startMs: number, endMs: number): boolean {
    return existingRanges.some(
      (r) =>
        r.userId === userId &&
        // Sessions overlap if one starts before the other ends
        startMs <= r.end + SESSION_GAP_MINUTES * 60000 &&
        endMs >= r.start - SESSION_GAP_MINUTES * 60000
    );
  }

  // 4. Insert new sessions
  let created = 0;
  let skipped = 0;

  for (const session of sessions) {
    const startMs = new Date(session.started_at).getTime();
    const endMs = new Date(session.last_activity_at).getTime();

    if (overlapsExisting(session.user_id, startMs, endMs)) {
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase.from("sessions").insert({
      user_id: session.user_id,
      conversation_history: session.conversation_history as unknown as Record<string, unknown>[],
      is_active: false, // Historical sessions — mark inactive
      started_at: session.started_at,
      last_activity_at: session.last_activity_at,
    });

    if (insertErr) {
      console.error(`Backfill session insert failed for ${session.user_id}:`, insertErr.message);
      skipped++;
    } else {
      created++;
    }
  }

  return NextResponse.json({
    message: `Backfill complete`,
    totalLogs: allLogs.length,
    sessionsDetected: sessions.length,
    created,
    skipped,
  });
}

/**
 * Build a session's conversation_history from a group of LLM log entries.
 *
 * Strategy: The last log entry for each "turn" (iteration 1 of a new user message)
 * has the most complete input_messages. We reconstruct by finding the final
 * iteration of each turn and combining input_messages + output_content.
 */
function buildSessionFromGroup(logs: LLMLogRow[]): ReconstructedSession | null {
  if (logs.length === 0) return null;

  // Find the last log entry — its input_messages contains the full conversation
  // up to that point, and its output_content is the final response
  const lastLog = logs[logs.length - 1];

  // Build conversation history: last log's input_messages + its output_content
  const history = [
    ...(Array.isArray(lastLog.input_messages) ? lastLog.input_messages : []),
    { role: "assistant", content: lastLog.output_content },
  ];

  // Cap tool results to prevent oversized storage
  const cappedHistory = capToolResults(history);

  // Need at least a user message and an assistant response
  if (cappedHistory.length < 2) return null;

  return {
    user_id: lastLog.user_id,
    conversation_history: cappedHistory,
    started_at: logs[0].created_at,
    last_activity_at: lastLog.created_at,
    log_count: logs.length,
  };
}
