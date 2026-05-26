"use client";

/**
 * RevenueCard — revenue visualization panel.
 * Stacked horizontal bar toward $500k goal with labels above each segment.
 */

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Loader2 } from "lucide-react";
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

  // Bar percentages (of $500k goal)
  const feePct = (feeVal / TOTAL_GOAL) * 100;
  const paidPct = (totalPaid / TOTAL_GOAL) * 100;
  const duePct = (totalDue / TOTAL_GOAL) * 100;
  const progressPct = Math.min(feePct + paidPct + duePct, 100);
  const medianPct =
    networkMedian != null && networkMedian > 0 ? Math.min((networkMedian / TOTAL_GOAL) * 100, 100) : null;

  // Build segments for display
  const segments = [
    { key: "fee", label: "Fee", value: feeVal, pct: feePct, color: "#3b82f6" },
    { key: "paid", label: "Royalty Paid", value: totalPaid, pct: paidPct, color: "#22c55e" },
    { key: "due", label: "Due", value: totalDue, pct: duePct, color: "#f97316" },
  ].filter((s) => s.value > 0);

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
      <div className="px-4 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
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
          </div>
        </div>

        {totalRevenue > 0 ? (
          <>
            {/* Big total */}
            <div className="text-center mb-3">
              <p className="text-2xl font-bold text-text-primary leading-none">{fmt(totalRevenue)}</p>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                of {fmtCompact(TOTAL_GOAL)} goal &middot; {progressPct.toFixed(0)}%
              </p>
            </div>

            {/* Stacked bar with labels above each segment */}
            <div className="relative mb-1">
              {/* Labels row — positioned to match bar segments */}
              <div className="flex mb-1" style={{ width: `${Math.max(progressPct, 5)}%` }}>
                {segments.map((seg) => {
                  // Each label takes proportional width within the filled portion
                  const segShare = totalRevenue > 0 ? (seg.value / totalRevenue) * 100 : 0;
                  return (
                    <div key={seg.key} className="min-w-0 text-center" style={{ width: `${segShare}%` }}>
                      {seg.key === "fee" && editingFee ? (
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
                            }
                          }}
                          className="w-full bg-bg-primary border border-nah-blue rounded px-1 py-0 text-[10px] text-text-primary outline-none text-center"
                        />
                      ) : (
                        <span
                          className={`text-[10px] font-semibold truncate block ${seg.key === "fee" ? "cursor-pointer" : ""}`}
                          style={{ color: seg.color }}
                          onClick={
                            seg.key === "fee"
                              ? () => {
                                  setEditingFee(true);
                                  setFeeDraft(displayFee?.toString() ?? "");
                                }
                              : undefined
                          }
                        >
                          {fmt(seg.value)}
                        </span>
                      )}
                      <span className="text-[8px] text-text-tertiary truncate block">{seg.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Bar */}
              <div className="relative">
                <div className="flex h-3 rounded-full overflow-hidden bg-bg-primary/30 border border-border-default">
                  {segments.map((seg) => (
                    <div
                      key={seg.key}
                      className="transition-all duration-700"
                      style={{ width: `${Math.max(seg.pct, 0.5)}%`, backgroundColor: seg.color }}
                      title={`${seg.label}: ${fmt(seg.value)}`}
                    />
                  ))}
                </div>

                {/* Median marker */}
                {medianPct != null && (
                  <div
                    className="absolute top-0 h-3"
                    style={{ left: `${medianPct}%`, borderLeft: "2px dashed #a1a1aa" }}
                    title={`Network median: ${fmt(networkMedian)}`}
                  />
                )}
              </div>
            </div>

            {/* Footer: legend + median */}
            <div className="flex items-center mt-1.5">
              {segments.map((seg) => (
                <div key={seg.key} className="flex items-center gap-1 mr-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-[8px] text-text-tertiary">{seg.label}</span>
                </div>
              ))}
              {medianPct != null && networkMedian != null && (
                <div className="flex items-center gap-1 ml-auto">
                  <div className="w-2.5 border-t-2 border-dashed" style={{ borderColor: "#a1a1aa" }} />
                  <span className="text-[8px] text-text-tertiary">Median {fmtCompact(networkMedian)}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-4">
            <div className="flex items-center gap-2 text-caption text-text-tertiary justify-center">
              <span>No revenue data yet</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
