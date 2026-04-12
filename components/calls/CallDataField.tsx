"use client";

import { useState } from "react";
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react";

interface ExtractionData {
  id: string;
  call_id: string;
  contact_id: string | null;
  field_key: string;
  field_category: string;
  extracted_value: string | null;
  confidence: string | null;
  saved_to_profile: boolean;
  dismissed: boolean;
}

interface CallDataFieldProps {
  extraction: ExtractionData;
  onSaved: () => void;
}

/** Human-readable labels for field keys */
const FIELD_LABELS: Record<string, string> = {
  employment_status: "Employment Status",
  years_in_current_role: "Years in Current Role",
  timeline_intent: "Timeline Intent",
  capital_range: "Capital Range",
  lead_source: "Lead Source",
  competitors_mentioned: "Competitors Mentioned",
  stated_why: "Stated \"Why\"",
  risk_tolerance: "Risk Tolerance",
  family_situation: "Family Situation",
  prior_business_ownership: "Prior Business Ownership",
  market_interest: "Market Interest",
  territory_type_preference: "Territory Type Preference",
  availability_confirmed: "Availability Confirmed",
};

/** Fields that should show an amber flag when missing */
const IMPORTANT_FIELDS = new Set([
  "capital_range",
  "timeline_intent",
  "stated_why",
  "market_interest",
]);

export default function CallDataField({ extraction, onSaved }: CallDataFieldProps) {
  const [saving, setSaving] = useState(false);

  const label = FIELD_LABELS[extraction.field_key] ?? extraction.field_key.replace(/_/g, " ");
  const hasValue = !!extraction.extracted_value;
  const isSaved = extraction.saved_to_profile;
  const isImportant = IMPORTANT_FIELDS.has(extraction.field_key);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/calls/${extraction.call_id}/data/${extraction.id}/save`,
        { method: "POST" }
      );
      if (res.ok) onSaved();
    } catch {
      // silent
    }
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-caption text-text-tertiary capitalize">{label}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {hasValue ? (
          <>
            <span className="text-body-sm text-text-primary max-w-[200px] truncate">
              {extraction.extracted_value}
            </span>
            {extraction.confidence && extraction.confidence !== "high" && (
              <span className={`text-[9px] px-1 py-0.5 rounded ${
                extraction.confidence === "medium" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
              }`}>
                {extraction.confidence}
              </span>
            )}
            {isSaved ? (
              <span className="text-[10px] text-success">Saved</span>
            ) : extraction.contact_id ? (
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="text-[11px] text-nah-blue hover:underline flex items-center gap-0.5"
              >
                {saving ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
                Save to profile
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-body-sm text-text-tertiary italic">Not captured</span>
            {isImportant && (
              <span className="flex items-center gap-0.5 text-[10px] text-warning">
                <AlertTriangle size={10} /> Flag for next call
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
