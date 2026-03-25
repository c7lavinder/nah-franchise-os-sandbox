"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronRight, MapPin, Megaphone, Loader2,
} from "lucide-react";
import type { GHLOpportunity } from "@/types/ghl";

interface ContactSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  tags: string[];
  territory: string | null;
  dateAdded: string;
}

interface LeadListProps {
  opportunities: GHLOpportunity[];
  stageName: string | null;
  stageNameMap: Map<string, string>;
  onContactClick: (opportunity: GHLOpportunity) => void;
  searchQuery: string;
}

type SortField = "name" | "urgency" | "recent";

// ─── Urgency calculation ───

function daysInPipeline(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function daysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}

interface UrgencyInfo {
  label: string;
  color: string;
  bgColor: string;
  score: number;
}

function getUrgency(opp: GHLOpportunity): UrgencyInfo {
  const pipelineDays = daysInPipeline(opp.createdAt);
  const stageDays = daysInStage(opp.updatedAt);

  if (opp.status === "lost") {
    return { label: "Lost", color: "text-danger", bgColor: "bg-danger/15", score: 0 };
  }
  if (opp.status === "won") {
    return { label: "Won", color: "text-success", bgColor: "bg-success/15", score: -1 };
  }

  // Lost: 12+ days in stage
  if (stageDays >= 12) {
    return { label: "Lost", color: "text-danger", bgColor: "bg-danger/15", score: 4 };
  }
  // At Risk: 6-11 days in stage
  if (stageDays >= 6) {
    return { label: "At Risk", color: "text-warning", bgColor: "bg-warning/15", score: 3 };
  }
  // Fresh: 0-5 days in stage
  return { label: "Fresh", color: "text-success", bgColor: "bg-success/15", score: 1 };
}

// ─── Component ───

const PAGE_SIZE = 25;

export default function LeadList({
  opportunities,
  stageName,
  stageNameMap,
  onContactClick,
  searchQuery,
}: LeadListProps) {
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [contacts, setContacts] = useState<Record<string, ContactSummary>>({});
  const [enriching, setEnriching] = useState(false);

  // Filter by search
  let filtered = opportunities;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((o) => o.name.toLowerCase().includes(q));
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "urgency":
        cmp = getUrgency(b).score - getUrgency(a).score;
        if (cmp === 0) cmp = daysInStage(b.updatedAt) - daysInStage(a.updatedAt);
        break;
      case "recent":
        cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        break;
    }
    return sortAsc ? -cmp : cmp;
  });

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  // Enrich visible leads with contact data
  const enrichContacts = useCallback(async (opps: GHLOpportunity[]) => {
    const idsToFetch = opps
      .map((o) => o.contactId)
      .filter((id) => id && !contacts[id]);

    if (idsToFetch.length === 0) return;

    setEnriching(true);
    try {
      const res = await fetch("/api/contacts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: idsToFetch }),
      });
      if (res.ok) {
        const data = await res.json();
        setContacts((prev) => ({ ...prev, ...data.contacts }));
      }
    } catch {
      // Silently fail — enrichment is optional
    } finally {
      setEnriching(false);
    }
  }, [contacts]);

  useEffect(() => {
    if (visible.length > 0) {
      void enrichContacts(visible);
    }
  }, [visible.length, enrichContacts]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h2 text-text-primary">
          {stageName ?? "All Leads"}
          <span className="text-caption text-text-tertiary ml-2 font-normal">
            {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
          </span>
        </h2>
        {enriching && <Loader2 size={14} className="animate-spin text-text-tertiary" />}
      </div>

      {/* Sort controls */}
      <div className="flex gap-4 mb-2 px-3 py-2 bg-bg-secondary rounded-t-lg border border-border-default border-b-0">
        {(["urgency", "name", "recent"] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={`text-caption font-medium ${sortField === field ? "text-nah-orange" : "text-text-tertiary"} hover:text-text-primary`}
          >
            {field === "urgency" ? "Urgency" : field === "name" ? "Name" : "Recent"}
            {sortField === field && (sortAsc ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {/* Lead rows */}
      <div className="border border-border-default rounded-b-lg overflow-hidden">
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-body-sm text-text-tertiary">
            {searchQuery ? "No leads match your search" : "No leads in this stage"}
          </div>
        )}
        {visible.map((opp, i) => {
          const stageDays = daysInStage(opp.updatedAt);
          const urgency = getUrgency(opp);
          const contact = contacts[opp.contactId];

          return (
            <div
              key={opp.id}
              className={`
                flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors cursor-pointer
                ${i < visible.length - 1 ? "border-b border-border-default" : ""}
              `}
              onClick={() => onContactClick(opp)}
            >
              {/* Name */}
              <p className="text-body-sm text-text-primary font-medium truncate min-w-0 flex-shrink w-[180px]">
                {opp.name}
              </p>

              {/* Urgency */}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${urgency.bgColor} ${urgency.color} flex-shrink-0`}>
                {urgency.label}
              </span>

              {/* Source */}
              {contact?.source ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-scout-purple/10 text-[11px] text-scout-purple font-medium flex-shrink-0">
                  <Megaphone size={9} />
                  {contact.source}
                </span>
              ) : (
                <span className="w-[80px] flex-shrink-0" />
              )}

              {/* Territory */}
              {contact?.territory ? (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/10 text-[11px] text-info font-medium flex-shrink-0">
                  <MapPin size={9} />
                  {contact.territory}
                </span>
              ) : null}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Single view button */}
              <button
                className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors text-text-tertiary hover:text-nah-orange flex-shrink-0"
                title="View details"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2 mt-2 text-caption text-text-tertiary hover:text-text-primary flex items-center justify-center gap-1"
        >
          <ChevronDown size={12} />
          Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more of {sorted.length}
        </button>
      )}
    </div>
  );
}
