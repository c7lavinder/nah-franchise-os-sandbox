"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, Clock, Loader2,
  ChevronDown, ChevronRight, Zap, Radio,
} from "lucide-react";
import Link from "next/link";

interface IntegrationLog {
  id: string;
  event_type: string;
  status: string;
  payload_summary: string | null;
  error_message: string | null;
  created_at: string;
}

interface Integration {
  name: string;
  label: string;
  desc?: string;
  status: "connected" | "error" | "pending" | "future";
  lastLog: IntegrationLog | null;
  logs: IntegrationLog[];
}

const INTEGRATIONS = [
  { name: "ghl-sync", label: "GoHighLevel (GHL)", desc: "CRM, contacts, pipeline sync" },
  { name: "ghl-calendar", label: "GHL Calendar", desc: "Appointment scheduling" },
  { name: "docusign", label: "DocuSign", desc: "FDD and franchise agreement signing" },
  { name: "zorakle", label: "Zorakle", desc: "Personality profiling + fit scoring" },
  { name: "trainual", label: "Trainual", desc: "Onboarding training modules" },
  { name: "google-meet", label: "Google Meet", desc: "Call recording + transcription" },
  { name: "form-submission", label: "JotForm / PFS", desc: "Personal Financial Statement intake" },
  { name: "payment", label: "Payment Processor", desc: "Franchise fee payments" },
  { name: "openai", label: "OpenAI (Whisper)", desc: "Audio transcription" },
  { name: "anthropic", label: "Anthropic (Claude)", desc: "Scout AI + agent intelligence" },
  { name: "pdl", label: "People Data Labs", desc: "Contact enrichment — job, education, LinkedIn" },
  { name: "read_ai", label: "Read.ai", desc: "Meeting transcription, summaries, and action items" },
  { name: "mastersuite", label: "MasterSuite", desc: "Deal management platform", future: true },
  { name: "background-check", label: "Background Check", desc: "Prospect verification", future: true },
  { name: "signing-software", label: "Signing Software", desc: "Document signing (evaluating)", future: true },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return <span className="flex items-center gap-1 text-[11px] font-medium text-green-700"><CheckCircle2 size={12} /> Connected</span>;
    case "error":
      return <span className="flex items-center gap-1 text-[11px] font-medium text-red-700"><XCircle size={12} /> Error</span>;
    case "pending":
      return <span className="flex items-center gap-1 text-[11px] font-medium text-yellow-700"><Clock size={12} /> Pending</span>;
    default:
      return <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400"><Zap size={12} /> Future</span>;
  }
}

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then((r) => r.json())
      .then((d) => {
        // Map API connection status to the static integration list
        const connectedSet = new Set<string>();
        if (d.ghl?.connected) connectedSet.add("ghl-sync").add("ghl-calendar");
        if (d.anthropic?.connected) connectedSet.add("anthropic");
        if (d.whisper?.connected) connectedSet.add("openai");
        if (d.pdl?.connected) connectedSet.add("pdl");
        if (d.read_ai?.connected) connectedSet.add("read_ai");

        setIntegrations(INTEGRATIONS.map((i) => ({
          ...i,
          status: ("future" in i && (i as { future?: boolean }).future)
            ? "future" as const
            : connectedSet.has(i.name) ? "connected" as const : "pending" as const,
          lastLog: null,
          logs: [],
        })));
      })
      .catch(() => {
        setIntegrations(INTEGRATIONS.map((i) => ({
          ...i,
          status: ("future" in i && (i as { future?: boolean }).future) ? "future" as const : "pending" as const,
          lastLog: null,
          logs: [],
        })));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption text-text-tertiary">
          Integration status is computed from activity logs. Connected = successful event in last 24 hours.
        </p>
        <Link href="/settings/webhooks" className="flex items-center gap-1.5 px-3 py-1.5 text-caption font-medium text-nah-blue hover:bg-nah-blue/5 rounded-md transition-colors">
          <Radio size={14} /> Webhook Admin
        </Link>
      </div>
      {integrations.map((intg) => (
        <div key={intg.name} className="border border-border-default rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === intg.name ? null : intg.name)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors"
          >
            {expanded === intg.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <div className="flex-1 text-left">
              <span className="text-body-sm font-medium text-text-primary">{intg.label}</span>
              {intg.desc && <span className="text-caption text-text-tertiary ml-2">{intg.desc}</span>}
            </div>
            <StatusBadge status={intg.status} />
          </button>
          {expanded === intg.name && (
            <div className="px-4 pb-3 border-t border-border-default">
              {intg.logs.length === 0 ? (
                <div className="text-caption text-text-tertiary py-2">No activity logs yet.</div>
              ) : (
                <div className="space-y-1 mt-2">
                  {intg.logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center gap-2 text-caption">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        log.status === "success" ? "bg-green-400" : log.status === "failed" ? "bg-red-400" : "bg-yellow-400"
                      }`} />
                      <span className="text-text-tertiary">{new Date(log.created_at).toLocaleString()}</span>
                      <span className="text-text-secondary">{log.event_type}</span>
                      {log.error_message && <span className="text-red-600 truncate max-w-[200px]">{log.error_message}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
