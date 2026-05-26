"use client";

/**
 * RevenueCard — revenue visualization panel.
 * Franchise fee (editable) + royalty paid/due + progress bar toward $500k/10yr goal.
 * Shows pace status and network median comparison.
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

const ROYALTY_GOAL = 460_000; // $500k total minus ~$40k franchise fee
const TOTAL_GOAL = 500_000;
const GOAL_YEARS = 10;

function formatDollarFull(amount: number | null): string {
  if (amount == null) return "—";
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDollarCompact(amount: number): string {
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

  // Progress toward $500k goal
  const progressPct = Math.min((totalRevenue / TOTAL_GOAL) * 100, 100);

  // Pace: only royalty (paid+due) vs expected royalty timeline — franchise fee is excluded
  const royaltyTotal = totalPaid + totalDue;
  const journeyStart = revenue?.journey_start;
  let paceStatus: "on" | "ahead" | "behind" | null = null;
  if (journeyStart && royaltyTotal > 0) {
    const startDate = new Date(journeyStart);
    const now = new Date();
    const yearsElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsElapsed > 0.1) {
      const expectedRoyalty = (ROYALTY_GOAL / GOAL_YEARS) * yearsElapsed;
      const ratio = royaltyTotal / expectedRoyalty;
      if (ratio >= 1.1) paceStatus = "ahead";
      else if (ratio >= 0.85) paceStatus = "on";
      else paceStatus = "behind";
    }
  }

  // Median marker position (median is total revenue including fee)
  const medianPct =
    networkMedian != null && networkMedian > 0 ? Math.min((networkMedian / TOTAL_GOAL) * 100, 100) : null;

  // Bar segments as percentage of goal
  const feePctOfGoal = (feeVal / TOTAL_GOAL) * 100;
  const paidPctOfGoal = (totalPaid / TOTAL_GOAL) * 100;
  const duePctOfGoal = (totalDue / TOTAL_GOAL) * 100;

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
                    ? "bg-success/15 text-success"
                    : paceStatus === "on"
                      ? "bg-nah-blue/15 text-nah-blue"
                      : "bg-nah-orange/15 text-nah-orange"
                }`}
              >
                {paceStatus === "ahead" ? "Ahead of pace" : paceStatus === "on" ? "On pace" : "Behind pace"}
              </span>
            )}
          </div>
        </div>

        {/* Metric pills — sized proportionally to match bar segments */}
        <div className="flex gap-1 mt-2">
          {/* Franchise Fee */}
          <div
            className="rounded-lg bg-bg-primary/50 border border-border-default px-2 py-2 min-w-0"
            style={{ flex: Math.max(feeVal, 1) }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <DollarSign size={9} className="text-nah-blue flex-shrink-0" />
              <span className="text-[8px] text-text-tertiary font-medium uppercase tracking-wider truncate">Fee</span>
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
                className="text-sm font-bold text-text-primary cursor-pointer hover:text-nah-blue transition-colors leading-tight truncate"
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
          <div
            className="rounded-lg bg-bg-primary/50 border border-border-default px-2 py-2 min-w-0"
            style={{ flex: Math.max(totalPaid, 1) }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp size={9} className="text-success flex-shrink-0" />
              <span className="text-[8px] text-text-tertiary font-medium uppercase tracking-wider truncate">Paid</span>
            </div>
            <p className="text-sm font-bold text-success leading-tight truncate">{formatDollarFull(totalPaid)}</p>
          </div>

          {/* Royalty Due */}
          <div
            className="rounded-lg bg-bg-primary/50 border border-border-default px-2 py-2 min-w-0"
            style={{ flex: Math.max(totalDue, 1) }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              <Clock size={9} className={`flex-shrink-0 ${totalDue > 0 ? "text-nah-orange" : "text-text-tertiary"}`} />
              <span className="text-[8px] text-text-tertiary font-medium uppercase tracking-wider truncate">Due</span>
            </div>
            <p
              className={`text-sm font-bold leading-tight truncate ${totalDue > 0 ? "text-nah-orange" : "text-text-secondary"}`}
            >
              {formatDollarFull(totalDue)}
            </p>
          </div>
        </div>

        {/* Revenue progress bar toward $500k goal */}
        {totalRevenue > 0 ? (
          <div className="mt-3">
            {/* Goal label */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-text-tertiary">
                {formatDollarFull(totalRevenue)} of {formatDollarCompact(TOTAL_GOAL)} goal
              </span>
              <span className="text-[9px] text-text-tertiary font-medium">{progressPct.toFixed(0)}%</span>
            </div>

            {/* Stacked bar */}
            <div className="relative">
              <div className="flex h-4 rounded-full overflow-hidden bg-bg-primary/30 border border-border-default">
                {feePctOfGoal > 0 && (
                  <div
                    className="bg-nah-blue transition-all duration-700"
                    style={{ width: `${Math.max(feePctOfGoal, 0.5)}%` }}
                    title={`Franchise Fee: ${formatDollarFull(feeVal)}`}
                  />
                )}
                {paidPctOfGoal > 0 && (
                  <div
                    className="bg-success transition-all duration-700"
                    style={{ width: `${Math.max(paidPctOfGoal, 0.5)}%` }}
                    title={`Royalty Paid: ${formatDollarFull(totalPaid)}`}
                  />
                )}
                {duePctOfGoal > 0 && (
                  <div
                    className="transition-all duration-700"
                    style={{ width: `${Math.max(duePctOfGoal, 1)}%`, backgroundColor: "#f97316" }}
                    title={`Due: ${formatDollarFull(totalDue)}`}
                  />
                )}
              </div>

              {/* Network median marker */}
              {medianPct != null && medianPct > 0 && (
                <div
                  className="absolute top-0 h-4 border-l-2 border-dashed"
                  style={{ left: `${medianPct}%`, borderColor: "#a1a1aa" }}
                  title={`Network median: ${formatDollarFull(networkMedian)}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-1.5">
              {feeVal > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-nah-blue" />
                  <span className="text-[9px] text-text-tertiary">Fee</span>
                </div>
              )}
              {totalPaid > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-[9px] text-text-tertiary">Paid</span>
                </div>
              )}
              {totalDue > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f97316" }} />
                  <span className="text-[9px] text-text-tertiary">Due</span>
                </div>
              )}
              {medianPct != null && networkMedian != null && (
                <div className="flex items-center gap-1 ml-auto">
                  <div className="w-3 border-t-2 border-dashed" style={{ borderColor: "#a1a1aa" }} />
                  <span className="text-[9px] text-text-tertiary">Median {formatDollarCompact(networkMedian)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
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
