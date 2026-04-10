/**
 * Agent 4 — Re-engagement Signal
 * Scans contacts monthly. Uses claude-haiku-4-5-20251001.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";

const AGENT_MODEL = "claude-haiku-4-5-20251001";

export type ReengagementSignal = "re-engage-now" | "re-engage-soon" | "leave-cold";

export async function runReengagementSignal(
  ghlContactId: string
): Promise<{ signal: ReengagementSignal; reason: string }> {
  const supabase = createServerClient();

  try {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, city, state, opportunity_source")
      .eq("ghl_contact_id", ghlContactId)
      .single();

    if (!contact) throw new Error("Contact not found");

    const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Evaluate this franchise prospect for re-engagement potential:
Name: ${name}, Location: ${contact.city ?? ""} ${contact.state ?? ""}, Source: ${contact.opportunity_source ?? "unknown"}

Answer 3 questions:
1. Is there any signal their career situation may have changed?
2. Has the housing market in their area changed favorably?
3. Are there any readiness signals (time passed, market conditions)?

Respond with ONLY valid JSON:
{ "signal": "re-engage-now|re-engage-soon|leave-cold", "reason": "brief explanation" }`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");

    const parsed = JSON.parse(jsonMatch[0]) as { signal: ReengagementSignal; reason: string };

    // Write to contact_scores (upsert on unique type)
    await supabase.from("contact_scores").upsert(
      {
        ghl_contact_id: ghlContactId,
        score_type: "reengagement",
        score_value: parsed.signal,
        reason: parsed.reason,
        confidence: parsed.signal === "re-engage-now" ? "high" : "medium",
        source: "agent",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ghl_contact_id,score_type" }
    );

    await supabase.from("integration_logs").insert({
      integration_name: "reengagement-signal",
      event_type: "scan",
      status: "success",
      payload_summary: `${name}: ${parsed.signal}`,
      related_contact_id: ghlContactId,
    });

    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("integration_logs").insert({
      integration_name: "reengagement-signal",
      event_type: "error",
      status: "failed",
      error_message: msg,
      related_contact_id: ghlContactId,
    });
    return { signal: "leave-cold", reason: msg };
  }
}
