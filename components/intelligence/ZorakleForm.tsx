"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * ZorakleForm — Log Zorakle assessment results for a candidate.
 *
 * Chad inputs results after a candidate completes the Zorakle personality
 * assessment. Data updates candidate_intelligence: zorakle fields, DISC
 * profile, risk tolerance, and personality flags. Triggers score recalculation.
 *
 * Follows the glass card / Signika heading style from CallLogForm.
 */

import { useState } from "react";
import { Save, X } from "lucide-react";
import type { DiscProfile } from "@/lib/intelligence/types";

// ═══════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════

interface ZorakleFormProps {
  contactId: string;
  onSave: () => void;
  onCancel: () => void;
}

// ═══════════════════════════════════════════════════════
// DISC dropdown options
// ═══════════════════════════════════════════════════════

interface SelectOption {
  value: string;
  label: string;
}

const DISC_OPTIONS: SelectOption[] = [
  { value: "D", label: "D — Dominance" },
  { value: "I", label: "I — Influence" },
  { value: "S", label: "S — Steadiness" },
  { value: "C", label: "C — Conscientiousness" },
];

// ═══════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════

export default function ZorakleForm({ contactId, onSave, onCancel }: ZorakleFormProps) {
  // ─── Field state ───
  const [discProfile, setDiscProfile] = useState<DiscProfile | "">("");
  const [riskToleranceScore, setRiskToleranceScore] = useState("");
  const [personalityFlags, setPersonalityFlags] = useState("");
  const [fitScore, setFitScore] = useState("");

  // ─── Form state ───
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Validation ───
  function validate(): string | null {
    if (!discProfile) return "DISC type is required";
    if (!riskToleranceScore) return "Risk tolerance score is required";

    const risk = Number(riskToleranceScore);
    if (isNaN(risk) || risk < 0 || risk > 100) {
      return "Risk tolerance score must be between 0 and 100";
    }

    if (fitScore) {
      const fit = Number(fitScore);
      if (isNaN(fit) || fit < 0 || fit > 100) {
        return "Zorakle fit score must be between 0 and 100";
      }
    }

    return null;
  }

  // ─── Save handler ───
  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        contactId,
        discProfile,
        riskToleranceScore: Number(riskToleranceScore),
        personalityFlags: personalityFlags.trim() || null,
        fitScore: fitScore ? Number(fitScore) : null,
      };

      const res = await apiFetch("/api/intelligence/zorakle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data: Record<string, string> = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Zorakle results");
    }

    setSaving(false);
  }

  return (
    <div className="rounded-lg bg-surface-glass backdrop-blur-md border border-border-glass shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
        <div>
          <h2 className="font-headline text-card-title text-text-primary">
            Log Zorakle Results
          </h2>
          <p className="text-caption text-text-secondary mt-0.5">
            Personality assessment data for scoring
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Form body ── */}
      <div className="px-6 py-5 space-y-5">
        {/* DISC type */}
        <div>
          <label className="text-caption text-text-secondary mb-1 block">DISC Type *</label>
          <select
            value={discProfile}
            onChange={(e) => setDiscProfile(e.target.value as DiscProfile | "")}
            className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary focus:border-nah-blue focus:outline-none transition-colors"
          >
            <option value="">Select DISC type...</option>
            {DISC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Risk tolerance score */}
        <div>
          <label className="text-caption text-text-secondary mb-1 block">
            Risk Tolerance Score (0-100) *
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={riskToleranceScore}
            onChange={(e) => setRiskToleranceScore(e.target.value)}
            placeholder="e.g. 72"
            className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors"
          />
        </div>

        {/* Key personality flags */}
        <div>
          <label className="text-caption text-text-secondary mb-1 block">
            Key Personality Flags
          </label>
          <textarea
            value={personalityFlags}
            onChange={(e) => setPersonalityFlags(e.target.value)}
            placeholder="Free-form observations from the Zorakle assessment..."
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Zorakle fit score (optional) */}
        <div>
          <label className="text-caption text-text-secondary mb-1 block">
            Zorakle Fit Score (0-100, optional)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={fitScore}
            onChange={(e) => setFitScore(e.target.value)}
            placeholder="e.g. 85"
            className="w-full px-3 py-2 rounded-md bg-bg-secondary border border-border-default text-body text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border-default">
        {error && (
          <p className="text-caption text-danger mr-4 truncate max-w-[60%]">{error}</p>
        )}
        {!error && <div />}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-button text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Results"}
          </button>
        </div>
      </div>
    </div>
  );
}
