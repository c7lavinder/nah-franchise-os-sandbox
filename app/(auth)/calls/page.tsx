"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw, Calendar, Award, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CallList, CallDetail } from "@/components/calls";

interface CallSummary {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  phone: string | null;
  direction: "inbound" | "outbound";
  dateAdded: string;
  duration: string | null;
  type: string;
}

/**
 * Call Center Page
 *
 * Left: List of recent calls
 * Right: Selected call detail with 3 tabs (Coaching, Transcript, AI Actions)
 */
export default function CallsPage() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbCalls, setDbCalls] = useState<{ id: string; contactName: string | null; callTypeName: string | null; hostName: string | null; scheduled_at: string | null; status: string; grade: string | null; hasTranscript: boolean }[]>([]);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ghlRes, dbRes] = await Promise.all([
        fetch("/api/calls").catch(() => null),
        fetch("/api/calls/list?limit=20").catch(() => null),
      ]);
      if (ghlRes?.ok) {
        const data = await ghlRes.json();
        setCalls(data.calls ?? []);
      } else if (ghlRes) {
        setError("Failed to load calls");
      }
      if (dbRes?.ok) {
        const data = await dbRes.json();
        setDbCalls(data.calls ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-3 flex-shrink-0">
        <Phone size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Call Center</h1>
        <span className="text-caption text-text-tertiary ml-1">
          {calls.length} {calls.length === 1 ? "call" : "calls"}
        </span>
        <button
          onClick={fetchCalls}
          className="btn-ghost p-1.5 ml-auto"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Scheduled calls from DB */}
      {dbCalls.length > 0 && (
        <div className="flex-shrink-0 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-nah-blue" />
            <span className="text-overline text-text-tertiary tracking-wider">SCHEDULED & RECENT CALLS</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dbCalls.slice(0, 10).map((c) => (
              <Link key={c.id} href={`/calls/${c.id}`}
                className="flex-shrink-0 w-[200px] p-2.5 bg-bg-secondary border border-border-default rounded-lg hover:border-nah-blue/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-caption font-medium text-text-primary truncate">{c.contactName ?? "Unknown"}</span>
                  {c.grade && <span className={`text-[10px] font-bold px-1 rounded ${
                    c.grade === "A" ? "bg-success/10 text-success" : c.grade === "F" ? "bg-danger/10 text-danger" : "bg-nah-blue/10 text-nah-blue"
                  }`}>{c.grade}</span>}
                </div>
                <p className="text-[10px] text-text-tertiary">{c.callTypeName ?? "Call"} {c.hostName ? `• ${c.hostName}` : ""}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-text-tertiary">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString() : "—"}</span>
                  <span className={`text-[10px] px-1 rounded ${c.status === "completed" ? "bg-success/10 text-success" : c.status === "scheduled" ? "bg-info/10 text-info" : "bg-text-tertiary/10 text-text-tertiary"}`}>{c.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-caption text-danger">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 border border-border-default rounded-lg overflow-hidden min-h-0">
        {/* Call list — 1/3 */}
        <div className="bg-bg-secondary overflow-y-auto p-3 border-r border-border-default">
          <CallList
            calls={calls}
            selectedId={selectedCall?.id ?? null}
            onSelect={setSelectedCall}
          />
        </div>

        {/* Call detail — 2/3 */}
        <div className="lg:col-span-2 bg-bg-primary flex flex-col min-h-0">
          {selectedCall ? (
            <CallDetail call={selectedCall} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Phone size={32} className="text-text-tertiary mx-auto mb-3" />
                <p className="text-body-sm text-text-tertiary">Select a call to view details</p>
                <p className="text-caption text-text-tertiary mt-1">
                  Scout will grade the call, show the transcript, and suggest next actions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
