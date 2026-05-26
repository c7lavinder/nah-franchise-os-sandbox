"use client";

/**
 * RevenueCard — revenue visualization panel.
 * Equal-width pills (colored numbers) + stacked progress bar toward $500k goal.
 */

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Loader2, TrendingUp, DollarSign, Clock } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface RevenueData {
  franchise_fee: number | null;
  total_paid: number;
  total_due: number;
  monthly_series: { month: string; paid: number }[];
  network_median?: number;
  journey_start?: string;
}

interface Props {
  journeyId: string;
  contactId: string;
  franchiseFee: number | null;
  onFeeUpdate: (fee: number | null) => void;
}

const ROYALTY_GOAL = 460_000;
const TOTAL_GOAL = 500_000;
const GOAL_YEARS = 10;

function fmt(amount: number | null): string {
  if (amount == null) return "—";
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCompact(amount: number): string {
  if (amount >= 1_000_000) return "$" + (amount / 1_000_000).toFixed(1) + "M";
  if (amount >= 1_000) return "$" + Math.round(amount / 1_000) + "k";
  return "$" + amount.toFixed(0);
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
  const feeVal = displayFee ?? 0;
  const totalRevenue = feeVal + totalPaid + totalDue;
  const networkMedian = revenue?.network_median ?? null;

  // Pace: royalty only vs $460k over 10yr
  const royaltyTotal = totalPaid + totalDue;
  const journeyStart = revenue?.journey_start;
  let paceStatus: "on" | "ahead" | "behind" | null = null;
  if (journeyStart && royaltyTotal > 0) {
    const yearsElapsed = (Date.now() - new Date(journeyStart).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsElapsed > 0.1) {
      const expected = (ROYALTY_GOAL / GOAL_YEARS) * yearsElapsed;
      const ratio = royaltyTotal / expected;
      paceStatus = ratio >= 1.1 ? "ahead" : ratio >= 0.85 ? "on" : "behind";
    }
  }

  // Bar percentages
  const feePct = (feeVal / TOTAL_GOAL) * 100;
  const paidPct = (totalPaid / TOTAL_GOAL) * 100;
  const duePct = (totalDue / TOTAL_GOAL) * 100;
  const progressPct = Math.min(feePct + paidPct + duePct, 100);
  const medianPct =
    networkMedian != null && networkMedian > 0 ? Math.min((networkMedian / TOTAL_GOAL) * 100, 100) : null;

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
      <div className="px-4 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">REVENUE</h3>
          <div className="flex items-center gap-2">
            {paceStatus && (
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  paceStatus === "ahead"
                    ? "bg-[#22c55e]/15 text-[#22c55e]"
                    : paceStatus === "on"
                      ? "bg-[#3b82f6]/15 text-[#3b82f6]"
                      : "bg-[#f97316]/15 text-[#f97316]"
                }`}
              >
                {paceStatus === "ahead" ? "Ahead of pace" : paceStatus === "on" ? "On pace" : "Behind pace"}
              </span>
            )}
            {totalRevenue > 0 && (
              <span className="text-[10px] text-text-tertiary">
                Total: <span className="text-text-primary font-semibold">{fmt(totalRevenue)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Equal-width pills with color-matched numbers */}
        <div className="flex gap-2 mt-2">
          {/* Franchise Fee */}
          <div className="flex-1 rounded-lg bg-bg-primary/50 border border-border-default px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <DollarSign size={10} className="text-[#3b82f6]" />
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
                className="text-lg font-bold cursor-pointer hover:opacity-80 transition-opacity leading-tight"
                style={{ color: "#3b82f6" }}
                onClick={() => {
                  setEditingFee(true);
                  setFeeDraft(displayFee?.toString() ?? "");
                }}
              >
                {fmt(displayFee)}
              </p>
            )}
          </div>

          {/* Royalty Paid */}
          <div className="flex-1 rounded-lg bg-bg-primary/50 border border-border-default px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp size={10} className="text-[#22c55e]" />
              <span className="text-[9px] text-text-tertiary font-medium uppercase tracking-wider">Royalty Paid</span>
            </div>
            <p className="text-lg font-bold leading-tight" style={{ color: "#22c55e" }}>
              {fmt(totalPaid)}
            </p>
          </div>

          {/* Royalty Due */}
          <div className="flex-1 rounded-lg bg-bg-primary/50 border border-border-default px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock
                size={10}
                style={{ color: totalDue > 0 ? "#f97316" : undefined }}
                className={totalDue > 0 ? "" : "text-text-tertiary"}
              />
              <span className="text-[9px] text-text-tertiary font-medium uppercase tracking-wider">Due</span>
            </div>
            <p className="text-lg font-bold leading-tight" style={{ color: totalDue > 0 ? "#f97316" : undefined }}>
              {fmt(totalDue)}
            </p>
          </div>
        </div>

        {/* Progress bar toward $500k goal */}
        {totalRevenue > 0 ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-text-tertiary">
                {fmt(totalRevenue)} of {fmtCompact(TOTAL_GOAL)} goal
              </span>
              <span className="text-[9px] text-text-tertiary font-medium">{progressPct.toFixed(0)}%</span>
            </div>

            <div className="relative">
              <div className="flex h-4 rounded-full overflow-hidden bg-bg-primary/30 border border-border-default">
                {feePct > 0 && (
                  <div
                    className="transition-all duration-700"
                    style={{ width: `${Math.max(feePct, 0.5)}%`, backgroundColor: "#3b82f6" }}
                    title={`Fee: ${fmt(feeVal)}`}
                  />
                )}
                {paidPct > 0 && (
                  <div
                    className="transition-all duration-700"
                    style={{ width: `${Math.max(paidPct, 0.5)}%`, backgroundColor: "#22c55e" }}
                    title={`Paid: ${fmt(totalPaid)}`}
                  />
                )}
                {duePct > 0 && (
                  <div
                    className="transition-all duration-700"
                    style={{ width: `${Math.max(duePct, 1)}%`, backgroundColor: "#f97316" }}
                    title={`Due: ${fmt(totalDue)}`}
                  />
                )}
              </div>

              {/* Median marker */}
              {medianPct != null && (
                <div
                  className="absolute top-0 h-4"
                  style={{ left: `${medianPct}%`, borderLeft: "2px dashed #a1a1aa" }}
                  title={`Network median: ${fmt(networkMedian)}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center mt-1.5">
              <div className="flex items-center gap-1 mr-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                <span className="text-[9px] text-text-tertiary">Fee</span>
              </div>
              <div className="flex items-center gap-1 mr-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#22c55e" }} />
                <span className="text-[9px] text-text-tertiary">Paid</span>
              </div>
              {totalDue > 0 && (
                <div className="flex items-center gap-1 mr-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f97316" }} />
                  <span className="text-[9px] text-text-tertiary">Due</span>
                </div>
              )}
              {medianPct != null && networkMedian != null && (
                <div className="flex items-center gap-1 ml-auto">
                  <div className="w-3 border-t-2 border-dashed" style={{ borderColor: "#a1a1aa" }} />
                  <span className="text-[9px] text-text-tertiary">Median {fmtCompact(networkMedian)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-caption text-text-tertiary justify-center">
              <div className="h-px flex-1 bg-border-default" />
              <span>No revenue data yet</span>
              <div className="h-px flex-1 bg-border-default" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
