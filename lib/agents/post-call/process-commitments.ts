/**
 * Process Commitments — Phase 9 of the Retrieval Brain
 *
 * After extraction writes commitment-category rows to call_data_extractions,
 * this module groups them into structured commitments and inserts into the
 * commitments table.
 *
 * Extraction fields grouped per commitment:
 *   - commitment_text (required)
 *   - commitment_due_date
 *   - commitment_type
 *   - committed_by_role ("rep" | "contact")
 */

import { createServerClient } from "@/lib/supabase/server";

interface ProcessResult {
  created: number;
  skipped: number;
}

export async function processCommitments(
  callId: string,
  contactId: string | null,
  userId: string | null,
  supabase: ReturnType<typeof createServerClient>
): Promise<ProcessResult> {
  const result: ProcessResult = { created: 0, skipped: 0 };

  // Fetch all commitment-category extractions for this call
  const { data: extractions, error } = await supabase
    .from("call_data_extractions")
    .select("id, contact_id, field_key, extracted_value, confidence")
    .eq("call_id", callId)
    .eq("field_category", "commitments")
    .order("created_at", { ascending: true });

  if (error || !extractions || extractions.length === 0) {
    return result;
  }

  // Group extractions into commitments. The LLM emits one row per field
  // (commitment_text, commitment_due_date, commitment_type, committed_by_role)
  // for each commitment. Group by sequential position — each commitment_text
  // starts a new group.
  const groups: Array<{
    text: string;
    dueDate: string | null;
    type: string | null;
    byRole: string | null;
    contactId: string | null;
    extractionId: string;
  }> = [];

  let current: (typeof groups)[number] | null = null;

  for (const ext of extractions) {
    if (!ext.extracted_value) continue;

    if (ext.field_key === "commitment_text") {
      // Start a new commitment group
      if (current) groups.push(current);
      current = {
        text: ext.extracted_value,
        dueDate: null,
        type: null,
        byRole: null,
        contactId: ext.contact_id ?? contactId,
        extractionId: ext.id,
      };
    } else if (current) {
      // Add metadata to the current commitment group
      switch (ext.field_key) {
        case "commitment_due_date":
          current.dueDate = ext.extracted_value;
          break;
        case "commitment_type":
          current.type = ext.extracted_value;
          break;
        case "committed_by_role":
          current.byRole = ext.extracted_value;
          break;
      }
    }
  }
  if (current) groups.push(current);

  if (groups.length === 0) return result;

  // Delete existing commitments for this call (idempotent re-run)
  await supabase.from("commitments").delete().eq("call_id", callId);

  const validTypes = new Set(["document", "follow_up", "decision", "consultation", "information", "action", "other"]);

  const rows = groups.map((g) => ({
    call_id: callId,
    contact_id: g.contactId,
    made_by_user_id: g.byRole === "rep" ? userId : null,
    commitment_text: g.text,
    committed_by: g.byRole ?? null,
    due_date: parseDueDate(g.dueDate),
    commitment_type: g.type && validTypes.has(g.type) ? g.type : "other",
    status: "pending" as const,
    source_extraction_id: g.extractionId,
  }));

  const { error: insertErr } = await supabase.from("commitments").insert(rows);

  if (insertErr) {
    console.error("[process-commitments] insert failed:", insertErr.message);
    result.skipped = rows.length;
    return result;
  }

  result.created = rows.length;
  console.log(`[process-commitments] ${callId}: created ${rows.length} commitments`);
  return result;
}

/**
 * Parse a due date string from the LLM into an ISO date (YYYY-MM-DD) or null.
 * Handles ISO dates, relative phrases like "end of week", "next Tuesday", etc.
 */
function parseDueDate(raw: string | null): string | null {
  if (!raw) return null;

  // Already ISO format
  const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  // Relative date parsing
  const lower = raw.toLowerCase().trim();
  const now = new Date();

  if (lower.includes("today")) {
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("tomorrow")) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("end of week") || lower.includes("this week")) {
    // Next Friday
    const dayOfWeek = now.getDay();
    const daysToFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5;
    now.setDate(now.getDate() + daysToFriday);
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("next week")) {
    now.setDate(now.getDate() + 7);
    return now.toISOString().split("T")[0];
  }

  // "next [day]" pattern
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      const currentDay = now.getDay();
      let daysAhead = i - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      now.setDate(now.getDate() + daysAhead);
      return now.toISOString().split("T")[0];
    }
  }

  // Can't parse — return null, commitment still tracks without a due date
  return null;
}
