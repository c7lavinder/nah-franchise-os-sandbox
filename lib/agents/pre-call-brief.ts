/**
 * Agent 3 — Pre-Call Brief Enrichment
 *
 * Fires the morning of any scheduled call (7am day-of via cron).
 * Uses claude-haiku-4-5-20251001 with web search to find fresh context
 * about the prospect and their local market.
 * May create data_update_suggestions if profile data changed.
 * Stores brief_context on the call record for injection into Scout briefs.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { handleDuplicateFieldSuggestion } from "@/lib/scout-learning";

const AGENT_MODEL = "claude-haiku-4-5-20251001";

export async function runPreCallBriefAgent(callId: string): Promise<{
  brief_context: string;
  suggestions_created: number;
}> {
  const supabase = createServerClient();

  try {
    // 1. Get call details + contact info + profile fields
    const { data: call } = await supabase
      .from("calls")
      .select("id, call_type_id, contact_id, scheduled_at, call_types (name)")
      .eq("id", callId)
      .single();

    if (!call || !call.contact_id) {
      return { brief_context: "", suggestions_created: 0 };
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("ghl_contact_id, first_name, last_name, email, city, state")
      .eq("id", call.contact_id)
      .single();

    if (!contact) {
      return { brief_context: "", suggestions_created: 0 };
    }

    const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Unknown";

    // Get relevant profile fields
    const { data: profileFields } = await supabase
      .from("contact_profile_fields")
      .select("field_name, field_value")
      .eq("contact_id", contact.ghl_contact_id)
      .in("field_name", [
        // Registry names — desired_territory/primary_motivation were legacy aliases
        // until the G3 rename (2026-08-09); the store now holds only these.
        "Territory Interest",
        "definition_of_success",
        "current_occupation",
        "company",
        "industry",
        "liquid_capital_available",
      ]);

    const pf = (name: string) => profileFields?.find((f) => f.field_name === name)?.field_value ?? null;

    const callTypeName = (call.call_types as unknown as { name: string } | null)?.name ?? "sales call";

    // 2. Call Haiku with web search tool
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 800,
      tools: [{ type: "web_search_20250305" as const, name: "web_search", max_uses: 3 } as unknown as Anthropic.Tool],
      system: `You prepare brief call prep notes for franchise sales calls.
Search for any recent updates about the prospect and their local market.
Focus only on what would be useful context for a call happening today.
Return JSON only — no preamble, no markdown fences.`,
      messages: [
        {
          role: "user",
          content: `Prepare call prep context for today's ${callTypeName} with ${fullName}.

What we know:
- Location: ${contact.city ?? ""} ${contact.state ?? ""}
- Job/company: ${pf("current_occupation") ?? "unknown"} at ${pf("company") ?? "unknown"}
- Motivation: ${pf("definition_of_success") ?? "not yet captured"}
- Territory interest: ${pf("Territory Interest") ?? "not yet discussed"}

Search for:
1. Any recent news about ${fullName} (career change, business news, etc.)
2. Any significant real estate market changes in ${contact.city ?? contact.state ?? "their area"} relevant to house flipping in the last 30 days

Return this exact JSON:
{
  "brief_context": "2-3 sentences of fresh context relevant to today's call",
  "market_update": "one sentence on local market if anything notable, or null",
  "field_updates": [
    { "field_name": "...", "suggested_value": "...", "evidence": "..." }
  ]
}`,
        },
      ],
    });

    // Extract text blocks from response (may include tool use blocks)
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let briefContext = "";
    let suggestionsCreated = 0;

    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const data = JSON.parse(jsonMatch[0]) as {
        brief_context: string;
        market_update: string | null;
        field_updates: Array<{ field_name: string; suggested_value: string; evidence: string }>;
      };

      // Build brief context string
      const parts = [data.brief_context];
      if (data.market_update) parts.push(data.market_update);
      briefContext = parts.filter(Boolean).join(" ");

      // Create suggestions for field updates
      for (const update of data.field_updates ?? []) {
        if (!update.field_name || !update.suggested_value) continue;
        await handleDuplicateFieldSuggestion({
          contact_id: contact.ghl_contact_id,
          field_name: update.field_name,
          field_table: "contact_profile_fields",
          suggested_value: update.suggested_value,
          source: "agent_research",
          source_id: `pre-call-brief-${callId}`,
          evidence: update.evidence,
          confidence: "low",
        });
        suggestionsCreated++;
      }

      // Store brief context on the call record
      await supabase
        .from("calls")
        .update({
          brief_context: briefContext,
          brief_generated_at: new Date().toISOString(),
        })
        .eq("id", callId);
    } catch (err) {
      console.error("Pre-call brief agent parse error:", err);
    }

    // Log to integration_logs
    await supabase.from("integration_logs").insert({
      integration_name: "pre-call-brief",
      event_type: "agent_run",
      status: briefContext ? "success" : "failed",
      payload_summary: `${fullName}: ${suggestionsCreated} suggestions, context=${briefContext.length > 0 ? "yes" : "no"}`,
      related_contact_id: contact.ghl_contact_id,
    });

    return { brief_context: briefContext, suggestions_created: suggestionsCreated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("integration_logs").insert({
      integration_name: "pre-call-brief",
      event_type: "error",
      status: "failed",
      error_message: msg,
    });
    return { brief_context: "", suggestions_created: 0 };
  }
}
