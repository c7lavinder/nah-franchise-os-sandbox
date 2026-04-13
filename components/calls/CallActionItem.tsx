"use client";

import { useState } from "react";
import {
  Check, X, Loader2, Sparkles, Zap, ChevronDown, ChevronUp,
  Send, CalendarPlus, ListChecks, Play, Save, Pencil,
} from "lucide-react";

interface ActionItemData {
  id: string;
  call_id: string;
  contact_id: string | null;
  category: string;
  title: string;
  description: string | null;
  source: string;
  ghl_action: boolean;
  status: string;
  pushed_at: string | null;
  skipped_at: string | null;
}

interface TeamMember {
  id: string;
  name: string;
}

interface CallActionItemProps {
  item: ActionItemData;
  teamMembers: TeamMember[];
  contactName: string | null;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onAction: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  pipeline: "bg-nah-blue/10 text-nah-blue",
  apt: "bg-scout-purple/10 text-scout-purple",
  task: "bg-nah-orange/10 text-nah-orange",
  comms: "bg-success/10 text-success",
  workflow: "bg-info/10 text-info",
  data: "bg-warning/10 text-warning",
};

const CATEGORY_ICONS: Record<string, typeof Send> = {
  comms: Send,
  task: ListChecks,
  apt: CalendarPlus,
  workflow: Play,
  data: Save,
};

