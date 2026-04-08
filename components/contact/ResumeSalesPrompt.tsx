"use client";

/**
 * ResumeSalesPrompt — shown when a contact is in Follow-up → Re-engaged.
 * Per §1.13: user picks fresh start or resume at prior stage.
 */

import { useState } from "react";
import { Loader2, Play } from "lucide-react";

interface ResumeSalesPromptProps {
  contactId: string;
  onRefresh: () => void;
}

export default function ResumeSalesPrompt({ contactId, onRefresh }: ResumeSalesPromptProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResume(mode: "fresh" | "resume") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/pipelines/resume-sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to resume");
      }
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 p-3 bg-success/5 border border-success/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Play size={14} className="text-success" />
        <span className="text-body-sm font-medium text-success">Ready to resume Sales?</span>
      </div>
      <p className="text-caption text-text-secondary mb-3">
        This contact is re-engaged. Spawn a new Sales pipeline entry:
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => void handleResume("fresh")}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-caption font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
        >
          {loading && <Loader2 size={12} className="animate-spin" />}
          Fresh Start (Stage 1)
        </button>
        <button
          onClick={() => void handleResume("resume")}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-caption font-medium bg-nah-blue/10 text-nah-blue hover:bg-nah-blue/20 transition-colors"
        >
          {loading && <Loader2 size={12} className="animate-spin" />}
          Resume at Prior Stage
        </button>
      </div>
      {error && <p className="text-caption text-danger mt-2">{error}</p>}
    </div>
  );
}
