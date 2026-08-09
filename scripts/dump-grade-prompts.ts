/**
 * Dump Grade Prompts — §8 step-4 parity validation (read-only).
 *
 * Assembles the EXACT grading prompt gradeCall() would send for each call id
 * given on the command line, without calling the LLM, and prints each prompt's
 * sha256 + writes the full text to a file. The C# port's dev-only probe
 * (POST /api/hooks/read-ai-grade-parity) produces the same hashes from the
 * MariaDB mirror — matching hashes prove the two assemblies are byte-identical
 * on identical data; differing hashes get a byte-diff via the dumped files.
 *
 * The assembly below is a verbatim copy of lib/calls/grader.ts lines 22-180
 * (fetches + prompt template), with the Claude call and the DB write removed.
 * If grader.ts changes, re-copy — this script exists to catch exactly that.
 *
 * Usage: source .env.local && npx tsx scripts/dump-grade-prompts.ts <callId> [...callIds] [--outdir /tmp/prompts]
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import ws from "ws";
import { loadRubricForCallType, determineCallType } from "../lib/calls/rubric-loader";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env. Run: source .env.local && npx tsx scripts/dump-grade-prompts.ts <ids>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws as any },
});

// rubric-loader creates its own client via lib/supabase/server — point it at
// the same env the app uses (createServerClient reads these).
process.env.SUPABASE_URL ??= SUPABASE_URL;

async function buildPrompt(callId: string): Promise<string> {
  const { data: call } = await supabase
    .from("calls")
    .select("id, call_type_id, contact_id, duration_seconds, raw_transcript")
    .eq("id", callId)
    .single();
  if (!call) throw new Error("Call not found");

  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const transcriptText = transcript?.full_text ?? call.raw_transcript;
  if (!transcriptText) throw new Error("No transcript found for this call");

  if (!call.call_type_id) throw new Error("Call has no call type assigned");

  const { data: rubric } = await supabase
    .from("rubrics")
    .select("id, name")
    .eq("call_type_id", call.call_type_id)
    .eq("is_active", true)
    .single();
  if (!rubric) throw new Error("No active rubric for this call type");

  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select(
      "id, name, description, weight, positive_examples, negative_examples, example_phrases_positive, example_phrases_negative"
    )
    .eq("rubric_id", rubric.id)
    .order("sort_order");
  if (!criteria || criteria.length === 0) {
    throw new Error("Rubric not configured — add criteria in Settings before grading");
  }

  let contactName = "Unknown";
  let stageName = "";
  if (call.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (contact) contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown";

    const { data: jps } = await supabase
      .from("journey_pipeline_state")
      .select("current_stage_id, pipeline_stages(name), journeys!inner(primary_contact_id)")
      .eq("journeys.primary_contact_id", call.contact_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (jps) {
      const stage = jps.pipeline_stages as unknown as { name: string } | null;
      stageName = stage?.name ?? "";
    }
  }

  const callTypeSlug = await determineCallType(callId);
  const rubricContext = await loadRubricForCallType(callTypeSlug);

  const criteriaBlock = criteria
    .map((c, i) => {
      let block = `${i + 1}. **${c.name}** (weight: ${c.weight})`;
      if (c.description) block += `\n   Description: ${c.description}`;
      const pos = (c.positive_examples as string[] | null) ?? [];
      const neg = (c.negative_examples as string[] | null) ?? [];
      const phPos = (c.example_phrases_positive as string[] | null) ?? [];
      const phNeg = (c.example_phrases_negative as string[] | null) ?? [];
      if (pos.length > 0) block += `\n   Excellent looks like: ${pos.join("; ")}`;
      if (neg.length > 0) block += `\n   Poor looks like: ${neg.join("; ")}`;
      if (phPos.length > 0) block += `\n   Positive phrases: "${phPos.join('", "')}"`;
      if (phNeg.length > 0) block += `\n   Negative phrases: "${phNeg.join('", "')}"`;
      return block;
    })
    .join("\n\n");

  const { data: callTypeRow } = await supabase
    .from("call_types")
    .select("slug, name")
    .eq("id", call.call_type_id)
    .single();
  const slug = callTypeRow?.slug ?? callTypeSlug ?? "unknown";
  const callTypeName = callTypeRow?.name ?? "Call";

  let persona: string;
  if (slug === "onboarding_call") {
    persona =
      "You are Scout, an expert franchise onboarding specialist for New Again Houses. Grade this onboarding call — focus on whether the new franchisee was set up for success, not on sales conversion.";
  } else if (slug === "coaching_call") {
    persona =
      "You are Scout, an expert franchise performance coach for New Again Houses. Grade this coaching call — focus on accountability, obstacle removal, and the franchisee's highest-leverage constraint, not on sales conversion.";
  } else if (slug === "group_call" || slug === "cohort_call") {
    persona =
      "You are Scout, evaluating a group/cohort session for New Again Houses. Grade this session — focus on content quality, engagement, facilitation, and actionable takeaways.";
  } else if (slug === "team_call") {
    persona =
      "You are Scout, evaluating an internal team meeting for New Again Houses. Grade this meeting — focus on decision quality, action clarity, and time management.";
  } else {
    persona =
      "You are Scout, an expert franchise sales coach for New Again Houses. Grade this sales call using the rubric below.";
  }

  return `${persona}

CALL CONTEXT:
- Call Type: ${callTypeName}
- Contact: ${contactName}
- Pipeline stage: ${stageName || "Unknown"}
- Duration: ${call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} minutes` : "Unknown"}

RUBRIC CRITERIA:
${criteriaBlock}
${rubricContext ? `\nKNOWLEDGE BASE RUBRIC GUIDANCE:\n${rubricContext}\n` : ""}
TRANSCRIPT:
${transcriptText}

INSTRUCTIONS:
- For each criterion, provide: grade (A/B/C/D/F), numeric score (0-100), and a rationale that is ONE concise sentence (max 15 words) citing a specific moment.
- Provide an overall grade (A/B/C/D/F) and overall score (0-100) as a weighted average.
- List 2-3 strengths and 2-3 improvements — each ONE short sentence (max 12 words).
- Suggest one specific next action in one sentence.
- Do NOT invent content not in the transcript.
- Distinguish substance from filler: a real action item or commitment is specific, owned, and time-bound. Casual or tangential talk that fills spare time at the end of a call (e.g. a brief aside on an unrelated process) is neither an action item nor a deficiency — do not list it as a strength or an improvement.
- Be critical but fair. Be concise — every word must earn its place.
${slug === "coaching_call" ? "- For coaching calls, do not default to pipeline criticism. If transcript evidence shows pipeline/deal count is already healthy, score that as context and make the next action about the true bottleneck discussed (cash flow, equity utilization, hiring, operations, marketing, or execution).\n- When a prior commitment was completed but the call identifies a next layer of improvement, describe it as a completed commitment plus refinement, not as a miss." : ""}

Respond with ONLY valid JSON matching this schema:
{
  "overallGrade": "A|B|C|D|F",
  "overallScore": 0-100,
  "criterionScores": [
    { "criterionId": "uuid", "name": "string", "grade": "A|B|C|D|F", "score": 0-100, "rationale": "string (max 15 words)" }
  ],
  "strengths": ["short sentence", "short sentence"],
  "improvements": ["short sentence", "short sentence"],
  "suggestedNextAction": "one sentence"
}

Use these criterion IDs:
${criteria.map((c) => `- ${c.id}: ${c.name}`).join("\n")}`;
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--outdir");
  const outdir = outIdx >= 0 ? args[outIdx + 1] : "/tmp/grade-prompts-ts";
  const ids = args.filter((a, i) => !a.startsWith("--") && i !== outIdx + 1);
  if (ids.length === 0) {
    console.error("Pass at least one call id.");
    process.exit(1);
  }
  mkdirSync(outdir, { recursive: true });

  for (const id of ids) {
    try {
      const prompt = await buildPrompt(id);
      const sha = createHash("sha256").update(prompt, "utf8").digest("hex");
      writeFileSync(join(outdir, `${id}.txt`), prompt, "utf8");
      console.log(`${id} sha256=${sha} chars=${prompt.length}`);
    } catch (err) {
      console.log(`${id} ERROR ${err instanceof Error ? err.message : err}`);
    }
  }
}

void main();
