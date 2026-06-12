"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * TerritoryDataTab — shows territory data inline on the contact page territories tab.
 * When expanded: Operations, Quarterly Grades, and read-only Ecosystem view.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, MapPin, ChevronDown, ChevronRight, Activity, Award } from "lucide-react";
import EcosystemPanel from "@/components/territory/EcosystemPanel";

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

interface Props {
  ghlContactId: string | null;
}

export default function TerritoryDataTab({ ghlContactId }: Props) {
  const [territories, setTerritories] = useState<TerritoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fullData, setFullData] = useState<TerritoryFull | null>(null);
  const [perfKpis, setPerfKpis] = useState<PerformanceKPIs | null>(null);
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
    const [tRes, pRes] = await Promise.all([
      apiFetch(`/api/territories/${slug}`).catch(() => null),
      apiFetch(`/api/territories/${slug}/performance?period=ytd`).catch(() => null),
    ]);
    if (tRes?.ok) setFullData(await tRes.json());
    if (pRes?.ok) {
      const d = await pRes.json();
      if (d?.kpis) setPerfKpis(d.kpis);
    }
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
                  <ExpandedTerritory data={fullData} kpis={perfKpis} />
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

/** Full expanded view: Operations + Grades + Ecosystem (read-only) */
function ExpandedTerritory({ data, kpis }: { data: TerritoryFull; kpis: PerformanceKPIs | null }) {
  const grades = data.grades;

  // Group grades by year
  const gradesByYear: Record<number, typeof grades> = {};
  for (const g of grades) {
    if (!gradesByYear[g.year]) gradesByYear[g.year] = [];
    gradesByYear[g.year].push(g);
  }

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

      {/* Quarterly Grades */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award size={18} className="text-warning" />
          <h3 className="text-body-sm font-semibold">Quarterly Grades</h3>
        </div>
        {grades.length === 0 ? (
          <div className="text-caption text-text-tertiary py-4 text-center">No grades recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-caption text-text-tertiary border-b border-border-default">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 px-2">Q1 Self</th>
                  <th className="py-2 px-2">Q1 John</th>
                  <th className="py-2 px-2">Q2 Self</th>
                  <th className="py-2 px-2">Q2 John</th>
                  <th className="py-2 px-2">Q3 Self</th>
                  <th className="py-2 px-2">Q3 John</th>
                  <th className="py-2 px-2">Q4 Self</th>
                  <th className="py-2 px-2">Q4 John</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(gradesByYear)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([year, yearGrades]) => (
                    <tr key={year} className="border-b border-border-default">
                      <td className="py-2 pr-4 font-medium">{year}</td>
                      {[1, 2, 3, 4].map((q) => {
                        const g = yearGrades.find((x) => x.quarter === q);
                        return [
                          <td key={`${q}s`} className="py-2 px-2 text-center">
                            {g?.self_grade ?? "—"}
                          </td>,
                          <td key={`${q}j`} className="py-2 px-2 text-center">
                            {g?.john_grade ?? "—"}
                          </td>,
                        ];
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
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
