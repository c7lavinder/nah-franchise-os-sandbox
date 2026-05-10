"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import { X } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import type { EosTerritoryTodo } from "@/types/database";

interface Props {
  TerritorySlug: string;
  todos: EosTerritoryTodo[];
  onUpdate: () => void;
}

export default function TerritoryEosTodos({ TerritorySlug, todos, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryTodo[]>(todos);
  const [newText, setNewText] = useState("");

  async function addTodo() {
    if (!newText.trim()) return;
    const res = await apiFetch(`/api/territories/${TerritorySlug}/eos/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Todo: newText.trim() }),
    });
    if (res.ok) {
      const { todo } = await res.json();
      setLocal((prev) => [...prev, todo]);
      setNewText("");
      onUpdate();
    }
  }

  async function toggleDone(todo: EosTerritoryTodo) {
    await apiFetch(`/api/territories/${TerritorySlug}/eos/todos/${todo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !todo.is_done }),
    });
    setLocal((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !t.is_done } : t)));
    onUpdate();
  }

  async function deleteTodo(id: string) {
    await apiFetch(`/api/territories/${TerritorySlug}/eos/todos/${id}`, { method: "DELETE" });
    setLocal((prev) => prev.filter((t) => t.id !== id));
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-2">To-Dos</h3>
      <ul className="space-y-1">
        {local.map((todo) => (
          <li
            key={todo.id}
            className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary transition-colors"
          >
            <input
              type="checkbox"
              checked={todo.is_done}
              onChange={() => toggleDone(todo)}
              className="mt-0.5 h-4 w-4 rounded border-border-primary text-nah-blue focus:ring-nah-blue/30"
            />
            <span
              className={`flex-1 text-body-sm ${todo.is_done ? "line-through text-text-tertiary opacity-60" : "text-text-primary"}`}
            >
              {todo.Todo}
            </span>
            <SourceBadge source={todo.source} />
            <button
              onClick={() => deleteTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-nah-blue/30"
          placeholder="Add a to-do..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
        />
      </div>
    </div>
  );
}
