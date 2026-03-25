"use client";

import { Calendar, Clock, Video } from "lucide-react";
import type { GHLAppointment } from "@/types/ghl";

interface TodayCalendarProps {
  appointments: GHLAppointment[];
  onAppointmentClick?: (appointment: GHLAppointment) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDuration(start: string, end: string): string {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60));
  return `${diff}min`;
}

export default function TodayCalendar({ appointments, onAppointmentClick }: TodayCalendarProps) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const now = new Date();
  const todayStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-default flex-shrink-0">
        <Calendar size={14} className="text-nah-orange" />
        <h3 className="text-body-sm font-semibold text-text-primary">Today</h3>
      </div>
      <p className="text-caption text-text-tertiary px-3 py-1.5">{todayStr}</p>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sorted.length === 0 && (
          <p className="text-caption text-text-tertiary text-center py-6">No appointments today</p>
        )}
        {sorted.map((apt) => {
          const isPast = new Date(apt.endTime) < now;
          const isCurrent = new Date(apt.startTime) <= now && new Date(apt.endTime) > now;

          return (
            <button
              key={apt.id}
              onClick={() => onAppointmentClick?.(apt)}
              className={`
                w-full text-left px-3 py-2 rounded-lg border transition-colors
                ${isCurrent
                  ? "border-nah-orange bg-nah-orange/5"
                  : isPast
                    ? "border-border-default bg-bg-secondary opacity-50"
                    : "border-border-default bg-bg-secondary hover:border-border-hover"
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock size={11} className={isCurrent ? "text-nah-orange" : "text-text-tertiary"} />
                <span className={`text-caption font-medium ${isCurrent ? "text-nah-orange" : "text-text-primary"}`}>
                  {formatTime(apt.startTime)} — {formatTime(apt.endTime)}
                </span>
                <span className="text-caption text-text-tertiary">{getDuration(apt.startTime, apt.endTime)}</span>
              </div>
              <p className="text-body-sm text-text-primary truncate">{apt.title}</p>
              {isCurrent && (
                <div className="flex items-center gap-1 mt-1">
                  <Video size={11} className="text-nah-orange" />
                  <span className="text-caption text-nah-orange font-medium">In Progress</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
