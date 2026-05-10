"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useRef } from "react";
import type { EosTerritoryScorecard } from "@/types/database";

interface Props {
  TerritorySlug: string;
  scorecard: EosTerritoryScorecard[];
  onUpdate: () => void;
}

export default function TerritoryEosScorecard({ TerritorySlug, scorecard, onUpdate }: Props) {
  const [local, setLocal] = useState<EosTerritoryScorecard[]>(scorecard);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(metricKey: string, value: string) {
    setLocal((prev) => prev.map((s) => (s.metric_key === metricKey ? { ...s, goal_value: value } : s)));
  }

  function handleBlur(metricKey: string) {
    const row = local.find((s) => s.metric_key === metricKey);
    if (!row) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      await apiFetch(`/api/territories/${TerritorySlug}/eos/scorecard/${metricKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_value: row.goal_value }),
      }).catch(() => {});
      setSaving(false);
      onUpdate();
    }, 300);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-sm font-semibold text-text-primary">Scorecard</h3>
        {saving && <span className="text-caption text-text-tertiary">Saving...</span>}
      </div>
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-border-primary">
            <th className="text-left py-2 pr-3 text-caption font-medium text-text-secondary">Metric</th>
            <th className="text-left py-2 px-2 text-caption font-medium text-text-secondary w-32">Goal</th>
            <th className="text-left py-2 px-2 text-caption font-medium text-text-secondary w-32">Actual</th>
          </tr>
        </thead>
        <tbody>
          {local.map((s) => (
            <tr key={s.metric_key} className="border-b border-border-primary/50">
              <td className="py-2 pr-3 text-text-primary">{s.metric_label}</td>
              <td className="py-2 px-2">
                <input
                  className="w-full rounded border border-border-primary bg-bg-primary px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue/30"
                  value={s.goal_value ?? ""}
                  onChange={(e) => handleChange(s.metric_key, e.target.value)}
                  onBlur={() => handleBlur(s.metric_key)}
                />
              </td>
              <td className="py-2 px-2 text-text-tertiary">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
