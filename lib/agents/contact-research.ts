/**
 * Agent 1 — Contact Research
 *
 * Uses claude-haiku-4-5-20251001 to research contacts via web search simulation.
 * Writes suggestions via handleDuplicateFieldSuggestion.
 * Logs to integration_logs.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { handleDuplicateFieldSuggestion } from "@/lib/scout-learning";

const AGENT_MODEL = "claude-haiku-4-5-20251001";

const RESEARCH_PROMPT = `You are a research agent for New Again Houses franchise development.
Research this person and extract relevant profile data points.

For each finding, provide:
- field_name: one of [job_title, company, prior_re_experience, skill_set_notes, decision_style_signal, industry, education_level, entrepreneurial_history, linkedin_url]
- suggested_value: the extracted value
- confidence: high|medium|low
- evidence: brief note on where this was found or inferred

Respond with ONLY valid JSON: { "findings": [...] }
Do NOT invent data. Only include what you can reasonably infer from the name + context.`;

export async function runContactResearch(
  ghlContactId: string,
  isNew: boolean = false
): Promise<{ suggestionsCreated: number }> {
  const supabase = createServerClient();
  const startTime = Date.now();

  try {
    // Get contact info
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, city, state")
      .eq("ghl_contact_id", ghlContactId)
      .single();

    if (!contact) throw new Error("Contact not found");

    const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${RESEARCH_PROMPT}\n\nPerson: ${name}\nEmail: ${contact.email ?? "unknown"}\nLocation: ${contact.city ?? ""}, ${contact.state ?? ""}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in agent response");

    const parsed = JSON.parse(jsonMatch[0]) as {
      findings: Array<{
        field_name: string;
        suggested_value: string;
        confidence: string;
        evidence: string;
      }>;
    };

    let findings = parsed.findings ?? [];

    // Cap at 5 for new contacts
    if (isNew) {
      findings = findings
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.confidence as keyof typeof order] ?? 2) - (order[b.confidence as keyof typeof order] ?? 2);
        })
        .slice(0, 5);
    }

    let created = 0;
    for (const f of findings) {
      await handleDuplicateFieldSuggestion({
        contact_id: ghlContactId,
        field_name: f.field_name,
        field_table: "contact_profile_fields",
        suggested_value: f.suggested_value,
        source: "agent_research",
        source_id: `contact-research-${ghlContactId}`,
        evidence: f.evidence,
        confidence: f.confidence as "high" | "medium" | "low",
      });
      created++;
    }

    // Log success
    await supabase.from("integration_logs").insert({
      integration_name: "contact-research",
      event_type: isNew ? "auto_new_contact" : "manual_research",
      status: "success",
      payload_summary: `${created} suggestions for ${name}`,
      related_contact_id: ghlContactId,
    });

    return { suggestionsCreated: created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("integration_logs").insert({
      integration_name: "contact-research",
      event_type: "error",
      status: "failed",
      error_message: msg,
      related_contact_id: ghlContactId,
    });
    throw err;
  }
}
