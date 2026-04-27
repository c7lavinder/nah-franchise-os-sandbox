"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import { Target, Loader2, AlertTriangle, ChevronRight, Brain } from "lucide-react";
import Link from "next/link";

interface PriorityLead {
  contactId: string;
  name: string;
  stage: string;
  score: number;
  tier: string;
  daysSinceTouch: number | null;
  reason: string;
  /** Intelligence score from candidate_intelligence (0-100), null if not profiled */
  intelligenceScore: number | null;
  /** Whether the lead has any critical-severity flags */
  hasCriticalFlags: boolean;
}

function tierColor(tier: string): string {
  switch (tier) {
    case "Hot": return "bg-[#f5a800] text-white";
    case "Warm": return "bg-[#fef3e2] text-[#f5a800]";
    case "Cool": return "bg-[#e6f7fd] text-[#00a1e1]";
    default: return "bg-[#f1f5f9] text-[#898a8d]";
  }
}

/** Intelligence score badge color — green 70+, yellow 40-69, red <40 */
function intelligenceScoreColor(score: number): string {
  if (score >= 70) return "bg-success/15 text-success border-success/25";
  if (score >= 40) return "bg-warning/15 text-[#d97706] border-warning/25";
  return "bg-danger/15 text-danger border-danger/25";
}

export default function PriorityLeads() {
  const [leads, setLeads] = useState<PriorityLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/leads/priority")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border-default">
        <Target size={14} className="text-nah-orange" />
        <span className="text-caption font-medium text-text-primary">Who Needs Attention</span>
        <span className="text-caption text-text-tertiary ml-auto">{leads.length} leads</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-caption text-text-tertiary">All caught up — no urgent leads</p>
        </div>
      ) : (
        <div>
          {leads.map((lead) => (
            <Link
              key={lead.contactId}
              href={`/contacts/${lead.contactId}`}
              className="flex items-center gap-2 px-3 py-2 border-b border-border-default hover:bg-bg-hover transition-colors last:border-b-0"
            >
              {/* Score badge */}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold flex-shrink-0 ${tierColor(lead.tier)}`}>
                {lead.score}
              </span>

              {/* Name + stage + intelligence badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-body-sm font-medium text-text-primary truncate">{lead.name}</p>
                  {lead.intelligenceScore !== null && (
                    <span
                      className={`px-1 py-0.5 rounded-sm text-[10px] font-bold border flex-shrink-0 ${intelligenceScoreColor(lead.intelligenceScore)}`}
                      title={`Intelligence Score: ${lead.intelligenceScore}`}
                    >
                      <Brain size={8} className="inline mr-0.5 -mt-px" />
                      {lead.intelligenceScore}
                    </span>
                  )}
                  {lead.hasCriticalFlags && (
                    <span
                      className="w-2 h-2 rounded-full bg-danger flex-shrink-0 animate-pulse"
                      title="Critical flag active"
                    />
                  )}
                </div>
                <p className="text-caption text-text-tertiary truncate">{lead.stage}</p>
              </div>

              {/* Reason */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {lead.daysSinceTouch !== null && lead.daysSinceTouch >= 3 && (
                  <AlertTriangle size={11} className="text-warning" />
                )}
                <span className="text-caption text-text-tertiary max-w-[140px] truncate">
                  {lead.reason}
                </span>
              </div>

              <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
