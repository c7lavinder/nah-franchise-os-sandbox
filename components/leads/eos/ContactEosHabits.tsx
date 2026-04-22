"use client";

/**
 * ContactEosHabits — recurring practices that follow the person across
 * every journey. Supports add / edit cadence / assign A-F grade / delete.
 * Mirrors the shape of ContactEosGoals/Issues/Todos so the API pattern
 * stays consistent.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import type { EosContactHabit, EosHabitCadence, EosHabitGrade } from "@/types/database";

interface Props {
  contactId: string;
}

const CADENCE_OPTIONS: { value: EosHabitCadence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const GRADE_OPTIONS: (EosHabitGrade | "")[] = ["", "A", "B", "C", "D", "F"];

function GradePill({ grade, onChange }: { grade: EosHabitGrade | null; onChange: (g: EosHabitGrade | null) => void }) {
  // Render as a select styled like a pill — compact, avoids a separate picker.
  const color = (() => {
    switch (grade) {
      case "A": return "bg-success/15 text-success";
      case "B": return "bg-info/15 text-info";
      case "C": return "bg-warning/15 text-warning";
      case "D": return "bg-nah-orange/15 text-nah-orange";
      case "F": return "bg-danger/15 text-danger";
      default: return "bg-bg-hover text-text-tertiary";
    }
  })();
  return (
    <select
      value={grade ?? ""}
      onChange={(e) => onChange((e.target.value || null) as EosHabitGrade | null)}
      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border-0 focus:ring-2 focus:ring-nah-blue/30 ${color}`}
    >
      {GRADE_OPTIONS.map((g) => (
        <option key={g} value={g}>{g === "" ? "—" : g}</option>
      ))}
    </select>
  );
}

export default function ContactEosHabits({ contactId }: Props) {
  const [habits, setHabits] = useState<EosContactHabit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newCadence, setNewCadence] = useState<EosHabitCadence>("weekly");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/contacts/${contactId}/eos/habits`)
      .then((r) => (r.ok ? r.json() : { habits: [] }))
      .then((d) => setHabits(d.habits ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  async function addHabit() {
    const text = newText.trim();
    if (!text) return;
    const res = await fetch(`/api/contacts/${contactId}/eos/habits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habit_text: text, cadence: newCadence }),
    });
    if (res.ok) {
      const { habit } = await res.json();
      setHabits((prev) => [...prev, habit]);
      setNewText("");
      setNewCadence("weekly");
    }
  }

  async function updateHabit(id: string, patch: Partial<Pick<EosContactHabit, "habit_text" | "cadence" | "grade">>) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    await fetch(`/api/contacts/${contactId}/eos/habits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteHabit(id: string) {
    await fetch(`/api/contacts/${contactId}/eos/habits/${id}`, { method: "DELETE" });
    setHabits((prev) => prev.filter((h) => h.id !== id));
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
      <h3 className="text-body-sm font-semibold text-text-primary">Habits</h3>
      {habits.length === 0 && (
        <p className="text-caption text-text-tertiary">No habits yet. Add recurring practices that follow this person.</p>
      )}
      <ul className="space-y-1">
        {habits.map((h) => (
          <li
            key={h.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-secondary transition-colors"
          >
            <GradePill grade={h.grade} onChange={(g) => updateHabit(h.id, { grade: g })} />
            <input
              type="text"
              value={h.habit_text}
              onChange={(e) => setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, habit_text: e.target.value } : x)))}
              onBlur={(e) => updateHabit(h.id, { habit_text: e.target.value })}
              className="flex-1 bg-transparent text-body-sm text-text-primary border-0 focus:outline-none focus:bg-bg-primary focus:ring-1 focus:ring-nah-blue/30 rounded px-1"
            />
            <select
              value={h.cadence}
              onChange={(e) => updateHabit(h.id, { cadence: e.target.value as EosHabitCadence })}
              className="text-caption bg-bg-tertiary border border-border-default rounded px-1.5 py-0.5 text-text-secondary"
            >
              {CADENCE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <SourceBadge source={h.source} />
            <button
              onClick={() => deleteHabit(h.id)}
              className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-opacity shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          className="flex-1 rounded-lg border border-border-primary bg-bg-primary px-3 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-nah-blue/30"
          placeholder="Add a habit…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHabit()}
        />
        <select
          value={newCadence}
          onChange={(e) => setNewCadence(e.target.value as EosHabitCadence)}
          className="rounded-lg border border-border-primary bg-bg-primary px-2 py-1.5 text-body-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-nah-blue/30"
        >
          {CADENCE_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
