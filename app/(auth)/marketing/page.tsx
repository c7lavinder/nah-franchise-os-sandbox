"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BarChart3, CheckCircle2, Mail, Map, Megaphone, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";

type Period = "T1" | "T3" | "T6" | "T12";

type MarketingData = {
  generatedAt: string;
  period: Period;
  periodStart: string;
  periodOptions: { value: Period; label: string; months: number }[];
  totals: {
    leads: number;
    convertedFranchisees: number;
    activePipeline: number;
  };
  channelCards: {
    key: string;
    name: string;
    leads: number;
    convertedFranchisees: number;
    activePipeline: number;
    avgScoutScore: number | null;
    spend: null;
    cac: null;
    dataStatus: "spend_not_connected";
    dataStatusLabel: string;
  }[];
  sourceRows: {
    name: string;
    leads: number;
    convertedFranchisees: number;
    activePipeline: number;
    avgScoutScore: number | null;
    activeTerritories: number;
  }[];
  opportunityMap: {
    activeChannels: { name: string; activeTerritories: number; periodLeads: number }[];
    missingChannels: string[];
    suggestedNextTests: string[];
  };
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  google_ads: Search,
  facebook_ads: Megaphone,
  nurture_email: Mail,
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-text-tertiary">{label}</p>
      <p className="mt-1 text-metric-sm text-text-primary">{value}</p>
    </div>
  );
}

