"use client";

/**
 * JourneyEosTab — routes the EOS view for a journey:
 *
 *  • Pre-award (no active territories yet): render contact-scoped EOS for
 *    each core member (personal goals / issues / todos captured during
 *    sales calls).
 *
 *  • Post-award (≥1 active territory): render BOTH personal EOS per core
 *    member AND territory EOS per awarded territory. Personal facts
 *    (credit, family, goals) live on the contact; operational facts
 *    (rocks, scorecard, marketing spend) live on the territory — showing
 *    both surfaces gives reps the full picture in one place.
 *
 *  • 2+ core members (Ryan + Shannon): render a contact sub-tab strip
 *    above Personal EOS so each member's personal EOS can be worked
 *    independently.
 *
 *  • 2+ active territories (Phil with 3): render a territory sub-tab strip
 *    above Territory EOS.
 */

import { useEffect, useState } from "react";
import EosTab from "@/components/leads/tabs/EosTab";
import TerritoryEosTab from "@/components/territories/tabs/EosTab";

interface JourneyTerritory {
  TerritorySlug: string;
  Nickname: string;
}

export interface CoreMember {
  contactId: string;
  name: string;
}

interface Props {
  contactId: string;
  carriedTerritoryName: string | null;
  awardedTerritories: JourneyTerritory[];
  focusedTerritorySlug: string | null;
  onTerritoryChange: (slug: string | null) => void;
  primaryContactName: string | null;
  /** Core journey members (primary + co_primary). When ≥2, a contact
   *  sub-tab strip is rendered above the Personal EOS section. */
  coreMembers?: CoreMember[];
}

export default function JourneyEosTab({
  contactId,
  carriedTerritoryName,
  awardedTerritories,
  focusedTerritorySlug,
  onTerritoryChange,
  primaryContactName,
  coreMembers = [],
}: Props) {
  // Ensure the primary contact is always in the list even if the parent
  // didn't pass coreMembers (defensive for legacy callers).
  const effectiveMembers: CoreMember[] =
    coreMembers.length > 0 ? coreMembers : [{ contactId, name: primaryContactName ?? "Primary" }];

  const [selectedContactId, setSelectedContactId] = useState<string>(effectiveMembers[0]?.contactId ?? contactId);

  // Keep the selected contact in sync if the member set changes (e.g. a
  // new co-owner was just added mid-session).
  useEffect(() => {
    if (!effectiveMembers.find((m) => m.contactId === selectedContactId)) {
      setSelectedContactId(effectiveMembers[0]?.contactId ?? contactId);
    }
  }, [effectiveMembers, selectedContactId, contactId]);

  // Resolve the focused territory. Prefer the externally-controlled slug;
  // fall back to the first awarded so the territory view never renders empty.
  const resolvedTerritory =
    awardedTerritories.find((t) => t.TerritorySlug === focusedTerritorySlug) ?? awardedTerritories[0] ?? null;

  useEffect(() => {
    if (awardedTerritories.length === 0) return;
    if (!resolvedTerritory) return;
    if (focusedTerritorySlug && focusedTerritorySlug !== resolvedTerritory.TerritorySlug) {
      const stillAwarded = awardedTerritories.some((t) => t.TerritorySlug === focusedTerritorySlug);
      if (!stillAwarded) onTerritoryChange(resolvedTerritory.TerritorySlug);
    }
  }, [focusedTerritorySlug, resolvedTerritory, awardedTerritories, onTerritoryChange]);

  const showContactTabs = effectiveMembers.length >= 2;
  // Territory strip is always shown when there's at least one awarded
  // territory so the Territory EOS section reads as its own persistent
  // home — not just a conditional add-on for multi-territory journeys.
  const showTerritoryTabs = awardedTerritories.length >= 1;

  // Reused pill-tab strip, consistent with the Territories/EOS patterns
  // elsewhere. Kept local to avoid one-off styling drift.
  function SubTabStrip({
    items,
    activeId,
    onSelect,
  }: {
    items: { id: string; label: string }[];
    activeId: string;
    onSelect: (id: string) => void;
  }) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <button
              key={it.id}
              onClick={() => onSelect(it.id)}
              className={`px-2.5 py-1 rounded-full text-caption font-medium transition-colors ${
                active ? "bg-nah-orange text-white" : "bg-bg-hover text-text-tertiary hover:text-text-primary"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">PERSONAL EOS</span>
          <span className="text-[10px] text-text-tertiary">— goals &amp; issues that follow the person</span>
          {showContactTabs && (
            <div className="ml-auto">
              <SubTabStrip
                items={effectiveMembers.map((m) => ({ id: m.contactId, label: m.name }))}
                activeId={selectedContactId}
                onSelect={setSelectedContactId}
              />
            </div>
          )}
        </div>
        {/* Personal EOS is contact-scoped only — no carriedTerritoryName,
            since personal goals/issues/todos follow the person, not the
            territory. The territory-linked view lives below. */}
        <EosTab key={selectedContactId} contactId={selectedContactId} carriedTerritoryName={null} />
      </section>

      {awardedTerritories.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">TERRITORY EOS</span>
            <span className="text-[10px] text-text-tertiary">
              — operational: rocks, scorecard, marketing spend, etc.
            </span>
            {showTerritoryTabs && resolvedTerritory && (
              <div className="ml-auto">
                <SubTabStrip
                  items={awardedTerritories.map((t) => ({ id: t.TerritorySlug, label: t.Nickname }))}
                  activeId={resolvedTerritory.TerritorySlug}
                  onSelect={onTerritoryChange}
                />
              </div>
            )}
          </div>
          {resolvedTerritory && (
            <TerritoryEosTab
              key={resolvedTerritory.TerritorySlug}
              TerritorySlug={resolvedTerritory.TerritorySlug}
              carriedFromContactName={primaryContactName}
            />
          )}
        </section>
      )}
    </div>
  );
}
