"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import type { EosTerritoryHabit, EosHabitGrade } from "@/types/database";

interface Props {
  msSlug: string;
  habits: EosTerritoryHabit[];
  onUpdate: () => void;
}

const GRADES: EosHabitGrade[] = ["A", "B", "C", "D", "F"];

const GRADE_COLORS: Record<EosHabitGrade, string> = {
  A: "bg-green-500 text-white",
  B: "bg-green-300 text-green-900",
  C: "bg-yellow-400 text-yellow-900",
  D: "bg-orange-400 text-white",
  F: "bg-red-500 text-white",
};

export default function TerritoryEosHabits({ msSlug, habits, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryHabit[]>(habits);

  async function setGrade(habit: EosTerritoryHabit, grade: EosHabitGrade) {
    const newGrade = habit.grade === grade ? null : grade;
    setLocal((prev) =>
      prev.map((h) => (h.id === habit.id ? { ...h, grade: newGrade } : h))
    );
    await apiFetch(`/api/territories/${msSlug}/eos/habits/${habit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: newGrade }),
    }).catch(() => {});
    onUpdate();
  }

  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-3">Habits</h3>
      <div className="space-y-2">
        {local.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-4">
            <span className="text-body-sm text-text-primary flex-1">{h.habit_label}</span>
            <div className="flex gap-1">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrade(h, g)}
                  className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${
                    h.grade === g
                      ? GRADE_COLORS[g]
                      : "bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
