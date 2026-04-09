/**
 * Agent 2 — Territory Market Research
 * Uses claude-haiku-4-5-20251001.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { handleDuplicateFieldSuggestion } from "@/lib/scout-learning";

const AGENT_MODEL = "claude-haiku-4-5-20251001";

export async function runTerritoryMarketResearch(
  msSlug: string
): Promise<{ suggestionsCreated: number }> {
  const supabase = createServerClient();

  try {
    const { data: territory } = await supabase
      .from("territories")
      .select("ms_slug, territory_name, region")
      .eq("ms_slug", msSlug)
      .single();

    if (!territory) throw new Error("Territory not found");

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Research the housing/flipping market for territory "${territory.territory_name}" (${msSlug}, region: ${territory.region ?? "unknown"}).

Provide estimates for:
- territory_value_est (numeric estimate)
- market_type (urban/suburban/rural)
- flip_activity_score (1-10)
- competitor_presence (description)
- local_market_notes (brief market summary)

Respond with ONLY valid JSON: { "findings": [{ "field_name": "...", "suggested_value": "...", "confidence": "high|medium|low", "evidence": "..." }] }`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in agent response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      findings: Array<{ field_name: string; suggested_value: string; confidence: string; evidence: string }>;
    };

    let created = 0;
    for (const f of parsed.findings ?? []) {
      await handleDuplicateFieldSuggestion({
        territory_ms_slug: msSlug,
        field_name: f.field_name,
        field_table: "territory_profile",
        suggested_value: f.suggested_value,
        source: "agent_research",
        source_id: `territory-market-${msSlug}`,
        evidence: f.evidence,
        confidence: f.confidence as "high" | "medium" | "low",
      });
      created++;
    }

    await supabase.from("integration_logs").insert({
      integration_name: "territory-market",
      event_type: "research",
      status: "success",
      payload_summary: `${created} suggestions for ${msSlug}`,
      related_ms_slug: msSlug,
    });

    return { suggestionsCreated: created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("integration_logs").insert({
      integration_name: "territory-market",
      event_type: "error",
      status: "failed",
      error_message: msg,
      related_ms_slug: msSlug,
    });
    throw err;
  }
}
