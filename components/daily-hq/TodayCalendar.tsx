"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, Loader2 } from "lucide-react";
import type { GHLAppointment } from "@/types/ghl";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", active: "bg-[#E6F4FB] text-[#0E96D8] border-[#0E96D8]/30" },
  { value: "showed", label: "Showed", active: "bg-[#E4F6F0] text-[#127D6B] border-[#127D6B]/30" },
  { value: "noshow", label: "No Show", active: "bg-[#FDECEC] text-[#D64545] border-[#D64545]/30" },
  { value: "cancelled", label: "Cancelled", active: "bg-[#f1f4f8] text-[#7a8696] border-[#cfd6df]" },
] as const;

interface TodayCalendarProps {
  appointments: GHLAppointment[];
}

/** Stable bar/dot color derived from the appointment title keyword. */
function eventColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("intro") || t.includes("discovery")) return "#0E96D8";
  if (t.includes("coaching") || t.includes("onboarding")) return "#7C5CFC";
  if (t.includes("validation") || t.includes("lending")) return "#F5A623";
  if (t.includes("fdd") || t.includes("final")) return "#EB5757";
  if (t.includes("team") || t.includes("internal") || t.includes("huddle")) return "#1FB6A8";
  return "#0E96D8";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getDuration(start: string, end: string): string {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60));
  if (isNaN(diff) || diff <= 0) return "";
  return `${diff} min`;
}

function isMeetLink(url?: string): boolean {
  if (!url) return false;
  return url.includes("meet.google") || url.includes("zoom.us") || url.includes("teams.microsoft");
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#9aa3b0]">{label}</span>
      <span className="text-[12.5px] font-semibold text-[#1c2430] text-right">{value}</span>
    </div>
  );
}

export default function TodayCalendar({ appointments }: TodayCalendarProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  async function handleStatusChange(aptId: string, newStatus: string) {
    setUpdatingStatus(aptId);
    try {
      const res = await apiFetch(`/api/appointments/${aptId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatusOverrides((prev) => ({ ...prev, [aptId]: newStatus }));
      }
    } catch {
      /* silent */
    }
    setUpdatingStatus(null);
  }

  const sorted = [...appointments].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const now = new Date();
  const todayStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <section className="hub-card p-4 flex-1 basis-60 min-w-60">
      <header className="flex items-center gap-2">
        <Calendar size={17} className="text-[#0E96D8]" />
        <h2 className="text-[15px] font-bold text-[#1c2430]">Calendar</h2>
        <span className="ml-auto text-xs text-[#9aa3b0]">{sorted.length} events</span>
      </header>
      <p className="text-[12.5px] text-[#9aa3b0] mt-0.5 mb-2">{todayStr} · from GHL</p>

      <div className="space-y-1">
        {sorted.length === 0 && <p className="text-[13px] text-[#9aa3b0] py-3">No appointments today</p>}
        {sorted.map((apt) => {
          const isExpanded = expandedId === apt.id;
          const color = eventColor(apt.title);
          const duration = getDuration(apt.startTime, apt.endTime);
          const currentStatus = statusOverrides[apt.id] ?? apt.appointmentStatus ?? "confirmed";

          return (
            <div key={apt.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                className="w-full text-left flex items-stretch gap-2.5 py-2 rounded-lg hover:bg-[#f7f9fc] -mx-1 px-1"
              >
                <span className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[#1c2430]">{apt.title}</p>
                  <p className="text-xs text-[#8a94a3] mt-0.5">
                    {formatTime(apt.startTime)}
                    {duration ? ` · ${duration}` : ""}
                  </p>
                </div>
                <ChevronDown
                  size={16}
                  className={`mt-0.5 text-[#b3bcc8] flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded && (
                <div className="hub-detail ml-[13px] px-3.5 py-3.5 mb-1 space-y-2.5">
                  {apt.notes && <p className="text-[12.5px] leading-[1.45] text-[#5b6573]">{apt.notes}</p>}

                  <div className="space-y-1.5">
                    <DetailRow
                      label="Date"
                      value={new Date(apt.startTime).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    />
                    <DetailRow label="Time" value={`${formatTime(apt.startTime)}${duration ? ` · ${duration}` : ""}`} />
                  </div>

                  {/* Status selector — live GHL action */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {updatingStatus === apt.id && <Loader2 size={12} className="animate-spin text-[#9aa3b0]" />}
                    {STATUS_OPTIONS.map((opt) => {
                      const isActive = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(apt.id, opt.value)}
                          disabled={updatingStatus === apt.id}
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border transition-colors ${
                            isActive ? opt.active : "bg-white text-[#9aa3b0] border-[#e2e7ee] hover:border-[#cfd6df]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Action row */}
                  <div className="flex gap-2 pt-0.5">
                    {isMeetLink(apt.address) && (
                      <a
                        href={apt.address}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center bg-[#0E96D8] text-white text-[12.5px] font-semibold py-2 rounded-[9px] hover:bg-[#0a85cf] transition-colors"
                      >
                        Join
                      </a>
                    )}
                    {apt.contactId && (
                      <Link
                        href={`/contacts/${apt.contactId}`}
                        className="flex-1 text-center bg-[#eef1f5] text-[#5b6573] text-[12.5px] font-semibold py-2 rounded-[9px] hover:bg-[#e2e7ee] transition-colors"
                      >
                        View Contact
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
