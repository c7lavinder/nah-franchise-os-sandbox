"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * PipelineLeadList — Sprint 3 rewire of the All Leads list.
 *
 * Pulls from journey_pipeline_state (Supabase) instead of GHL opportunities.
 * Shows urgency colors per §1.14 (Fresh 0-5d / At Risk 5-10d / Losing 10+d).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Loader2, MessageSquare, X, Calendar } from "lucide-react";
import Link from "next/link";
import { capitalizeName, formatPhone } from "@/lib/format/contact";
import BulkComposerModal, { type BulkContact } from "./BulkComposerModal";
import PipelineQuickPanel from "./PipelineQuickPanel";

interface PipelineContact {
  stateId: string;
  contactId: string;
  ghlContactId: string | null;
  journeyId?: string;
  journeySlug?: string | null;
  territoryMsSlug?: string | null;
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
  urgency: "fresh" | "at_risk" | "losing" | "won";
  urgencyScore: number;
  enteredStageAt: string | null;
  nextAppointment?: { title: string; startTime: string } | null;
}

interface PipelineLeadListProps {
  selectedStageId: string | null;
  selectedStageName: string | null;
  searchQuery: string;
  refreshKey?: number;
}

type SortField = "urgency" | "name" | "recent";

const URGENCY_STYLES = {
  won: { label: "Won", color: "text-[#1565c0]", bgColor: "bg-[#e3f2fd]" },
  losing: { label: "Losing", color: "text-[#c62828]", bgColor: "bg-[#fce4ec]" },
  at_risk: { label: "At Risk", color: "text-[#e65100]", bgColor: "bg-[#fff3e0]" },
  fresh: { label: "Fresh", color: "text-[#2e7d32]", bgColor: "bg-[#e8f5e9]" },
};

/** Stage slug → color that matches the pipeline circles */
/** Label colors matching wave gradient circles — custom hex for exact match */
const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  // Sales
  engagement: { bg: "bg-[#fce8e5]", text: "text-[#c95a4a]" },
  qualification: { bg: "bg-[#fceee5]", text: "text-[#c97a4a]" },
  discovery: { bg: "bg-[#fcf3e0]", text: "text-[#b8924a]" },
  compliance: { bg: "bg-[#f5f5d8]", text: "text-[#9a9a38]" },
  awarding: { bg: "bg-[#eef5db]", text: "text-[#6d9a3a]" },
  closed: { bg: "bg-[#e2f2e5]", text: "text-[#3d8a4e]" },
  // Onboarding
  setup: { bg: "bg-[#fce8e5]", text: "text-[#c95a4a]" },
  training: { bg: "bg-[#fcf0e2]", text: "text-[#b88540]" },
  "launch-prep": { bg: "bg-[#f2f5d8]", text: "text-[#8a9a38]" },
  onboarded: { bg: "bg-[#e2f2e5]", text: "text-[#3d8a4e]" },
  // Runway
  "first-offer": { bg: "bg-[#fce8e5]", text: "text-[#c95a4a]" },
  "first-purchase": { bg: "bg-[#fcf0e2]", text: "text-[#b88540]" },
  "inventory-building": { bg: "bg-[#f2f5d8]", text: "text-[#8a9a38]" },
  running: { bg: "bg-[#e2f2e5]", text: "text-[#3d8a4e]" },
  // Territories
  inactive: { bg: "bg-[#fce8e5]", text: "text-[#c95a4a]" },
  available: { bg: "bg-[#fcf3e0]", text: "text-[#a89038]" },
  active: { bg: "bg-[#e2f2e5]", text: "text-[#3d8a4e]" },
  // Follow-up
  nurture: { bg: "bg-[#fce8e5]", text: "text-[#c95a4a]" },
  followup: { bg: "bg-[#fcf3e0]", text: "text-[#a89038]" },
  reengaged: { bg: "bg-[#e2f2e5]", text: "text-[#3d8a4e]" },
};

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  "google ads": { bg: "bg-blue-50", text: "text-blue-600" },
  facebook: { bg: "bg-indigo-50", text: "text-indigo-600" },
  referral: { bg: "bg-green-50", text: "text-green-600" },
  organic: { bg: "bg-emerald-50", text: "text-emerald-600" },
  website: { bg: "bg-cyan-50", text: "text-cyan-600" },
  "franchise expo": { bg: "bg-orange-50", text: "text-orange-600" },
  linkedin: { bg: "bg-sky-50", text: "text-sky-600" },
};

