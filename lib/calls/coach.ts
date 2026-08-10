/**
 * Scout call coaching — uses knowledge base + transcript + grade to produce coaching.
 */

import { createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export interface CoachingResult {
  coachingNotes: string;
  coachingPlan: string;
  kbSnippetsUsed: string[];
}

export async function coachCall(callId: string): Promise<CoachingResult> {
  const supabase = createServerClient();

  // Fetch call
  const { data: call } = await supabase
    .from("calls")
    .select("id, call_type_id, contact_id, hosted_by_user_id, raw_transcript")
    .eq("id", callId)
    .single();
  if (!call) throw new Error("Call not found");

  // Fetch transcript — prefer call_transcripts, fall back to raw_transcript on calls
  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const transcriptText = transcript?.full_text ?? call.raw_transcript;
  if (!transcriptText) throw new Error("No transcript found");

  // Fetch grade if exists
  const { data: grade } = await supabase
    .from("call_grades")
    .select("overall_grade, overall_score, strengths, improvements, suggested_next_action")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch contact context
  let contactContext = "";
  if (call.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name")
      .eq("id", call.contact_id)
      .single();
    if (contact) contactContext = `Contact: ${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
  }

  // Fetch relevant KB documents (existing knowledge_documents table)
  // Get call type name for relevance matching
  let callTypeName = "";
  if (call.call_type_id) {
    const { data: ct } = await supabase.from("call_types").select("name").eq("id", call.call_type_id).single();
    callTypeName = ct?.name ?? "";
  }

  const { data: kbDocs } = await supabase
    .from("knowledge_documents")
    .select("id, title, content, category")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(10);

  const kbSnippets = (kbDocs ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    snippet: d.content.length > 500 ? d.content.slice(0, 500) + "..." : d.content,
  }));

  const kbBlock =
    kbSnippets.length > 0
      ? kbSnippets.map((s, i) => `[KB${i + 1}: ${s.title}]\n${s.snippet}`).join("\n\n")
      : "No knowledge base documents available.";

  const gradeBlock = grade
    ? `GRADE SUMMARY:
- Overall: ${grade.overall_grade} (${grade.overall_score}/100)
- Strengths: ${((grade.strengths as string[]) ?? []).join(", ")}
- Improvements: ${((grade.improvements as string[]) ?? []).join(", ")}
- Suggested next: ${grade.suggested_next_action ?? "N/A"}`
    : "No grade available yet.";

  const prompt = `You are Scout, an expert franchise sales coach for New Again Houses. Generate personalized coaching for this call.

${contactContext}
Call type: ${callTypeName || "Unknown"}

${gradeBlock}

KNOWLEDGE BASE CONTEXT:
${kbBlock}

TRANSCRIPT:
${transcriptText}

INSTRUCTIONS:
- Produce coaching notes: specific, actionable feedback referencing moments in the transcript.
- Produce a coaching plan: 3-5 concrete steps the rep should take to improve, ordered by priority.
- Reference KB materials where relevant (cite by title).
- Be constructive and specific — no vague advice.
- Ground all coaching in the transcript content.

Respond with ONLY valid JSON:
{
  "coachingNotes": "string (detailed coaching feedback)",
  "coachingPlan": "string (numbered action steps)",
  "kbReferencedTitles": ["string"]
}`;

  const model = process.env.SCOUT_MODEL ?? "claude-haiku-4-5-20251001";
  const anthropic = new Anthropic();

  let parsed: { coachingNotes: string; coachingPlan: string; kbReferencedTitles?: string[] };
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Scout coaching failed:", err);
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Scout coaching failed after retry");
    parsed = JSON.parse(jsonMatch[0]);
  }

  // Map referenced KB titles back to IDs
  const referencedIds = kbSnippets
    .filter((s) => (parsed.kbReferencedTitles ?? []).some((t) => s.title.toLowerCase().includes(t.toLowerCase())))
    .map((s) => s.id);

  // Persistence lives on call_review_packages (via generateReviewPackage);
  // the legacy call_coaching table was dropped — nothing ever read it.
  return {
    coachingNotes: parsed.coachingNotes,
    coachingPlan: parsed.coachingPlan,
    kbSnippetsUsed: referencedIds,
  };
}
