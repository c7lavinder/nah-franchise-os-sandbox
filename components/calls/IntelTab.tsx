"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * IntelTab — AI-assisted intelligence data collection after a call.
 *
 * Shows the structured call log form pre-filled with data extracted
 * from the call grading/transcript. User reviews each field,
 * confirms or edits, then saves.
 *
 * This is the primary path for collecting candidate intelligence data.
 */

import { useState, useMemo } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import CallLogForm from "@/components/intelligence/CallLogForm";

interface ProfileUpdate {
  fieldName: string;
  suggestedValue: string;
  reason: string;
}

interface IntelTabProps {
  contactId: string;
  contactName: string;
  /** Profile updates extracted by AI grading — pre-fills the form */
  profileUpdates: ProfileUpdate[];
  /** Whether AI data is available */
  hasAiData: boolean;
}

/** Map AI profile field names to call log form field names */
function buildPrefillData(updates: ProfileUpdate[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const update of updates) {
    const key = update.fieldName.toLowerCase().replace(/\s+/g, "_");

    // Map common AI-extracted fields to call log form fields
    const fieldMap: Record<string, string> = {
      stated_motivation: "stated_motivation",
      motivation: "stated_motivation",
      prior_business_owner: "prior_business_owner",
      business_owner: "prior_business_owner",
      construction_comfort: "construction_comfort",
      liquid_capital: "liquid_capital",
      capital: "liquid_capital",
      funding_path: "funding_path",
      spouse_supportive: "spouse_supportive",
      spouse: "spouse_supportive",
      urgency: "urgency",
      disc_type: "disc_impression",
      disc_profile: "disc_impression",
      disc: "disc_impression",
      homework: "homework_done",
      homework_done: "homework_done",
      capital_concern: "capital_concern_surfaced",
      royalty_objection: "royalty_objection_raised",
      close_confidence: "close_confidence",
      financial_situation: "financial_situation_read",
      market_analysis: "market_analysis_quality",
      wholesaling: "wholesaling_comfort",
      pfs: "pfs_complete",
      pfs_complete: "pfs_complete",
      funding_confirmed: "funding_path_confirmed",
      recommendation: "marks_recommendation",
    };

    const mappedKey = fieldMap[key] ?? key;
    data[mappedKey] = update.suggestedValue;
  }

  return data;
}

/** Detect call type from profile updates */
function detectCallType(updates: ProfileUpdate[]): "intro" | "matt" | "sam" | "mark" {
  const fields = updates.map((u) => u.fieldName.toLowerCase());

  if (fields.some((f) => f.includes("pfs") || f.includes("lending") || f.includes("alta") || f.includes("mark"))) {
    return "mark";
  }
  if (fields.some((f) => f.includes("market") || f.includes("wholesaling") || f.includes("sam"))) {
    return "sam";
  }
  if (fields.some((f) => f.includes("homework") || f.includes("royalty") || f.includes("disc") || f.includes("matt"))) {
    return "matt";
  }
  return "intro";
}

export default function IntelTab({ contactId, contactName, profileUpdates, hasAiData }: IntelTabProps) {
  const detectedType = useMemo(() => detectCallType(profileUpdates), [profileUpdates]);
  const [callType, setCallType] = useState<"intro" | "matt" | "sam" | "mark">(detectedType);
  const [saved, setSaved] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [transcriptPrefill, setTranscriptPrefill] = useState<Record<string, unknown> | null>(null);
  const [transcriptSummary, setTranscriptSummary] = useState<string | null>(null);

  const prefillData = useMemo(() => {
    // Merge AI grade pre-fill with transcript pre-fill (transcript takes priority)
    const base = buildPrefillData(profileUpdates);
    if (transcriptPrefill) {
      return { ...base, ...transcriptPrefill };
    }
    return base;
  }, [profileUpdates, transcriptPrefill]);

  const hasAnyPrefill = hasAiData || transcriptPrefill !== null;

  async function analyzeTranscriptText() {
    if (transcriptText.trim().length < 50) return;
    setAnalyzing(true);
    try {
      const res = await apiFetch("/api/intelligence/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText, contactName }),
      });
      if (res.ok) {
        const data = await res.json();
        const analysis = data.analysis;
        if (analysis.callType !== "unknown") {
          setCallType(analysis.callType);
        }
        setTranscriptPrefill(analysis.extractedFields);
        setTranscriptSummary(analysis.summary);
      }
    } catch { /* silent */ }
    setAnalyzing(false);
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mb-3">
          <span className="text-success text-xl">✓</span>
        </div>
        <p className="text-body text-text-primary mb-1">Call log saved</p>
        <p className="text-body-sm text-text-tertiary">
          Score updated, flags regenerated, and objections logged automatically.
        </p>
        <button
          onClick={() => setSaved(false)}
          className="mt-4 px-4 py-2 rounded-md text-button text-nah-blue hover:bg-bg-hover transition-colors"
        >
          Log another call
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Transcript paste area — for AI-assisted pre-fill */}
      {!hasAnyPrefill && (
        <div className="mb-4 rounded-lg border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-nah-blue" />
            <p className="text-body-sm font-medium text-text-primary">Have a transcript?</p>
          </div>
          <p className="text-caption text-text-tertiary mb-3">
            Paste your call transcript or Gemini notes and Scout will auto-fill the form.
          </p>
          <textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Paste call transcript here..."
            rows={4}
            className="w-full px-3 py-2 rounded-md bg-bg-primary border border-border-default text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-blue focus:outline-none resize-none mb-2"
          />
          <button
            onClick={analyzeTranscriptText}
            disabled={analyzing || transcriptText.trim().length < 50}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nah-blue text-white text-button hover:bg-nah-blue-hover transition-colors disabled:opacity-50"
          >
            {analyzing ? (
              <><Loader2 size={14} className="animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles size={14} /> Analyze with Scout</>
            )}
          </button>
        </div>
      )}

      {/* AI assist indicator */}
      {hasAnyPrefill && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-nah-blue/5 border border-nah-blue/15">
          <p className="text-body-sm text-nah-blue">
            {transcriptSummary
              ? `Scout analyzed the transcript: ${transcriptSummary}`
              : `Scout pre-filled ${profileUpdates.length} fields from the call. Review each field before saving.`
            }
          </p>
        </div>
      )}

      {/* Call type selector */}
      <div className="flex gap-2 mb-4">
        {(["intro", "matt", "sam", "mark"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setCallType(t)}
            className={`px-3 py-1.5 rounded-md text-body-sm ${
              callType === t ? "bg-nah-blue text-white" : "text-text-secondary hover:bg-bg-hover"
            }`}
          >
            {t === "intro" ? "Chad (Intro)" : t === "matt" ? "Matt (Discovery)" : t === "sam" ? "Sam (Validation)" : "Mark (Lending)"}
          </button>
        ))}
      </div>

      {/* Call log form with pre-fill */}
      <CallLogForm
        callType={callType}
        contactId={contactId}
        contactName={contactName}
        prefillData={hasAnyPrefill ? prefillData : undefined}
        onSave={() => setSaved(true)}
        onCancel={() => { /* stay on tab */ }}
      />
    </div>
  );
}
