"use client";

/**
 * PipelineLeadList — Sprint 3 rewire of the All Leads list.
 *
 * Pulls from contact_pipeline_state (Supabase) instead of GHL opportunities.
 * Shows urgency colors per §1.14 (Fresh 0-5d / At Risk 5-10d / Losing 10+d).
 */

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { capitalizeName, formatPhone } from "@/lib/format/contact";

interface PipelineContact {
  stateId: string;
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  city: string | null;
  state: string | null;
  stageName: string;
  stageSlug: string;
  stageId: string;
  pipelineName: string;
  pipelineSlug: string;
  daysSinceSubTask: number;
  urgency: "fresh" | "at_risk" | "losing";
  urgencyScore: number;
  enteredStageAt: string | null;
}

interface PipelineLeadListProps {
  selectedStageId: string | null;
  selectedStageName: string | null;
  searchQuery: string;
}

type SortField = "urgency" | "name" | "recent";

const URGENCY_STYLES = {
  losing:  { label: "Losing",  color: "text-[#c62828]", bgColor: "bg-[#fce4ec]" },
  at_risk: { label: "At Risk", color: "text-[#e65100]", bgColor: "bg-[#fff3e0]" },
  fresh:   { label: "Fresh",   color: "text-[#2e7d32]", bgColor: "bg-[#e8f5e9]" },
};

const PAGE_SIZE = 50;

export default function PipelineLeadList({
  selectedStageId,
  selectedStageName,
  searchQuery,
}: PipelineLeadListProps) {
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("urgency");
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const BATCH_SIZE = 5000;

  const fetchContacts = useCallback(async (append = false, currentOffset = 0) => {
    if (!append) { setLoading(true); setVisibleCount(PAGE_SIZE); }
    else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("sort", sortField);
      params.set("limit", String(BATCH_SIZE));
      params.set("offset", String(currentOffset));
      if (selectedStageId) params.set("stage_id", selectedStageId);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/pipeline/contacts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const batch: PipelineContact[] = data.contacts ?? [];
        if (append) {
          setContacts((prev) => [...prev, ...batch]);
        } else {
          setContacts(batch);
          setTotalCount(data.totalCount ?? batch.length);
        }
        setHasMore((data.totalCount ?? batch.length) > currentOffset + batch.length);
      } else {
        setError("Failed to load contacts");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    }
    setLoading(false);
    setLoadingMore(false);
  }, [sortField, selectedStageId, searchQuery]);

  async function handleLoadMore() {
    await fetchContacts(true, contacts.length);
  }

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  // Client-side sort refinement
  const sorted = [...contacts].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "urgency":
        cmp = b.urgencyScore - a.urgencyScore;
        if (cmp === 0) cmp = b.daysSinceSubTask - a.daysSinceSubTask;
        break;
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "recent":
        cmp = new Date(b.enteredStageAt ?? 0).getTime() - new Date(a.enteredStageAt ?? 0).getTime();
        break;
    }
    return sortAsc ? -cmp : cmp;
  });

  const visible = sorted.slice(0, visibleCount);
  const hasMoreLocal = sorted.length > visibleCount;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  return (
    <div>
      {/* Error display */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-caption text-danger">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h2 text-text-primary">
          {selectedStageName ?? "All Prospects"}
          <span className="text-caption text-text-tertiary ml-2 font-normal">
            {totalCount > contacts.length ? `Showing ${contacts.length} of ${totalCount} prospects` : `${contacts.length} ${contacts.length === 1 ? "prospect" : "prospects"}`}
          </span>
        </h2>
        {loading && <Loader2 size={14} className="animate-spin text-text-tertiary" />}
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
        {!loading && visible.length === 0 && (
          <div className="px-4 py-8 text-center text-body-sm text-text-tertiary">
            {searchQuery ? "No prospects match your search" : "No prospects in this stage"}
          </div>
        )}
        {visible.map((contact, i) => {
          const urg = URGENCY_STYLES[contact.urgency];

          return (
            <Link
              key={contact.stateId}
              href={`/leads/${contact.contactId}`}
              className={`
                flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors
                ${i < visible.length - 1 ? "border-b border-border-default" : ""}
              `}
            >
              {/* Name */}
              <p className="text-body-sm text-text-primary font-medium truncate min-w-0 flex-shrink w-[180px]">
                {capitalizeName(contact.name)}
              </p>

              {/* Urgency badge */}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${urg.bgColor} ${urg.color} flex-shrink-0`}>
                {urg.label}
              </span>

              {/* Stage */}
              <span className="text-caption text-text-tertiary flex-shrink-0 w-[100px] truncate">
                {contact.stageName}
              </span>

              {/* Days */}
              <span className="text-caption text-text-tertiary flex-shrink-0 w-[40px] text-right">
                {contact.daysSinceSubTask}d
              </span>

              {/* Source */}
              {contact.source && (
                <span className="text-caption text-text-tertiary flex-shrink-0 truncate max-w-[100px] hidden lg:block">
                  {contact.source}
                </span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Load more (local pagination) */}
      {hasMoreLocal && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-2 mt-2 text-caption text-text-tertiary hover:text-text-primary flex items-center justify-center gap-1"
        >
          <ChevronDown size={12} />
          Show {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more of {sorted.length}
        </button>
      )}

      {/* Load more from server */}
      {!hasMoreLocal && hasMore && (
        <button
          onClick={() => void handleLoadMore()}
          disabled={loadingMore}
          className="w-full py-2 mt-2 text-caption text-nah-blue hover:underline flex items-center justify-center gap-1"
        >
          {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
          Load more ({totalCount - contacts.length} remaining)
        </button>
      )}
    </div>
  );
}
