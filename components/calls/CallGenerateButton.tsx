"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { Sparkles, RefreshCw, Loader2 } from "lucide-react";

interface CallGenerateButtonProps {
  callId: string;
  hasGenerated: boolean;
  hasTranscript: boolean;
  isGenerating: boolean;
  onGenerateStart: () => void;
  onGenerateError: (msg: string) => void;
}

export default function CallGenerateButton({
  callId,
  hasGenerated,
  hasTranscript,
  isGenerating,
  onGenerateStart,
  onGenerateError,
}: CallGenerateButtonProps) {
  async function handleGenerate() {
    try {
      const res = await apiFetch(`/api/calls/${callId}/generate`, { method: "POST" });
      if (res.ok) {
        onGenerateStart();
      } else {
        const data = await res.json().catch(() => ({}));
        onGenerateError(data.error ?? "Generation failed");
      }
    } catch {
      onGenerateError("Network error");
    }
  }

  if (!hasTranscript) return null;

  return (
    <button
      onClick={() => void handleGenerate()}
      disabled={isGenerating}
      className={`${hasGenerated ? "btn-ghost" : "btn-primary"} px-4 py-2 text-body-sm flex items-center gap-1.5`}
    >
      {isGenerating ? (
        <Loader2 size={14} className="animate-spin" />
      ) : hasGenerated ? (
        <RefreshCw size={14} />
      ) : (
        <Sparkles size={14} />
      )}
      {isGenerating ? "Generating..." : hasGenerated ? "Regenerate" : "Generate with Scout"}
    </button>
  );
}
