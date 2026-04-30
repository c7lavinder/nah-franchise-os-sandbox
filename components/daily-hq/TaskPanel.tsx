"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Pencil,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";

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

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

function formatDue(dueDate: string): string {
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return "No date";
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getPriorityColor(dueDate: string): { border: string; bg: string; dot: string } {
  const d = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { border: "border-l-[#EF4444]", bg: "bg-[#FEF2F2]", dot: "bg-[#EF4444]" };
  if (diffDays === 0) return { border: "border-l-[#F59E0B]", bg: "bg-[#FFFBEB]", dot: "bg-[#F59E0B]" };
  if (diffDays <= 2) return { border: "border-l-[#3B82F6]", bg: "bg-[#EFF6FF]", dot: "bg-[#3B82F6]" };
  return { border: "border-l-[#6B7280]", bg: "bg-bg-secondary", dot: "bg-[#6B7280]" };
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
    const color = isDone
      ? { border: "border-l-[#D1D5DB]", bg: "bg-bg-secondary", dot: "bg-[#D1D5DB]" }
      : getPriorityColor(task.dueDate);

    return (
      <div
        key={task.id}
        className={`rounded-lg border-l-[3px] border border-border-default transition-all ${color.border} ${isDone ? "opacity-40" : ""}`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => toggleTask(task)}
            className={`flex-shrink-0 ${isDone ? "text-success" : "text-text-tertiary hover:text-success"}`}
            disabled={togglingId === task.id}
          >
            {togglingId === task.id ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isDone ? (
              <CheckCircle2 size={16} />
            ) : (
              <Circle size={16} />
            )}
          </button>

          <button onClick={() => setExpandedId(isExpanded ? null : task.id)} className="flex-1 min-w-0 text-left">
            <p
              className={`text-body-sm font-medium truncate ${isDone ? "line-through text-text-tertiary" : "text-text-primary"}`}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {task.contactName && (
                <>
                  <User size={10} className="text-text-tertiary flex-shrink-0" />
                  <span className="text-caption text-text-tertiary truncate">{task.contactName}</span>
                  <span className="text-text-tertiary">·</span>
                </>
              )}
              <Calendar size={10} className="text-text-tertiary flex-shrink-0" />
              <span
                className={`text-caption ${!isDone && isOverdue(task.dueDate) ? "text-danger font-medium" : "text-text-tertiary"}`}
              >
                {formatDue(task.dueDate)}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1 flex-shrink-0">
            {!isDone && isOverdue(task.dueDate) && <AlertTriangle size={12} className="text-danger" />}
            {isExpanded ? (
              <ChevronDown size={12} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={12} className="text-text-tertiary" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-border-default/50 space-y-2">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-2.5 py-1.5 text-body-sm text-text-primary"
                  placeholder="Title"
                />
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-2.5 py-1.5 text-caption text-text-primary resize-none"
                  placeholder="Description (optional)"
                />
                <input
                  type="datetime-local"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                  className="w-full bg-bg-secondary border border-border-default rounded-md px-2.5 py-1.5 text-caption text-text-primary"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn-ghost px-2.5 py-1 text-caption flex items-center gap-1"
                  >
                    <X size={11} /> Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(task)}
                    disabled={editSaving || !editTitle.trim()}
                    className="btn-primary px-2.5 py-1 text-caption flex items-center gap-1"
                  >
                    {editSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {task.body && <p className="text-caption text-text-secondary">{task.body}</p>}
                {task.contactName && (
                  <a
                    href={`/frandev/contacts/${task.contactId}`}
                    className="flex items-center gap-1.5 text-caption text-nah-blue hover:underline"
                  >
                    <User size={11} />
                    {task.contactName}
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-caption text-text-tertiary">
                    Due:{" "}
                    {new Date(task.dueDate).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <button
                  onClick={() => startEdit(task)}
                  className="flex items-center gap-1 text-caption text-nah-blue hover:underline"
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-default flex-shrink-0">
        <ClipboardList size={14} className="text-warning" />
        <h3 className="text-body-sm font-semibold text-text-primary">Tasks</h3>
        <span className="text-caption text-text-tertiary ml-auto">{pending.length} pending</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {tasks.length === 0 && <p className="text-caption text-text-tertiary text-center py-6">No tasks</p>}
        {sortedPending.map((t) => renderTask(t, false))}
        {completed.slice(0, 3).map((t) => renderTask(t, true))}
      </div>
    </div>
  );
}