export default function CallActionItem({
  item, teamMembers, contactName, expandedId, onExpand, onAction,
}: CallActionItemProps) {
  // Form fields — pre-filled from item
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [body, setBody] = useState(item.description ?? "");
  const [taskTitle, setTaskTitle] = useState(item.title);
  const [taskNotes, setTaskNotes] = useState(item.description ?? "");
  const [dueDate, setDueDate] = useState(getDefaultDueDate());
  const [assigneeId, setAssigneeId] = useState(teamMembers[0]?.id ?? "");
  const [aptDate, setAptDate] = useState("");
  const [aptDuration, setAptDuration] = useState(30);
  const [dataValue, setDataValue] = useState(item.description ?? "");

  // AI rewrite
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDone = item.status !== "pending";
  const isExpanded = expandedId === item.id;
  const isPipeline = item.category === "pipeline";

  // --- Done state ---
  if (isDone) {
    return (
      <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${
        item.status === "skipped" ? "opacity-40" : "opacity-60"
      }`}>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.status === "skipped" ? (
            <X size={14} className="text-text-tertiary" />
          ) : (
            <Check size={14} className="text-success" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[item.category] ?? "bg-bg-tertiary text-text-tertiary"}`}>
              {item.category}
            </span>
          </div>
          <p className={`text-body-sm text-text-primary ${item.status === "skipped" ? "line-through" : ""}`}>
            {item.title}
          </p>
        </div>
        <span className="text-[10px] text-text-tertiary capitalize flex-shrink-0">
          {item.status === "skipped" ? "Skipped" : "Done"}
          {item.pushed_at && ` · ${new Date(item.pushed_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
        </span>
      </div>
    );
  }

  // --- Handlers ---
  async function handleSkip() {
    setLoading("skip");
    setError(null);
    try {
      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (res.ok) { onExpand(null); onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handlePush() {
    setLoading("push");
    setError(null);

    const payload = buildPayload();
    try {
      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", payload }),
      });
      if (res.ok) { onExpand(null); onAction(); }
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? "Failed"); }
    } catch { setError("Network error"); }
    setLoading(null);
  }

  async function handleAiRewrite() {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/calls/${item.call_id}/actions/${item.id}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: aiInstruction,
          currentFields: buildPayload(),
          category: item.category,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        applyRewrite(data.fields);
        setAiInstruction("");
      }
    } catch { /* silent */ }
    setAiLoading(false);
  }

  function buildPayload(): Record<string, unknown> {
    switch (item.category) {
      case "comms": return { channel, body, to: contactName };
      case "task": return { title: taskTitle, due_date: dueDate, assignee_user_id: assigneeId, notes: taskNotes };
      case "apt": return { contact_id: item.contact_id, rep_user_id: assigneeId, start_time: aptDate, duration_minutes: aptDuration, notes: taskNotes };
      case "workflow": return { workflow_name: item.description };
      case "data": return { field_key: item.title, field_value: dataValue, contact_id: item.contact_id };
      case "pipeline": return {};
      default: return {};
    }
  }

  function applyRewrite(fields: Record<string, string>) {
    if (fields.body) setBody(fields.body);
    if (fields.title) setTaskTitle(fields.title);
    if (fields.notes) setTaskNotes(fields.notes);
    if (fields.field_value) setDataValue(fields.field_value);
  }

  function handlePushClick() {
    if (isPipeline) {
      void handlePush();
    } else {
      onExpand(isExpanded ? null : item.id);
    }
  }

  const CategoryIcon = CATEGORY_ICONS[item.category] ?? Check;

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Collapsed row */}
      <div className="p-3">
        {/* Tags */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${CATEGORY_COLORS[item.category] ?? "bg-bg-tertiary text-text-tertiary"}`}>
            {item.category}
          </span>
          {item.source === "scout" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-scout-purple/10 text-scout-purple flex items-center gap-0.5">
              <Sparkles size={8} /> Scout
            </span>
          )}
          {item.ghl_action && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-nah-orange/10 text-nah-orange flex items-center gap-0.5">
              <Zap size={8} /> GHL
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-body-sm font-medium text-text-primary mb-0.5">{item.title}</p>
        {item.description && !isExpanded && (
          <p className="text-caption text-text-secondary mb-2 line-clamp-1">{item.description}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handlePushClick}
            disabled={loading !== null}
            className="btn-primary px-3 py-1 text-caption flex items-center gap-1"
          >
            {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <CategoryIcon size={12} />}
            {isPipeline ? "Push" : isExpanded ? "Close" : "Push to CRM"}
          </button>
          {!isPipeline && !isExpanded && (
            <button
              onClick={() => onExpand(item.id)}
              disabled={loading !== null}
              className="btn-ghost px-3 py-1 text-caption flex items-center gap-1"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
          <button
            onClick={() => void handleSkip()}
            disabled={loading !== null}
            className="btn-ghost px-3 py-1 text-caption flex items-center gap-1 text-text-tertiary"
          >
            {loading === "skip" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Skip
          </button>
          {isExpanded && (
            <button onClick={() => onExpand(null)} className="btn-ghost px-2 py-1 text-caption ml-auto">
              <ChevronUp size={14} />
            </button>
          )}
        </div>

        {error && <p className="text-caption text-danger mt-1">{error}</p>}
      </div>

      {/* Expanded inline form */}
      {isExpanded && !isPipeline && (
        <div className="border-t border-border-default px-3 py-3 bg-bg-primary/50 space-y-3">
          {/* Per-category form */}
          {item.category === "comms" && (
            <CommsForm
              contactName={contactName}
              channel={channel} setChannel={setChannel}
              body={body} setBody={setBody}
            />
          )}
          {item.category === "task" && (
            <TaskForm
              title={taskTitle} setTitle={setTaskTitle}
              notes={taskNotes} setNotes={setTaskNotes}
              dueDate={dueDate} setDueDate={setDueDate}
              assigneeId={assigneeId} setAssigneeId={setAssigneeId}
              teamMembers={teamMembers}
            />
          )}
          {item.category === "apt" && (
            <AptForm
              contactName={contactName}
              aptDate={aptDate} setAptDate={setAptDate}
              duration={aptDuration} setDuration={setAptDuration}
              assigneeId={assigneeId} setAssigneeId={setAssigneeId}
              notes={taskNotes} setNotes={setTaskNotes}
              teamMembers={teamMembers}
            />
          )}
          {item.category === "workflow" && (
            <WorkflowForm workflowName={item.description ?? item.title} contactName={contactName} />
          )}
          {item.category === "data" && (
            <DataForm fieldLabel={item.title} value={dataValue} setValue={setDataValue} />
          )}

          {/* Tell AI what to change */}
          {["comms", "task", "apt", "data"].includes(item.category) && (
            <div className="border-t border-border-default pt-3">
              <label className="text-[10px] text-scout-purple font-medium flex items-center gap-1 mb-1">
                <Sparkles size={10} /> TELL AI WHAT TO CHANGE
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="e.g. Make it more urgent, change the date to Friday..."
                  className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAiRewrite(); }}
                />
                <button
                  onClick={() => void handleAiRewrite()}
                  disabled={aiLoading || !aiInstruction.trim()}
                  className="btn-ghost px-3 py-1.5 text-caption flex items-center gap-1 text-scout-purple"
                >
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Confirm / Cancel */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-default">
            <button
              onClick={() => void handlePush()}
              disabled={loading !== null}
              className="btn-primary px-4 py-1.5 text-caption flex items-center gap-1"
            >
              {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <CategoryIcon size={12} />}
              {getCTALabel(item.category)}
            </button>
            <button
              onClick={() => onExpand(null)}
              className="btn-ghost px-3 py-1.5 text-caption"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-forms ---

function CommsForm({ contactName, channel, setChannel, body, setBody }: {
  contactName: string | null;
  channel: "sms" | "email"; setChannel: (v: "sms" | "email") => void;
  body: string; setBody: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-caption text-text-tertiary">To</label>
        <p className="text-body-sm text-text-primary">{contactName ?? "Contact"}</p>
      </div>
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">Channel</label>
        <div className="flex gap-1">
          {(["sms", "email"] as const).map((ch) => (
            <button key={ch} onClick={() => setChannel(ch)}
              className={`px-3 py-1 text-caption rounded-md font-medium ${channel === ch ? "bg-nah-blue text-white" : "bg-bg-tertiary text-text-tertiary"}`}>
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">Message</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
          className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary resize-none" />
      </div>
    </div>
  );
}

function TaskForm({ title, setTitle, notes, setNotes, dueDate, setDueDate, assigneeId, setAssigneeId, teamMembers }: {
  title: string; setTitle: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  dueDate: string; setDueDate: (v: string) => void;
  assigneeId: string; setAssigneeId: (v: string) => void;
  teamMembers: TeamMember[];
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-caption text-text-tertiary mb-1 block">Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary" />
        </div>
        <div>
          <label className="text-caption text-text-tertiary mb-1 block">Assigned To</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary">
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary resize-none" />
      </div>
    </div>
  );
}

function AptForm({ contactName, aptDate, setAptDate, duration, setDuration, assigneeId, setAssigneeId, notes, setNotes, teamMembers }: {
  contactName: string | null;
  aptDate: string; setAptDate: (v: string) => void;
  duration: number; setDuration: (v: number) => void;
  assigneeId: string; setAssigneeId: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  teamMembers: TeamMember[];
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-caption text-text-tertiary">Contact</label>
        <p className="text-body-sm text-text-primary">{contactName ?? "Contact"}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-caption text-text-tertiary mb-1 block">Rep</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary">
            <option value="">Select...</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-caption text-text-tertiary mb-1 block">Date / Time</label>
          <input type="datetime-local" value={aptDate} onChange={(e) => setAptDate(e.target.value)}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary" />
        </div>
        <div>
          <label className="text-caption text-text-tertiary mb-1 block">Duration</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary">
            {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary resize-none" />
      </div>
    </div>
  );
}

function WorkflowForm({ workflowName, contactName }: { workflowName: string; contactName: string | null }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-caption text-text-tertiary">Workflow</label>
        <p className="text-body-sm text-text-primary font-medium">{workflowName}</p>
      </div>
      <div>
        <label className="text-caption text-text-tertiary">Contact</label>
        <p className="text-body-sm text-text-primary">{contactName ?? "Contact"}</p>
      </div>
    </div>
  );
}

function DataForm({ fieldLabel, value, setValue }: { fieldLabel: string; value: string; setValue: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-caption text-text-tertiary">Field</label>
        <p className="text-body-sm text-text-primary font-medium">{fieldLabel}</p>
      </div>
      <div>
        <label className="text-caption text-text-tertiary mb-1 block">Value</label>
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
          className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary" />
      </div>
    </div>
  );
}

// --- Helpers ---

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getCTALabel(category: string): string {
  switch (category) {
    case "comms": return "Send via GHL";
    case "task": return "Create Task";
    case "apt": return "Schedule";
    case "workflow": return "Trigger Workflow";
    case "data": return "Save to Profile";
    default: return "Push";
  }
}
