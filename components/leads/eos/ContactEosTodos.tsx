"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import type { EosContactTodo } from "@/types/database";

interface Props {
  contactId: string;
  carriedTerritoryName?: string | null;
}

export default function ContactEosTodos({ contactId, carriedTerritoryName }: Props) {
  const [todos, setTodos] = useState<EosContactTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    apiFetch(`/api/contacts/${contactId}/eos`)
      .then((r) => (r.ok ? r.json() : { todos: [] }))
      .then((d) => setTodos(d.todos ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  async function addTodo() {
    if (!newText.trim()) return;
    const res = await apiFetch(`/api/contacts/${contactId}/eos/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todo_text: newText.trim() }),
    });
    if (res.ok) {
      const { todo } = await res.json();
      setTodos((prev) => [...prev, todo]);
      setNewText("");
    }
  }

  async function toggleDone(todo: EosContactTodo) {
    await apiFetch(`/api/contacts/${contactId}/eos/todos/${todo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !todo.is_done }),
    });
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, is_done: !t.is_done } : t))
    );
  }

  async function deleteTodo(id: string) {
    await apiFetch(`/api/contacts/${contactId}/eos/todos/${id}`, { method: "DELETE" });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-body-sm font-semibold text-text-primary">To-Dos</h3>
      <ul className="space-y-1">
        {todos.map((todo) => (
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
              className={`flex-1 text-body-sm ${
                todo.is_done ? "line-through text-text-tertiary opacity-60" : "text-text-primary"
              }`}
            >
              {todo.todo_text}
            </span>
            <SourceBadge source={todo.source} />
            {carriedTerritoryName && (
              <span className="text-[10px] text-text-tertiary shrink-0">Carried to {carriedTerritoryName}</span>
            )}
            <button
              onClick={() => deleteTodo(todo.id)}
              className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
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
