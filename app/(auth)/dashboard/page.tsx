"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { KPICards, PipelineFunnelChart, LeadSourceTable, StageVelocity, ConversionChart, TimePeriodSelector, ScoreDistribution } from "@/components/dashboard";

interface SourceData {
  name: string;
  count: number;
  color: string;
}

interface StageCount {
  pipelineName: string;
  stageName: string;
  count: number;
  avgDays?: number;
}

interface DashboardData {
  kpis: {
    activeLeads: number;
    won: number;
    lost: number;
    conversionRate: number;
    totalContacts: number;
  };
  funnel: StageCount[];
  sources: SourceData[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState("all");

  const fetchDashboard = useCallback(async (period: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?period=${period}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load dashboard — GHL may be unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard(timePeriod);
  }, [fetchDashboard, timePeriod]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchDashboard(timePeriod);
    }, 300000);
    return () => clearInterval(interval);
  }, [fetchDashboard, timePeriod]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Leadership Dashboard</h1>
        <div className="ml-auto flex items-center gap-2">
          <TimePeriodSelector selected={timePeriod} onChange={setTimePeriod} />
          <button
            onClick={() => void fetchDashboard(timePeriod)}
            className="btn-ghost p-1.5"
            title="Refresh dashboard"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
          <p className="text-body-sm text-warning">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-bg-secondary border border-border-default rounded-lg p-4 animate-pulse">
                <div className="w-8 h-8 bg-bg-tertiary rounded-lg mb-2" />
                <div className="h-8 bg-bg-tertiary rounded w-16 mb-1" />
                <div className="h-3 bg-bg-tertiary rounded w-20" />
              </div>
            ))}
          </div>
          <div className="bg-bg-secondary border border-border-default rounded-lg p-4 animate-pulse h-[300px]" />
        </div>
      )}

      {/* Dashboard content */}
      {data && (
        <>
          <KPICards
            activeLeads={data.kpis.activeLeads}
            won={data.kpis.won}
            lost={data.kpis.lost}
            conversionRate={data.kpis.conversionRate}
            totalContacts={data.kpis.totalContacts}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <PipelineFunnelChart stages={data.funnel} />
            </div>
            <div>
              <LeadSourceTable
                sources={data.sources}
                totalContacts={data.kpis.totalContacts}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ConversionChart
              stageCounts={data.funnel}
              wonCount={data.kpis.won}
              lostCount={data.kpis.lost}
            />
            <StageVelocity stages={data.funnel} />
            <ScoreDistribution />
          </div>
        </>
      )}
    </div>
  );
}