function getSourceStyle(source: string): { bg: string; text: string } {
  const lower = source.toLowerCase();
  for (const [key, style] of Object.entries(SOURCE_COLORS)) {
    if (lower.includes(key)) return style;
  }
  return { bg: "bg-gray-50", text: "text-gray-600" };
}

const PAGE_SIZE = 50;

export default function PipelineLeadList({
  selectedStageId,
  selectedStageName,
  searchQuery,
  refreshKey,
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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const BATCH_SIZE = 5000;

  // Abort controller ref — cancels in-flight requests when deps change
  const abortRef = useRef<AbortController | null>(null);

  // Bulk-select state — keyed by contactId. Cleared whenever the visible
  // dataset changes meaningfully (new stage filter, new search) since
  // selections from a previous view are usually no longer relevant.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  useEffect(() => {
    // Reset selection + expanded panel on stage/search change
    setSelectedIds(new Set());
    setExpandedRow(null);
  }, [selectedStageId, searchQuery]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  const fetchContacts = useCallback(
    async (append = false, currentOffset = 0) => {
      // Cancel any in-flight request before starting a new one
      if (!append) {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setVisibleCount(PAGE_SIZE);
      }
      setError(null);

      const controller = abortRef.current;

      try {
        const params = new URLSearchParams();
        params.set("limit", String(BATCH_SIZE));
        params.set("offset", String(currentOffset));
        if (selectedStageId) params.set("stage_id", selectedStageId);
        if (searchQuery) params.set("q", searchQuery);

        const res = await apiFetch(`/api/pipeline/contacts?${params.toString()}`, {
          signal: controller?.signal,
        });

        // If this request was aborted, bail out silently
        if (controller?.signal.aborted) return;

        if (res.ok) {
          const data = await res.json();
          const batch: PipelineContact[] = data.contacts ?? [];
          if (append) {
            setContacts((prev) => [...prev, ...batch]);
            setLoadingMore(false);
          } else {
            setContacts(batch);
            setTotalCount(data.totalCount ?? batch.length);
            setLoading(false);
          }
          setHasMore((data.totalCount ?? batch.length) > currentOffset + batch.length);
        } else {
          setError("Failed to load contacts");
          setLoading(false);
          setLoadingMore(false);
        }
      } catch (err) {
        // Aborted requests are not errors
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load contacts");
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedStageId, searchQuery, refreshKey]
  );

  async function handleLoadMore() {
    setLoadingMore(true);
    await fetchContacts(true, contacts.length);
  }

  useEffect(() => {
    void fetchContacts();
    return () => {
      abortRef.current?.abort();
    };
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

  // Resolve selected ids back to contact summaries for the bulk modal.
  const selectedBulkContacts: BulkContact[] = useMemo(() => {
    return contacts
      .filter((c) => selectedIds.has(c.contactId))
      .map((c) => ({
        contactId: c.contactId,
        ghlContactId: c.ghlContactId,
        name: capitalizeName(c.name),
        email: c.email,
        phone: c.phone,
      }));
  }, [contacts, selectedIds]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
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
          {selectedStageName ?? "All Journeys"}
          <span className="text-caption text-text-tertiary ml-2 font-normal">
            {totalCount > contacts.length
              ? `Showing ${contacts.length} of ${totalCount} journeys`
              : `${contacts.length} ${contacts.length === 1 ? "journey" : "journeys"}`}
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
            {searchQuery ? "No journeys match your search" : "No journeys in this stage"}
          </div>
        )}
        {visible.map((contact, i) => {
          const urg = URGENCY_STYLES[contact.urgency];

          const sc = STAGE_COLORS[contact.stageSlug] ?? { bg: "bg-gray-100", text: "text-gray-600" };
          const srcStyle = contact.source ? getSourceStyle(contact.source) : null;
          const isSelected = selectedIds.has(contact.contactId);
          const isExpanded = expandedRow === contact.stateId;

          return (
            <div key={contact.stateId}>
              <div
                onClick={() => setExpandedRow(isExpanded ? null : contact.stateId)}
                className={`
                  grid items-center gap-2 pl-2 pr-3 py-2.5 hover:bg-bg-hover transition-colors cursor-pointer
                  grid-cols-[20px_1fr_72px_16px] sm:grid-cols-[20px_1fr_72px_110px_16px] lg:grid-cols-[20px_1fr_72px_110px_140px_16px]
                  ${isSelected ? "bg-nah-blue/5" : ""}
                  ${isExpanded ? "bg-bg-hover" : ""}
                  ${!isExpanded && i < visible.length - 1 ? "border-b border-border-default" : ""}
                `}
              >
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(contact.contactId)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                  aria-label={`Select ${contact.name}`}
                />

                {/* Name — links to detail page */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link
                    href={
                      contact.journeySlug || contact.journeyId
                        ? `/journeys/${contact.journeySlug ?? contact.journeyId}${contact.territoryMsSlug ? `?territory=${contact.territoryMsSlug}` : ""}`
                        : `/leads/${contact.contactId}`
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="text-body-sm text-text-primary font-medium truncate hover:underline"
                  >
                    {capitalizeName(contact.name)}
                  </Link>
                  {contact.territoryMsSlug && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info">
                      {contact.territoryMsSlug}
                    </span>
                  )}
                  {contact.nextAppointment && (
                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-nah-blue/10 text-nah-blue">
                      <Calendar size={9} />
                      {contact.nextAppointment.title?.replace(/\s*w\/.*$/, "") ?? "Call"} ·{" "}
                      {new Date(contact.nextAppointment.startTime).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold text-center ${urg.bgColor} ${urg.color}`}
                >
                  {urg.label}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate text-center hidden sm:block ${sc.bg} ${sc.text}`}
                >
                  {contact.stageName}
                </span>

                {srcStyle ? (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate text-center hidden lg:block ${srcStyle.bg} ${srcStyle.text}`}
                  >
                    {contact.source}
                  </span>
                ) : (
                  <span className="hidden lg:block" />
                )}

                {isExpanded ? (
                  <ChevronUp size={12} className="text-nah-blue" />
                ) : (
                  <ChevronRight size={12} className="text-text-tertiary" />
                )}
              </div>

              {/* Quick-action panel */}
              {isExpanded && (
                <PipelineQuickPanel
                  contactId={contact.contactId}
                  ghlContactId={contact.ghlContactId}
                  contactName={contact.name}
                  contactEmail={contact.email}
                  contactPhone={contact.phone}
                  stageId={contact.stageId}
                  stageName={contact.stageName}
                  pipelineSlug={contact.pipelineSlug}
                  journeyId={contact.journeyId}
                  onRefresh={() => void fetchContacts()}
                />
              )}

              {/* Border after expanded panel or between collapsed rows */}
              {isExpanded && i < visible.length - 1 && <div className="border-b border-border-default" />}
            </div>
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

      {/* Bulk actions bar — sticky, only when something is selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-bg-primary border border-border-default rounded-xl shadow-2xl px-4 py-2.5">
          <span className="text-body-sm font-medium text-text-primary">{selectedIds.size} selected</span>
          <button
            onClick={clearSelection}
            className="text-text-tertiary hover:text-text-primary p-1"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
          <div className="w-px h-5 bg-border-default mx-1" />
          <button
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nah-blue text-white text-body-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <MessageSquare size={14} />
            Bulk action…
          </button>
        </div>
      )}

      {bulkModalOpen && (
        <BulkComposerModal
          contacts={selectedBulkContacts}
          onClose={() => setBulkModalOpen(false)}
          onComplete={() => clearSelection()}
        />
      )}
    </div>
  );
}
