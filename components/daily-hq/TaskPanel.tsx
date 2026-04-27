"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Plus, ClipboardList } from "lucide-react";
import type { GHLTask } from "@/types/ghl";

interface TaskPanelProps {
  tasks: GHLTask[];
  onTaskUpdated: () => void;
}

export default function TaskPanel({ tasks, onTaskUpdated }: TaskPanelProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  // Sort: overdue first, then by due date
  const now = new Date();
  const sortedPending = [...pending].sort((a, b) => {
    const aOverdue = new Date(a.dueDate) < now ? 0 : 1;
    const bOverdue = new Date(b.dueDate) < now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  async function toggleTask(task: GHLTask) {
    setTogglingId(task.id);
    try {
      const res = await fetch(`/api/contacts/${task.contactId}/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (res.ok) onTaskUpdated();
    } catch {
      // Silently fail
    } finally {
      setTogglingId(null);
    }
  }

  function isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < now;
  }

  function formatDue(dueDate: string): string {
    const d = new Date(dueDate);
    const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Tomorrow";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={16} className="text-warning" />
        <h3 className="text-h2 text-text-primary">Tasks</h3>
        <span className="text-caption text-text-tertiary">
          {pending.length} pending
        </span>
      </div>

      {tasks.length === 0 && (
        <p className="text-caption text-text-tertiary py-4 text-center">No tasks</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {sortedPending.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-2 px-3 py-2 rounded-lg border transition-colors ${
              isOverdue(task.dueDate)
                ? "border-danger/30 bg-danger/5"
                : "border-border-default bg-bg-secondary"
            }`}
          >
            <button
              onClick={() => toggleTask(task)}
              className="mt-0.5 text-text-tertiary hover:text-success flex-shrink-0"
              disabled={togglingId === task.id}
            >
              {togglingId === task.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Circle size={16} />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm text-text-primary truncate">{task.title}</p>
              <p className={`text-caption ${isOverdue(task.dueDate) ? "text-danger" : "text-text-tertiary"}`}>
                {task.contactName ? `${task.contactName} · ` : ""}
                {formatDue(task.dueDate)}
              </p>
            </div>
          </div>
        ))}
        {completed.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border-default bg-bg-secondary opacity-40">
            <button
              onClick={() => toggleTask(task)}
              className="mt-0.5 text-success flex-shrink-0"
              disabled={togglingId === task.id}
            >
              <CheckCircle2 size={16} />
            </button>
            <p className="text-body-sm text-text-primary truncate line-through">{task.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
