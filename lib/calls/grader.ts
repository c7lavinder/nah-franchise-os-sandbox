/**
 * Scout call grading — rubric-driven grading via Claude.
 * Reads rubric criteria from DB, builds structured prompt, returns grades.
 */

import { createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

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
    .select("id, call_type_id, contact_id, duration_seconds")
    .eq("id", callId)
    .single();
  if (!call) throw new Error("Call not found");

  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!transcript) throw new Error("No transcript found for this call");

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
    .select("id, name, description, weight")
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

    const { data: cps } = await supabase
      .from("contact_pipeline_state")
      .select("current_stage_id, pipeline_stages (name)")
      .eq("contact_id", call.contact_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (cps) {
      const stage = (cps.pipeline_stages as unknown) as { name: string } | null;
      stageName = stage?.name ?? "";
    }
  }

  // Build prompt
  const criteriaBlock = criteria.map((c, i) =>
    `${i + 1}. **${c.name}** (weight: ${c.weight})${c.description ? ` — ${c.description}` : ""}`
  ).join("\n");

  const prompt = `You are Scout, an expert franchise sales coach for New Again Houses. Grade this call using the rubric below.

CALL CONTEXT:
- Contact: ${contactName}
- Pipeline stage: ${stageName || "Unknown"}
- Duration: ${call.duration_seconds ? `${Math.round(call.duration_seconds / 60)} minutes` : "Unknown"}

RUBRIC CRITERIA:
${criteriaBlock}

TRANSCRIPT:
${transcript.full_text}

INSTRUCTIONS:
- For each criterion, provide: grade (A/B/C/D/F), numeric score (0-100), and rationale grounded in specific quotes or moments from the transcript.
- Provide an overall grade (A/B/C/D/F) and overall score (0-100) as a weighted average.
- List exactly 3 strengths and 3 areas for improvement.
- Suggest one specific next action for the rep.
- Do NOT invent content not in the transcript.
- Be critical but fair.

Respond with ONLY valid JSON matching this schema:
{
  "overallGrade": "A|B|C|D|F",
  "overallScore": 0-100,
  "criterionScores": [
    { "criterionId": "uuid", "name": "string", "grade": "A|B|C|D|F", "score": 0-100, "rationale": "string" }
  ],
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "suggestedNextAction": "string"
}

Use these criterion IDs:
${criteria.map((c) => `- ${c.id}: ${c.name}`).join("\n")}`;

  // Call Claude
  const model = process.env.SCOUT_MODEL ?? "claude-sonnet-4-6-20250514";
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
