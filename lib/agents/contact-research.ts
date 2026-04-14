/**
 * Agent 1 — Contact Research
 *
 * Weekly cron + on-creation: researches contacts via LLM knowledge.
 * High-confidence findings auto-write to contact_profile_data + contacts.
 * Lower-confidence go to suggestion queue for review.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { handleDuplicateFieldSuggestion } from "@/lib/scout-learning";

const AGENT_MODEL = "claude-haiku-4-5-20251001";

const RESEARCH_PROMPT = `You are a research agent for New Again Houses franchise development.
Research this person and extract relevant profile data points.

Extract any of these fields you can infer:

### Basic/Background
- job_title, company, industry, education_level
- prior_re_experience (real estate experience description)
- prior_business_ownership (yes/no + details)
- entrepreneurial_history (business ownership history)
- skill_set_notes (relevant skills)
- military_background (yes/no + branch/rank)
- linkedin_url

### Financial Signals
- estimated_income_range (rough range based on role/company)
- financing_type_signal (likely financing approach based on background)

### Personality/Decision Style
- decision_style_signal (analytical/emotional/collaborative — inferred from background)
- risk_profile_signal (conservative/moderate/aggressive — inferred)

### EOS Goals (if inferable from background)
- income_goal_signal (likely income target based on current earnings)
- lifestyle_goal_signal (likely lifestyle motivation based on background)

For each finding, provide:
- field_name: one of the names above
- suggested_value: the extracted value
- confidence: high|medium|low
- evidence: brief note on where this was found or inferred

Respond with ONLY valid JSON: { "findings": [...] }
Do NOT invent data. Only include what you can reasonably infer from the name + context.
Aim for 5-15 findings per contact.`;

// Fields that can be written directly to contacts table
const CONTACTS_DIRECT_FIELDS = new Set(["city", "state"]);

// Fields that map to contact_profile_data
const PROFILE_FIELDS = new Set([
  "job_title", "company", "industry", "education_level",
  "prior_re_experience", "prior_business_ownership", "entrepreneurial_history",
  "skill_set_notes", "military_background", "linkedin_url",
  "decision_style_signal", "risk_profile_signal",
  "estimated_income_range", "financing_type_signal",
]);

// Fields that seed EOS goals
const EOS_GOAL_MAP: Record<string, string> = {
  income_goal_signal: "income_goal",
  lifestyle_goal_signal: "lifestyle_goal",
};

export async function runContactResearch(
  ghlContactId: string,
  isNew: boolean = false
): Promise<{ suggestionsCreated: number; directWrites: number }> {
  const supabase = createServerClient();

  try {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, city, state, ghl_contact_id")
      .eq("ghl_contact_id", ghlContactId)
      .single();

    if (!contact) throw new Error("Contact not found");

    const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 2048,
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
      findings: Array<{ field_name: string; suggested_value: string; confidence: string; evidence: string }>;
    };

    let findings = parsed.findings ?? [];
    if (isNew) {
      // Cap at 10 for new contacts to save tokens
      findings = findings
        .sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (order[a.confidence] ?? 2) - (order[b.confidence] ?? 2);
        })
        .slice(0, 10);
    }

    let directWrites = 0;
    let suggestions = 0;

    // Batch profile updates for high-confidence
    const profileUpdates: Record<string, string> = {};
    const contactUpdates: Record<string, string> = {};
    const eosGoalUpdates: Record<string, string> = {};

    for (const f of findings) {
      if (f.confidence === "high") {
        if (CONTACTS_DIRECT_FIELDS.has(f.field_name)) {
          contactUpdates[f.field_name] = f.suggested_value;
          directWrites++;
        } else if (PROFILE_FIELDS.has(f.field_name)) {
          profileUpdates[f.field_name] = f.suggested_value;
          directWrites++;
        } else if (EOS_GOAL_MAP[f.field_name]) {
          eosGoalUpdates[EOS_GOAL_MAP[f.field_name]] = f.suggested_value;
          directWrites++;
        } else {
          // Unknown field — queue for review
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
          suggestions++;
        }
      } else {
        // Medium/low → suggestion queue
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
        suggestions++;
      }
    }

    // Write batched updates
    if (Object.keys(contactUpdates).length > 0) {
      await supabase.from("contacts").update(contactUpdates).eq("id", contact.id);
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from("contact_profile_data").upsert(
        { ghl_contact_id: ghlContactId, ...profileUpdates },
        { onConflict: "ghl_contact_id" }
      );
    }

    if (Object.keys(eosGoalUpdates).length > 0) {
      await supabase.from("eos_contact_goals").upsert(
        { contact_id: contact.id, ...eosGoalUpdates, source: "ai" },
        { onConflict: "contact_id" }
      );
    }

    await supabase.from("integration_logs").insert({
      integration_name: "contact-research",
      event_type: isNew ? "auto_new_contact" : "manual_research",
      status: "success",
      payload_summary: `${directWrites} writes, ${suggestions} suggestions for ${name}`,
      related_contact_id: ghlContactId,
    });

    return { suggestionsCreated: suggestions, directWrites };
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
