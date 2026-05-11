"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Activity, AlertTriangle, Loader2 } from "lucide-react";
import EcosystemPanel from "@/components/territory/EcosystemPanel";
import TerritoryEosTab from "@/components/territories/tabs/EosTab";
import MarketTab from "@/components/territories/tabs/MarketTab";
import PerformanceTab from "@/components/territories/tabs/PerformanceTab";
import DetailsTab from "@/components/territories/tabs/DetailsTab";

interface OwnerOut {
  ownerName: string | null;
  ghlContactId: string | null;
  role?: string;
  start_date?: string | null;
}

interface TerritoryRecord {
  TerritorySlug: string;
  Nickname: string;
  status: string;
  region: string | null;
  FranchiseAgreementDate: string | null;
  [key: string]: unknown;
}

interface TerritoryData {
  territory: TerritoryRecord;
  profile: Record<string, unknown> | null;
  currentOwner: OwnerOut | null;
  currentOwners?: OwnerOut[];
  grades: Array<{
    year: number;
    quarter: number;
    self_grade: number | null;
    john_grade: number | null;
    houses_purchased: number | null;
    notes: string | null;
  }>;
  franchiseOwner: { full_name: string; status: string } | null;
}

interface PerformanceKPIs {
  leadsEntered: number;
  leadProgression: number | null;
  activeInventory: number;
  soldInPeriod: number;
  avgProfit: number | null;
  totalProfit: number | null;
  conversionRate: number | null;
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

interface QuarterlyGrade {
  Scope: string;
  PropertiesAcquired: number | null;
  NumberSold: number | null;
  NumberInInventory: number | null;
  GrossProfit: number | null;
  LeadsEntered: number | null;
  Stage1toStage4: number | null;
  MedianCycleDays: number | null;
  AverageComplianceScore: number | null;
  [key: string]: unknown;
}

export default function TerritoryProfilePage() {
  const params = useParams();
  const router = useRouter();
  const TerritorySlug = params.TerritorySlug as string;

  const [data, setData] = useState<TerritoryData | null>(null);
  const [kpis, setKpis] = useState<PerformanceKPIs | null>(null);
  const [t12Sold, setT12Sold] = useState<number | null>(null);
  const [quarterlyGrades, setQuarterlyGrades] = useState<QuarterlyGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"performance" | "ecosystem" | "market" | "eos" | "details">("performance");

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/territories/${TerritorySlug}`).then((r) => r.json()),
      apiFetch(`/api/territories/${TerritorySlug}/performance?period=ytd`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      apiFetch(`/api/territories/${TerritorySlug}/performance?period=t12`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      apiFetch(`/api/territories/${TerritorySlug}/quarterly-grades`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([territoryData, perfData, t12Data, gradesData]) => {
        setData(territoryData);
        if (perfData?.kpis) setKpis(perfData.kpis);
        if (t12Data?.kpis) setT12Sold(t12Data.kpis.purchasedInPeriod ?? 0);
        if (gradesData?.grades) setQuarterlyGrades(gradesData.grades);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [TerritorySlug]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  if (!data) return <div className="p-6 text-text-secondary">Territory not found.</div>;

  const { territory, currentOwner, currentOwners } = data;
  const ownerNames = (currentOwners && currentOwners.length > 0 ? currentOwners : currentOwner ? [currentOwner] : [])
    .map((o) => o.ownerName)
    .filter(Boolean) as string[];
  const carriedOwnerName = ownerNames.length > 1 ? ownerNames.join(" + ") : (ownerNames[0] ?? null);
  // 10+ houses purchased in last 12 months = high performer
  const isHighPerformer = territory.status === "active" && t12Sold !== null && t12Sold >= 10;
  const isUnderTarget = territory.status === "active" && t12Sold !== null && t12Sold < 10 && !isHighPerformer;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 text-text-tertiary hover:text-text-primary">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{territory.Nickname}</h1>
            <StatusBadge status={territory.status} />
            {isHighPerformer && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success">
                High Performer
              </span>
            )}
            {isUnderTarget && (
              <span className="flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={14} /> Below target
              </span>
            )}
          </div>
          <div className="text-body-sm text-text-tertiary mt-1 flex items-center gap-3">
            <span className="font-mono">{territory.TerritorySlug}</span>
            {territory.FranchiseAgreementDate && (
              <span>Awarded {new Date(territory.FranchiseAgreementDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* Persistent: Operations — YTD */}
      <div className="bg-bg-primary border border-border-default rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-info" />
          <h2 className="text-body-sm font-semibold">Operations — YTD</h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Leads Entered" value={kpis?.leadsEntered ?? "—"} sub="hit Stage 1" />
          <StatCard
            label="Conversion"
            value={kpis?.conversionRate != null ? `${kpis.conversionRate}%` : "—"}
            sub="S1 → S4+"
          />
          <StatCard label="Sold" value={kpis?.soldInPeriod ?? "—"} />
          <StatCard label="Avg Profit" value={kpis?.avgProfit != null ? `$${kpis.avgProfit.toLocaleString()}` : "—"} />
        </div>
      </div>

      {/* Quarterly Scorecard — from MasterSuite TerritoryScorecardKPIs */}
      {quarterlyGrades.length > 0 && (
        <div className="bg-bg-primary border border-border-default rounded-lg p-5">
          <h2 className="text-body-sm font-semibold mb-4">Quarterly Scorecard</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-caption text-text-tertiary border-b border-border-default">
                  <th className="py-2 pr-3">Quarter</th>
                  <th className="py-2 px-2 text-right">Acquired</th>
                  <th className="py-2 px-2 text-right">Sold</th>
                  <th className="py-2 px-2 text-right">Inventory</th>
                  <th className="py-2 px-2 text-right">Gross Profit</th>
                  <th className="py-2 px-2 text-right">Leads</th>
                  <th className="py-2 px-2 text-right">S1→S4</th>
                  <th className="py-2 px-2 text-right">Cycle Days</th>
                  <th className="py-2 px-2 text-right">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyGrades.map((g, i) => (
                  <tr key={i} className="border-b border-border-default/50">
                    <td className="py-2 pr-3 font-medium">{g.Scope}</td>
                    <td className="py-2 px-2 text-right">{g.PropertiesAcquired ?? "—"}</td>
                    <td className="py-2 px-2 text-right">{g.NumberSold ?? "—"}</td>
                    <td className="py-2 px-2 text-right">{g.NumberInInventory ?? "—"}</td>
                    <td className="py-2 px-2 text-right">
                      {g.GrossProfit != null ? `$${Number(g.GrossProfit).toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right">{g.LeadsEntered ?? "—"}</td>
                    <td className="py-2 px-2 text-right">
                      {g.Stage1toStage4 != null ? `${Number(g.Stage1toStage4).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right">{g.MedianCycleDays ?? "—"}</td>
                    <td className="py-2 px-2 text-right">
                      {g.AverageComplianceScore != null ? Number(g.AverageComplianceScore).toFixed(0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-default">
        {[
          { key: "performance" as const, label: "Performance" },
          { key: "ecosystem" as const, label: "Ecosystem" },
          { key: "market" as const, label: "Market & Financial" },
          { key: "eos" as const, label: "EOS" },
          { key: "details" as const, label: "Details" },
        ].map((tab) => (
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
      {activeTab === "performance" && <PerformanceTab TerritorySlug={TerritorySlug} />}

      {activeTab === "ecosystem" && (
        <EcosystemPanel TerritorySlug={TerritorySlug} owner={currentOwner} owners={currentOwners ?? null} />
      )}

      {activeTab === "eos" && (
        <TerritoryEosTab TerritorySlug={TerritorySlug} carriedFromContactName={carriedOwnerName} />
      )}

      {activeTab === "market" && <MarketTab TerritorySlug={TerritorySlug} />}

      {activeTab === "details" && <DetailsTab territory={territory as any} />}
    </div>
  );
}
