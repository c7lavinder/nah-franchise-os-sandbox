"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, X, Loader2, Phone, Monitor, AlertTriangle, Upload } from "lucide-react";
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
  teamMembers: { name: string; color: string | null }[];
  externalContacts: string[];
  date: string | null;
  duration_seconds: number | null;
  platform: string | null;
  territoryName: string | null;
  has_transcript: boolean;
  transcript_length: number;
  ai_summary_generated_at: string | null;
  unmappedCount: number;
}

function getBadCallReasons(c: Call): string[] {
  const reasons: string[] = [];
  if (c.status === "missed") reasons.push("Marked missed");
  if (c.status === "completed" && !c.has_transcript) reasons.push("No transcript");
  if (c.status === "completed" && c.has_transcript && c.transcript_length < 500) reasons.push("Transcript too short");
  if (c.duration_seconds != null && c.duration_seconds > 0 && c.duration_seconds < 120) reasons.push("Under 2 minutes");
  return reasons;
}

interface UserOption {
  id: string;
  full_name: string;
}

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
    key: "team",
    label: "Team Calls",
    slugs: ["team_call"] as string[],
    classified: ["internal"],
  },
  {
    key: "group",
    label: "Group Calls",
    slugs: ["group_call", "cohort_call"] as string[],
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
  // Priority 1: match by call_type slug (most reliable — set by the processor)
  if (c.callTypeSlug) {
    for (const panel of PANELS) {
      if (panel.key === "other") continue;
      if (panel.slugs.includes(c.callTypeSlug)) return panel.key;
    }
  }
  // Priority 2: match by Read.ai classified type (fallback)
  if (c.classifiedType) {
    for (const panel of PANELS) {
      if (panel.key === "other") continue;
      if (panel.classified.includes(c.classifiedType)) return panel.key;
    }
  }
  // Priority 3: match by title keywords (last resort)
  const titleLower = (c.title ?? "").toLowerCase();
  if (titleLower.includes("coaching")) return "coaching";
  if (titleLower.includes("onboarding")) return "onboarding";
  return "other";
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function filterByTime(calls: Call[], filter: TimeFilter): Call[] {
  if (filter === "all") return calls;
  const bounds = filter === "week" ? getWeekBounds() : getMonthBounds();
  return calls.filter((c) => {
    if (!c.date) return false;
    const d = new Date(c.date);
    return d >= bounds.start && d <= bounds.end;
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

function CallRow({ c }: { c: Call }) {
  const badReasons = getBadCallReasons(c);
  return (
    <Link
      href={`/calls/${c.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-bg-hover transition-colors"
    >
      <PlatformIcon platform={c.platform} source={c.source} />

      {/* Call type + team + contacts */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-body-sm font-semibold text-text-primary truncate">{c.callTypeName ?? c.title ?? "Call"}</p>
          {badReasons.length > 0 && (
            <span
              className="inline-flex items-center text-danger flex-shrink-0"
              title={`Likely bad call: ${badReasons.join(", ")}`}
            >
              <AlertTriangle size={12} fill="currentColor" />
            </span>
          )}
          {c.unmappedCount > 0 && (
            <span
              className="inline-flex items-center text-[#EAB308] flex-shrink-0"
              title={`${c.unmappedCount} participant${c.unmappedCount === 1 ? "" : "s"} not mapped`}
            >
              <AlertTriangle size={12} fill="currentColor" />
            </span>
          )}
        </div>
        {c.teamMembers.length > 0 && (
          <div
            className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {c.teamMembers.map((m, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0"
                style={m.color ? { backgroundColor: `${m.color}18`, color: m.color } : undefined}
              >
                {m.name}
              </span>
            ))}
          </div>
        )}
        {c.externalContacts.length > 0 && (
          <div
            className="flex items-center gap-1 mt-1 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {c.externalContacts.map((name, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-bg-tertiary text-text-secondary whitespace-nowrap flex-shrink-0"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 w-[90px] text-right">
        {c.status === "scheduled" && c.date && new Date(c.date) > new Date() ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-info/10 text-info">Upcoming</span>
        ) : c.has_transcript && !c.ai_summary_generated_at ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-warning/10 text-warning">
            Needs Review
          </span>
        ) : null}
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

const PANEL_VISIBLE_LIMIT = 6;
const ROW_HEIGHT_PX = 76; // approximate height per call row (title + team + contacts)

function CallPanel({ label, calls }: { label: string; calls: Call[] }) {
  const maxHeight = PANEL_VISIBLE_LIMIT * ROW_HEIGHT_PX;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h3 className="text-body-sm font-medium text-text-primary">{label}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">{calls.length}</span>
      </div>
      {calls.length === 0 ? (
        <div className="px-4 py-6 text-center text-caption text-text-tertiary">No calls</div>
      ) : (
        <div className="divide-y divide-border-default overflow-y-auto" style={{ maxHeight: `${maxHeight}px` }}>
          {calls.map((c) => (
            <CallRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("week");

  // Upload form
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [uploadHostedBy, setUploadHostedBy] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [uploadDragOver, setUploadDragOver] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/calls/list?limit=200");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    if (!showManualEntry) return;
    apiFetch("/api/settings/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((uData) => {
        if (uData?.users)
          setUsers(uData.users.filter((u: UserOption & { is_active: boolean }) => u.is_active !== false));
      })
      .catch(() => {});
  }, [showManualEntry]);

  async function handleUploadSubmit() {
    if (!uploadFile && !pastedTranscript.trim()) return;
    setManualSaving(true);
    try {
      // 1. Create the call with minimal info — AI will fill in title + call type
      const title = uploadFile?.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ") ?? "Uploaded Call";
      const res = await apiFetch("/api/calls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          hosted_by_user_id: uploadHostedBy || undefined,
          started_at: uploadDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create call");
      const { id: callId } = await res.json();

      // 2. Upload the file or paste the transcript
      if (uploadFile) {
        const formData = new FormData();
        formData.append("file", uploadFile);
        const ext = uploadFile.name.split(".").pop()?.toLowerCase() ?? "";
        formData.append("type", ext === "txt" ? "transcript" : "recording");
        await apiFetch(`/api/calls/${callId}/upload`, { method: "POST", body: formData });
      } else if (pastedTranscript.trim()) {
        const blob = new Blob([pastedTranscript.trim()], { type: "text/plain" });
        const formData = new FormData();
        formData.append("file", blob, "transcript.txt");
        formData.append("type", "transcript");
        await apiFetch(`/api/calls/${callId}/upload`, { method: "POST", body: formData });
      }

      // 3. Navigate first, then trigger AI processing from the new page context
      setShowManualEntry(false);
      setUploadFile(null);
      setPastedTranscript("");
      setUploadDate("");
      setUploadHostedBy("");
      router.push(`/calls/${callId}`);

      // 4. Fire AI processing after navigation — use fetch() directly so
      //    browser doesn't cancel when the component unmounts
      const base = window.location.origin + "/frandev";
      fetch(`${base}/api/calls/${callId}/review-package`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
      fetch(`${base}/api/calls/${callId}/generate`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    setManualSaving(false);
  }

  // Filter + categorize + sort newest first within each panel
  const filtered = filterByTime(calls, timeFilter);
  const panelData = PANELS.map((p) => ({
    ...p,
    calls: filtered
      .filter((c) => categorizeCall(c) === p.key)
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      }),
  }));
  // Only show panels that have calls or are key categories
  const visiblePanels = panelData.filter((p) => p.key !== "other" || p.calls.length > 0);

  return (
    <div>
      <div className="mb-4">
        <ScoreCardRow page="calls" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        {/* Time filter */}
        <div className="flex items-center bg-bg-secondary border border-border-default rounded-md overflow-hidden">
          {(
            [
              ["week", "This Week"],
              ["month", "This Month"],
              ["all", "All"],
            ] as [TimeFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTimeFilter(key)}
              className={`px-3 py-1.5 text-caption font-medium transition-colors ${
                timeFilter === key ? "bg-nah-blue text-white" : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-caption text-text-tertiary">{filtered.length} calls</span>

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

      {/* Upload Call Form */}
      {showManualEntry && (
        <div className="mb-4 p-4 bg-bg-secondary border border-border-default rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-body-sm font-medium text-text-primary">Upload a Call</h3>
            <button onClick={() => setShowManualEntry(false)} className="btn-ghost p-1">
              <X size={14} />
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDragOver(true);
            }}
            onDragLeave={() => setUploadDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUploadDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) {
                setUploadFile(file);
                setPastedTranscript("");
              }
            }}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              uploadDragOver
                ? "border-nah-blue bg-[rgba(0,161,225,0.05)]"
                : uploadFile
                  ? "border-success/40 bg-success/5"
                  : "border-border-default hover:border-border-hover"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".mp4,.webm,.m4a,.mp3,.wav,.txt";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) {
                  setUploadFile(file);
                  setPastedTranscript("");
                }
              };
              input.click();
            }}
          >
            {uploadFile ? (
              <div className="flex items-center justify-center gap-2">
                <Upload size={16} className="text-success" />
                <span className="text-body-sm font-medium text-text-primary">{uploadFile.name}</span>
                <span className="text-caption text-text-tertiary">
                  ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadFile(null);
                  }}
                  className="text-text-tertiary hover:text-danger ml-2"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={20} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-body-sm text-text-secondary">Drop a recording or transcript here</p>
                <p className="text-caption text-text-tertiary mt-1">MP4, WebM, M4A, MP3, WAV, or TXT</p>
              </>
            )}
          </div>

          {/* Or paste transcript */}
          {!uploadFile && (
            <div className="mt-3">
              <label className="block text-caption text-text-tertiary mb-1">Or paste transcript</label>
              <textarea
                value={pastedTranscript}
                onChange={(e) => setPastedTranscript(e.target.value)}
                rows={4}
                placeholder={"Speaker 1: Hello...\nSpeaker 2: Hi there..."}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary resize-none font-mono"
              />
            </div>
          )}

          {/* Date + Hosted By */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Call Date</label>
              <input
                type="datetime-local"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              />
            </div>
            <div>
              <label className="block text-caption text-text-tertiary mb-1">Who hosted?</label>
              <select
                value={uploadHostedBy}
                onChange={(e) => setUploadHostedBy(e.target.value)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              >
                <option value="">Select team member...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-caption text-text-tertiary mt-3">
            AI will determine: title, call type, contact match, and coaching analysis.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => void handleUploadSubmit()}
              disabled={(!uploadFile && !pastedTranscript.trim()) || manualSaving}
              className="btn-primary px-4 py-2 text-body-sm flex items-center gap-1 disabled:opacity-50"
            >
              {manualSaving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload & Process
            </button>
            <button
              onClick={() => {
                setShowManualEntry(false);
                setUploadFile(null);
                setPastedTranscript("");
              }}
              className="btn-ghost px-3 py-2 text-body-sm"
            >
              Cancel
            </button>
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
