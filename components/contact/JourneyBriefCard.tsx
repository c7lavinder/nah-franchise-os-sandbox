"use client";

/**
 * JourneyBriefCard — AI-generated narrative + next actions panel.
 * First load: waits for inline generation (~3-5s). Shows generating state.
 * Subsequent loads: instant from DB cache.
 * Refresh button forces regeneration with latest code/data.
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Loader2, ChevronRight, RefreshCw, Sparkles } from "lucide-react";

interface BriefData {
  empty: boolean;
  narrative: string;
  next_actions: {
    primary: string;
    secondary: string[];
  };
  stale: boolean;
  updated_at?: string;
}

export default function JourneyBriefCard({ journeyId }: { journeyId: string }) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBrief = useCallback(
    (refresh = false) => {
      const url = `/api/journeys/${journeyId}/brief${refresh ? "?refresh=true" : ""}`;
      if (refresh) setRefreshing(true);
      else setLoading(true);

      apiFetch(url)
        .then((r) => r.json())
        .then((d) => setBrief(d))
        .catch(() => setBrief(null))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [journeyId]
  );

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

  if (loading) {
    return (
      <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 min-h-[120px]">
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-3">JOURNEY BRIEF</h3>
        <div className="flex items-center gap-2 text-text-tertiary">
          <Sparkles size={14} className="text-nah-orange animate-pulse" />
          <span className="text-body-sm">Generating brief...</span>
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-3 bg-bg-hover rounded animate-pulse w-full" />
          <div className="h-3 bg-bg-hover rounded animate-pulse w-4/5" />
          <div className="h-3 bg-bg-hover rounded animate-pulse w-3/5" />
        </div>
      </div>
    );
  }

  if (!brief || brief.empty) {
    return (
      <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3">
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">JOURNEY BRIEF</h3>
        <p className="text-body-sm text-text-tertiary">Unable to generate brief</p>
      </div>
    );
  }

  const actions = brief.next_actions ?? { primary: "", secondary: [] };

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">JOURNEY BRIEF</h3>
        <button
          onClick={() => fetchBrief(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-[9px] text-text-tertiary hover:text-nah-orange transition-colors disabled:opacity-50"
          title="Regenerate brief"
        >
          <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Regenerating..." : "Refresh"}
        </button>
      </div>

      <p className="text-body-sm text-text-primary leading-relaxed">{brief.narrative}</p>

      {actions.primary && (
        <div className="border-t border-border-default mt-3 pt-2">
          <div className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-nah-orange flex-shrink-0" />
            <span className="text-body-sm font-medium text-text-primary">{actions.primary}</span>
          </div>
          {actions.secondary.map((action, i) => (
            <div key={i} className="flex items-center gap-1.5 ml-4 mt-1">
              <span className="text-[8px] text-text-tertiary">&#x2022;</span>
              <span className="text-caption text-text-secondary">{action}</span>
            </div>
          ))}
        </div>
      )}

      {brief.updated_at && (
        <p className="text-[9px] text-text-tertiary mt-2">Updated {new Date(brief.updated_at).toLocaleDateString()}</p>
      )}
    </div>
  );
}
