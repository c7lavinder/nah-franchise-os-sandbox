/**
 * Backfill Commitments — Phase 9
 *
 * Extracts commitments from all existing call transcripts using Haiku.
 * Writes to call_data_extractions (commitments category) then processes
 * them into the commitments table via process-commitments.ts.
 *
 * Usage: npx tsx scripts/backfill-commitments.ts [--dry-run]
 *
 * Estimated cost: ~$2 for 70 transcripts via Haiku.
 */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import ws from "ws";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error("Missing required env vars. Run: source .env.local && npx tsx scripts/backfill-commitments.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws as any },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const DRY_RUN = process.argv.includes("--dry-run");
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You extract commitments from franchise sales call transcripts.
A commitment is a specific promise or pledge made by either party (rep or contact).

For each commitment found, return a JSON object with these fields:
- commitment_text: the specific promise (e.g., "send FDD by Friday")
- commitment_due_date: ISO date if mentioned, relative timeframe if not, null if none
- commitment_type: one of: document, follow_up, decision, consultation, information, action
- committed_by_role: "rep" or "contact"

What counts: "I'll send you the FDD", "Let me follow up next week", "I'll have a decision by Friday"
What doesn't count: vague interest ("sounds good"), past actions ("I sent it yesterday"), questions

Return JSON: { "commitments": [...] }
If no commitments found, return: { "commitments": [] }
Return only valid JSON. No preamble, no markdown fences.`;

interface CommitmentExtraction {
  commitment_text: string;
  commitment_due_date: string | null;
  commitment_type: string;
  committed_by_role: string;
}

async function extractCommitments(transcript: string): Promise<CommitmentExtraction[]> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Extract all commitments from this transcript:\n\n${transcript}` }],
  });

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return [];

  try {
    const cleaned = text
      .trim()
      .replace(/^```\w*\s*\n?/i, "")
      .replace(/\n?```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { commitments?: CommitmentExtraction[] };
    return parsed.commitments ?? [];
  } catch {
    console.error("  Failed to parse response");
    return [];
  }
}

function parseDueDate(raw: string | null): string | null {
  if (!raw) return null;
  const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  // For relative dates, skip — they're relative to the call date, not today
  return null;
}

async function main() {
  console.log(`Backfill Commitments${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log("=".repeat(50));

  // Fetch all calls with transcripts
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, contact_id, title, started_at")
    .not("ai_summary_generated_at", "is", null)
    .order("started_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch calls:", error.message);
    process.exit(1);
  }

  console.log(`Found ${calls.length} processed calls`);

  // Filter out calls that already have commitments
  const { data: existingCommitments } = await supabase.from("commitments").select("call_id");

  const existingCallIds = new Set((existingCommitments ?? []).map((c) => c.call_id));
  const callsToProcess = calls.filter((c) => !existingCallIds.has(c.id));

  console.log(`${callsToProcess.length} calls need commitment extraction (${existingCallIds.size} already done)`);

  let totalCommitments = 0;
  let callsProcessed = 0;
  let callsSkipped = 0;

  const validTypes = new Set(["document", "follow_up", "decision", "consultation", "information", "action", "other"]);

  for (const call of callsToProcess) {
    // Get transcript
    const { data: transcriptRow } = await supabase
      .from("call_transcripts")
      .select("full_text")
      .eq("call_id", call.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const transcript = transcriptRow?.full_text;
    if (!transcript || transcript.length < 200) {
      callsSkipped++;
      continue;
    }

    console.log(
      `\n[${callsProcessed + 1}/${callsToProcess.length}] ${call.title ?? call.id} (${call.started_at?.split("T")[0] ?? "?"})`
    );

    const commitments = await extractCommitments(transcript);

    if (commitments.length === 0) {
      console.log("  No commitments found");
      callsProcessed++;
      continue;
    }

    console.log(`  Found ${commitments.length} commitments`);

    if (DRY_RUN) {
      for (const c of commitments) {
        console.log(
          `    [${c.committed_by_role}] ${c.commitment_text} (type: ${c.commitment_type}, due: ${c.commitment_due_date ?? "none"})`
        );
      }
      totalCommitments += commitments.length;
      callsProcessed++;
      continue;
    }

    // Write to commitments table directly (skip call_data_extractions for backfill)
    const rows = commitments.map((c) => ({
      call_id: call.id,
      contact_id: call.contact_id,
      commitment_text: c.commitment_text,
      committed_by: c.committed_by_role ?? null,
      due_date: parseDueDate(c.commitment_due_date),
      commitment_type: c.commitment_type && validTypes.has(c.commitment_type) ? c.commitment_type : "other",
      status: "pending" as const,
    }));

    const { error: insertErr } = await supabase.from("commitments").insert(rows);
    if (insertErr) {
      console.error(`  Insert failed: ${insertErr.message}`);
    } else {
      totalCommitments += commitments.length;
      console.log(`  Saved ${commitments.length} commitments`);
    }

    callsProcessed++;

    // Rate limiting — 1s between calls to stay within Haiku limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Done. ${callsProcessed} calls processed, ${callsSkipped} skipped (no transcript)`);
  console.log(`Total commitments extracted: ${totalCommitments}`);
  if (DRY_RUN) console.log("(DRY RUN — nothing written to database)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
