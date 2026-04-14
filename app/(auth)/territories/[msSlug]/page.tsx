"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Activity, DollarSign,
  BarChart3, Award, AlertTriangle, Loader2,
} from "lucide-react";
import EcosystemPanel from "@/components/territory/EcosystemPanel";
import TerritoryEosTab from "@/components/territories/tabs/EosTab";
import MarketTab from "@/components/territories/tabs/MarketTab";

interface TerritoryData {
  territory: { ms_slug: string; territory_name: string; status: string; region: string | null; awarded_date: string | null };
  profile: Record<string, unknown> | null;
  currentOwner: { ownerName: string | null; ghlContactId: string | null; role?: string; start_date?: string } | null;
  grades: Array<{ year: number; quarter: number; self_grade: number | null; john_grade: number | null; houses_purchased: number | null; notes: string | null }>;
  franchiseOwner: { full_name: string; status: string } | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-600",
    available: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-3">
      <div className="text-caption text-text-tertiary">{label}</div>
      <div className="text-xl font-bold text-text-primary">{value}</div>
      {sub && <div className="text-caption text-text-tertiary">{sub}</div>}
    </div>
  );
}

export default function TerritoryProfilePage() {
  const params = useParams();
  const router = useRouter();
  const msSlug = params.msSlug as string;

  const [data, setData] = useState<TerritoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ecosystem" | "market" | "eos">("ecosystem");

  useEffect(() => {
    fetch(`/api/territories/${msSlug}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [msSlug]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={24} /></div>;
  if (!data) return <div className="p-6 text-text-secondary">Territory not found.</div>;

  const { territory, profile, currentOwner, grades } = data;
  const p = profile as Record<string, number | string | null> | null;
  const housesYTD = (p?.houses_purchased_ytd as number) ?? 0;
  const isUnderTarget = housesYTD < 10 && territory.status === "active";

  // Group grades by year
  const gradesByYear: Record<number, typeof grades> = {};
  for (const g of grades) {
    if (!gradesByYear[g.year]) gradesByYear[g.year] = [];
    gradesByYear[g.year].push(g);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 text-text-tertiary hover:text-text-primary">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{territory.territory_name}</h1>
            <StatusBadge status={territory.status} />
            {isUnderTarget && (
              <span className="flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={14} /> Below target
              </span>
            )}
          </div>
          <div className="text-body-sm text-text-tertiary mt-1 flex items-center gap-3">
            <span className="font-mono">{territory.ms_slug}</span>
            {territory.awarded_date && <span>Awarded {new Date(territory.awarded_date).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>

      {/* Persistent: Operations — full width, big number + 4-col stats */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-info" />
          <h2 className="text-body-sm font-semibold">Operations</h2>
        </div>
        <div className="text-center mb-4">
          <div className="text-4xl font-bold text-text-primary">{housesYTD}</div>
          <div className="text-caption text-text-tertiary">Houses Purchased YTD</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sold YTD" value={p?.houses_sold_ytd ?? "—"} />
          <StatCard label="Active Deals" value={p?.active_deals ?? "—"} />
          <StatCard label="Lead Conv. Rate" value={p?.lead_conversion_rate ? `${p.lead_conversion_rate}%` : "—"} />
          <StatCard label="Avg Profit/Flip" value={p?.avg_profit_per_flip ? `$${Number(p.avg_profit_per_flip).toLocaleString()}` : "—"} />
        </div>
      </div>

      {/* Persistent: Quarterly Grades — full width, Self/John columns */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award size={18} className="text-warning" />
          <h2 className="text-body-sm font-semibold">Quarterly Grades</h2>
        </div>
        {grades.length === 0 ? (
          <div className="text-caption text-text-tertiary py-4 text-center">No grades recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-caption text-text-tertiary border-b border-border-default">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 px-2">Q1 Self</th><th className="py-2 px-2">Q1 John</th>
                  <th className="py-2 px-2">Q2 Self</th><th className="py-2 px-2">Q2 John</th>
                  <th className="py-2 px-2">Q3 Self</th><th className="py-2 px-2">Q3 John</th>
                  <th className="py-2 px-2">Q4 Self</th><th className="py-2 px-2">Q4 John</th>
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
                        return (
                          <React.Fragment key={q}>
                            <td className="py-2 px-2 text-center">{g?.self_grade ?? "—"}</td>
                            <td className="py-2 px-2 text-center">{g?.john_grade ?? "—"}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-default">
        {([
          { key: "ecosystem" as const, label: "Ecosystem" },
          { key: "market" as const, label: "Market & Financial" },
          { key: "eos" as const, label: "EOS" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-nah-orange text-nah-orange"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "ecosystem" && (
        <EcosystemPanel msSlug={msSlug} owner={currentOwner} />
      )}

      {activeTab === "eos" && (
        <TerritoryEosTab
          msSlug={msSlug}
          carriedFromContactName={currentOwner?.ownerName ?? null}
        />
      )}

      {activeTab === "market" && (
        <MarketTab msSlug={msSlug} />
      )}
    </div>
  );
}
