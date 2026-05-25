"use client";

/**
 * RevenueCard — franchise fee (editable) + royalty chart.
 * Reads from /api/journeys/[journeyId]/revenue.
 * Franchise fee saved via PATCH /api/contacts/[contactId].
 */

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
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
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

  // Build cumulative series for the chart
  const cumulativeSeries = (revenue?.monthly_series ?? []).reduce<{ month: string; cumulative: number }[]>(
    (acc, entry) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
      acc.push({ month: entry.month, cumulative: prev + entry.paid });
      return acc;
    },
    []
  );

  if (loading) {
    return (
      <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 flex items-center justify-center min-h-[120px]">
        <Loader2 size={16} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const totalPaid = revenue?.total_paid ?? 0;
  const totalDue = revenue?.total_due ?? 0;
  const displayFee = franchiseFee ?? revenue?.franchise_fee ?? null;

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3">
      <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">REVENUE</h3>

      {/* Top row: Franchise Fee | Total Paid | Total Due */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Franchise Fee — inline editable */}
        <div className="min-w-0">
          <span className="text-[10px] text-text-tertiary block">Franchise Fee</span>
          {editingFee ? (
            <input
              autoFocus
              type="number"
              value={feeDraft}
              onChange={(e) => setFeeDraft(e.target.value)}
              onBlur={() => {
                setEditingFee(false);
                if (feeDraft !== (displayFee?.toString() ?? "")) {
                  void saveFee(feeDraft);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditingFee(false);
                  if (feeDraft !== (displayFee?.toString() ?? "")) {
                    void saveFee(feeDraft);
                  }
                }
                if (e.key === "Escape") {
                  setEditingFee(false);
                  setFeeDraft(displayFee?.toString() ?? "");
                }
              }}
              className="w-full bg-bg-primary border border-nah-blue rounded px-2 py-0.5 text-body-sm text-text-primary outline-none"
            />
          ) : (
            <p
              className="text-body-sm text-text-primary cursor-pointer hover:text-nah-blue truncate"
              onClick={() => {
                setEditingFee(true);
                setFeeDraft(displayFee?.toString() ?? "");
              }}
            >
              {formatDollar(displayFee)}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <span className="text-[10px] text-text-tertiary block">Royalty Paid</span>
          <p className="text-body-sm font-medium text-success">{formatDollar(totalPaid)}</p>
        </div>

        <div className="min-w-0">
          <span className="text-[10px] text-text-tertiary block">Royalty Due</span>
          <p className={`text-body-sm font-medium ${totalDue > 0 ? "text-nah-orange" : "text-text-secondary"}`}>
            {formatDollar(totalDue)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {cumulativeSeries.length > 1 ? (
        <div className="h-[100px] -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeSeries} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="royaltyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value) => [formatDollar(Number(value)), "Cumulative"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#F97316"
                strokeWidth={2}
                fill="url(#royaltyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : cumulativeSeries.length === 1 ? (
        <p className="text-caption text-text-tertiary">
          {formatDollar(cumulativeSeries[0].cumulative)} total — chart shows with 2+ months of data
        </p>
      ) : (
        <p className="text-caption text-text-tertiary">No royalty data yet</p>
      )}
    </div>
  );
}
