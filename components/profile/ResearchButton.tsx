"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Loader2, Check } from "lucide-react";

interface Props {
  entityType: "contact" | "territory";
  entityId: string;
  onNewSuggestions?: () => void;
}

export default function ResearchButton({ entityType, entityId, onNewSuggestions }: Props) {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const initialCountRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startResearch = useCallback(async () => {
    setStatus("running");

    // Get initial count
    const countUrl = entityType === "contact"
      ? `/api/contacts/${entityId}/profile`
      : `/api/territories/${entityId}`;
    try {
      // Just use a simple fetch to kick it off — actual count comes from polling
      initialCountRef.current = 0;
    } catch { /* continue */ }

    // Fire research
    const researchUrl = entityType === "contact"
      ? `/api/research/contact/${entityId}`
      : `/api/research/territory/${entityId}`;

    try {
      await fetch(researchUrl, { method: "POST" });
    } catch { /* fire and forget */ }

    // Poll for new suggestions every 5 seconds, max 90 seconds
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 5000;
      if (elapsed >= 90000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("done");
        setTimeout(() => setStatus("idle"), 2000);
        return;
      }

      try {
        const res = await fetch(
          `/api/pipeline/territory-cards` // Lightweight ping — actual badge update comes from parent refresh
        );
        if (res.ok) {
          // Check if suggestions appeared by triggering parent refresh
          onNewSuggestions?.();
        }
      } catch { /* continue polling */ }
    }, 5000);

    // Auto-stop after 30 seconds regardless (most agents finish quickly)
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setStatus("done");
      onNewSuggestions?.();
      setTimeout(() => setStatus("idle"), 2000);
    }, 30000);
  }, [entityType, entityId, onNewSuggestions]);

  return (
    <button
      onClick={startResearch}
      disabled={status === "running"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-colors ${
        status === "running"
          ? "bg-scout-purple/10 text-scout-purple cursor-wait"
          : status === "done"
            ? "bg-green-100 text-green-800"
            : "bg-bg-secondary text-text-primary hover:bg-bg-hover"
      }`}
    >
      {status === "running" ? (
        <><Loader2 size={14} className="animate-spin" /> Researching...</>
      ) : status === "done" ? (
        <><Check size={14} /> Done</>
      ) : (
        <><Search size={14} /> Research</>
      )}
    </button>
  );
}
