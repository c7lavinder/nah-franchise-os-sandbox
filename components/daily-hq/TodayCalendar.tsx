"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Video, ExternalLink, FileText, ChevronDown, ChevronRight, User, Loader2 } from "lucide-react";
import type { GHLAppointment } from "@/types/ghl";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", color: "bg-nah-blue/10 text-nah-blue border-nah-blue/30" },
  { value: "showed", label: "Showed", color: "bg-success/10 text-success border-success/30" },
  { value: "noshow", label: "No Show", color: "bg-danger/10 text-danger border-danger/30" },
  { value: "cancelled", label: "Cancelled", color: "bg-text-tertiary/10 text-text-tertiary border-text-tertiary/30" },
] as const;

interface TodayCalendarProps {
  appointments: GHLAppointment[];
}

/** Color palette by appointment title keyword */
function getEventColor(title: string): { border: string; bg: string; text: string; dot: string } {
  const t = title.toLowerCase();
  if (t.includes("intro") || t.includes("chad"))
    return { border: "border-[#3B82F6]", bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", dot: "bg-[#3B82F6]" };
  if (t.includes("discovery") || t.includes("matt"))
    return { border: "border-[#8B5CF6]", bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", dot: "bg-[#8B5CF6]" };
  if (t.includes("validation") || t.includes("sam"))
    return { border: "border-[#F59E0B]", bg: "bg-[#FFFBEB]", text: "text-[#B45309]", dot: "bg-[#F59E0B]" };
  if (t.includes("lending") || t.includes("mark"))
    return { border: "border-[#10B981]", bg: "bg-[#ECFDF5]", text: "text-[#047857]", dot: "bg-[#10B981]" };
  if (t.includes("fdd") || t.includes("final"))
    return { border: "border-[#EF4444]", bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", dot: "bg-[#EF4444]" };
  if (t.includes("coaching") || t.includes("onboarding"))
    return { border: "border-[#06B6D4]", bg: "bg-[#ECFEFF]", text: "text-[#0E7490]", dot: "bg-[#06B6D4]" };
  if (t.includes("team") || t.includes("internal") || t.includes("huddle"))
    return { border: "border-[#6B7280]", bg: "bg-[#F9FAFB]", text: "text-[#374151]", dot: "bg-[#6B7280]" };
  return { border: "border-[#F97316]", bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", dot: "bg-[#F97316]" };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getDuration(start: string, end: string): string {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60));
  if (isNaN(diff) || diff <= 0) return "";
  return `${diff}m`;
}

function isMeetLink(url?: string): boolean {
  if (!url) return false;
  return url.includes("meet.google") || url.includes("zoom.us") || url.includes("teams.microsoft");
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-default flex-shrink-0">
        <Calendar size={14} className="text-nah-orange" />
        <h3 className="text-body-sm font-semibold text-text-primary">Calendar</h3>
        <span className="text-caption text-text-tertiary ml-auto">{sorted.length} events</span>
      </div>
      <p className="text-caption text-text-tertiary px-3 py-1.5">{todayStr}</p>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sorted.length === 0 && (
          <p className="text-caption text-text-tertiary text-center py-6">No appointments today</p>
        )}
        {sorted.map((apt) => {
          const isPast = new Date(apt.endTime) < now;
          const isCurrent = new Date(apt.startTime) <= now && new Date(apt.endTime) > now;
          const isExpanded = expandedId === apt.id;
          const color = getEventColor(apt.title);
          const hasMeetLink = isMeetLink(apt.address);

          return (
            <div
              key={apt.id}
              className={`rounded-lg border-l-[3px] border transition-all ${
                isCurrent
                  ? `${color.border} ${color.bg} border-r border-t border-b ${color.border}`
                  : isPast
                    ? "border-l-gray-300 border-border-default bg-bg-secondary opacity-50"
                    : `${color.border} border-r border-t border-b border-border-default bg-bg-secondary hover:${color.bg}`
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                className="w-full text-left px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrent ? "animate-pulse" : ""} ${color.dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-body-sm font-medium truncate ${isCurrent ? color.text : "text-text-primary"}`}>
                      {apt.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={10} className="text-text-tertiary flex-shrink-0" />
                      <span className="text-caption text-text-tertiary">
                        {formatTime(apt.startTime)}
                        {apt.endTime ? ` - ${formatTime(apt.endTime)}` : ""}
                        {getDuration(apt.startTime, apt.endTime) ? ` (${getDuration(apt.startTime, apt.endTime)})` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success">
                        LIVE
                      </span>
                    )}
                    {hasMeetLink && <Video size={12} className="text-text-tertiary" />}
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-text-tertiary" />
                    ) : (
                      <ChevronRight size={12} className="text-text-tertiary" />
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border-default/50 space-y-2">
                  {apt.contactId && (
                    <div className="flex items-center gap-1.5">
                      <User size={11} className="text-text-tertiary" />
                      <Link href={`/contacts/${apt.contactId}`} className="text-caption text-nah-blue hover:underline">
                        View Contact
                      </Link>
                    </div>
                  )}
                  {apt.address && (
                    <a
                      href={apt.address}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-nah-blue/10 text-nah-blue text-caption font-medium hover:bg-nah-blue/20 transition-colors"
                    >
                      <Video size={12} />
                      {apt.address.includes("meet.google")
                        ? "Join Google Meet"
                        : apt.address.includes("zoom")
                          ? "Join Zoom"
                          : apt.address.includes("teams")
                            ? "Join Teams"
                            : "Join Meeting"}
                      <ExternalLink size={10} className="ml-auto" />
                    </a>
                  )}
                  {apt.notes && (
                    <div className="flex items-start gap-1.5">
                      <FileText size={11} className="text-text-tertiary mt-0.5" />
                      <p className="text-caption text-text-secondary">{apt.notes}</p>
                    </div>
                  )}
                  {/* Status selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {updatingStatus === apt.id && <Loader2 size={12} className="animate-spin text-text-tertiary" />}
                    {STATUS_OPTIONS.map((opt) => {
                      const currentStatus = statusOverrides[apt.id] ?? apt.appointmentStatus ?? "confirmed";
                      const isActive = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChange(apt.id, opt.value)}
                          disabled={updatingStatus === apt.id}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                            isActive
                              ? opt.color
                              : "bg-bg-secondary text-text-tertiary border-border-default hover:border-border-hover"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
