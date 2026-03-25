"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface Task {
  id: string;
  contactId: string;
  title: string;
  body: string | null;
  dueDate: string;
  completed: boolean;
}

interface TaskListProps {
  contactId: string;
  tasks: Task[];
  onTaskUpdated: () => void;
}

export default function TaskList({ contactId, tasks, onTaskUpdated }: TaskListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleTask(task: Task) {
    setTogglingId(task.id);
    try {
      const res = await fetch(`/api/contacts/${contactId}/tasks/${task.id}`, {
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

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <section>
      <h3 className="text-overline text-text-tertiary tracking-wider mb-3">
        TASKS ({pending.length} pending)
      </h3>

      {tasks.length === 0 && (
        <p className="text-caption text-text-tertiary py-2">No tasks</p>
      )}

      <div className="space-y-1.5">
        {pending.map((task) => (
          <div key={task.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-hover">
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
            <div className="min-w-0">
              <p className="text-body-sm text-text-primary">{task.title}</p>
              {task.body && (
                <p className="text-caption text-text-tertiary truncate">{task.body}</p>
              )}
              <p className="text-caption text-text-tertiary">
                Due {new Date(task.dueDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
        {completed.map((task) => (
          <div key={task.id} className="flex items-start gap-2 px-2 py-1.5 rounded opacity-50">
            <button
              onClick={() => toggleTask(task)}
              className="mt-0.5 text-success flex-shrink-0"
              disabled={togglingId === task.id}
            >
              {togglingId === task.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
            </button>
            <p className="text-body-sm text-text-primary line-through">{task.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
