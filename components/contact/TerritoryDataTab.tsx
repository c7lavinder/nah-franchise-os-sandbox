"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * TerritoryDataTab — shows territory data inline on the contact page territories tab.
 * When expanded: Operations, mirrored EOS habit panels, and the territory Ecosystem view.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, MapPin, ChevronDown, ChevronRight, Activity, Hammer } from "lucide-react";
import EcosystemPanel from "@/components/territory/EcosystemPanel";
import TerritoryEosHabits from "@/components/territories/eos/TerritoryEosHabits";
import type { EosTerritoryHabit } from "@/types/database";

interface TerritoryListItem {
  TerritorySlug: string;
  Nickname: string;
  status: string;
}

interface OwnerOut {
  ownerName: string | null;
  contactId: string | null;
  ghlContactId: string | null;
  role?: string;
  start_date?: string | null;
}

interface PerformanceKPIs {
  leadsEntered: number;
  conversionRate: number | null;
  soldInPeriod: number;
  avgProfit: number | null;
}

interface TerritoryFull {
  territory: {
    TerritorySlug: string;
    Nickname: string;
    status: string;
    region: string | null;
    FranchiseAgreementDate: string | null;
  };
  profile: Record<string, number | string | null> | null;
  currentOwner: OwnerOut | null;
  currentOwners?: OwnerOut[];
  grades: Array<{
    year: number;
    quarter: number;
    self_grade: number | null;
    john_grade: number | null;
    houses_purchased: number | null;
  }>;
}

interface TerritoryEosData {
  habits: EosTerritoryHabit[];
}

interface ConstructionEosData {
  habits: Record<string, string | null> | null;
}

interface Props {
  ghlContactId: string | null;
}

const CONSTRUCTION_HABIT_LABELS: Record<string, string> = {
  WeeklyBudgetMeeting: "Weekly Budget Meeting",
  AltaWeeklyVideoUpdates: "Alta Weekly Video Updates",
  Phase1Walkthroughs: "Phase 1 Walkthroughs",
  PropertyAutopsies: "Property Autopsies",
  QuarterlyIndexUpdate: "Quarterly Index Update",
};

function gradeColor(grade: string | null): string {
  if (!grade) return "text-text-tertiary";
  if (grade === "A") return "text-green-600";
  if (grade === "B") return "text-blue-600";
  if (grade === "C") return "text-yellow-600";
  if (grade === "D") return "text-orange-600";
  return "text-red-600";
}

