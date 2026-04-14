"use client";

import { useState } from "react";
import { X, Sparkles, ArrowUp } from "lucide-react";
import type { EosTerritoryIssue } from "@/types/database";

interface Props {
  msSlug: string;
  issues: EosTerritoryIssue[];
  onUpdate: () => void;
}

export default function TerritoryEosIssues({ msSlug, issues, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryIssue[]>(issues);
  const [newText, setNewText] = useState("");

  async function addIssue() {
    if (!newText.trim()) return;
    const res = await fetch(`/api/territories/${msSlug}/eos/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_text: newText.trim() }),
    });
    if (res.ok) {
      const { issue } = await res.json();
      setLocal((prev) => [...prev, issue]);
      setNewText("");
      onUpdate();
    }
  }

  async function toggleDone(issue: EosTerritoryIssue) {
    await fetch(`/api/territories/${msSlug}/eos/issues/${issue.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !issue.is_done }),
    });
    setLocal((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, is_done: !i.is_done } : i))
    );
    onUpdate();
  }

  async function deleteIssue(id: string) {
    await fetch(`/api/territories/${msSlug}/eos/issues/${id}`, { method: "DELETE" });
    setLocal((prev) => prev.filter((i) => i.id !== id));
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-2">Issues</h3>
      <ul className="space-y-1">
        {local.map((issue) => (
          <li key={issue.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary transition-colors">
            <input
              type="checkbox"
              checked={issue.is_done}
              onChange={() => toggleDone(issue)}
              className="mt-0.5 h-4 w-4 rounded border-border-primary text-nah-blue focus:ring-nah-blue/30"
            />
            <span className={`flex-1 text-body-sm ${issue.is_done ? "line-through text-text-tertiary opacity-60" : "text-text-primary"}`}>
              {issue.issue_text}
            </span>
            {issue.source === "carried_forward" && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium shrink-0" title="Carried forward from sales">
                <ArrowUp className="h-3 w-3" /> From sales
              </span>
            )}
            {issue.source === "ai" && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium shrink-0">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
            <button
              onClick={() => deleteIssue(issue.id)}
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
          placeholder="Add an issue..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIssue()}
        />
      </div>
    </div>
  );
}
