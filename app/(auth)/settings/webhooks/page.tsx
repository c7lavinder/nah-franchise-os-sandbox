"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * Webhook Admin Page — /settings/webhooks
 * Shows Read.ai sessions, integration logs, and recent calls for debugging.
 */

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, Radio, FileText, Phone, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Session {
  session_id: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  platform: string | null;
  owner_email: string | null;
  participant_emails: string[] | null;
  processing_status: string | null;
  call_type: string | null;
  error_message: string | null;
  classified_at: string | null;
  processed_at: string | null;
  created_at: string;
}

interface LogEntry {
  id: string;
  integration_name: string;
  event_type: string;
  status: string;
  payload_summary: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface CallEntry {
  id: string;
  title: string | null;
  contact_id: string | null;
  contactName: string | null;
  source: string | null;
  status: string | null;
  started_at: string | null;
  created_at: string;
  read_ai_session_id: string | null;
  summary: string | null;
}

interface Counts { sessions: number; logs: number; calls: number }

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary">—</span>;
  const map: Record<string, string> = {
    complete: "bg-success/10 text-success",
    success: "bg-success/10 text-success",
    completed: "bg-success/10 text-success",
    processing: "bg-info/10 text-info",
    pending: "bg-info/10 text-info",
    failed: "bg-danger/10 text-danger",
    error: "bg-danger/10 text-danger",
    parse_error: "bg-danger/10 text-danger",
    skipped: "bg-warning/10 text-warning",
    invalid: "bg-warning/10 text-warning",
    missing: "bg-bg-tertiary text-text-tertiary",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[status] ?? "bg-bg-tertiary text-text-tertiary"}`}>
      {status}
    </span>
  );
}

function TimeAgo({ date }: { date: string | null }) {
  if (!date) return <span className="text-text-tertiary">—</span>;
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return <span>just now</span>;
  if (diffMin < 60) return <span>{diffMin}m ago</span>;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return <span>{diffHr}h ago</span>;
  return <span>{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

export default function WebhookAdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [counts, setCounts] = useState<Counts>({ sessions: 0, logs: 0, calls: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sessions" | "logs" | "calls">("sessions");

  async function fetchData() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/webhooks?limit=100");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
        setLogs(data.logs ?? []);
        setCalls(data.calls ?? []);
        setCounts(data.counts ?? { sessions: 0, logs: 0, calls: 0 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { void fetchData(); }, []);

  const TABS = [
    { key: "sessions" as const, label: "Read.ai Sessions", icon: Radio, count: counts.sessions },
    { key: "logs" as const, label: "Webhook Logs", icon: FileText, count: counts.logs },
    { key: "calls" as const, label: "Created Calls", icon: Phone, count: counts.calls },
  ];

  const failedSessions = sessions.filter((s) => s.processing_status === "failed").length;
  const errorLogs = logs.filter((l) => l.status === "error" || l.status === "parse_error").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/settings" className="btn-ghost p-1.5"><ArrowLeft size={16} /></Link>
        <Radio size={20} className="text-nah-blue" />
        <h1 className="font-headline text-page-title text-text-primary">Webhook Admin</h1>
        <button onClick={() => void fetchData()} disabled={loading} className="btn-ghost p-1.5 ml-auto">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={14} className="text-nah-blue" />
            <span className="text-caption text-text-tertiary">Sessions</span>
          </div>
          <p className="text-h2 text-text-primary">{counts.sessions}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Phone size={14} className="text-success" />
            <span className="text-caption text-text-tertiary">Calls Created</span>
          </div>
          <p className="text-h2 text-text-primary">{counts.calls}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            {failedSessions > 0 ? <XCircle size={14} className="text-danger" /> : <CheckCircle2 size={14} className="text-success" />}
            <span className="text-caption text-text-tertiary">Failed Sessions</span>
          </div>
          <p className={`text-h2 ${failedSessions > 0 ? "text-danger" : "text-text-primary"}`}>{failedSessions}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-1">
            {errorLogs > 0 ? <AlertTriangle size={14} className="text-warning" /> : <CheckCircle2 size={14} className="text-success" />}
            <span className="text-caption text-text-tertiary">Errors</span>
          </div>
          <p className={`text-h2 ${errorLogs > 0 ? "text-warning" : "text-text-primary"}`}>{errorLogs}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default mb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-nah-orange text-nah-orange"
                  : "border-transparent text-text-tertiary hover:text-text-primary"
              }`}
            >
              <Icon size={14} />
              {tab.label}
              <span className="text-[10px] bg-bg-tertiary px-1.5 py-0.5 rounded-full ml-1">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Sessions tab */}
      {activeTab === "sessions" && (
        <div className="space-y-2">
          {sessions.length === 0 && !loading && (
            <p className="text-body-sm text-text-tertiary py-8 text-center">No Read.ai sessions yet. Webhooks will appear here when received.</p>
          )}
          {sessions.map((s) => (
            <div key={s.session_id} className={`card p-3 border-l-4 ${
              s.processing_status === "failed" ? "border-l-danger" :
              s.processing_status === "complete" ? "border-l-success" :
              s.processing_status === "skipped" ? "border-l-warning" :
              "border-l-info"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-body-sm font-medium text-text-primary truncate">{s.title ?? "Untitled Session"}</span>
                    <StatusBadge status={s.processing_status} />
                    {s.call_type && <StatusBadge status={s.call_type} />}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                    {s.owner_email && <span>{s.owner_email}</span>}
                    {s.platform && <span>{s.platform}</span>}
                    {s.participant_emails && <span>{s.participant_emails.length} participants</span>}
                  </div>
                  {s.error_message && (
                    <div className="mt-2 px-2 py-1 bg-danger/5 border border-danger/10 rounded text-[10px] text-danger font-mono">
                      {s.error_message}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-text-tertiary"><TimeAgo date={s.created_at} /></div>
                  <div className="text-[10px] text-text-tertiary font-mono mt-1 truncate max-w-[140px]" title={s.session_id}>
                    {s.session_id.length > 16 ? `${s.session_id.slice(0, 16)}...` : s.session_id}
                  </div>
                </div>
              </div>
              {/* Timeline */}
              <div className="flex items-center gap-4 mt-2 text-[10px] text-text-tertiary">
                <span className="flex items-center gap-1"><Clock size={10} /> Received: {s.created_at ? new Date(s.created_at).toLocaleTimeString() : "—"}</span>
                {s.classified_at && <span>Classified: {new Date(s.classified_at).toLocaleTimeString()}</span>}
                {s.processed_at && <span>Processed: {new Date(s.processed_at).toLocaleTimeString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs tab */}
      {activeTab === "logs" && (
        <div className="space-y-2">
          {logs.length === 0 && !loading && (
            <p className="text-body-sm text-text-tertiary py-8 text-center">No webhook logs yet. Events will appear here as webhooks are processed.</p>
          )}
          {logs.map((l) => (
            <div key={l.id} className={`card p-3 border-l-4 ${
              l.status === "error" || l.status === "parse_error" ? "border-l-danger" :
              l.status === "success" ? "border-l-success" :
              "border-l-info"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-body-sm font-medium text-text-primary">{l.payload_summary ?? l.event_type}</span>
                    <StatusBadge status={l.status} />
                  </div>
                  {l.error_message && (
                    <div className="mt-1 px-2 py-1 bg-danger/5 border border-danger/10 rounded text-[10px] text-danger font-mono">
                      {l.error_message}
                    </div>
                  )}
                  {l.metadata && (
                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-text-tertiary">
                      {l.metadata.owner_email ? <span>Owner: {String(l.metadata.owner_email)}</span> : null}
                      {l.metadata.signature_status ? <span>Sig: {String(l.metadata.signature_status)}</span> : null}
                      {l.metadata.participant_count != null ? <span>{String(l.metadata.participant_count)} participants</span> : null}
                      {l.metadata.session_id ? <span className="font-mono truncate max-w-[120px]">{String(l.metadata.session_id).slice(0, 16)}...</span> : null}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-text-tertiary flex-shrink-0">
                  <TimeAgo date={l.created_at} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calls tab */}
      {activeTab === "calls" && (
        <div className="space-y-2">
          {calls.length === 0 && !loading && (
            <p className="text-body-sm text-text-tertiary py-8 text-center">No calls created from webhooks or manual entry yet.</p>
          )}
          {calls.map((c) => (
            <Link key={c.id} href={`/calls/${c.id}`}
              className="card p-3 block hover:border-nah-blue/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-body-sm font-medium text-text-primary truncate">{c.title ?? "Untitled"}</span>
                    <StatusBadge status={c.status} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      c.source === "read_ai" ? "bg-green-500/10 text-green-600" : "bg-nah-blue/10 text-nah-blue"
                    }`}>{c.source === "read_ai" ? "Read.ai" : "Manual"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                    {c.contactName && <span>{c.contactName}</span>}
                    {c.read_ai_session_id && <span className="font-mono truncate max-w-[120px]">{c.read_ai_session_id.slice(0, 16)}...</span>}
                  </div>
                  {c.summary && (
                    <p className="text-[10px] text-text-tertiary mt-1 line-clamp-2">{c.summary}</p>
                  )}
                </div>
                <div className="text-[10px] text-text-tertiary flex-shrink-0">
                  <TimeAgo date={c.started_at ?? c.created_at} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
