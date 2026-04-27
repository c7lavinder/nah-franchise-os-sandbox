"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * IntelligenceTab — main intelligence tab for the candidate profile panel.
 * Fetches the full intelligence profile and renders score breakdown,
 * financial/personality cards, flags, call log history, and objection history.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  DollarSign,
  Brain,
  Flag,
  MessageSquare,
  ShieldAlert,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type {
  CandidateIntelligence,
  CallLog,
  ObjectionRegistry,
} from "@/lib/intelligence/types";
import ScoreBreakdown from "./ScoreBreakdown";
import FlagList from "./FlagList";
import type { IntelligenceFlag } from "./FlagList";

// ─────────────────────────────────────────────
// Types for the API response
// ─────────────────────────────────────────────

interface IntelligenceProfileResponse {
  intelligence: CandidateIntelligence | null;
  callLogs: CallLog[];
  objections: ObjectionRegistry[];
}

// ─────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────

type TabKey = "overview" | "calls" | "objections";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Brain },
  { key: "calls", label: "Calls", icon: Phone },
  { key: "objections", label: "Objections", icon: ShieldAlert },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const CALL_TYPE_LABELS: Record<string, string> = {
  intro: "Intro Call",
  matt: "Matt Call",
  sam: "Sam Call",
  mark: "Mark Call",
};

