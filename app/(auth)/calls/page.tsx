"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw, Calendar, Plus, X, Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CallList, CallDetail } from "@/components/calls";
import ScoreCardRow from "@/components/scorecards/ScoreCardRow";

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
 * Calls Page
 *
 * Left: List of recent calls
 * Right: Selected call detail with 3 tabs (Coaching, Transcript, AI Actions)
 */
interface CallType { id: string; name: string }
interface UserOption { id: string; full_name: string }
interface ContactOption { id: string; first_name: string | null; last_name: string | null }

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbCalls, setDbCalls] = useState<{ id: string; contactName: string | null; callTypeName: string | null; hostName: string | null; scheduled_at: string | null; started_at: string | null; created_at: string | null; status: string; grade: string | null; hasTranscript: boolean; title: string | null; source: string | null }[]>([]);

  // Manual entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualForm, setManualForm] = useState({ title: "", contact_id: "", call_type_id: "", hosted_by_user_id: "", started_at: "", duration_minutes: "", notes: "" });
  const [manualSaving, setManualSaving] = useState(false);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  const [selectedContactName, setSelectedContactName] = useState("");

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

  // Load call types + users when manual entry opens
  useEffect(() => {
    if (!showManualEntry) return;
    Promise.all([
      fetch("/api/settings/call-types").then((r) => r.ok ? r.json() : null),
      fetch("/api/settings/users").then((r) => r.ok ? r.json() : null),
    ]).then(([ctData, uData]) => {
      if (ctData?.callTypes) setCallTypes(ctData.callTypes);
      if (uData?.users) setUsers(uData.users.filter((u: UserOption & { is_active: boolean }) => u.is_active !== false));
    }).catch(() => {});
  }, [showManualEntry]);

  // Contact search with debounce
  useEffect(() => {
    if (contactSearch.length < 2) { setContactResults([]); return; }
    const timer = setTimeout(async () => {
      setContactSearching(true);
      try {
        const res = await fetch(`/api/pipeline/contacts?q=${encodeURIComponent(contactSearch)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setContactResults((data.contacts ?? []).map((c: { id: string; first_name: string | null; last_name: string | null }) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name })));
        }
      } catch { /* ignore */ }
      setContactSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  async function handleManualSubmit() {
    if (!manualForm.title.trim()) return;
    setManualSaving(true);
    try {
      const res = await fetch("/api/calls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualForm.title,
          contact_id: manualForm.contact_id || undefined,
          call_type_id: manualForm.call_type_id || undefined,
          hosted_by_user_id: manualForm.hosted_by_user_id || undefined,
          started_at: manualForm.started_at || undefined,
          duration_minutes: manualForm.duration_minutes ? parseInt(manualForm.duration_minutes) : undefined,
          notes: manualForm.notes || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowManualEntry(false);
        setManualForm({ title: "", contact_id: "", call_type_id: "", hosted_by_user_id: "", started_at: "", duration_minutes: "", notes: "" });
        setSelectedContactName("");
        setContactSearch("");
        router.push(`/calls/${data.id}`);
      }
    } catch { /* ignore */ }
    setManualSaving(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Scorecards + controls */}
      <div className="px-1 py-3 flex-shrink-0 space-y-3">
        <ScoreCardRow page="calls" />
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-nah-blue" />
          <span className="text-caption text-text-tertiary">
            {calls.length} {calls.length === 1 ? "call" : "calls"}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowManualEntry((v) => !v)}
              className="btn-secondary px-3 py-1.5 text-caption flex items-center gap-1"
            >
              <Plus size={14} /> Log Call
            </button>
            <button
              onClick={fetchCalls}
              className="btn-ghost p-1.5"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showManualEntry && (
        <div className="flex-shrink-0 mb-3 p-4 bg-bg-secondary border border-border-default rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-body-sm font-medium text-text-primary">Log a Call</h3>
            <button onClick={() => setShowManualEntry(false)} className="btn-ghost p-1"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Title */}
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Title *</label>
              <input
                type="text"
                value={manualForm.title}
                onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                placeholder="e.g. Discovery Call — John Smith"
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
              />
            </div>

            {/* Contact search */}
            <div className="relative">
              <label className="block text-caption text-text-tertiary mb-1">Contact</label>
              {selectedContactName ? (
                <div className="flex items-center gap-2 bg-bg-primary border border-border-default rounded-md px-3 py-2">
                  <span className="text-body-sm text-text-primary flex-1 truncate">{selectedContactName}</span>
                  <button onClick={() => { setManualForm({ ...manualForm, contact_id: "" }); setSelectedContactName(""); setContactSearch(""); }} className="text-text-tertiary hover:text-text-primary"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search contacts..."
                      className="w-full bg-bg-primary border border-border-default rounded-md pl-8 pr-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
                    />
                    {contactSearching && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-text-tertiary" />}
                  </div>
                  {contactResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-default rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {contactResults.map((c) => {
                        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
                        return (
                          <button key={c.id} onClick={() => { setManualForm({ ...manualForm, contact_id: c.id }); setSelectedContactName(name); setContactSearch(""); setContactResults([]); }}
                            className="w-full text-left px-3 py-2 text-body-sm text-text-primary hover:bg-bg-secondary">
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Call Type */}
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Call Type</label>
              <select
                value={manualForm.call_type_id}
                onChange={(e) => setManualForm({ ...manualForm, call_type_id: e.target.value })}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              >
                <option value="">Select...</option>
                {callTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>

            {/* Hosted By */}
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Hosted By</label>
              <select
                value={manualForm.hosted_by_user_id}
                onChange={(e) => setManualForm({ ...manualForm, hosted_by_user_id: e.target.value })}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              >
                <option value="">Select...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Date</label>
              <input
                type="datetime-local"
                value={manualForm.started_at}
                onChange={(e) => setManualForm({ ...manualForm, started_at: e.target.value })}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Duration (min)</label>
              <input
                type="number"
                min={1}
                max={300}
                value={manualForm.duration_minutes}
                onChange={(e) => setManualForm({ ...manualForm, duration_minutes: e.target.value })}
                placeholder="30"
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mt-3">
            <label className="block text-caption text-text-tertiary mb-1">Notes</label>
            <textarea
              value={manualForm.notes}
              onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
              rows={2}
              placeholder="Key takeaways, action items..."
              className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none"
            />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => void handleManualSubmit()}
              disabled={!manualForm.title.trim() || manualSaving}
              className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1 disabled:opacity-50"
            >
              {manualSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Call
            </button>
            <button onClick={() => setShowManualEntry(false)} className="btn-ghost px-3 py-2 text-body-sm">Cancel</button>
          </div>
        </div>
      )}

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
                  <span className="text-caption font-medium text-text-primary truncate">{c.title ?? c.contactName ?? "Unknown"}</span>
                  {c.grade && <span className={`text-[10px] font-bold px-1 rounded ${
                    c.grade === "A" ? "bg-success/10 text-success" : c.grade === "F" ? "bg-danger/10 text-danger" : "bg-nah-blue/10 text-nah-blue"
                  }`}>{c.grade}</span>}
                </div>
                <p className="text-[10px] text-text-tertiary">
                  {c.callTypeName ?? "Call"} {c.hostName ? `• ${c.hostName}` : ""}
                  {c.source === "read_ai" && <span className="ml-1 text-green-600">• Read.ai</span>}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-text-tertiary">{(() => { const d = c.scheduled_at ?? c.started_at ?? c.created_at; return d ? new Date(d).toLocaleDateString() : "—"; })()}</span>
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
