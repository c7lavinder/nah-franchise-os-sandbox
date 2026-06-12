"use client";

import { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";

interface ScoutConcernFlaggerProps {
  onFlagConcern: (feedback: { selectedText: string; concernType: string; correctionNote: string }) => Promise<void>;
  className?: string;
}

export default function ScoutConcernFlagger({ onFlagConcern, className = "" }: ScoutConcernFlaggerProps) {
  const [selectedText, setSelectedText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [concernType, setConcernType] = useState("factually_wrong");
  const [correctionNote, setCorrectionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectionHint, setSelectionHint] = useState(false);

  function readSelection() {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (text.length === 0) return "";
    setSelectedText(text.slice(0, 1000));
    setSaved(false);
    setSelectionHint(false);
    return text;
  }

  function handleOpen() {
    const text = readSelection();
    if (!text && !selectedText) {
      setSelectionHint(true);
      return;
    }
    setShowForm(true);
  }

  async function submitConcern() {
    if (!selectedText) return;
    setSaving(true);
    try {
      await onFlagConcern({ selectedText, concernType, correctionNote: correctionNote.trim() });
      setSaved(true);
      setShowForm(false);
      setCorrectionNote("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className} onMouseUp={readSelection} onTouchEnd={() => setTimeout(readSelection, 250)}>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 hover:text-red-600"
        title="Flag selected Scout text"
      >
        <Flag size={12} />
        Flag concern
      </button>

      {selectionHint && (
        <div className="mt-1 text-[11px] text-red-500">Highlight text in the Scout response first.</div>
      )}

      {selectedText && (
        <div className="mt-1 rounded-lg border border-red-100 bg-red-50/80 p-2 text-xs text-red-700">
          <div className="flex items-start gap-2">
            <Flag size={13} className="mt-0.5 flex-shrink-0" />
            <button type="button" onClick={() => setShowForm((prev) => !prev)} className="flex-1 text-left font-medium">
              &ldquo;{selectedText.length > 90 ? `${selectedText.slice(0, 90)}...` : selectedText}&rdquo;
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedText("");
                setShowForm(false);
                setSelectionHint(false);
              }}
              className="rounded p-0.5 text-red-400 hover:bg-red-100 hover:text-red-600"
              title="Clear selection"
            >
              <X size={12} />
            </button>
          </div>

          {showForm && (
            <div className="mt-2 space-y-2">
              <select
                value={concernType}
                onChange={(e) => setConcernType(e.target.value)}
                className="w-full rounded-md border border-red-100 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-red-300"
              >
                <option value="factually_wrong">Factually wrong</option>
                <option value="outdated_info">Outdated info</option>
                <option value="bad_recommendation">Bad recommendation</option>
                <option value="missing_context">Missing context</option>
                <option value="tone_wording">Tone / wording issue</option>
                <option value="other">Other</option>
              </select>
              <textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder="What was wrong?"
                className="min-h-16 w-full resize-y rounded-md border border-red-100 bg-white px-2 py-1 text-xs text-gray-700 outline-none placeholder:text-gray-400 focus:border-red-300"
              />
              <button
                type="button"
                onClick={submitConcern}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                Save to Audit
              </button>
            </div>
          )}

          {saved && <div className="mt-1 text-[11px] text-red-500">Saved to Audit.</div>}
        </div>
      )}
    </div>
  );
}
