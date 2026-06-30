"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, ClipboardList, ChevronDown, Pencil, Save, X } from "lucide-react";

interface Task {
  id: string;
  title: string;
  body?: string | null;
  dueDate: string;
  contactId: string;
  contactName?: string | null;
  completed: boolean;
  assignedTo?: string | null;
}

interface TaskPanelProps {
  tasks: Task[];
  onTaskUpdated: () => void;
}

type Priority = "high" | "medium" | "low";

const PRIORITY_CHIP: Record<Priority, { label: string; cls: string }> = {
  high: { label: "High", cls: "text-[#D64545] bg-[#FDECEC]" },
  medium: { label: "Medium", cls: "text-[#C77B12] bg-[#FEF3E0]" },
  low: { label: "Low", cls: "text-[#127D6B] bg-[#E4F6F0]" },
};

const PRIORITY_VALUE_COLOR: Record<Priority, string> = {
  high: "text-[#D64545]",
  medium: "text-[#C77B12]",
  low: "text-[#127D6B]",
};

/** Derive priority from due-date proximity (no explicit GHL priority field). */
function priorityOf(dueDate: string): Priority {
  const d = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (isNaN(d.getTime())) return "low";
  if (diffDays <= 0) return "high";
  if (diffDays <= 2) return "medium";
  return "low";
}

function formatDue(dueDate: string): string {
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return "No date";
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#9aa3b0]">{label}</span>
      <span className={`text-[12.5px] font-semibold text-right ${valueClass ?? "text-[#1c2430]"}`}>{value}</span>
    </div>
  );
}

export default function TaskPanel({ tasks, onTaskUpdated }: TaskPanelProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const now = new Date();
  const sortedPending = [...pending].sort((a, b) => {
    const aOver = new Date(a.dueDate) < now ? 0 : 1;
    const bOver = new Date(b.dueDate) < now ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  async function toggleTask(task: Task) {
    setTogglingId(task.id);
    try {
      const res = await apiFetch(`/api/contacts/${task.contactId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (res.ok) onTaskUpdated();
    } catch {
      /* silent */
    } finally {
      setTogglingId(null);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditBody(task.body ?? "");
    setEditDue(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : "");
  }

  async function saveEdit(task: Task) {
    setEditSaving(true);
    try {
      await apiFetch(`/api/contacts/${task.contactId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          body: editBody || undefined,
          dueDate: editDue ? new Date(editDue).toISOString() : undefined,
        }),
      });
      setEditingId(null);
      onTaskUpdated();
    } catch {
      /* silent */
    } finally {
      setEditSaving(false);
    }
  }

  function renderTask(task: Task, isDone: boolean) {
    const isExpanded = expandedId === task.id;
    const isEditing = editingId === task.id;
    const priority = priorityOf(task.dueDate);
    const chip = PRIORITY_CHIP[priority];

    return (
      <div key={task.id} className={isDone ? "opacity-40" : ""}>
        <div className="flex items-center gap-2.5 py-2 -mx-1 px-1 rounded-lg hover:bg-[#f7f9fc]">
          {/* Checkbox */}
          <button
            onClick={() => toggleTask(task)}
            className={`flex-shrink-0 w-4 h-4 rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
              isDone
                ? "bg-[#1FB6A8] border-[#1FB6A8] text-white"
                : "border-[#cfd6df] text-transparent hover:border-[#1FB6A8]"
            }`}
            disabled={togglingId === task.id}
          >
            {togglingId === task.id ? (
              <Loader2 size={11} className="animate-spin text-[#9aa3b0]" />
            ) : (
              <Check size={11} strokeWidth={3} />
            )}
          </button>

          <button
            onClick={() => setExpandedId(isExpanded ? null : task.id)}
            className="flex-1 min-w-0 text-left flex items-center gap-2"
          >
            <span
              className={`truncate text-[13.5px] font-semibold ${isDone ? "line-through text-[#9aa3b0]" : "text-[#1c2430]"}`}
            >
              {task.title}
            </span>
            {!isDone && (
              <span className={`flex-shrink-0 text-[10.5px] font-bold rounded-full px-2 py-0.5 ${chip.cls}`}>
                {chip.label}
              </span>
            )}
          </button>

          <button onClick={() => setExpandedId(isExpanded ? null : task.id)} className="flex-shrink-0">
            <ChevronDown
              size={16}
              className={`text-[#b3bcc8] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {isExpanded && (
          <div className="hub-detail ml-[26px] px-3.5 py-3.5 mb-1 space-y-2.5">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-white border border-[#e2e7ee] rounded-md px-2.5 py-1.5 text-[13px] text-[#1c2430]"
                  placeholder="Title"
                />
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-[#e2e7ee] rounded-md px-2.5 py-1.5 text-xs text-[#1c2430] resize-none"
                  placeholder="Description (optional)"
                />
                <input
                  type="datetime-local"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  className="w-full bg-white border border-[#e2e7ee] rounded-md px-2.5 py-1.5 text-xs text-[#1c2430]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 text-xs text-[#5b6573] px-2.5 py-1"
                  >
                    <X size={11} /> Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(task)}
                    disabled={editSaving || !editTitle.trim()}
                    className="flex items-center gap-1 bg-[#0E96D8] text-white text-xs px-2.5 py-1 rounded-md disabled:opacity-50"
                  >
                    {editSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {task.body && <p className="text-[12.5px] leading-[1.45] text-[#5b6573]">{task.body}</p>}

                <div className="space-y-1.5">
                  <DetailRow label="Due" value={formatDue(task.dueDate)} />
                  {!isDone && (
                    <DetailRow label="Priority" value={chip.label} valueClass={PRIORITY_VALUE_COLOR[priority]} />
                  )}
                  {task.contactName && <DetailRow label="Contact" value={task.contactName} />}
                </div>

                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={() => toggleTask(task)}
                    disabled={togglingId === task.id}
                    className="flex-1 text-center bg-[#1FB6A8] text-white text-[12.5px] font-semibold py-2 rounded-[9px] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isDone ? "Mark not done" : "Mark done"}
                  </button>
                  {task.contactId && (
                    <Link
                      href={`/contacts/${task.contactId}`}
                      className="flex-1 text-center bg-[#eef1f5] text-[#5b6573] text-[12.5px] font-semibold py-2 rounded-[9px] hover:bg-[#e2e7ee] transition-colors"
                    >
                      View Contact
                    </Link>
                  )}
                </div>

                <button
                  onClick={() => startEdit(task)}
                  className="flex items-center gap-1 text-xs text-[#0E96D8] hover:underline"
                >
                  <Pencil size={11} /> Edit
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="hub-card p-4 flex-1 basis-60 min-w-60">
      <header className="flex items-center gap-2 mb-1">
        <ClipboardList size={17} className="text-[#F5A623]" />
        <h2 className="text-[15px] font-bold text-[#1c2430]">Tasks</h2>
        <span className="ml-auto text-xs text-[#9aa3b0]">{pending.length} pending</span>
      </header>

      <div>
        {tasks.length === 0 && <p className="text-[13px] text-[#9aa3b0] py-3">No tasks</p>}
        {sortedPending.map((t) => renderTask(t, false))}
        {completed.slice(0, 3).map((t) => renderTask(t, true))}
      </div>
    </section>
  );
}
