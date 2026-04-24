"use client";

import { Loader2, BookOpen } from "lucide-react";
import type { KBIntelItem } from "./CallDetailTabs";

interface CallKnowledgeTabProps {
  items: KBIntelItem[];
  isGenerating: boolean;
  hasTranscript: boolean;
  hasGenerated: boolean;
}

/** Group/cohort/internal calls don't have meaningful per-contact next steps or
 *  data extraction (a 30-person franchisee call has no "primary"). Instead,
 *  this tab visualizes what Scout pulled out of the transcript and folded into
 *  the knowledge base. Items are grouped by KB category for skimmability. */
const CATEGORY_LABELS: Record<string, string> = {
  marketing_insight: "Marketing & Lead Generation",
  lead_source_intel: "Marketing & Lead Generation",
  prospect_questions: "Prospect Questions & Objections",
  objections: "Prospect Questions & Objections",
  prospect_motivations: "Prospect Motivations",
  competitors: "Competitive Intelligence",
  sales_effectiveness: "Sales Effectiveness",
  capital_intelligence: "Capital & Financing",
  fdd_intel: "FDD Strategy",
  onboarding_insight: "Onboarding Operations",
  training_intel: "Training & Curriculum",
  franchisee_setup: "Franchisee Setup",
  coaching: "Coaching & Development",
  franchisee_challenges: "Franchisee Challenges",
  deal_intel: "Deal Execution",
  market_intelligence: "Territory & Market Intelligence",
  territory: "Territory & Market Intelligence",
  process_updates: "Process & Operations Updates",
  best_practices: "Process & Operations Updates",
  operations: "Process & Operations Updates",
  brand: "Brand Positioning",
  business_decision: "Business Decisions",
  governance_update: "Governance",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function freqStyle(signal: KBIntelItem["frequency_signal"]): string {
  if (signal === "recurring") return "bg-nah-orange/10 text-nah-orange border-nah-orange/30";
  if (signal === "new") return "bg-success/10 text-success border-success/30";
  return "bg-bg-tertiary text-text-tertiary border-border-default";
}

export default function CallKnowledgeTab({ items, isGenerating, hasTranscript, hasGenerated }: CallKnowledgeTabProps) {
  if (!hasTranscript) {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Knowledge capture will be available once the transcript arrives from Read.ai.
        </p>
      </div>
    );
  }
  if (isGenerating) {
    return (
      <div className="text-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">Scout is extracting knowledge...</p>
      </div>
    );
  }
  if (!hasGenerated && items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">Generate on the Overview tab to capture knowledge from this call.</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen size={20} className="text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">No knowledge items captured from this call.</p>
        <p className="text-caption text-text-tertiary mt-1">Quick check-ins and short calls often have nothing reusable to extract.</p>
      </div>
    );
  }

  // Group items by display category
  const grouped = new Map<string, KBIntelItem[]>();
  for (const it of items) {
    const label = categoryLabel(it.category);
    const list = grouped.get(label) ?? [];
    list.push(it);
    grouped.set(label, list);
  }
  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  const recurringCount = items.filter((i) => i.frequency_signal === "recurring").length;
  const newCount = items.filter((i) => i.frequency_signal === "new").length;

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-nah-orange" />
          <div className="flex-1">
            <p className="text-body-sm font-medium text-text-primary">
              {items.length} item{items.length === 1 ? "" : "s"} added to the Knowledge Base
            </p>
            <p className="text-caption text-text-tertiary">
              {newCount > 0 && <>{newCount} new · </>}
              {recurringCount > 0 && <>{recurringCount} recurring pattern{recurringCount === 1 ? "" : "s"} · </>}
              folded into Scout&apos;s knowledge graph for future calls.
            </p>
          </div>
        </div>
      </div>

      {sortedGroups.map(([label, list]) => (
        <div key={label} className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border-default flex items-center justify-between">
            <h3 className="text-body-sm font-medium text-text-primary">{label}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">{list.length}</span>
          </div>
          <div className="divide-y divide-border-default">
            {list.map((it, idx) => (
              <div key={`${it.title}-${idx}`} className="px-4 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body-sm font-medium text-text-primary">{it.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 uppercase tracking-wider font-semibold ${freqStyle(it.frequency_signal)}`}>
                    {it.frequency_signal}
                  </span>
                </div>
                <p className="text-caption text-text-secondary whitespace-pre-wrap">{it.content}</p>
                {it.source_quote && (
                  <p className="text-caption text-text-tertiary italic border-l-2 border-border-default pl-2">
                    &ldquo;{it.source_quote}&rdquo;
                  </p>
                )}
                {it.subcategory && (
                  <p className="text-[10px] text-text-tertiary">{it.subcategory}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
