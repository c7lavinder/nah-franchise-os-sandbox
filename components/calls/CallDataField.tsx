"use client";

import { useState } from "react";
import { Check, Pencil, X, Loader2, AlertTriangle, Sparkles } from "lucide-react";

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
  onAction: () => void;
}

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

const IMPORTANT_FIELDS = new Set([
  "capital_range",
  "timeline_intent",
  "stated_why",
  "market_interest",
]);

export default function CallDataField({ extraction, onAction }: CallDataFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(extraction.extracted_value ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const label = FIELD_LABELS[extraction.field_key] ?? extraction.field_key.replace(/_/g, " ");
  const hasValue = !!extraction.extracted_value;
  const isDone = extraction.saved_to_profile || extraction.dismissed;
  const isImportant = IMPORTANT_FIELDS.has(extraction.field_key);

  // Done state
  if (isDone) {
    return (
      <div className={`flex items-start gap-3 py-2 border-b border-border-default last:border-b-0 ${
        extraction.dismissed ? "opacity-40" : "opacity-60"
      }`}>
        <div className="mt-0.5">
          {extraction.dismissed ? (
            <X size={12} className="text-text-tertiary" />
          ) : (
            <Check size={12} className="text-success" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-caption text-text-tertiary capitalize">{label}</p>
          {hasValue && (
            <p className={`text-body-sm text-text-secondary ${extraction.dismissed ? "line-through" : ""}`}>
              {extraction.extracted_value}
            </p>
          )}
        </div>
        <span className="text-[10px] text-text-tertiary flex-shrink-0">
          {extraction.dismissed ? "Skipped" : "Saved"}
        </span>
      </div>
    );
  }

  // No value extracted
  if (!hasValue) {
    return (
      <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-caption text-text-tertiary capitalize">{label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm text-text-tertiary italic">Not captured</span>
          {isImportant && (
            <span className="flex items-center gap-0.5 text-[10px] text-warning">
              <AlertTriangle size={10} /> Flag for next call
            </span>
          )}
        </div>
      </div>
    );
  }

  async function handlePush() {
    setLoading("push");
    try {
      const res = await fetch(`/api/calls/${extraction.call_id}/data/${extraction.id}/save`, { method: "POST" });
      if (res.ok) onAction();
    } catch { /* silent */ }
    setLoading(null);
  }

  async function handleEditSave() {
    setLoading("edit");
    try {
      const res = await fetch(`/api/calls/${extraction.call_id}/data/${extraction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_save", field_value: editValue }),
      });
      if (res.ok) { setEditing(false); onAction(); }
    } catch { /* silent */ }
    setLoading(null);
  }

  async function handleSkip() {
    setLoading("skip");
    try {
      const res = await fetch(`/api/calls/${extraction.call_id}/data/${extraction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (res.ok) onAction();
    } catch { /* silent */ }
    setLoading(null);
  }

  async function handleAiRewrite() {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/calls/${extraction.call_id}/actions/_/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: aiInstruction,
          currentFields: { field_value: editValue, field_label: label },
          category: "data",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fields?.field_value) setEditValue(data.fields.field_value);
        setAiInstruction("");
      }
    } catch { /* silent */ }
    setAiLoading(false);
  }

  // Pending state — with Push/Edit/Skip
  return (
    <div className="py-2 border-b border-border-default last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-caption text-text-tertiary capitalize">{label}</p>
          {editing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary resize-none"
              />
              {/* Tell AI what to change */}
              <div>
                <label className="text-[10px] text-scout-purple font-medium flex items-center gap-1 mb-1">
                  <Sparkles size={10} /> TELL SCOUT WHAT TO CHANGE
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="e.g. Shorten to key phrase only..."
                    className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAiRewrite(); }}
                  />
                  <button
                    onClick={() => void handleAiRewrite()}
                    disabled={aiLoading || !aiInstruction.trim()}
                    className="btn-ghost px-2 py-1.5 text-caption flex items-center gap-1 text-scout-purple"
                  >
                    {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Apply
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void handleEditSave()} disabled={loading !== null}
                  className="btn-primary px-3 py-1 text-caption flex items-center gap-1">
                  {loading === "edit" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save to Profile
                </button>
                <button onClick={() => { setEditing(false); setEditValue(extraction.extracted_value ?? ""); }}
                  className="btn-ghost px-3 py-1 text-caption">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-body-sm text-text-primary mt-0.5">{extraction.extracted_value}</p>
          )}
        </div>

        {/* Confidence badge */}
        {!editing && extraction.confidence && extraction.confidence !== "high" && (
          <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 mt-1 ${
            extraction.confidence === "medium" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
          }`}>
            {extraction.confidence}
          </span>
        )}
      </div>

      {/* Action buttons — only when not editing */}
      {!editing && (
        <div className="flex items-center gap-2 mt-1.5 ml-0">
          <button onClick={() => void handlePush()} disabled={loading !== null || !extraction.contact_id}
            className="btn-primary px-3 py-1 text-caption flex items-center gap-1">
            {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Push to Profile
          </button>
          <button onClick={() => setEditing(true)} disabled={loading !== null}
            className="btn-ghost px-3 py-1 text-caption flex items-center gap-1">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={() => void handleSkip()} disabled={loading !== null}
            className="btn-ghost px-3 py-1 text-caption flex items-center gap-1 text-text-tertiary">
            {loading === "skip" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
