"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, X, Search, Loader2, Clock, Users, User, Phone, Monitor } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScoreCardRow from "@/components/scorecards/ScoreCardRow";

interface Call {
  id: string;
  title: string | null;
  source: string | null;
  status: string | null;
  hostName: string | null;
  contactName: string | null;
  callTypeName: string | null;
  callTypeSlug: string | null;
  classifiedType: string | null;
  teamMembers: string[];
  externalContacts: string[];
  date: string | null;
  duration_seconds: number | null;
  platform: string | null;
  territoryName: string | null;
}

interface CallType { id: string; name: string }
interface UserOption { id: string; full_name: string }
interface ContactOption { id: string; first_name: string | null; last_name: string | null }

type TimeFilter = "week" | "month" | "all";

// Panel definitions — each maps to call type slugs or classified types
const PANELS = [
  {
    key: "pto",
    label: "Path to Ownership",
    slugs: ["intro_call", "matt_call", "sam_call", "mark_call", "matt_final_call", "fdd_review_call"],
    classified: ["prospect"],
  },
  {
    key: "onboarding",
    label: "Onboarding",
    slugs: ["onboarding_call"],
    classified: [] as string[],
  },
  {
    key: "coaching",
    label: "Coaching",
    slugs: ["coaching_call"],
    classified: ["coaching"],
  },
  {
    key: "admin",
    label: "Admin / Check-in",
    slugs: [] as string[],
    classified: ["internal"],
  },
  {
    key: "group",
    label: "Group Calls",
    slugs: [] as string[],
    classified: ["group"],
  },
  {
    key: "other",
    label: "Other",
    slugs: [] as string[],
    classified: [] as string[],
  },
];

function categorizeCall(c: Call): string {
  for (const panel of PANELS) {
    if (panel.key === "other") continue;
    if (c.callTypeSlug && panel.slugs.includes(c.callTypeSlug)) return panel.key;
    if (c.classifiedType && panel.classified.includes(c.classifiedType)) return panel.key;
  }
  return "other";
}

function getMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getFirstOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function filterByTime(calls: Call[], filter: TimeFilter): Call[] {
  if (filter === "all") return calls;
  const cutoff = filter === "week" ? getMonday() : getFirstOfMonth();
  return calls.filter((c) => {
    if (!c.date) return false;
    return new Date(c.date) >= cutoff;
  });
}

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

function PlatformIcon({ platform, source }: { platform: string | null; source: string | null }) {
  if (source === "read_ai") return <Monitor size={16} className="text-nah-blue flex-shrink-0" />;
  const isVideo = platform && ["meet", "google_meet", "zoom", "teams", "webex"].includes(platform.toLowerCase());
  if (isVideo) return <Monitor size={16} className="text-nah-blue flex-shrink-0" />;
  return <Phone size={16} className="text-text-tertiary flex-shrink-0" />;
}

// Rotating colors for team member pills
const TEAM_COLORS = [
  "bg-nah-orange/10 text-nah-orange",
  "bg-nah-blue/10 text-nah-blue",
  "bg-scout-purple/10 text-scout-purple",
  "bg-success/10 text-success",
  "bg-info/10 text-info",
  "bg-warning/10 text-warning",
];

function getTeamColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}

function CallRow({ c }: { c: Call }) {
  return (
    <Link href={`/calls/${c.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-bg-hover transition-colors">
      <PlatformIcon platform={c.platform} source={c.source} />

      {/* Title + labels */}
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-semibold text-text-primary truncate">{c.title ?? "Untitled"}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {c.teamMembers.map((name, i) => (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getTeamColor(name)}`}>{name}</span>
          ))}
        </div>
      </div>

      {/* Duration + date stacked */}
      <div className="flex-shrink-0 text-right w-[110px]">
        <p className="text-[11px] text-text-tertiary">{formatDate(c.date)}</p>
        {c.duration_seconds ? (
          <p className="text-[10px] text-text-tertiary mt-0.5">{formatDuration(c.duration_seconds)}</p>
        ) : null}
      </div>
    </Link>
  );
}

function CallPanel({ label, calls }: { label: string; calls: Call[] }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h3 className="text-body-sm font-medium text-text-primary">{label}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">{calls.length}</span>
      </div>
      {calls.length === 0 ? (
        <div className="px-4 py-6 text-center text-caption text-text-tertiary">No calls</div>
      ) : (
        <div className="divide-y divide-border-default">
          {calls.map((c) => <CallRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

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
      const res = await fetch("/api/calls/list?limit=200");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchCalls(); }, [fetchCalls]);

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

  // Filter + categorize
  const filtered = filterByTime(calls, timeFilter);
  const panelData = PANELS.map((p) => ({
    ...p,
    calls: filtered.filter((c) => categorizeCall(c) === p.key),
  }));
  // Only show panels that have calls or are key categories
  const visiblePanels = panelData.filter((p) => p.calls.length > 0 || ["pto", "coaching"].includes(p.key));

  return (
    <div>
      <div className="mb-4">
        <ScoreCardRow page="calls" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        {/* Time filter */}
        <div className="flex items-center bg-bg-secondary border border-border-default rounded-md overflow-hidden">
          {([["week", "This Week"], ["month", "This Month"], ["all", "All"]] as [TimeFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTimeFilter(key)}
              className={`px-3 py-1.5 text-caption font-medium transition-colors ${
                timeFilter === key ? "bg-nah-blue text-white" : "text-text-tertiary hover:text-text-primary"
              }`}>{label}</button>
          ))}
        </div>
        <span className="text-caption text-text-tertiary">{filtered.length} calls</span>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setShowManualEntry((v) => !v)}
            className="btn-secondary px-3 py-1.5 text-caption flex items-center gap-1">
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

      {/* Empty */}
      {!loading && calls.length === 0 && (
        <div className="text-center py-16">
          <Phone size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-body-sm text-text-tertiary">No calls yet</p>
          <p className="text-caption text-text-tertiary mt-1">Calls from Read.ai and manual entries will appear here</p>
        </div>
      )}

      {/* Panels — two columns */}
      {calls.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visiblePanels.map((p) => (
            <CallPanel key={p.key} label={p.label} calls={p.calls} />
          ))}
        </div>
      )}
    </div>
  );
}
