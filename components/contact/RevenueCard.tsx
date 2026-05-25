"use client";

/**
 * RevenueCard — premium revenue visualization panel.
 * Franchise fee (editable) + royalty paid/due + cumulative area chart.
 */

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Loader2, TrendingUp, DollarSign, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/components/ui/Toast";

interface RevenueData {
  franchise_fee: number | null;
  total_paid: number;
  total_due: number;
  monthly_series: { month: string; paid: number }[];
}

interface Props {
  journeyId: string;
  contactId: string;
  franchiseFee: number | null;
  onFeeUpdate: (fee: number | null) => void;
}

function formatDollar(amount: number | null): string {
  if (amount == null) return "—";
  if (amount >= 1000) {
    return "$" + (amount / 1000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + "k";
  }
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDollarFull(amount: number | null): string {
  if (amount == null) return "—";
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

export default function RevenueCard({ journeyId, contactId, franchiseFee, onFeeUpdate }: Props) {
  const { toast } = useToast();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingFee, setEditingFee] = useState(false);
  const [feeDraft, setFeeDraft] = useState("");

  useEffect(() => {
    apiFetch(`/api/journeys/${journeyId}/revenue`)
      .then((r) => r.json())
      .then((d) => setRevenue(d))
      .catch(() => setRevenue(null))
      .finally(() => setLoading(false));
  }, [journeyId]);

  async function saveFee(value: string) {
    const numVal = value ? Number(value) : null;
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchise_fee: numVal }),
      });
      if (res.ok) {
        onFeeUpdate(numVal);
        toast("Saved");
      }
    } catch {
      /* silent */
    }
  }

  // Build cumulative series
  const cumulativeSeries = (revenue?.monthly_series ?? []).reduce<
    { month: string; label: string; cumulative: number }[]
  >((acc, entry) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({ month: entry.month, label: formatMonth(entry.month), cumulative: prev + entry.paid });
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 flex items-center justify-center min-h-[140px]">
        <Loader2 size={16} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const totalPaid = revenue?.total_paid ?? 0;
  const totalDue = revenue?.total_due ?? 0;
  const displayFee = franchiseFee ?? revenue?.franchise_fee ?? null;
  const totalRevenue = (displayFee ?? 0) + totalPaid;
  const hasChartData = cumulativeSeries.length > 1;

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Header with total */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">REVENUE</h3>
          {totalRevenue > 0 && (
            <span className="text-[10px] text-text-tertiary">
              Total: <span className="text-text-primary font-semibold">{formatDollarFull(totalRevenue)}</span>
            </span>
          )}
        </div>

        {/* Metric pills */}
        <div className="flex gap-2 mt-2">
          {/* Franchise Fee */}
          <div className="flex-1 rounded-lg bg-bg-primary/50 border border-border-default px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <DollarSign size={10} className="text-nah-blue" />
              <span className="text-[9px] text-text-tertiary font-medium uppercase tracking-wider">Franchise Fee</span>
            </div>
            {editingFee ? (
              <input
                autoFocus
                type="number"
                value={feeDraft}
                onChange={(e) => setFeeDraft(e.target.value)}
                onBlur={() => {
                  setEditingFee(false);
                  if (feeDraft !== (displayFee?.toString() ?? "")) void saveFee(feeDraft);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setEditingFee(false);
                    if (feeDraft !== (displayFee?.toString() ?? "")) void saveFee(feeDraft);
                  }
                  if (e.key === "Escape") {
                    setEditingFee(false);
                    setFeeDraft(displayFee?.toString() ?? "");
                  }
                }}
                className="w-full bg-bg-secondary border border-nah-blue rounded px-1.5 py-0.5 text-body-sm text-text-primary outline-none"
              />
            ) : (
              <p
                className="text-lg font-bold text-text-primary cursor-pointer hover:text-nah-blue transition-colors leading-tight"
                onClick={() => {
                  setEditingFee(true);
                  setFeeDraft(displayFee?.toString() ?? "");
                }}
              >
                {formatDollarFull(displayFee)}
              </p>
            )}
          </div>

          {/* Royalty Paid */}
          <div className="flex-1 rounded-lg bg-bg-primary/50 border border-border-default px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp size={10} className="text-success" />
              <span className="text-[9px] text-text-tertiary font-medium uppercase tracking-wider">Royalty Paid</span>
            </div>
            <p className="text-lg font-bold text-success leading-tight">{formatDollarFull(totalPaid)}</p>
          </div>

          {/* Royalty Due */}
          <div className="flex-1 rounded-lg bg-bg-primary/50 border border-border-default px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock size={10} className={totalDue > 0 ? "text-nah-orange" : "text-text-tertiary"} />
              <span className="text-[9px] text-text-tertiary font-medium uppercase tracking-wider">Due</span>
            </div>
            <p
              className={`text-lg font-bold leading-tight ${totalDue > 0 ? "text-nah-orange" : "text-text-secondary"}`}
            >
              {formatDollarFull(totalDue)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart area */}
      {hasChartData ? (
        <div className="h-[90px] px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeSeries} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#52525b" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#52525b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatDollar(v)}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#09090b",
                  border: "1px solid #27272a",
                  borderRadius: 10,
                  fontSize: 12,
                  padding: "8px 12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
                labelStyle={{ color: "#a1a1aa", fontSize: 10, marginBottom: 2 }}
                formatter={(value) => [formatDollarFull(Number(value)), "Cumulative Royalty"]}
                cursor={{ stroke: "#22c55e", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e", stroke: "#09090b", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : cumulativeSeries.length === 1 ? (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-caption text-text-tertiary">
            <div className="h-px flex-1 bg-border-default" />
            <span>{formatDollarFull(cumulativeSeries[0].cumulative)} total royalty</span>
            <div className="h-px flex-1 bg-border-default" />
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 text-caption text-text-tertiary">
            <div className="h-px flex-1 bg-border-default" />
            <span>No royalty data yet</span>
            <div className="h-px flex-1 bg-border-default" />
          </div>
        </div>
      )}
    </div>
  );
}