const CALL_TYPE_COLORS: Record<string, string> = {
  intro: "bg-nah-blue-light text-nah-blue",
  matt: "bg-[#e8f5e9] text-success",
  sam: "bg-accent-yellow-light text-accent-yellow-hover",
  mark: "bg-[#f3e8ff] text-[#7c3aed]",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-success",
  medium: "text-accent-yellow",
  low: "text-danger",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "--" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function netWorthLabel(bucket: string | null): string {
  if (!bucket) return "--";
  const map: Record<string, string> = {
    under_100k: "Under $100K",
    "100_250k": "$100K - $250K",
    "250_500k": "$250K - $500K",
    "500k_plus": "$500K+",
  };
  return map[bucket] ?? bucket;
}

function fundingLabel(path: string | null): string {
  if (!path) return "--";
  const map: Record<string, string> = {
    cash: "Cash",
    guidant: "Guidant Financial",
    sba: "SBA Loan",
    combination: "Combination",
    unknown: "Unknown",
  };
  return map[path] ?? path;
}

function capitalDisplay(amount: number | null): string {
  if (amount === null || amount === undefined) return "--";
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

/** Parse active_flags from the intelligence record into the FlagList shape */
function parseFlags(raw: Record<string, unknown>[] | null): IntelligenceFlag[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((f) => ({
    text: (f.text as string) ?? (f.message as string) ?? "",
    severity: (f.severity as IntelligenceFlag["severity"]) ?? "info",
    createdAt: (f.createdAt as string) ?? (f.created_at as string) ?? new Date().toISOString(),
  }));
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

interface IntelligenceTabProps {
  contactId: string;
  onLogCall?: () => void;
}

export default function IntelligenceTab({ contactId, onLogCall }: IntelligenceTabProps) {
  const [data, setData] = useState<IntelligenceProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/intelligence/profile?contactId=${contactId}`);
      if (res.ok) {
        const json = (await res.json()) as IntelligenceProfileResponse;
        setData(json);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [contactId]);

  useEffect(() => {
    setLoading(true);
    void fetchProfile();
  }, [fetchProfile]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-bg-tertiary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // ── No data state ──
  if (!data || !data.intelligence) {
    return (
      <div className="p-5 text-center">
        <Brain size={32} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-body text-text-secondary mb-1">No intelligence data yet</p>
        <p className="text-body-sm text-text-tertiary">
          Log the first call to start building this candidate&apos;s profile.
        </p>
        {onLogCall && (
          <button
            onClick={onLogCall}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-nah-blue text-text-inverse text-button hover:bg-nah-blue-hover transition-colors"
          >
            <Plus size={14} />
            Log Call
          </button>
        )}
      </div>
    );
  }

  const intel = data.intelligence;
  const flags = parseFlags(intel.active_flags);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-0 border-b border-border-default">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-body-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-nah-blue text-nah-blue bg-bg-hover"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover/50"
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.key === "calls" && data.callLogs.length > 0 && (
                <span className="text-badge text-text-tertiary ml-1">{data.callLogs.length}</span>
              )}
              {tab.key === "objections" && data.objections.length > 0 && (
                <span className="text-badge text-text-tertiary ml-1">{data.objections.length}</span>
              )}
            </button>
          );
        })}

        {/* Log Call button — always visible in tab bar */}
        {onLogCall && (
          <button
            onClick={onLogCall}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nah-blue text-text-inverse text-button hover:bg-nah-blue-hover transition-colors"
          >
            <Plus size={14} />
            Log Call
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <OverviewTab intel={intel} flags={flags} />
        )}
        {activeTab === "calls" && (
          <CallsTab callLogs={data.callLogs} />
        )}
        {activeTab === "objections" && (
          <ObjectionsTab objections={data.objections} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────

function OverviewTab({ intel, flags }: { intel: CandidateIntelligence; flags: IntelligenceFlag[] }) {
  return (
    <div className="p-5 space-y-5">
      {/* Score Breakdown */}
      <section>
        <p className="text-label-caps text-text-tertiary mb-3">SCOUT SCORE</p>
        <ScoreBreakdown
          financial={intel.score_financial}
          operational={intel.score_operational}
          engagement={intel.score_engagement}
          momentum={intel.score_momentum}
          total={intel.current_score}
        />
      </section>

      {/* Financial Profile */}
      <section>
        <p className="text-label-caps text-text-tertiary mb-3 flex items-center gap-1.5">
          <DollarSign size={13} />
          FINANCIAL PROFILE
        </p>
        <div className="rounded-lg border border-border-default bg-surface-glass p-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoField label="Net Worth" value={netWorthLabel(intel.net_worth_bucket)} />
            <InfoField label="Liquid Capital" value={capitalDisplay(intel.liquid_capital)} />
            <InfoField label="Funding Path" value={fundingLabel(intel.funding_path)} />
            <InfoField
              label="PFS Status"
              value={intel.pfs_received ? "Received" : "Not Received"}
              valueColor={intel.pfs_received ? "text-success" : "text-text-tertiary"}
            />
          </div>
        </div>
      </section>

      {/* Personality Profile */}
      <section>
        <p className="text-label-caps text-text-tertiary mb-3 flex items-center gap-1.5">
          <Brain size={13} />
          PERSONALITY PROFILE
        </p>
        <div className="rounded-lg border border-border-default bg-surface-glass p-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoField
              label="DISC Type"
              value={intel.disc_profile ?? "--"}
              valueColor={intel.disc_profile ? "text-text-primary font-semibold" : undefined}
            />
            <InfoField
              label="Zorakle"
              value={intel.zorakle_completed ? "Completed" : "Not Completed"}
              valueColor={intel.zorakle_completed ? "text-success" : "text-text-tertiary"}
            />
            <InfoField
              label="Risk Tolerance"
              value={intel.risk_tolerance_score !== null ? `${intel.risk_tolerance_score}/10` : "--"}
            />
            <InfoField label="Motivation" value={motivationLabel(intel.stated_motivation)} />
          </div>
        </div>
      </section>

      {/* Active Flags */}
      <section>
        <p className="text-label-caps text-text-tertiary mb-3 flex items-center gap-1.5">
          <Flag size={13} />
          ACTIVE FLAGS ({flags.length})
        </p>
        <FlagList flags={flags} />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// Calls Tab
// ─────────────────────────────────────────────

function CallsTab({ callLogs }: { callLogs: CallLog[] }) {
  if (callLogs.length === 0) {
    return (
      <div className="p-5 text-center py-10">
        <Phone size={28} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-body-sm text-text-tertiary">No calls logged yet</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <p className="text-label-caps text-text-tertiary mb-3">
        CALL HISTORY ({callLogs.length})
      </p>
      <div className="space-y-2">
        {callLogs.map((log) => (
          <CallLogRow key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}

function CallLogRow({ log }: { log: CallLog }) {
  const typeLabel = CALL_TYPE_LABELS[log.call_type] ?? log.call_type;
  const typeColor = CALL_TYPE_COLORS[log.call_type] ?? "bg-bg-tertiary text-text-secondary";
  const confColor = CONFIDENCE_COLORS[log.rep_confidence ?? ""] ?? "text-text-tertiary";

  return (
    <div className="rounded-md border border-border-default bg-surface-glass p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {/* Call type badge */}
        <span className={`px-2 py-0.5 rounded text-badge ${typeColor}`}>
          {typeLabel}
        </span>
        {/* Date */}
        <span className="text-caption text-text-tertiary">
          {formatDate(log.called_at ?? log.logged_at)}
        </span>
        {/* Rep confidence */}
        {log.rep_confidence && (
          <span className={`text-badge ml-auto ${confColor}`}>
            {log.rep_confidence.charAt(0).toUpperCase() + log.rep_confidence.slice(1)} confidence
          </span>
        )}
      </div>
      {/* Notes */}
      {log.notes && (
        <p className="text-body-sm text-text-secondary mt-1">{log.notes}</p>
      )}
      {/* Red flags */}
      {log.red_flags_raised && (
        <p className="text-body-sm text-danger mt-1 flex items-center gap-1">
          <ShieldAlert size={12} />
          {log.red_flags_raised}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Objections Tab
// ─────────────────────────────────────────────

function ObjectionsTab({ objections }: { objections: ObjectionRegistry[] }) {
  if (objections.length === 0) {
    return (
      <div className="p-5 text-center py-10">
        <MessageSquare size={28} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-body-sm text-text-tertiary">No objections recorded</p>
      </div>
    );
  }

  const unresolved = objections.filter((o) => !o.resolved);
  const resolved = objections.filter((o) => o.resolved);

  return (
    <div className="p-5 space-y-5">
      {/* Unresolved */}
      {unresolved.length > 0 && (
        <section>
          <p className="text-label-caps text-text-tertiary mb-3">
            UNRESOLVED ({unresolved.length})
          </p>
          <div className="space-y-2">
            {unresolved.map((obj) => (
              <ObjectionRow key={obj.id} objection={obj} />
            ))}
          </div>
        </section>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <section>
          <p className="text-label-caps text-text-tertiary mb-3">
            RESOLVED ({resolved.length})
          </p>
          <div className="space-y-2">
            {resolved.map((obj) => (
              <ObjectionRow key={obj.id} objection={obj} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ObjectionRow({ objection }: { objection: ObjectionRegistry }) {
  const typeLabel = objection.objection_type.charAt(0).toUpperCase() + objection.objection_type.slice(1).replace(/_/g, " ");

  return (
    <div className={`rounded-md border p-3 ${
      objection.resolved
        ? "border-success/20 bg-success/5"
        : "border-danger/20 bg-danger/5"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {objection.resolved ? (
          <CheckCircle2 size={14} className="text-success flex-shrink-0" />
        ) : (
          <XCircle size={14} className="text-danger flex-shrink-0" />
        )}
        <span className="text-body-sm font-medium text-text-primary">{typeLabel}</span>
        <span className="text-caption text-text-tertiary ml-auto">
          {formatDate(objection.created_at)}
        </span>
      </div>
      {objection.objection_detail && (
        <p className="text-body-sm text-text-secondary mt-1 ml-5">{objection.objection_detail}</p>
      )}
      {objection.resolved && objection.resolution_notes && (
        <p className="text-body-sm text-success mt-1 ml-5">{objection.resolution_notes}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function InfoField({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div>
      <p className="text-caption text-text-tertiary mb-0.5">{label}</p>
      <p className={`text-body-sm ${valueColor ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function motivationLabel(motivation: string | null): string {
  if (!motivation) return "--";
  const map: Record<string, string> = {
    buy_job: "Buy a Job",
    wealth: "Wealth Building",
    escape_corporate: "Escape Corporate",
    other: "Other",
  };
  return map[motivation] ?? motivation;
}
