"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface TerritoryCard {
  ms_slug: string;
  territory_name: string;
  status: string;
  owner_name: string | null;
  owner_ghl_contact_id: string | null;
  awarded_date: string | null;
}

interface Props {
  status?: string;
  statusFilter?: string | null;
}

const STATUS_STYLES: Record<string, { label: string; bgColor: string; color: string }> = {
  active:    { label: "Active",    bgColor: "bg-[#e8f5e9]", color: "text-[#2e7d32]" },
  inactive:  { label: "Inactive",  bgColor: "bg-[#f5f5f5]", color: "text-[#757575]" },
  available: { label: "Available", bgColor: "bg-[#e3f2fd]", color: "text-[#1565c0]" },
};

type SortField = "name" | "status" | "owner";
const PAGE_SIZE = 50;

export default function TerritoryCardList({ status, statusFilter }: Props) {
  const effectiveStatus = statusFilter ?? status;
  const [cards, setCards] = useState<TerritoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    const url = effectiveStatus
      ? `/api/pipeline/territory-cards?status=${effectiveStatus}`
      : "/api/pipeline/territory-cards";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveStatus]);

  const sorted = [...cards].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.territory_name.localeCompare(b.territory_name);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
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
    else { setSortField(field); setSortAsc(true); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-text-tertiary" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-h2 text-text-primary">
          {effectiveStatus ? `${effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)} Territories` : "Territory Network"}
          <span className="text-caption text-text-tertiary ml-2 font-normal">
            {cards.length} {cards.length === 1 ? "territory" : "territories"}
          </span>
        </h2>
      </div>

      {/* Sort controls */}
      <div className="flex gap-4 mb-2 px-3 py-2 bg-bg-secondary rounded-t-lg border border-border-default border-b-0">
        {(["name", "status", "owner"] as SortField[]).map((field) => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={`text-caption font-medium ${sortField === field ? "text-nah-orange" : "text-text-tertiary"} hover:text-text-primary`}
          >
            {field === "name" ? "Name" : field === "status" ? "Status" : "Owner"}
            {sortField === field && (sortAsc ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {/* Territory rows */}
      <div className="border border-border-default rounded-b-lg overflow-hidden">
        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-body-sm text-text-tertiary">
            No territories found
          </div>
        )}
        {visible.map((card, i) => {
          const st = STATUS_STYLES[card.status] ?? { label: card.status, bgColor: "bg-[#f5f5f5]", color: "text-[#757575]" };

          return (
            <Link
              key={card.ms_slug}
              href={`/territories/${card.ms_slug}`}
              className={`
                flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover transition-colors
                ${i < visible.length - 1 ? "border-b border-border-default" : ""}
              `}
            >
              {/* Name */}
              <p className="text-body-sm text-text-primary font-medium truncate min-w-0 flex-shrink w-[200px]">
                {card.territory_name}
              </p>

              {/* Status badge */}
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${st.bgColor} ${st.color} flex-shrink-0`}>
                {st.label}
              </span>

              {/* Slug */}
              <span className="text-caption text-text-tertiary flex-shrink-0 w-[80px] truncate font-mono">
                {card.ms_slug}
              </span>

              {/* Owner — clickable to contact page */}
              {card.owner_name && card.owner_ghl_contact_id ? (
                <span
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/leads/${card.owner_ghl_contact_id}`; }}
                  className="text-caption text-nah-blue font-medium flex-shrink-0 truncate w-[160px] hover:underline cursor-pointer"
                >
                  {card.owner_name}
                </span>
              ) : (
                <span className="text-caption text-text-tertiary italic flex-shrink-0 truncate w-[160px]">
                  {card.owner_name ?? "No owner"}
                </span>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
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
