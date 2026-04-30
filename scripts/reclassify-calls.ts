/**
 * Re-run post-call agent on all calls to fix misclassified call types.
 * The LLM reads each transcript and assigns the correct call type.
 *
 * Run: source .env.local && npx tsx scripts/reclassify-calls.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

// Inline the summary classification logic to avoid importing the full agent
// (which needs Next.js module resolution). Instead, call Claude directly.
async function classifyCall(
  callId: string,
  transcript: string,
  currentType: string | null,
  teamMembers: string[],
  contactNames: string[],
  territoryNames: string[],
  duration: number | null,
  callDate: string | null
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY required");

  const participantInfo = [
    teamMembers.length > 0 ? `NAH Team: ${teamMembers.join(", ")}` : null,
    contactNames.length > 0 ? `External: ${contactNames.join(", ")}` : null,
    territoryNames.length > 0 ? `Territories: ${territoryNames.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Classify this call into exactly ONE type. Return ONLY the slug, nothing else.

Types:
- intro_call: First call with a new prospect. Chad introduces NAH.
- matt_call: Discovery/deep-dive with Matt. Financials, motivation.
- sam_call: Validation with Sam. Territory research, market fit.
- mark_call: Lending/capital with Mark. SBA, ROBS, funding.
- territory_call: Territory selection discussion.
- fdd_review: Franchise Disclosure Document review.
- matt_final_call: Matt's final qualification call.
- onboarding_call: Post-award franchisee — setup, training, launch prep.
- coaching_call: Active franchisee coaching — operations, deals. Also franchisee employees.
- group_call: 3+ external participants from different franchises.
- cohort_call: Scheduled group session with multiple franchisees.
- team_call: Internal NAH team meeting only.
- unclassified: Cannot determine.

Rules:
- Converted franchisee (territory awarded, going through setup) → onboarding_call
- Active franchisee (operating, discussing deals) → coaching_call
- Franchisee employee → coaching_call
- All NAH team, no externals → team_call
- 3+ external from different companies → group_call

${participantInfo}
Duration: ${duration ? `${Math.round(duration / 60)}m` : "?"}
Date: ${callDate ?? "?"}
Current type: ${currentType ?? "unknown"}

Transcript (first 3000 chars):
${transcript.slice(0, 3000)}

Reply with ONLY the slug (e.g. "coaching_call"). Nothing else.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.log(`  Claude error: ${res.status}`);
    return null;
  }

  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content?.[0]?.text?.trim() ?? null;
  return text;
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all calls with transcripts
  const { data: calls } = await supabase
    .from("calls")
    .select("id, call_type_id, duration_seconds, started_at, contact_id, raw_transcript")
    .not("raw_transcript", "is", null)
    .order("started_at", { ascending: false });

  if (!calls?.length) {
    console.log("No calls with transcripts found.");
    return;
  }

  // Also get calls with transcripts in call_transcripts table
  const { data: transcriptCalls } = await supabase
    .from("call_transcripts")
    .select("call_id, full_text")
    .order("created_at", { ascending: false });

  const transcriptMap = new Map<string, string>();
  for (const t of transcriptCalls ?? []) {
    if (!transcriptMap.has(t.call_id)) transcriptMap.set(t.call_id, t.full_text);
  }

  // Load call types for slug lookup
  const { data: callTypes } = await supabase.from("call_types").select("id, slug, name");
  const typeIdToSlug = new Map((callTypes ?? []).map((ct) => [ct.id, ct.slug]));
  const slugToId = new Map((callTypes ?? []).map((ct) => [ct.slug, ct.id]));

  console.log(`Found ${calls.length} calls. Reclassifying...\n`);

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const transcript = transcriptMap.get(call.id) ?? call.raw_transcript ?? "";
    if (!transcript || transcript.length < 50) {
      console.log(`[${i + 1}/${calls.length}] ${call.id} — skipped (no/short transcript)`);
      continue;
    }

    const currentSlug = call.call_type_id ? (typeIdToSlug.get(call.call_type_id) ?? "unknown") : "unknown";

    // Get participants
    const { data: participants } = await supabase
      .from("call_participants")
      .select("display_name, role")
      .eq("call_id", call.id);

    const teamMembers = (participants ?? []).filter((p) => p.role === "nah_team").map((p) => p.display_name ?? "");
    const contactNames = (participants ?? []).filter((p) => p.role !== "nah_team").map((p) => p.display_name ?? "");

    // Get territories
    const { data: territories } = await supabase
      .from("call_territories")
      .select("territory_ms_slug, territories ( territory_name )")
      .eq("call_id", call.id);
    const territoryNames = (territories ?? []).map((t) => {
      const terr = Array.isArray(t.territories) ? t.territories[0] : t.territories;
      return (terr as { territory_name: string } | null)?.territory_name ?? t.territory_ms_slug;
    });

    const newSlug = await classifyCall(
      call.id,
      transcript,
      currentSlug,
      teamMembers,
      contactNames,
      territoryNames,
      call.duration_seconds,
      call.started_at
    );

    if (!newSlug || !slugToId.has(newSlug)) {
      console.log(`[${i + 1}/${calls.length}] ${call.id} — failed (got: ${newSlug})`);
      failed++;
      continue;
    }

    if (newSlug === currentSlug) {
      console.log(`[${i + 1}/${calls.length}] ${call.id} — unchanged (${currentSlug})`);
      unchanged++;
    } else {
      const newId = slugToId.get(newSlug)!;
      await supabase.from("calls").update({ call_type_id: newId }).eq("id", call.id);
      console.log(`[${i + 1}/${calls.length}] ${call.id} — ${currentSlug} → ${newSlug}`);
      changed++;
    }

    // Rate limit: 1 call per second
    if (i < calls.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone: ${changed} changed, ${unchanged} unchanged, ${failed} failed`);
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
