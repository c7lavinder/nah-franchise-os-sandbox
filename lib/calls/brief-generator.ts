/**
 * Pre-Call Brief Generator — 8 Sections
 *
 * Generates a comprehensive pre-call brief by pulling from:
 * - Contact profile (199 fields)
 * - Pipeline state (stage, sub-tasks)
 * - Contact journals (recent activity)
 * - Call transcripts (via RAG)
 * - KB docs (sales methodology)
 * - Prediction scores
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { retrieveContext, formatContextForPrompt } from "@/lib/rag/retriever";
import { getContactProfileFields } from "@/lib/profile/profile-fields";
import { getSuggestionContext } from "@/lib/scout-learning";

export interface PreCallBrief {
  contactId: string;
  contactName: string;
  callType: string;
  generatedAt: string;
  sections: {
    whoIsThis: string;
    whereTheyAre: string;
    whatHappenedLast: string;
    openConcerns: string;
    whatToAccomplish: string;
    howTheyCompare: string;
    predictionSnapshot: string;
    suggestedOpening: string;
  };
}

export async function generatePreCallBrief(
  contactId: string,
  callType: string
): Promise<PreCallBrief> {
  const supabase = createServerClient();

  // Get contact name
  const { data: contact } = await supabase
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", contactId)
    .single();
  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "Unknown";

  // Retrieve rich context + learning context
  const [context, profileFields, learningContext] = await Promise.all([
    retrieveContext(`Pre-call brief for ${callType} with ${contactName}`, {
      contactId,
      contentTypes: ["transcript", "journal", "kb_doc"],
      limit: 15,
      includeStructured: true,
    }),
    getContactProfileFields(contactId),
    getSuggestionContext(callType),
  ]);

  // Extract key profile values
  const pv = (name: string) => {
    const f = profileFields[name];
    if (!f || f.field_value == null) return null;
    try {
      return typeof f.field_value === "string" ? JSON.parse(f.field_value) : f.field_value;
    } catch {
      return f.field_value;
    }
  };

  const contextStr = formatContextForPrompt(context);

  const prompt = `You are Scout, the AI brain of the New Again Houses franchise sales platform.
Generate a pre-call brief for an upcoming ${callType} with ${contactName}.
${learningContext ? `\n${learningContext}\n` : ""}
CONTEXT DATA:
${contextStr}

KEY PROFILE FIELDS:
- DISC Type: ${pv("disc_type") ?? "Unknown"}
- Occupation: ${pv("current_occupation") ?? "Unknown"}
- Liquid Capital: ${pv("liquid_capital_available") ?? "Unknown"}
- Zorakle Fit Score: ${pv("zorakle_fit_score") ?? "Unknown"}
- Communication Style: ${pv("communication_style") ?? "Unknown"}
- Close Probability: ${pv("Predicted Close Probability") ?? "Unknown"}
- Ghost Risk: ${pv("ghost_risk") ?? "Unknown"}
- Primary Objection: ${pv("capital_objection") ?? pv("timing_objection") ?? "None identified"}
- Key Sticking Point: ${pv("key_sticking_point") ?? "None identified"}

Generate exactly 8 sections. For each section, write 2-4 sentences maximum. Be specific and actionable.

Respond with ONLY valid JSON:
{
  "whoIsThis": "Section 1 — who they are, personality, key facts",
  "whereTheyAre": "Section 2 — pipeline stage, progress, days in stage",
  "whatHappenedLast": "Section 3 — last interaction summary, commitments",
  "openConcerns": "Section 4 — unresolved objections, flags",
  "whatToAccomplish": "Section 5 — stage goal, 3 recommended questions, data gaps",
  "howTheyCompare": "Section 6 — comparison to successful franchisees",
  "predictionSnapshot": "Section 7 — close probability, trends, risk scores",
  "suggestedOpening": "Section 8 — 2-3 sentence opener for the call"
}`;

  const model = process.env.SCOUT_MODEL ?? "claude-sonnet-4-5-20250514";
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to generate brief — no JSON in response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as PreCallBrief["sections"];

  // Store brief
  const { error } = await supabase.from("system_logs").insert({
    action_type: "pre_call_brief",
    contact_id: contactId,
    input_params: { callType, contactName },
    result_summary: `Generated ${callType} brief for ${contactName}`,
    was_auto: false,
  });
  if (error) {
    console.error("Failed to log brief generation:", error.message);
  }

  return {
    contactId,
    contactName,
    callType,
    generatedAt: new Date().toISOString(),
    sections: parsed,
  };
}
