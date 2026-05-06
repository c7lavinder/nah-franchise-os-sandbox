/**
 * KB Updater — merges extracted intelligence into knowledge_documents.
 *
 * Strategy:
 * - Each KB category maps to one or more knowledge_documents
 * - New items are MERGED into existing docs — if a heading with the same
 *   title already exists, the entry is UPDATED (not duplicated)
 * - If no document exists for the category, creates one
 * - Tracks source call and date for auditability
 * - Stores objections in objection_registry for pattern tracking
 */

import { createServerClient } from "@/lib/supabase/server";
import type { KBIntelligenceItem } from "./prompts/kb-intelligence";

/** Maps extraction categories → knowledge_documents category */
const CATEGORY_MAP: Record<string, string> = {
  // Pillar 1: More leads
  marketing_insight: "marketing",
  lead_source_intel: "lead_generation",
  // Pillar 2: Better conversion
  prospect_questions: "objections",
  objections: "objections",
  prospect_motivations: "ideal_candidate",
  competitors: "competitors",
  sales_effectiveness: "conversion_playbook",
  capital_intelligence: "objections",
  fdd_intel: "fdd",
  // Pillar 3: Faster onboarding
  onboarding_insight: "onboarding_ops",
  training_intel: "training",
  franchisee_setup: "franchisee_playbook",
  // Pillar 4: More houses
  coaching: "coaching",
  franchisee_challenges: "coaching",
  deal_intel: "deal_execution",
  market_intelligence: "territory",
  territory: "territory",
  // Cross-cutting
  process_updates: "operations",
  best_practices: "operations",
  operations: "operations",
  brand: "brand",
  business_decision: "business_planning",
  governance_update: "governance",
};

/** Human-readable titles for auto-created category docs */
const CATEGORY_TITLES: Record<string, string> = {
  // Pillar 1
  marketing: "Marketing Strategies & Campaign Intelligence",
  lead_generation: "Lead Sources & Generation Insights",
  // Pillar 2
  objections: "Prospect Questions, Objections & Capital Intelligence",
  ideal_candidate: "Prospect Motivations & Ideal Candidate Signals",
  competitors: "Competitive Intelligence from Calls",
  conversion_playbook: "Sales Effectiveness & Conversion Tactics",
  fdd: "FDD Strategy, Questions & Review Insights",
  // Pillar 3
  training: "Training Progress & Curriculum Insights",
  franchisee_playbook: "Franchisee Setup & Success Playbook",
  onboarding_ops: "Onboarding Operations & Process Notes",
  // Pillar 4
  coaching: "Coaching Insights & Franchisee Development",
  territory: "Territory & Market Intelligence",
  industry: "Industry Trends & Market Conditions",
  deal_execution: "Deal Execution — Acquisitions, Rehabs, Sales",
  // Cross-cutting
  operations: "Process Updates & Operational Changes",
  brand: "Brand Positioning & Value Propositions",
  business_planning: "Business Planning, EOS & Strategic Decisions",
  governance: "Governance, Policies & Decision Framework",
};

