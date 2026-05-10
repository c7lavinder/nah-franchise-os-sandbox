"use client";
import { apiFetch } from "@/lib/auth/api-fetch";
import { useState, useEffect } from "react";
import { BarChart3, Loader2 } from "lucide-react";

interface KPIs {
  leadsEntered: number;
  leadProgression: number | null;
  activeInventory: number;
  soldInPeriod: number;
  avgProfit: number | null;
  conversionRate: number | null;
}

interface Props {
  TerritorySlug: string;
  Nickname: string;
}

export default function TerritoryPerformanceCard({ TerritorySlug, Nickname }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/territories/${TerritorySlug}/performance`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.kpis) setKpis(d.kpis);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [TerritorySlug]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={14} className="animate-spin text-text-tertiary" />
      </div>
    );

  if (!kpis) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 size={14} className="text-text-tertiary" />
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">
          {Nickname.toUpperCase()} PERFORMANCE
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-bg-tertiary rounded px-2 py-1.5">
          <div className="text-[10px] text-text-tertiary">Leads Entered</div>
          <div className="text-body-sm font-bold text-text-primary">{kpis.leadsEntered}</div>
        </div>
        <div className="bg-bg-tertiary rounded px-2 py-1.5">
          <div className="text-[10px] text-text-tertiary">Sold (3mo)</div>
          <div className="text-body-sm font-bold text-text-primary">{kpis.soldInPeriod}</div>
        </div>
        <div className="bg-bg-tertiary rounded px-2 py-1.5">
          <div className="text-[10px] text-text-tertiary">Inventory</div>
          <div className="text-body-sm font-bold text-text-primary">{kpis.activeInventory}</div>
        </div>
        <div className="bg-bg-tertiary rounded px-2 py-1.5">
          <div className="text-[10px] text-text-tertiary">Conversion</div>
          <div className="text-body-sm font-bold text-text-primary">
            {kpis.conversionRate != null ? `${kpis.conversionRate}%` : "—"}
          </div>
        </div>
        <div className="bg-bg-tertiary rounded px-2 py-1.5">
          <div className="text-[10px] text-text-tertiary">Avg Profit</div>
          <div className="text-body-sm font-bold text-text-primary">
            {kpis.avgProfit != null ? `$${kpis.avgProfit.toLocaleString()}` : "—"}
          </div>
        </div>
        <div className="bg-bg-tertiary rounded px-2 py-1.5">
          <div className="text-[10px] text-text-tertiary">Progression</div>
          <div className="text-body-sm font-bold text-text-primary">
            {kpis.leadProgression != null ? `${kpis.leadProgression}%` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
