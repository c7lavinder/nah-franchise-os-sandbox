"use client";

import { useState } from "react";
import {
  Check, X, Loader2, Sparkles, Zap, User,
  Send, CalendarPlus, ListChecks, Save, FileText, Mail, MessageSquare,
} from "lucide-react";

export interface ActionItemData {
  id: string;
  call_id: string;
  contact_id: string | null;
  category: string;
  title: string;
  description: string | null;
  why: string | null;
  contact_name: string | null;
  assigned_to_name: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
  pushed_at: string | null;
  skipped_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface TeamMember { id: string; name: string }

interface CallActionItemProps {
  item: ActionItemData;
  teamMembers: TeamMember[];
  onAction: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Send> = {
  comms: Send, task: ListChecks, apt: CalendarPlus, note: FileText, data: Save,
};

const CTA_LABELS: Record<string, string> = {
  comms: "Send", task: "Create Task", apt: "Schedule",
  note: "Log Note", data: "Save to Profile", workflow: "Trigger", pipeline: "Move Stage",
};

function getCommIcon(channel: string) {
  return channel === "email" ? Mail : MessageSquare;
}

export default function CallActionItem({ item, teamMembers, onAction }: CallActionItemProps) {
  const isDone = item.status !== "pending";
  const channel = (item.metadata?.comms_channel as string) ?? "sms";
  const Icon = item.category === "comms" ? getCommIcon(channel) : (CATEGORY_ICONS[item.category] ?? Check);

  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() => initFields(item));
  const [showWhy, setShowWhy] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // ── Done state ──
  if (isDone) {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-white/50 ${item.status === "skipped" ? "opacity-40" : "opacity-60"}`}>
        {item.status === "skipped" ? <X size={14} className="text-text-tertiary" /> : <Check size={14} className="text-success" />}
        <div className="flex-1 min-w-0">
          <p className={`text-body-sm text-text-primary ${item.status === "skipped" ? "line-through" : ""}`}>{item.title}</p>
          {item.contact_name && <span className="text-[10px] text-text-tertiary">{item.contact_name}</span>}
        </div>
        <span className="text-[10px] text-text-tertiary flex-shrink-0">
          {item.status === "skipped" ? "Skipped" : "Done"}
        </span>
      </div>
    );
  }

  // ── Handlers ──
  async function handlePush() {
    setLoading("push"); setError(null);
    try {
      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", payload: fields }),
      });
      if (res.ok) { onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handleSkip() {
    setLoading("skip"); setError(null);
    try {
      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (res.ok) { onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handleAiRewrite() {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}/rewrite`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: aiInput, currentFields: fields, category: item.category }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fields) setFields((prev) => ({ ...prev, ...data.fields }));
        setAiInput("");
      }
    } catch { /* silent */ }
    setAiLoading(false);
  }

  // Collapsed summary line — show key detail per type
  const summaryDetail = getSummaryDetail(item.category, fields);

  return (
    <div className="bg-white rounded-lg border border-white/80 shadow-sm overflow-hidden">
      {/* ── Collapsed view ── */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Icon size={14} className="text-text-secondary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-text-primary truncate">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.contact_name && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-nah-blue/10 text-nah-blue flex items-center gap-0.5">
                <User size={8} /> {item.contact_name}
              </span>
            )}
            {summaryDetail && (
              <span className="text-[10px] text-text-tertiary truncate">{summaryDetail}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((v) => !v)}
            className="px-2 py-1 text-[10px] text-nah-blue hover:bg-nah-blue/10 rounded-md transition-colors font-medium">
            {expanded ? "Close" : "Edit"}
          </button>
          <button onClick={() => void handlePush()} disabled={loading !== null}
            className="btn-primary px-2.5 py-1 text-[10px] flex items-center gap-1">
            {loading === "push" ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
            {CTA_LABELS[item.category] ?? "Push"}
          </button>
          <button onClick={() => void handleSkip()} disabled={loading !== null}
            className="px-1.5 py-1 text-text-tertiary hover:text-danger hover:bg-danger/5 rounded-md transition-colors">
            {loading === "skip" ? <Loader2 size={10} className="animate-spin" /> : <X size={12} />}
          </button>
        </div>
      </div>

      {/* ── Expanded editable view ── */}
      {expanded && (
        <div className="border-t border-border-default px-3 py-3 space-y-2 bg-bg-primary/30">
          {item.category === "comms" && <CommsFields fields={fields} setField={setField} />}
          {item.category === "apt" && <AptFields fields={fields} setField={setField} teamMembers={teamMembers} />}
          {item.category === "task" && <TaskFields fields={fields} setField={setField} teamMembers={teamMembers} />}
          {item.category === "note" && <NoteFields fields={fields} setField={setField} />}

          {/* Why this action */}
          {item.why && (
            <>
              <button onClick={() => setShowWhy((v) => !v)} className="text-[10px] text-scout-purple flex items-center gap-1">
                <Sparkles size={8} /> Why? {showWhy ? "▲" : "▼"}
              </button>
              {showWhy && <p className="text-[11px] text-text-secondary pl-4">{item.why}</p>}
            </>
          )}

          {/* AI rewrite */}
          <div className="flex gap-1.5 pt-1">
            <div className="flex-1 relative">
              <Sparkles size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-scout-purple" />
              <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                placeholder="Tell AI what to change..."
                className="w-full bg-white border border-border-default rounded-md pl-6 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-tertiary"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAiRewrite(); }} />
            </div>
            <button onClick={() => void handleAiRewrite()} disabled={aiLoading || !aiInput.trim()}
              className="px-2 py-1 text-[10px] text-scout-purple hover:bg-scout-purple/10 rounded-md transition-colors flex items-center gap-0.5">
              {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Apply
            </button>
          </div>

          {/* Confirm row */}
          <div className="flex items-center gap-2 pt-1 border-t border-border-default">
            <button onClick={() => void handlePush()} disabled={loading !== null}
              className="btn-primary px-3 py-1 text-[11px] flex items-center gap-1">
              {loading === "push" ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
              {CTA_LABELS[item.category] ?? "Push"}
            </button>
            <button onClick={() => setExpanded(false)}
              className="px-2 py-1 text-[11px] text-text-tertiary hover:text-text-primary rounded-md transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-[10px] text-danger px-3 pb-2">{error}</p>}
    </div>
  );
}

// ── Inline editable field components ──

const LABEL = "text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-0.5 block";
const INPUT = "w-full bg-white border border-border-default rounded-md px-2 py-1 text-[12px] text-text-primary";

function CommsFields({ fields, setField }: { fields: Record<string, string>; setField: (k: string, v: string) => void }) {
  const channel = fields.comms_channel ?? "sms";
  return (
    <div className="space-y-1.5">
      <div>
        <label className={LABEL}>Channel</label>
        <div className="flex gap-1">
          {(["sms", "email"] as const).map((ch) => (
            <button key={ch} onClick={() => setField("comms_channel", ch)}
              className={`px-2.5 py-0.5 text-[10px] rounded-md font-medium ${channel === ch ? "bg-nah-blue text-white" : "bg-bg-tertiary text-text-tertiary"}`}>
              {ch === "email" ? "Email" : "SMS"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className={LABEL}>To</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>From</label><input type="text" value={fields.assigned_to_name ?? ""} onChange={(e) => setField("assigned_to_name", e.target.value)} className={INPUT} /></div>
      </div>
      {channel === "email" && (
        <div><label className={LABEL}>Subject</label><input type="text" value={fields.comms_subject ?? ""} onChange={(e) => setField("comms_subject", e.target.value)} className={INPUT} /></div>
      )}
      <div><label className={LABEL}>Message</label><textarea value={fields.comms_body ?? ""} onChange={(e) => setField("comms_body", e.target.value)} rows={3} className={INPUT + " resize-none"} /></div>
    </div>
  );
}

function AptFields({ fields, setField, teamMembers }: { fields: Record<string, string>; setField: (k: string, v: string) => void; teamMembers: TeamMember[] }) {
  return (
    <div className="space-y-1.5">
      <div><label className={LABEL}>Title</label><input type="text" value={fields.apt_title ?? ""} onChange={(e) => setField("apt_title", e.target.value)} className={INPUT} /></div>
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className={LABEL}>Date & Time</label><input type="datetime-local" value={fields.apt_date_time ?? ""} onChange={(e) => setField("apt_date_time", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Assigned To</label>
          <select value={fields.assigned_to ?? ""} onChange={(e) => setField("assigned_to", e.target.value)} className={INPUT}>
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div><label className={LABEL}>Contact</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Duration (min)</label><input type="number" value={fields.apt_duration_minutes ?? "30"} onChange={(e) => setField("apt_duration_minutes", e.target.value)} className={INPUT} /></div>
      </div>
      <div><label className={LABEL}>Notes</label><textarea value={fields.apt_notes ?? ""} onChange={(e) => setField("apt_notes", e.target.value)} rows={2} className={INPUT + " resize-none"} /></div>
    </div>
  );
}

function TaskFields({ fields, setField, teamMembers }: { fields: Record<string, string>; setField: (k: string, v: string) => void; teamMembers: TeamMember[] }) {
  return (
    <div className="space-y-1.5">
      <div><label className={LABEL}>Title</label><input type="text" value={fields.task_title ?? ""} onChange={(e) => setField("task_title", e.target.value)} className={INPUT} /></div>
      <div><label className={LABEL}>Description</label><textarea value={fields.task_description ?? ""} onChange={(e) => setField("task_description", e.target.value)} rows={2} className={INPUT + " resize-none"} /></div>
      <div className="grid grid-cols-3 gap-1.5">
        <div><label className={LABEL}>Due Date</label><input type="date" value={fields.task_due_date ?? ""} onChange={(e) => setField("task_due_date", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Assigned To</label>
          <select value={fields.assigned_to ?? ""} onChange={(e) => setField("assigned_to", e.target.value)} className={INPUT}>
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Contact</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
      </div>
    </div>
  );
}

function NoteFields({ fields, setField }: { fields: Record<string, string>; setField: (k: string, v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div><label className={LABEL}>Note</label><textarea value={fields.note_body ?? ""} onChange={(e) => setField("note_body", e.target.value)} rows={4} className={INPUT + " resize-none"} /></div>
      <div><label className={LABEL}>Contact</label><input type="text" value={fields.contact_name ?? ""} onChange={(e) => setField("contact_name", e.target.value)} className={INPUT} /></div>
    </div>
  );
}

// ── Initialize form fields from item metadata ──

function initFields(item: ActionItemData): Record<string, string> {
  const meta = item.metadata ?? {};
  const base: Record<string, string> = {
    contact_name: item.contact_name ?? "",
    assigned_to_name: item.assigned_to_name ?? "",
  };

  switch (item.category) {
    case "apt":
      return { ...base, apt_title: str(meta.apt_title) || item.title, apt_date_time: str(meta.apt_date_time), apt_duration_minutes: str(meta.apt_duration_minutes) || "30", apt_notes: str(meta.apt_notes), assigned_to: "" };
    case "comms":
      return { ...base, comms_channel: str(meta.comms_channel) || "sms", comms_subject: str(meta.comms_subject), comms_body: str(meta.comms_body) || item.description || "" };
    case "task":
      return { ...base, task_title: str(meta.task_title) || item.title, task_description: str(meta.task_description) || item.description || "", task_due_date: str(meta.task_due_date) || todayISO(), assigned_to: "" };
    case "note":
      return { ...base, note_body: str(meta.note_body) || item.description || "" };
    default:
      return base;
  }
}

function str(v: unknown): string { return v != null ? String(v) : ""; }
function todayISO(): string { return new Date().toISOString().split("T")[0]; }

/** Brief one-liner for the collapsed view based on category */
function getSummaryDetail(category: string, fields: Record<string, string>): string | null {
  switch (category) {
    case "comms": {
      const ch = fields.comms_channel === "email" ? "Email" : "SMS";
      const body = (fields.comms_body ?? "").split("\n")[0].slice(0, 60);
      return body ? `${ch}: ${body}${body.length >= 60 ? "…" : ""}` : ch;
    }
    case "apt": {
      const dt = fields.apt_date_time;
      if (!dt) return null;
      try {
        return `${new Date(dt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${fields.apt_duration_minutes ?? "30"}min`;
      } catch { return null; }
    }
    case "task": {
      const due = fields.task_due_date;
      if (!due) return null;
      try {
        return `Due: ${new Date(due + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      } catch { return null; }
    }
    case "note": {
      const body = (fields.note_body ?? "").split("\n")[0].slice(0, 60);
      return body ? `${body}${body.length >= 60 ? "…" : ""}` : null;
    }
    default:
      return null;
  }
}