function ChannelCard({ channel }: { channel: MarketingData["channelCards"][number] }) {
  const Icon = CHANNEL_ICONS[channel.key] ?? BarChart3;

  return (
    <section className="card-glass">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-nah-blue-light text-nah-blue">
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-card-title text-text-primary">{channel.name}</h2>
            <p className="text-caption text-text-tertiary">CRM attribution only</p>
          </div>
        </div>
        <span className="badge badge-warning">{channel.dataStatusLabel}</span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Leads" value={formatNumber(channel.leads)} />
        <Stat label="Franchisees" value={formatNumber(channel.convertedFranchisees)} />
        <Stat label="Active pipeline" value={formatNumber(channel.activePipeline)} />
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-caption text-amber-800">
        Spend and CAC are hidden until ad-platform spend is connected.
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-caption text-text-tertiary">{message}</p>;
}

export default function MarketingPage() {
  const [period, setPeriod] = useState<Period>("T3");
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/marketing?period=${period}`);
      if (!res.ok) {
        setError(`Failed to load marketing report (${res.status})`);
        return;
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load marketing report");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchMarketing();
  }, [fetchMarketing]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-headline text-page-title text-text-primary">Marketing</h1>
          <p className="mt-1 text-body text-text-secondary">
            Period-scoped lead generation, paid channel attribution, nurture performance, and territory channel gaps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["T1", "T3", "T6", "T12"] as Period[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`h-9 rounded-lg px-3 text-body-sm font-medium transition-colors ${
                period === option
                  ? "bg-nah-blue text-white"
                  : "border border-border-default bg-surface-glass text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void fetchMarketing()}
            className="btn-secondary flex h-9 items-center gap-2 !px-3 !py-0"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && !data ? (
        <section className="card-glass">
          <div className="flex items-center justify-center gap-2 py-12 text-text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            Loading marketing report...
          </div>
        </section>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="card-glass">
              <Stat label="Period leads" value={formatNumber(data.totals.leads)} />
              <p className="mt-2 text-caption text-text-tertiary">Since {formatDate(data.periodStart)}</p>
            </div>
            <div className="card-glass">
              <Stat label="Converted franchisees" value={formatNumber(data.totals.convertedFranchisees)} />
              <p className="mt-2 text-caption text-text-tertiary">From period-created contacts</p>
            </div>
            <div className="card-glass">
              <Stat label="Active pipeline" value={formatNumber(data.totals.activePipeline)} />
              <p className="mt-2 text-caption text-text-tertiary">Period leads in active journey pipelines</p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            {data.channelCards.map((channel) => (
              <ChannelCard key={channel.key} channel={channel} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-5">
            <div className="card-glass !p-0 xl:col-span-3">
              <div className="flex items-center gap-2 border-b border-border-default px-5 py-4">
                <BarChart3 size={17} className="text-nah-blue" />
                <h2 className="text-card-title text-text-primary">Source / Channel Table</h2>
                <span className="ml-auto text-caption text-text-tertiary">{data.sourceRows.length} sources</span>
              </div>
              <div className="overflow-x-auto">
                {data.sourceRows.length === 0 ? (
                  <EmptyState message="No source data available for this period." />
                ) : (
                  <table className="w-full min-w-[680px] text-left">
                    <thead className="bg-bg-tertiary text-caption text-text-tertiary">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Source</th>
                        <th className="px-5 py-3 font-semibold">Leads</th>
                        <th className="px-5 py-3 font-semibold">Franchisees</th>
                        <th className="px-5 py-3 font-semibold">Active pipeline</th>
                        <th className="px-5 py-3 font-semibold">Avg score</th>
                        <th className="px-5 py-3 font-semibold">EOS territories</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default text-body-sm">
                      {data.sourceRows.map((source) => (
                        <tr key={source.name} className="bg-white/40">
                          <td className="px-5 py-3 font-medium text-text-primary">{source.name}</td>
                          <td className="px-5 py-3 text-text-secondary">{formatNumber(source.leads)}</td>
                          <td className="px-5 py-3 text-text-secondary">
                            {formatNumber(source.convertedFranchisees)}
                          </td>
                          <td className="px-5 py-3 text-text-secondary">{formatNumber(source.activePipeline)}</td>
                          <td className="px-5 py-3 text-text-secondary">
                            {source.avgScoutScore === null ? "N/A" : source.avgScoutScore}
                          </td>
                          <td className="px-5 py-3 text-text-secondary">{formatNumber(source.activeTerritories)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <aside className="space-y-4 xl:col-span-2">
              <section className="card-glass">
                <div className="flex items-center gap-2">
                  <Map size={17} className="text-nah-blue" />
                  <h2 className="text-card-title text-text-primary">Lead-Gen Opportunity Map</h2>
                </div>

                <div className="mt-5">
                  <h3 className="text-label-caps text-text-secondary">Active Channels</h3>
                  <div className="mt-2 space-y-2">
                    {data.opportunityMap.activeChannels.length === 0 ? (
                      <p className="text-caption text-text-tertiary">No active EOS channels found.</p>
                    ) : (
                      data.opportunityMap.activeChannels.map((channel) => (
                        <div
                          key={channel.name}
                          className="flex items-center gap-3 rounded-lg border border-border-default bg-white/50 px-3 py-2"
                        >
                          <CheckCircle2 size={15} className="text-success" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-medium text-text-primary">{channel.name}</p>
                            <p className="text-caption text-text-tertiary">
                              {channel.activeTerritories} active territor
                              {channel.activeTerritories === 1 ? "y" : "ies"} · {channel.periodLeads} period leads
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="text-label-caps text-text-secondary">Missing Channels</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.opportunityMap.missingChannels.length === 0 ? (
                      <span className="text-caption text-text-tertiary">No expected channel gaps.</span>
                    ) : (
                      data.opportunityMap.missingChannels.map((channel) => (
                        <span key={channel} className="badge badge-cold">
                          {channel}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="card-glass">
                <h2 className="text-card-title text-text-primary">Suggested Next Tests</h2>
                {data.opportunityMap.suggestedNextTests.length === 0 ? (
                  <EmptyState message="No suggested tests from the current data." />
                ) : (
                  <div className="mt-4 space-y-3">
                    {data.opportunityMap.suggestedNextTests.map((test) => (
                      <div key={test} className="rounded-lg border border-border-default bg-white/50 p-3">
                        <p className="text-body-sm text-text-primary">{test}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}
