/**
 * Profile Extractor
 *
 * Extracts profile data points from call transcripts and returns
 * suggested field updates for review by the rep (Edit / Skip / Push).
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { PROFILE_FIELDS } from "@/lib/profile/field-registry";
import { getSuggestionContext } from "@/lib/scout-learning";
import { getContactProfileFields } from "@/lib/profile/profile-fields";

export interface ProfileSuggestion {
  field_name: string;
  field_label: string;
  current_value: unknown;
  suggested_value: unknown;
  confidence: "high" | "medium" | "low";
  source_quote: string;
  outcome?: "accepted" | "edited" | "skipped";
}

const EXTRACT_PROMPT = `You are Scout, the AI brain of the New Again Houses franchise sales platform.
Extract profile data points from this call transcript that should update the contact's profile.

IMPORTANT RULES:
- Only extract facts explicitly stated or strongly implied in the transcript
- Do NOT guess or infer — if it's not clearly in the transcript, skip it
- Include the exact quote from the transcript that supports each suggestion
- Cap at 10 suggestions maximum, prioritized by confidence
- Focus on: goals, objections, financial signals, personality, background, motivation, timeline, concerns, territory preferences

Available profile fields (use exact field_name values):
FIELD_LIST

Current profile values for this contact:
CURRENT_PROFILE

Respond with ONLY valid JSON matching this schema:
{
  "suggestions": [
    {
      "field_name": "exact_field_name_from_list",
      "suggested_value": "the value extracted",
      "confidence": "high|medium|low",
      "source_quote": "exact quote from transcript"
    }
  ]
}`;

export async function extractProfileUpdates(
  transcriptText: string,
  contactId: string
): Promise<ProfileSuggestion[]> {
  // Build field list for prompt
  const fieldList = PROFILE_FIELDS
    .filter((f) => f.source === "scout" || f.source === "manual")
    .map((f) => `  ${f.name}: ${f.label} (${f.dataType}${f.options ? ` — options: ${f.options.join(", ")}` : ""})`)
    .join("\n");

  // Get current profile values
  const currentFields = await getContactProfileFields(contactId);
  const currentProfile = Object.entries(currentFields)
    .filter(([, v]) => v.field_value !== null)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v.field_value)}`)
    .join("\n") || "  (no profile data yet)";

  // Inject learning context before generating suggestions
  const learningCtx = await getSuggestionContext("general");
  const prompt = EXTRACT_PROMPT
    .replace("FIELD_LIST", fieldList)
    .replace("CURRENT_PROFILE", currentProfile)
    + (learningCtx ? `\n\n${learningCtx}` : "");

  const model = process.env.SCOUT_MODEL ?? "claude-sonnet-4-5-20250514";
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nTRANSCRIPT:\n${transcriptText}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as {
    suggestions: Array<{
      field_name: string;
      suggested_value: unknown;
      confidence: "high" | "medium" | "low";
      source_quote: string;
    }>;
  };

  // Map to full suggestions with labels and current values
  return (parsed.suggestions ?? [])
    .filter((s) => PROFILE_FIELDS.some((f) => f.name === s.field_name))
    .slice(0, 10)
    .map((s) => {
      const field = PROFILE_FIELDS.find((f) => f.name === s.field_name);
      return {
        field_name: s.field_name,
        field_label: field?.label ?? s.field_name,
        current_value: currentFields[s.field_name]?.field_value ?? null,
        suggested_value: s.suggested_value,
        confidence: s.confidence,
        source_quote: s.source_quote,
      };
    });
}
