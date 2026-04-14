"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { EosContactGoals } from "@/types/database";

interface Props {
  contactId: string;
  carriedTerritoryName?: string | null;
}

const FIELDS: { key: keyof Pick<EosContactGoals, "income_goal" | "lifestyle_goal" | "qol_goal">; label: string; placeholder: string }[] = [
  { key: "income_goal", label: "Income Goal", placeholder: "What income are they targeting in year 1?" },
  { key: "lifestyle_goal", label: "Lifestyle Goal", placeholder: "What lifestyle change are they seeking?" },
  { key: "qol_goal", label: "Quality of Life Goal", placeholder: "What does success look like personally?" },
];

export default function ContactEosGoals({ contactId, carriedTerritoryName }: Props) {
  const [goals, setGoals] = useState<EosContactGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/eos`)
      .then((r) => (r.ok ? r.json() : { goals: null }))
      .then((d) => setGoals(d.goals))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contactId]);

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaving(true);
      fetch(`/api/contacts/${contactId}/eos/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income_goal: goals?.income_goal ?? "",
          lifestyle_goal: goals?.lifestyle_goal ?? "",
          qol_goal: goals?.qol_goal ?? "",
          source: goals?.source ?? "manual",
        }),
      })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 300);
  }

  function updateField(key: string, value: string) {
    setGoals((prev) => ({
      id: prev?.id ?? "",
      contact_id: contactId,
      income_goal: prev?.income_goal ?? null,
      lifestyle_goal: prev?.lifestyle_goal ?? null,
      qol_goal: prev?.qol_goal ?? null,
      source: prev?.source ?? "manual",
      updated_at: prev?.updated_at ?? "",
      [key]: value,
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-body-sm font-semibold text-text-primary">Goals</h3>
        {saving && <span className="text-caption text-text-tertiary">Saving...</span>}
      </div>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="block text-caption font-medium text-text-secondary mb-1">
            {f.label}
            {goals?.source === "ai" && (
              <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            )}
          </label>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-nah-blue/30 resize-none"
            placeholder={f.placeholder}
            value={goals?.[f.key] ?? ""}
            onChange={(e) => updateField(f.key, e.target.value)}
            onBlur={handleBlur}
          />
          {carriedTerritoryName && (
            <p className="text-[11px] text-text-tertiary mt-0.5">Carried to {carriedTerritoryName}</p>
          )}
        </div>
      ))}
    </div>
  );
}
