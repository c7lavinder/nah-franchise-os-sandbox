/**
 * Scout call grading — rubric-driven grading via Claude.
 * Reads rubric criteria from DB, builds structured prompt, returns grades.
 */

import { createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadRubricForCallType, determineCallType } from "@/lib/calls/rubric-loader";

export interface GradeResult {
  overallGrade: string;
  overallScore: number;
  criterionScores: { criterionId: string; name: string; grade: string; score: number; rationale: string }[];
  strengths: string[];
  improvements: string[];
  suggestedNextAction: string;
}

export async function gradeCall(callId: string): Promise<GradeResult> {
  const supabase = createServerClient();

  // Fetch call + transcript
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

  // Fetch rubric + criteria
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

  // Fetch contact context
  let contactName = "Unknown";
  let stageName = "";
  if (call.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (contact) contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown";

    // Phase 4 read migration: source stage from journey_pipeline_state via
    // the journey whose primary is this contact. Any active jps row works for
    // "what stage is this contact in" since runway territories share a stage
    // during the transition period.
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

  // Load KB rubric context for this call type
  const callTypeSlug = await determineCallType(callId);
  const rubricContext = await loadRubricForCallType(callTypeSlug);

  // Build prompt
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

  // Determine call type slug for framing the prompt correctly
  const { data: callTypeRow } = await supabase
    .from("call_types")
    .select("slug, name")
    .eq("id", call.call_type_id)
    .single();
  const slug = callTypeRow?.slug ?? callTypeSlug ?? "unknown";
  const callTypeName = callTypeRow?.name ?? "Call";

  // Frame the grading persona based on call type — prevents sales-oriented
  // language from bleeding into onboarding/coaching/group evaluations.
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

  const prompt = `${persona}

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

  // Call Claude
  const model = process.env.SCOUT_MODEL ?? "claude-haiku-4-5-20251001";
  const anthropic = new Anthropic();

  let parsed: GradeResult;
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON from possible markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    parsed = JSON.parse(jsonMatch[0]) as GradeResult;
  } catch (err) {
    console.error("Scout grading failed:", err);
    // Retry once
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Scout grading failed after retry");
    parsed = JSON.parse(jsonMatch[0]) as GradeResult;
  }

  // Save to DB
  await supabase.from("call_grades").insert({
    call_id: callId,
    rubric_id: rubric.id,
    overall_grade: parsed.overallGrade,
    overall_score: parsed.overallScore,
    criterion_scores: parsed.criterionScores,
    strengths: parsed.strengths,
    improvements: parsed.improvements,
    suggested_next_action: parsed.suggestedNextAction,
    graded_by: "scout",
    scout_model: model,
  });

  return parsed;
}
