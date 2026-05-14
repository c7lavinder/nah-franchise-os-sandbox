"use client";

// Calendar audit panel — lists every active GHL calendar that Scout can book
// against, plus a "match preview" tool that mirrors Scout's calendar_hint
// fuzzy match so reps/admins can see which calendar a phrase would resolve to.

import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import { Calendar, Clock, Copy, Check, Loader2, AlertTriangle, Search } from "lucide-react";

interface GHLCalendar {
  id: string;
  name: string;
  description?: string | null;
  slotDuration?: number | null;
  timezone?: string | null;
  calendarType?: string | null;
}

export default function CalendarsPanel() {
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/ghl/calendars");
        if (!res.ok) throw new Error(`GHL returned ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCalendars(data.calendars ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirrors lib/scout/tool-executor.ts:executeDraftAppointment — first calendar
  // whose name contains the lowercased hint wins; otherwise the first active
  // calendar is used as the default.
  const match = useMemo(() => {
    const h = hint.toLowerCase().trim();
    if (!h || calendars.length === 0) return null;
    const found = calendars.find((c) => c.name.toLowerCase().includes(h));
    return found
      ? { calendar: found, reason: `matched "${h}" in calendar name` }
      : { calendar: calendars[0], reason: `no match — fell back to first active calendar` };
  }, [hint, calendars]);

  function copyId(id: string) {
    void navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-body-sm font-medium text-red-900">Could not load calendars from GHL</p>
          <p className="text-caption text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-caption text-text-tertiary">
          {calendars.length} active calendar{calendars.length === 1 ? "" : "s"} in the GHL location. Scout can book
          against any of these via the <span className="font-mono text-text-secondary">draft_appointment</span> tool.
        </p>
      </div>

      {/* Match preview */}
      <div className="border border-border-default rounded-lg p-4 bg-bg-secondary">
        <div className="text-overline text-text-tertiary mb-2">SCOUT MATCH PREVIEW</div>
        <p className="text-caption text-text-tertiary mb-3">
          Type a phrase below to see which calendar Scout would pick when the LLM passes that as the{" "}
          <span className="font-mono">calendar_hint</span>.
        </p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder='e.g. "discovery", "validation", "matt"'
            className="w-full pl-9 pr-3 py-2 text-body-sm bg-white border border-border-default rounded-md focus:outline-none focus:ring-2 focus:ring-nah-blue/20 focus:border-nah-blue placeholder:text-text-tertiary"
          />
        </div>
        {match && (
          <div className="mt-3 flex items-start gap-3 px-3 py-2 bg-white rounded-md border border-border-default">
            <Calendar size={16} className="text-nah-blue flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-medium text-text-primary">{match.calendar.name}</div>
              <div className="text-caption text-text-tertiary">{match.reason}</div>
              <div className="text-caption font-mono text-text-tertiary mt-0.5">{match.calendar.id}</div>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {calendars.map((c) => (
          <div
            key={c.id}
            className="flex items-start gap-3 border border-border-default rounded-lg p-3 bg-bg-secondary hover:border-nah-blue-mid transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-nah-blue-light flex items-center justify-center text-nah-blue flex-shrink-0">
              <Calendar size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-body-sm font-medium text-text-primary">{c.name}</h3>
                {c.calendarType && (
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{c.calendarType}</span>
                )}
                {c.slotDuration && (
                  <span className="text-caption text-text-tertiary inline-flex items-center gap-1">
                    <Clock size={10} /> {c.slotDuration} min
                  </span>
                )}
                {c.timezone && <span className="text-caption text-text-tertiary">{c.timezone}</span>}
              </div>
              {c.description && <p className="text-caption text-text-secondary mt-0.5">{c.description}</p>}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[11px] font-mono text-text-tertiary">{c.id}</span>
                <button
                  onClick={() => copyId(c.id)}
                  className="p-0.5 text-text-tertiary hover:text-nah-blue rounded transition-colors"
                  title="Copy calendar ID"
                >
                  {copiedId === c.id ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Help footer */}
      <div className="border-t border-border-default pt-4">
        <p className="text-caption text-text-tertiary leading-relaxed">
          <strong className="text-text-secondary">How Scout picks a calendar:</strong> when the LLM drafts an
          appointment it passes a <span className="font-mono">calendar_hint</span> (e.g. {`"intro"`}, {`"discovery"`}).
          The first active calendar whose name <em>contains</em> that hint wins. If no calendar matches, Scout falls
          back to the first active calendar in this list. The user can override the pick in the confirm card before
          pushing.
        </p>
      </div>
    </div>
  );
}
