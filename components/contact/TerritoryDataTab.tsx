"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * TerritoryDataTab — shows territory data inline on the contact page territories tab.
 * When expanded: Operations, Quarterly Grades, and read-only Ecosystem view.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  MapPin,
  ChevronDown,
  ChevronRight,
  Activity,
  Award,
  Briefcase,
  Wrench,
  Heart,
  Scale,
  HandshakeIcon,
  Home,
  Users,
} from "lucide-react";

interface TerritoryListItem {
  TerritorySlug: string;
  Nickname: string;
  status: string;
}

interface OwnerOut {
  ownerName: string | null;
  ghlContactId: string | null;
  role?: string;
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

interface Stakeholder {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  role: string;
}

interface Props {
  ghlContactId: string | null;
}

const ROLE_STYLES: Record<string, { label: string; icon: typeof Briefcase; color: string }> = {
  agent: { label: "Agent", icon: Briefcase, color: "bg-blue-100 text-blue-700 border-blue-200" },
  contractor: { label: "Contractor", icon: Wrench, color: "bg-amber-100 text-amber-700 border-amber-200" },
  family: { label: "Family", icon: Heart, color: "bg-pink-100 text-pink-700 border-pink-200" },
  lawyer: { label: "Lawyer", icon: Scale, color: "bg-purple-100 text-purple-700 border-purple-200" },
  partner: { label: "Partner", icon: HandshakeIcon, color: "bg-green-100 text-green-700 border-green-200" },
  lender: { label: "Lender", icon: Home, color: "bg-teal-100 text-teal-700 border-teal-200" },
  other: { label: "Other", icon: Users, color: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function TerritoryDataTab({ ghlContactId }: Props) {
  const [territories, setTerritories] = useState<TerritoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fullData, setFullData] = useState<TerritoryFull | null>(null);
  const [perfKpis, setPerfKpis] = useState<PerformanceKPIs | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
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
    setStakeholders([]);
    const [tRes, sRes, pRes] = await Promise.all([
      apiFetch(`/api/territories/${slug}`).catch(() => null),
      apiFetch(`/api/territories/${slug}/stakeholders`).catch(() => null),
      apiFetch(`/api/territories/${slug}/performance?period=ytd`).catch(() => null),
    ]);
    if (tRes?.ok) setFullData(await tRes.json());
    if (sRes?.ok) {
      const d = await sRes.json();
      setStakeholders(d.stakeholders ?? []);
    }
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
                  <ExpandedTerritory data={fullData} stakeholders={stakeholders} kpis={perfKpis} />
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
function ExpandedTerritory({
  data,
  stakeholders,
  kpis,
}: {
  data: TerritoryFull;
  stakeholders: Stakeholder[];
  kpis: PerformanceKPIs | null;
}) {
  const grades = data.grades;

  // Group grades by year
  const gradesByYear: Record<number, typeof grades> = {};
  for (const g of grades) {
    if (!gradesByYear[g.year]) gradesByYear[g.year] = [];
    gradesByYear[g.year].push(g);
  }

  // Group stakeholders by role
  const grouped = new Map<string, Stakeholder[]>();
  for (const s of stakeholders) {
    const arr = grouped.get(s.role) ?? [];
    arr.push(s);
    grouped.set(s.role, arr);
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

      {/* Ecosystem — read-only */}
      {(stakeholders.length > 0 || (data.currentOwners?.length ?? 0) > 0 || data.currentOwner?.ownerName) &&
        (() => {
          const ownerList: OwnerOut[] =
            data.currentOwners && data.currentOwners.length > 0
              ? data.currentOwners
              : data.currentOwner
                ? [data.currentOwner]
                : [];
          return (
            <div className="bg-bg-primary border border-border-default rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-scout-purple" />
                <h3 className="text-body-sm font-semibold">Ecosystem</h3>
              </div>
              <div className="flex flex-col items-center">
                {/* Owner center node(s) — side-by-side for co-owners */}
                {ownerList.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-4 mb-4">
                    {ownerList.map((o, i) => {
                      const name = o.ownerName ?? "—";
                      const initials = name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();
                      const isCoPrimary = o.role === "co_primary";
                      return (
                        <div key={`${o.ghlContactId ?? i}-${o.role ?? "owner"}`} className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full bg-nah-orange/10 border-2 border-nah-orange flex items-center justify-center">
                            <span className="text-lg font-bold text-nah-orange">{initials}</span>
                          </div>
                          <p className="text-body-sm font-semibold text-text-primary mt-1.5">{name}</p>
                          <span className="text-[10px] font-medium text-nah-orange tracking-wider">
                            {isCoPrimary ? "CO-OWNER" : "OWNER"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Stakeholders by role */}
                {stakeholders.length > 0 && (
                  <>
                    {ownerList.length > 0 && <div className="w-0.5 h-4 bg-border-default -mt-1 mb-2" />}
                    <div className="flex flex-wrap justify-center gap-3">
                      {Object.entries(ROLE_STYLES).map(([roleKey, roleDef]) => {
                        const members = grouped.get(roleKey);
                        if (!members || members.length === 0) return null;
                        const Icon = roleDef.icon;
                        return (
                          <div key={roleKey} className="flex flex-col items-center">
                            <div
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border mb-2 ${roleDef.color}`}
                            >
                              <Icon size={10} />
                              {roleDef.label}
                            </div>
                            <div className="flex flex-wrap justify-center gap-2">
                              {members.map((s) => {
                                const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
                                const initials = name
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase();
                                return (
                                  <div key={s.id} className="flex flex-col items-center">
                                    <div
                                      className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold border ${roleDef.color}`}
                                    >
                                      {initials}
                                    </div>
                                    <p className="text-[10px] text-text-primary font-medium mt-1 max-w-[70px] truncate text-center">
                                      {name}
                                    </p>
                                    {s.company && (
                                      <p className="text-[9px] text-text-tertiary max-w-[70px] truncate text-center">
                                        {s.company}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {stakeholders.length === 0 && ownerList.length === 0 && (
                  <p className="text-caption text-text-tertiary">No ecosystem data.</p>
                )}
              </div>
            </div>
          );
        })()}
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