export default function TerritoryDataTab({ ghlContactId }: Props) {
  const [territories, setTerritories] = useState<TerritoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fullData, setFullData] = useState<TerritoryFull | null>(null);
  const [perfKpis, setPerfKpis] = useState<PerformanceKPIs | null>(null);
  const [eosData, setEosData] = useState<TerritoryEosData | null>(null);
  const [constructionEosData, setConstructionEosData] = useState<ConstructionEosData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!ghlContactId) {
      setLoading(false);
      return;
    }
    apiFetch(`/api/contacts/${ghlContactId}/territory-data`)
      .then((r) => (r.ok ? r.json() : { territories: [] }))
      .then((d) => {
        const list = (d.territories ?? []).map((t: TerritoryListItem) => ({
          TerritorySlug: t.TerritorySlug,
          Nickname: t.Nickname,
          status: t.status,
        }));
        setTerritories(list);
        if (list.length === 1) handleExpand(list[0].TerritorySlug);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ghlContactId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExpand(slug: string) {
    if (expanded === slug) {
      setExpanded(null);
      return;
    }
    setExpanded(slug);
    setLoadingDetail(true);
    setFullData(null);
    setPerfKpis(null);
    setEosData(null);
    setConstructionEosData(null);
    const [tRes, pRes, eosRes, constructionEosRes] = await Promise.all([
      apiFetch(`/api/territories/${slug}`).catch(() => null),
      apiFetch(`/api/territories/${slug}/performance?period=ytd`).catch(() => null),
      apiFetch(`/api/territories/${slug}/eos`).catch(() => null),
      apiFetch(`/api/territories/${slug}/construction-eos`).catch(() => null),
    ]);
    if (tRes?.ok) setFullData(await tRes.json());
    if (pRes?.ok) {
      const d = await pRes.json();
      if (d?.kpis) setPerfKpis(d.kpis);
    }
    if (eosRes?.ok) setEosData(await eosRes.json());
    if (constructionEosRes?.ok) setConstructionEosData(await constructionEosRes.json());
    setLoadingDetail(false);
  }

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  if (territories.length === 0)
    return <p className="text-caption text-text-tertiary py-4">No territories owned by this contact.</p>;

  return (
    <div className="space-y-3">
      {territories.map((t) => {
        const isExpanded = expanded === t.TerritorySlug;
        return (
          <div key={t.TerritorySlug} className="border border-border-default rounded-lg overflow-hidden">
            <button
              onClick={() => void handleExpand(t.TerritorySlug)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <MapPin size={14} className="text-info" />
              <Link
                href={`/territories/${t.TerritorySlug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-body-sm font-medium text-nah-blue hover:underline"
              >
                {t.Nickname}
              </Link>
              <span className="text-[10px] text-text-tertiary font-mono ml-1">{t.TerritorySlug}</span>
              <span
                className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  t.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.status}
              </span>
            </button>

            {isExpanded && (
              <div className="p-4 space-y-5">
                {loadingDetail ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={18} className="animate-spin text-text-tertiary" />
                  </div>
                ) : fullData ? (
                  <ExpandedTerritory
                    data={fullData}
                    kpis={perfKpis}
                    eosData={eosData}
                    constructionEosData={constructionEosData}
                  />
                ) : (
                  <p className="text-caption text-text-tertiary">Failed to load territory data.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Full expanded view: Operations + mirrored EOS habits + mirrored Ecosystem */
function ExpandedTerritory({
  data,
  kpis,
  eosData,
  constructionEosData,
}: {
  data: TerritoryFull;
  kpis: PerformanceKPIs | null;
  eosData: TerritoryEosData | null;
  constructionEosData: ConstructionEosData | null;
}) {
  return (
    <>
      {/* Operations — YTD (from performance API, same source as territory page) */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-info" />
          <h3 className="text-body-sm font-semibold">Operations — YTD</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Leads Entered" value={kpis?.leadsEntered ?? "—"} />
          <StatCard label="Deal Progression" value={kpis?.conversionRate != null ? `${kpis.conversionRate}%` : "—"} />
          <StatCard label="Sold" value={kpis?.soldInPeriod ?? "—"} />
          <StatCard label="Avg Profit" value={kpis?.avgProfit != null ? `$${kpis.avgProfit.toLocaleString()}` : "—"} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-bg-primary border border-border-default rounded-lg p-5">
          <h3 className="text-body-sm font-semibold text-text-primary mb-3">Business EOS</h3>
          <TerritoryEosHabits habits={eosData?.habits ?? []} />
        </div>

        <div className="bg-bg-primary border border-border-default rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Hammer size={16} className="text-text-tertiary" />
            <h3 className="text-body-sm font-semibold text-text-primary">Construction EOS</h3>
          </div>
          <h4 className="text-caption font-medium text-text-tertiary mb-2">Habits</h4>
          <div className="space-y-1">
            {Object.entries(CONSTRUCTION_HABIT_LABELS).map(([key, label]) => {
              const grade = constructionEosData?.habits?.[key] ?? null;
              return (
                <div key={key} className="flex items-center justify-between text-body-sm">
                  <span className="text-text-secondary">{label}</span>
                  <span className={`font-bold ${gradeColor(grade)}`}>{grade || "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <EcosystemPanel
        TerritorySlug={data.territory.TerritorySlug}
        owner={data.currentOwner}
        owners={data.currentOwners ?? null}
      />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="text-caption text-text-tertiary">{label}</div>
      <div className="text-xl font-bold text-text-primary">{value ?? "—"}</div>
    </div>
  );
}
