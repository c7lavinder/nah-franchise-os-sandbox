"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useRef } from "react";
import type { EosTerritoryGoal } from "@/types/database";

interface Props {
  TerritorySlug: string;
  goals: EosTerritoryGoal[];
  onUpdate: () => void;
}

const GOAL_LABELS: Record<string, string> = {
  houses_purchased: "Houses Purchased",
  gross_profit: "Gross Profit",
  quality_of_life: "Quality of Life",
};

const COL_HEADERS = ["Actual", "Current Year", "Year 5", "Year 25"];
const COL_KEYS: (keyof EosTerritoryGoal)[] = ["actual", "current_year_goal", "year_5_goal", "year_25_goal"];

export default function TerritoryEosGoals({ TerritorySlug, goals, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryGoal[]>(goals);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(goalType: string, colKey: string, value: string) {
    setLocal((prev) => prev.map((g) => (g.goal_type === goalType ? { ...g, [colKey]: value } : g)));
  }

  function handleBlur(goalType: string) {
    const row = local.find((g) => g.goal_type === goalType);
    if (!row) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      await apiFetch(`/api/territories/${TerritorySlug}/eos/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal_type: row.goal_type,
          actual: row.actual,
          current_year_goal: row.current_year_goal,
          year_5_goal: row.year_5_goal,
          year_25_goal: row.year_25_goal,
        }),
      }).catch(() => {});
      setSaving(false);
      onUpdate();
    }, 300);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-sm font-semibold text-text-primary">Goals</h3>
        {saving && <span className="text-caption text-text-tertiary">Saving...</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="text-left py-2 pr-3 text-caption font-medium text-text-secondary w-40" />
              {COL_HEADERS.map((h) => (
                <th key={h} className="text-left py-2 px-2 text-caption font-medium text-text-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {local.map((g) => (
              <tr key={g.goal_type} className="border-b border-border-primary/50">
                <td className="py-2 pr-3 font-medium text-text-primary">{GOAL_LABELS[g.goal_type] ?? g.goal_type}</td>
                {COL_KEYS.map((col, ci) => (
                  <td key={col} className="py-2 px-2">
                    {ci === 0 ? (
                      <span className="text-text-tertiary">{(g[col] as string) || "—"}</span>
                    ) : (
                      <input
                        className="w-full rounded border border-border-primary bg-bg-primary px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue/30"
                        value={(g[col] as string) ?? ""}
                        onChange={(e) => handleChange(g.goal_type, col, e.target.value)}
                        onBlur={() => handleBlur(g.goal_type)}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
