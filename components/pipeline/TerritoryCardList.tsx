"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth/api-fetch";

interface TerritoryCard {
  TerritorySlug: string;
  Nickname: string;
  status: string;
  owner_name: string | null;
  owner_ghl_contact_id: string | null;
  FranchiseAgreementDate: string | null;
  stage_name: string | null;
  stage_slug: string | null;
  pipeline_slug: string | null;
  highPerformer?: boolean;
  performanceQuartile?: "Q1" | "Q2" | "Q3" | "Q4" | null;
  performanceScore?: number | null;
  performanceRank?: number | null;
  performanceStatus?: string | null;
  performanceCoachingFlag?: string | null;
  performanceCoachingReason?: string | null;
  performanceLeadWorkRate?: number | null;
}

/** Label colors matching wave gradient circles — custom hex */
const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
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
};

interface Props {
  status?: string;
  statusFilter?: string | null;
  stageId?: string | null;
  searchQuery?: string;
}

const STATUS_STYLES: Record<string, { label: string; bgColor: string; color: string }> = {
  active: { label: "Active", bgColor: "bg-[#e8f5e9]", color: "text-[#2e7d32]" },
  inactive: { label: "Inactive", bgColor: "bg-[#f5f5f5]", color: "text-[#757575]" },
  available: { label: "Available", bgColor: "bg-[#e3f2fd]", color: "text-[#1565c0]" },
};

const QUARTILE_STYLES: Record<string, { bg: string; text: string }> = {
  Q1: { bg: "bg-emerald-50", text: "text-emerald-700" },
  Q2: { bg: "bg-yellow-50", text: "text-yellow-700" },
  Q3: { bg: "bg-orange-50", text: "text-orange-700" },
  Q4: { bg: "bg-red-50", text: "text-red-700" },
};

type SortField = "name" | "status" | "performance" | "owner";
const PAGE_SIZE = 50;

export default function TerritoryCardList({ status, statusFilter, stageId, searchQuery }: Props) {
  const router = useRouter();
  const effectiveStatus = statusFilter ?? status;
  const [cards, setCards] = useState<TerritoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (effectiveStatus) params.set("status", effectiveStatus);
    if (stageId) params.set("stage_id", stageId);
    const url = `/api/pipeline/territory-cards${params.toString() ? `?${params.toString()}` : ""}`;
    apiFetch(url)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveStatus, stageId]);

  const filtered = searchQuery
    ? cards.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          c.Nickname.toLowerCase().includes(q) ||
          c.TerritorySlug.toLowerCase().includes(q) ||
          (c.owner_name?.toLowerCase().includes(q) ?? false)
        );
      })
    : cards;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.Nickname.localeCompare(b.Nickname);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "performance":
        cmp = (a.performanceRank ?? 999).toString().localeCompare((b.performanceRank ?? 999).toString(), undefined, {
          numeric: true,
        });
        break;
      case "owner":
        cmp = (a.owner_name ?? "zzz").localeCompare(b.owner_name ?? "zzz");
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h2 text-text-primary">
          {effectiveStatus
            ? `${effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)} Territories`
            : "Territory Network"}
          <span className="text-caption text-text-tertiary ml-2 font-normal">
            {searchQuery && filtered.length !== cards.length
              ? `${filtered.length} of ${cards.length} territories`
              : `${cards.length} ${cards.length === 1 ? "territory" : "territories"}`}
          </span>
        </h2>
      </div>

      {/* Sort controls */}
      <div className="flex gap-4 mb-2 px-3 py-2 bg-bg-secondary rounded-t-lg border border-border-default border-b-0">
        {(["name", "status", "performance", "owner"] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={`text-caption font-medium ${sortField === field ? "text-nah-orange" : "text-text-tertiary"} hover:text-text-primary`}
          >
            {field === "name" ? "Name" : field === "status" ? "Status" : field === "performance" ? "Quartile" : "Owner"}
            {sortField === field && (sortAsc ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {/* Territory rows */}
      <div className="border border-border-default rounded-b-lg overflow-hidden">
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-body-sm text-text-tertiary">No territories found</div>
        )}
        {visible.map((card, i) => {
          const st = STATUS_STYLES[card.status] ?? {
            label: card.status,
            bgColor: "bg-[#f5f5f5]",
            color: "text-[#757575]",
          };

          const sc = card.stage_slug
            ? (STAGE_COLORS[card.stage_slug] ?? { bg: "bg-gray-100", text: "text-gray-600" })
            : null;
          const qc = card.performanceQuartile ? QUARTILE_STYLES[card.performanceQuartile] : null;

          return (
            <Link
              key={card.TerritorySlug}
              href={`/territories/${card.TerritorySlug}`}
              className={`
                grid items-center gap-2 px-3 py-2.5 hover:bg-bg-hover transition-colors
                grid-cols-[1fr_72px_110px_140px_16px]
                ${i < visible.length - 1 ? "border-b border-border-default" : ""}
              `}
            >
              {/* Name + slug + high performer */}
              <p className="text-body-sm text-text-primary font-medium truncate min-w-0 flex items-center gap-1.5">
                {card.Nickname}
                <span className="text-[10px] text-text-tertiary font-mono font-normal">{card.TerritorySlug}</span>
                {card.highPerformer && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success whitespace-nowrap">
                    High Performer
                  </span>
                )}
                {card.performanceQuartile && qc && (
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${qc.bg} ${qc.text}`}
                    title={`${card.performanceStatus ?? card.performanceQuartile} · ${card.performanceScore ?? 0} pts · rank ${card.performanceRank ?? "—"} · ${card.performanceCoachingReason ?? "No coaching reason"}`}
                  >
                    {card.performanceQuartile} · {card.performanceScore} pts
                  </span>
                )}
                {card.performanceCoachingFlag && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-nah-blue-light text-nah-blue whitespace-nowrap"
                    title={`${card.performanceCoachingReason ?? card.performanceCoachingFlag}${card.performanceLeadWorkRate == null ? "" : ` · ${card.performanceLeadWorkRate}% worked`}`}
                  >
                    {card.performanceCoachingFlag}
                  </span>
                )}
              </p>

              {/* Status badge */}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold text-center ${st.bgColor} ${st.color}`}>
                {st.label}
              </span>

              {/* Pipeline stage — colored label */}
              {sc && card.stage_name ? (
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate text-center ${sc.bg} ${sc.text}`}
                >
                  {card.stage_name}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-medium truncate text-center bg-gray-50 text-gray-400">
                  —
                </span>
              )}

              {/* Owner — pill label, clickable to contact page */}
              {card.owner_name ? (
                <span
                  onClick={
                    card.owner_ghl_contact_id
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/leads/${card.owner_ghl_contact_id}`);
                        }
                      : undefined
                  }
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate text-center bg-blue-50 text-blue-600 ${card.owner_ghl_contact_id ? "hover:bg-blue-100 cursor-pointer" : ""}`}
                >
                  {card.owner_name}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-medium truncate text-center bg-gray-50 text-gray-400">
                  No owner
                </span>
              )}

              <ChevronRight size={12} className="text-text-tertiary" />
            </Link>
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
