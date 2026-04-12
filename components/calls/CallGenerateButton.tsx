"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface CallGenerateButtonProps {
  callId: string;
  hasGenerated: boolean;
  hasTranscript: boolean;
  onGenerated: () => void;
}

export default function CallGenerateButton({
  callId,
  hasGenerated,
  hasTranscript,
  onGenerated,
}: CallGenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/generate`, { method: "POST" });
      if (res.ok) {
        onGenerated();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Generation failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  if (!hasTranscript) return null;

  return (
    <div>
      <button
        onClick={() => void handleGenerate()}
        disabled={loading}
        className={`${hasGenerated ? "btn-ghost" : "btn-primary"} px-4 py-2 text-body-sm flex items-center gap-1.5`}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : hasGenerated ? (
          <RefreshCw size={14} />
        ) : (
          <Sparkles size={14} />
        )}
        {loading ? "Generating..." : hasGenerated ? "Regenerate" : "Generate with Scout"}
      </button>
      {error && (
        <p className="text-caption text-danger mt-1">{error}</p>
      )}
    </div>
  );
}
