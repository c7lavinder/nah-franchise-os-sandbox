/**
 * Agent 2 — Territory Market Research
 *
 * Weekly cron + on-creation: researches market data for a territory.
 * High-confidence findings auto-write to territory_market_data.
 * Lower-confidence go to suggestion queue for review.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { handleDuplicateFieldSuggestion } from "@/lib/scout-learning";
import { MARKET_FIELDS } from "@/lib/territory/market-field-registry";

const AGENT_MODEL = "claude-haiku-4-5-20251001";

// Build the field list for the prompt from the registry
const FIELD_LIST = MARKET_FIELDS
  .filter((f) => f.populationSource !== "mastersuite" && f.populationSource !== "calculated")
  .map((f) => {
    const type = f.dataType === "currency" ? "(dollar amount)" :
      f.dataType === "percentage" ? "(%)" :
      f.dataType === "number" ? "(number)" : "(text)";
    return `- ${f.name}: ${f.label} ${type}${f.help ? ` — ${f.help}` : ""}`;
  })
  .join("\n");

const RESEARCH_PROMPT = `You are a market research agent for New Again Houses, a house flipping franchise.
Research this territory's real estate market and provide as many data points as possible.

Extract data for ANY of these fields you can estimate or know:

${FIELD_LIST}

For each finding, provide:
- field_name: exact field name from above
- suggested_value: the value (numbers only for numeric fields, no $ or % symbols)
- confidence: high (published data), medium (reasonable estimate), low (rough guess)
- evidence: brief source note

Respond with ONLY valid JSON: { "findings": [...] }
Be thorough — aim for 20-40+ fields. Use general market knowledge for the metro area.`;

export async function runTerritoryMarketResearch(
  msSlug: string
): Promise<{ suggestionsCreated: number; directWrites: number }> {
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
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${RESEARCH_PROMPT}\n\nTerritory: "${territory.territory_name}" (code: ${msSlug})\nRegion: ${territory.region ?? "unknown"}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in agent response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      findings: Array<{ field_name: string; suggested_value: string; confidence: string; evidence: string }>;
    };

    let directWrites = 0;
    let suggestions = 0;

    for (const f of parsed.findings ?? []) {
      // Validate field name exists in registry
      const registryField = MARKET_FIELDS.find((mf) => mf.name === f.field_name);
      if (!registryField) continue;

      if (f.confidence === "high") {
        // High confidence → write directly to territory_market_data
        await supabase.from("territory_market_data").upsert(
          {
            territory_slug: msSlug,
            field_name: f.field_name,
            field_value: f.suggested_value,
            source: "api",
            source_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "territory_slug,field_name", ignoreDuplicates: false }
        );
        directWrites++;
      } else {
        // Medium/low → suggestion queue for human review
        await handleDuplicateFieldSuggestion({
          territory_ms_slug: msSlug,
          field_name: f.field_name,
          field_table: "territory_market_data",
          suggested_value: f.suggested_value,
          source: "agent_research",
          source_id: `territory-market-${msSlug}`,
          evidence: f.evidence,
          confidence: f.confidence as "high" | "medium" | "low",
        });
        suggestions++;
      }
    }

    await supabase.from("integration_logs").insert({
      integration_name: "territory-market",
      event_type: "research",
      status: "success",
      payload_summary: `${directWrites} direct writes, ${suggestions} suggestions for ${msSlug}`,
      related_ms_slug: msSlug,
    });

    return { suggestionsCreated: suggestions, directWrites };
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
