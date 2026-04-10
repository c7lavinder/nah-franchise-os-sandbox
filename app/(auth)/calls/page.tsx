"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw, Plus, X, Search, Loader2, Clock, Users, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Call {
  id: string;
  title: string | null;
  source: string | null;
  status: string | null;
  hostName: string | null;
  contactName: string | null;
  callTypeName: string | null;
  teamMembers: string[];
  externalContacts: string[];
  date: string | null;
  duration_seconds: number | null;
}

interface CallType { id: string; name: string }
interface UserOption { id: string; full_name: string }
interface ContactOption { id: string; first_name: string | null; last_name: string | null }

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const res = await fetch("/api/calls/list?limit=50");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchCalls(); }, [fetchCalls]);

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
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Phone size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Calls</h1>
        <span className="text-caption text-text-tertiary ml-1">{calls.length}</span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowManualEntry((v) => !v)}
            className="btn-secondary px-3 py-1.5 text-caption flex items-center gap-1"
          >
            <Plus size={14} /> Log Call
          </button>
          <button onClick={fetchCalls} className="btn-ghost p-1.5" disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showManualEntry && (
        <div className="mb-4 p-4 bg-bg-secondary border border-border-default rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-body-sm font-medium text-text-primary">Log a Call</h3>
            <button onClick={() => setShowManualEntry(false)} className="btn-ghost p-1"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Title *</label>
              <input type="text" value={manualForm.title} onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                placeholder="e.g. Discovery Call — John Smith"
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary" />
            </div>
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
                    <input type="text" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search contacts..."
                      className="w-full bg-bg-primary border border-border-default rounded-md pl-8 pr-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary" />
                    {contactSearching && <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-text-tertiary" />}
                  </div>
                  {contactResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-default rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {contactResults.map((c) => {
                        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
                        return (
                          <button key={c.id} onClick={() => { setManualForm({ ...manualForm, contact_id: c.id }); setSelectedContactName(name); setContactSearch(""); setContactResults([]); }}
                            className="w-full text-left px-3 py-2 text-body-sm text-text-primary hover:bg-bg-secondary">{name}</button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Call Type</label>
              <select value={manualForm.call_type_id} onChange={(e) => setManualForm({ ...manualForm, call_type_id: e.target.value })}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary">
                <option value="">Select...</option>
                {callTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Hosted By</label>
              <select value={manualForm.hosted_by_user_id} onChange={(e) => setManualForm({ ...manualForm, hosted_by_user_id: e.target.value })}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary">
                <option value="">Select...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Date</label>
              <input type="datetime-local" value={manualForm.started_at} onChange={(e) => setManualForm({ ...manualForm, started_at: e.target.value })}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary" />
            </div>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Duration (min)</label>
              <input type="number" min={1} max={300} value={manualForm.duration_minutes} onChange={(e) => setManualForm({ ...manualForm, duration_minutes: e.target.value })} placeholder="30"
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-caption text-text-tertiary mb-1">Notes</label>
            <textarea value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} rows={2} placeholder="Key takeaways, action items..."
              className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => void handleManualSubmit()} disabled={!manualForm.title.trim() || manualSaving}
              className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1 disabled:opacity-50">
              {manualSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Call
            </button>
            <button onClick={() => setShowManualEntry(false)} className="btn-ghost px-3 py-2 text-body-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && calls.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-text-tertiary" />
        </div>
      )}

      {/* Call List */}
      {!loading && calls.length === 0 && (
        <div className="text-center py-16">
          <Phone size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-body-sm text-text-tertiary">No calls yet</p>
          <p className="text-caption text-text-tertiary mt-1">Calls from Read.ai and manual entries will appear here</p>
        </div>
      )}

      <div className="space-y-1">
        {calls.map((c) => (
          <Link key={c.id} href={`/calls/${c.id}`}
            className="flex items-center gap-4 px-4 py-3 rounded-lg border border-transparent hover:border-border-default hover:bg-bg-secondary transition-colors group">

            {/* Title + call type */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body-sm font-medium text-text-primary truncate">{c.title ?? "Untitled Call"}</span>
                {c.callTypeName && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary">{c.callTypeName}</span>
                )}
                {c.source === "read_ai" && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">Read.ai</span>
                )}
                {c.source === "manual" && (
                  <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-nah-blue/10 text-nah-blue">Manual</span>
                )}
              </div>

              {/* People row */}
              <div className="flex items-center gap-3 mt-1 text-caption text-text-tertiary">
                {/* Host / lead */}
                {c.hostName && (
                  <span className="flex items-center gap-1">
                    <User size={10} className="text-nah-orange" />
                    {c.hostName}
                  </span>
                )}
                {/* Contact */}
                {c.contactName && (
                  <span className="flex items-center gap-1">
                    <User size={10} className="text-nah-blue" />
                    {c.contactName}
                  </span>
                )}
                {/* External contacts from Read.ai */}
                {!c.contactName && c.externalContacts.length > 0 && (
                  <span className="flex items-center gap-1">
                    <User size={10} className="text-nah-blue" />
                    {c.externalContacts.slice(0, 2).join(", ")}
                    {c.externalContacts.length > 2 && ` +${c.externalContacts.length - 2}`}
                  </span>
                )}
                {/* Team members */}
                {c.teamMembers.length > 1 && (
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {c.teamMembers.length} team
                  </span>
                )}
              </div>
            </div>

            {/* Duration */}
            {c.duration_seconds ? (
              <span className="flex-shrink-0 flex items-center gap-1 text-caption text-text-tertiary">
                <Clock size={10} />
                {formatDuration(c.duration_seconds)}
              </span>
            ) : null}

            {/* Date + time */}
            <span className="flex-shrink-0 text-caption text-text-tertiary w-[120px] text-right">
              {formatDate(c.date)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