export async function updateKnowledgeBase(
  items: KBIntelligenceItem[],
  callId: string,
  callDate: string | null,
  contactName: string | null,
  callType: string | null
): Promise<{ docsUpdated: number; objectionsLogged: number }> {
  if (items.length === 0) return { docsUpdated: 0, objectionsLogged: 0 };

  const supabase = createServerClient();
  const dateLabel = callDate
    ? new Date(callDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Unknown date";

  // Group items by KB category
  const grouped = new Map<string, KBIntelligenceItem[]>();
  for (const item of items) {
    const kbCategory = CATEGORY_MAP[item.category] ?? "operations";
    const existing = grouped.get(kbCategory) ?? [];
    existing.push(item);
    grouped.set(kbCategory, existing);
  }

  let docsUpdated = 0;
  let objectionsLogged = 0;

  for (const [kbCategory, categoryItems] of grouped) {
    // Find existing doc for this category (auto-generated ones have seeded_from = 'call_extraction')
    const { data: existingDoc } = await supabase
      .from("knowledge_documents")
      .select("id, content")
      .eq("category", kbCategory)
      .eq("is_active", true)
      .eq("seeded_from", "call_extraction")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDoc) {
      // MERGE into existing document — update entries with matching titles,
      // append only genuinely new ones. This prevents the doc from growing
      // unboundedly with duplicate/overlapping entries.
      let content = existingDoc.content;

      for (const item of categoryItems) {
        const entry = formatEntry(item, callType, dateLabel);
        const titleSlug = item.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

        // Search for an existing ### heading that matches this title (fuzzy: normalize whitespace + case)
        const headingPattern = new RegExp(
          `### [^\\n]*${escapeRegex(titleSlug.split(" ").slice(0, 3).join(" "))}[^\\n]*\\n[\\s\\S]*?(?=\\n### |\\n---\\n|$)`,
          "i"
        );
        const match = content.match(headingPattern);

        if (match) {
          // UPDATE existing entry — replace it with the newer version
          content = content.replace(match[0], entry);
        } else {
          // APPEND new entry
          content = content + "\n\n---\n\n" + entry;
        }
      }

      const tokenCount = Math.ceil(content.length / 4);
      await supabase
        .from("knowledge_documents")
        .update({
          content,
          token_count: tokenCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDoc.id);
      docsUpdated++;
    } else {
      // Create new document for this category
      const title = CATEGORY_TITLES[kbCategory] ?? `${kbCategory} — Extracted from Calls`;
      const entries = categoryItems.map((item) => formatEntry(item, callType, dateLabel)).join("\n\n---\n\n");
      const content = `# ${title}\n\n_Auto-maintained by Scout from call transcripts. Updated after every analyzed call._\n\n${entries}`;
      const tokenCount = Math.ceil(content.length / 4);

      await supabase.from("knowledge_documents").insert({
        title,
        category: kbCategory,
        content,
        priority: 5,
        token_count: tokenCount,
        seeded_from: "call_extraction",
      });
      docsUpdated++;
    }
  }

  // Log objections to objection_registry for pattern tracking
  const objectionItems = items.filter((i) => i.category === "objections" || i.category === "capital_intelligence");
  for (const item of objectionItems) {
    const objectionType = mapToObjectionType(item.subcategory);
    const { error } = await supabase.from("objection_registry").insert({
      contact_id: contactName ?? "unknown",
      stage_at_time: callType ?? "unknown",
      objection_type: objectionType,
      objection_detail: `${item.title}: ${item.content}`,
      resolved: false,
    });
    if (!error) objectionsLogged++;
  }

  return { docsUpdated, objectionsLogged };
}

function formatEntry(item: KBIntelligenceItem, callType: string | null, dateLabel: string): string {
  const header = `### ${item.title}`;
  const meta = `_Last updated: ${dateLabel} · Source: ${callType ?? "Call"}_`;
  const body = item.content;
  const quote = item.source_quote ? `> "${item.source_quote}"` : "";
  return [header, meta, body, quote].filter(Boolean).join("\n");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapToObjectionType(subcategory: string): string {
  const lower = (subcategory ?? "").toLowerCase();
  if (lower.includes("capital") || lower.includes("invest") || lower.includes("fund") || lower.includes("cost"))
    return "capital";
  if (lower.includes("royal") || lower.includes("fee")) return "royalty";
  if (lower.includes("time") || lower.includes("timing") || lower.includes("ready")) return "timing";
  if (lower.includes("territory") || lower.includes("area") || lower.includes("location")) return "territory";
  if (lower.includes("value") || lower.includes("worth") || lower.includes("why")) return "value";
  if (lower.includes("compet") || lower.includes("homevest") || lower.includes("alternative")) return "value";
  return "other";
}
