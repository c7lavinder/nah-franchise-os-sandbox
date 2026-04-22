"use client";

/**
 * JourneyEosTab — routes the EOS view for a journey:
 *
 *  • Pre-award (no active territories yet): render contact-scoped EOS. This
 *    is the prospect's personal goals/issues/todos captured during sales
 *    calls; still relevant before a territory is awarded.
 *
 *  • Post-award (≥1 active territory): render territory-scoped EOS for the
 *    focused territory. Once a territory is awarded, the business EOS lives
 *    on the territory (shared across partners/co-owners), not on the
 *    individual contact — which is what the restructure plan called for.
 *
 *  • 2+ active territories (Phil with 3): render a picker row at the top so
 *    the rep can switch between each territory's operating system.
 *
 * Falls back to contact EOS if the territory endpoint can't be loaded
 * (e.g. territory missing from territories table) so the tab never blanks.
 */

import { useEffect, useState } from "react";
import EosTab from "@/components/leads/tabs/EosTab";
import TerritoryEosTab from "@/components/territories/tabs/EosTab";

interface JourneyTerritory {
  ms_slug: string;
  territory_name: string;
}

interface Props {
  contactId: string;
  carriedTerritoryName: string | null;
  awardedTerritories: JourneyTerritory[];
  focusedTerritorySlug: string | null;
  onTerritoryChange: (slug: string | null) => void;
  primaryContactName: string | null;
}

export default function JourneyEosTab({
  contactId,
  carriedTerritoryName,
  awardedTerritories,
  focusedTerritorySlug,
  onTerritoryChange,
  primaryContactName,
}: Props) {
  // Resolve the active territory. Prefer the externally-controlled slug; if
  // it isn't one of the journey's awarded territories (or it's null), fall
  // back to the first awarded one so the tab never renders empty.
  const resolved = awardedTerritories.find((t) => t.ms_slug === focusedTerritorySlug)
    ?? awardedTerritories[0]
    ?? null;

  // If the focused territory is out of sync with the awarded set (e.g. a
  // stale URL param from a territory no longer awarded), nudge the parent
  // to the valid fallback.
  useEffect(() => {
    if (awardedTerritories.length === 0) return;
    if (!resolved) return;
    if (focusedTerritorySlug && focusedTerritorySlug !== resolved.ms_slug) {
      const stillAwarded = awardedTerritories.some((t) => t.ms_slug === focusedTerritorySlug);
      if (!stillAwarded) onTerritoryChange(resolved.ms_slug);
    }
  }, [focusedTerritorySlug, resolved, awardedTerritories, onTerritoryChange]);

  const hasMultiple = awardedTerritories.length >= 2;

  // Pre-award path: classic contact-scoped EOS (prospect goals/issues/todos).
  if (awardedTerritories.length === 0) {
    return <EosTab contactId={contactId} carriedTerritoryName={carriedTerritoryName} />;
  }

  // Post-award: render BOTH contact EOS (personal — goals, issues, todos
  // that follow the person) AND territory EOS (operational — rocks,
  // scorecard, marketing spend per territory). Some fields are inherently
  // contact-scoped (personal goals) and some are territory-scoped (per-
  // territory spend); showing both surfaces gives reps the full picture.
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">PERSONAL EOS</span>
          <span className="text-[10px] text-text-tertiary">— goals &amp; issues that follow {primaryContactName ?? "the primary contact"}</span>
        </div>
        <EosTab contactId={contactId} carriedTerritoryName={carriedTerritoryName} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">TERRITORY EOS</span>
          <span className="text-[10px] text-text-tertiary">— operational: rocks, scorecard, marketing spend, etc.</span>
          {hasMultiple && resolved && (
            <div className="flex items-center gap-1 ml-auto">
              {awardedTerritories.map((t) => {
                const isActive = t.ms_slug === resolved.ms_slug;
                return (
                  <button
                    key={t.ms_slug}
                    onClick={() => onTerritoryChange(t.ms_slug)}
                    className={`px-2.5 py-1 rounded-full text-caption font-medium transition-colors ${
                      isActive
                        ? "bg-nah-orange text-white"
                        : "bg-bg-hover text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {t.territory_name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {resolved && (
          <TerritoryEosTab
            key={resolved.ms_slug}
            msSlug={resolved.ms_slug}
            carriedFromContactName={primaryContactName}
          />
        )}
      </section>
    </div>
  );
}
