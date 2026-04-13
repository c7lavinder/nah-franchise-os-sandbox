"use client";

import { useState } from "react";
import {
  Check, X, Loader2, Sparkles, Zap, ChevronUp,
  Send, CalendarPlus, ListChecks, Save, Pencil, FileText,
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
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onAction: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  pipeline: "bg-nah-blue/10 text-nah-blue",
  apt: "bg-scout-purple/10 text-scout-purple",
  task: "bg-nah-orange/10 text-nah-orange",
  comms: "bg-success/10 text-success",
  note: "bg-info/10 text-info",
  workflow: "bg-info/10 text-info",
  data: "bg-warning/10 text-warning",
};

const CATEGORY_ICONS: Record<string, typeof Send> = {
  comms: Send, task: ListChecks, apt: CalendarPlus, note: FileText, data: Save,
};

const CTA_LABELS: Record<string, string> = {
  comms: "Send via GHL", task: "Create Task", apt: "Schedule",
  note: "Log Note", data: "Save to Profile", workflow: "Trigger",
};

export default function CallActionItem({ item, teamMembers, expandedId, onExpand, onAction }: CallActionItemProps) {
  const meta = item.metadata ?? {};
  const isExpanded = expandedId === item.id;
  const isDone = item.status !== "pending";
  const isPipeline = item.category === "pipeline";
  const CategoryIcon = CATEGORY_ICONS[item.category] ?? Check;

  // Form state — initialized from metadata
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
      <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${item.status === "skipped" ? "opacity-40" : "opacity-60"}`}>
        {item.status === "skipped" ? <X size={14} className="text-text-tertiary mt-0.5" /> : <Check size={14} className="text-success mt-0.5" />}
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[item.category] ?? "bg-bg-tertiary text-text-tertiary"}`}>{item.category}</span>
          <p className={`text-body-sm text-text-primary mt-0.5 ${item.status === "skipped" ? "line-through" : ""}`}>{item.title}</p>
        </div>
        <span className="text-[10px] text-text-tertiary flex-shrink-0">
          {item.status === "skipped" ? "Skipped" : "Done"}
          {item.pushed_at && ` · ${new Date(item.pushed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
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
      if (res.ok) { onExpand(null); onAction(); }
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
      if (res.ok) { onExpand(null); onAction(); }
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

  function handlePushClick() {
    if (isPipeline || item.category === "note") { void handlePush(); }
    else { onExpand(isExpanded ? null : item.id); }
  }

  // ── Render ──
  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Collapsed header */}
      <div className="p-3">
        {/* Tags row */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[item.category] ?? "bg-bg-tertiary text-text-tertiary"}`}>{item.category}</span>
          {item.source === "scout" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-scout-purple/10 text-scout-purple flex items-center gap-0.5"><Sparkles size={8} /> Scout</span>
          )}
          {item.ghl_action && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-nah-orange/10 text-nah-orange flex items-center gap-0.5"><Zap size={8} /> GHL</span>
          )}
          {item.assigned_to_name && (
            <span className="text-[10px] text-text-tertiary ml-auto">→ {item.assigned_to_name}</span>
          )}
        </div>

        {/* Title */}
        <p className="text-body-sm font-medium text-text-primary">{item.title}</p>
        {!isExpanded && item.description && (
          <p className="text-caption text-text-secondary mt-0.5 line-clamp-1">{item.description}</p>
        )}

        {/* Why expandable */}
        {item.why && (
          <button onClick={() => setShowWhy((v) => !v)} className="text-[11px] text-nah-blue flex items-center gap-1 mt-1">
            <Sparkles size={10} /> Why this action? {showWhy ? "▲" : "▼"}
          </button>
        )}
        {showWhy && item.why && (
          <p className="text-[12px] text-text-secondary mt-1 mb-1">{item.why}</p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2 mt-2">
          <button onClick={handlePushClick} disabled={loading !== null}
            className="btn-primary px-3 py-1 text-caption flex items-center gap-1">
            {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <CategoryIcon size={12} />}
            {isPipeline || item.category === "note" ? (CTA_LABELS[item.category] ?? "Push") : isExpanded ? "Close" : "Push to CRM"}
          </button>
          {!isPipeline && item.category !== "note" && !isExpanded && (
            <button onClick={() => onExpand(item.id)} disabled={loading !== null}
              className="btn-ghost px-3 py-1 text-caption flex items-center gap-1">
              <Pencil size={12} /> Edit
            </button>
          )}
          <button onClick={() => void handleSkip()} disabled={loading !== null}
            className="btn-ghost px-3 py-1 text-caption flex items-center gap-1 text-text-tertiary">
            {loading === "skip" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Skip
          </button>
          {isExpanded && (
            <button onClick={() => onExpand(null)} className="btn-ghost px-2 py-1 text-caption ml-auto"><ChevronUp size={14} /></button>
          )}
        </div>
        {error && <p className="text-caption text-danger mt-1">{error}</p>}
      </div>

      {/* ── Expanded form ── */}
      {isExpanded && !isPipeline && (
        <div className="border-t border-border-default px-3 py-3 bg-bg-primary/50 space-y-3">
          {item.category === "apt" && <AptForm fields={fields} setField={setField} teamMembers={teamMembers} />}
          {item.category === "comms" && <CommsForm fields={fields} setField={setField} />}
          {item.category === "task" && <TaskForm fields={fields} setField={setField} teamMembers={teamMembers} />}
          {item.category === "note" && <NoteForm fields={fields} setField={setField} />}

          {/* Tell AI what to change */}
          <div className="border-t border-border-default pt-3">
            <label className="text-[10px] text-scout-purple font-medium flex items-center gap-1 mb-1">
              <Sparkles size={10} /> TELL AI WHAT TO CHANGE
            </label>
            <div className="flex gap-2">
              <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                placeholder="e.g. Change to next Tuesday, make it more urgent..."
                className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
                onKeyDown={(e) => { if (e.key === "Enter") void handleAiRewrite(); }} />
              <button onClick={() => void handleAiRewrite()} disabled={aiLoading || !aiInput.trim()}
                className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1 text-scout-purple">
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Apply
              </button>
            </div>
          </div>

          {/* Confirm / Cancel */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-default">
            <button onClick={() => void handlePush()} disabled={loading !== null}
              className="btn-primary px-4 py-1.5 text-caption flex items-center gap-1">
              {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <CategoryIcon size={12} />}
              {CTA_LABELS[item.category] ?? "Push"}
            </button>
            <button onClick={() => onExpand(null)} className="btn-ghost px-3 py-1.5 text-caption">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-forms (read from fields map) ──

const LABEL = "text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1 block";
const INPUT = "w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary";

function AptForm({ fields, setField, teamMembers }: { fields: Record<string, string>; setField: (k: string, v: string) => void; teamMembers: TeamMember[] }) {
  return (
    <div className="space-y-2">
      <div><label className={LABEL}>Appointment Title</label><input type="text" value={fields.apt_title ?? ""} onChange={(e) => setField("apt_title", e.target.value)} className={INPUT} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={LABEL}>Date & Time (CT)</label><input type="datetime-local" value={fields.apt_date_time ?? ""} onChange={(e) => setField("apt_date_time", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Assigned To</label>
          <select value={fields.assigned_to ?? ""} onChange={(e) => setField("assigned_to", e.target.value)} className={INPUT}>
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div><label className={LABEL}>Contact</label><p className="text-body-sm text-text-primary">{fields.contact_name || "—"}</p></div>
      <div><label className={LABEL}>Notes</label><textarea value={fields.apt_notes ?? ""} onChange={(e) => setField("apt_notes", e.target.value)} rows={2} className={INPUT + " resize-none"} /></div>
    </div>
  );
}

function CommsForm({ fields, setField }: { fields: Record<string, string>; setField: (k: string, v: string) => void }) {
  const channel = fields.comms_channel ?? "sms";
  return (
    <div className="space-y-2">
      <div>
        <label className={LABEL}>Channel</label>
        <div className="flex gap-1">
          {(["sms", "email"] as const).map((ch) => (
            <button key={ch} onClick={() => setField("comms_channel", ch)}
              className={`px-3 py-1 text-caption rounded-md font-medium ${channel === ch ? "bg-nah-blue text-white" : "bg-bg-tertiary text-text-tertiary"}`}>
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {channel === "email" && (
        <div><label className={LABEL}>Subject</label><input type="text" value={fields.comms_subject ?? ""} onChange={(e) => setField("comms_subject", e.target.value)} className={INPUT} /></div>
      )}
      <div><label className={LABEL}>Message</label><textarea value={fields.comms_body ?? ""} onChange={(e) => setField("comms_body", e.target.value)} rows={4} className={INPUT + " resize-none"} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={LABEL}>To</label><p className="text-body-sm text-text-primary">{fields.contact_name || "—"}</p></div>
        <div><label className={LABEL}>Send From</label><p className="text-body-sm text-text-primary">{fields.assigned_to_name || "—"}</p></div>
      </div>
    </div>
  );
}

function TaskForm({ fields, setField, teamMembers }: { fields: Record<string, string>; setField: (k: string, v: string) => void; teamMembers: TeamMember[] }) {
  return (
    <div className="space-y-2">
      <div><label className={LABEL}>Task Title</label><input type="text" value={fields.task_title ?? ""} onChange={(e) => setField("task_title", e.target.value)} className={INPUT} /></div>
      <div><label className={LABEL}>Description</label><textarea value={fields.task_description ?? ""} onChange={(e) => setField("task_description", e.target.value)} rows={2} className={INPUT + " resize-none"} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={LABEL}>Due Date</label><input type="date" value={fields.task_due_date ?? ""} onChange={(e) => setField("task_due_date", e.target.value)} className={INPUT} /></div>
        <div><label className={LABEL}>Assigned To</label>
          <select value={fields.assigned_to ?? ""} onChange={(e) => setField("assigned_to", e.target.value)} className={INPUT}>
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div><label className={LABEL}>Contact</label><p className="text-body-sm text-text-primary">{fields.contact_name || "—"}</p></div>
    </div>
  );
}

function NoteForm({ fields, setField }: { fields: Record<string, string>; setField: (k: string, v: string) => void }) {
  return (
    <div className="space-y-2">
      <div><label className={LABEL}>Note</label><textarea value={fields.note_body ?? ""} onChange={(e) => setField("note_body", e.target.value)} rows={5} className={INPUT + " resize-none"} /></div>
      <div><label className={LABEL}>Contact</label><p className="text-body-sm text-text-primary">{fields.contact_name || "—"}</p></div>
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
