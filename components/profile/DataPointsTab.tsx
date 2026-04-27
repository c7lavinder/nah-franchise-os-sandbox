"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import SuggestionCards from "./SuggestionCards";
import ResearchButton from "./ResearchButton";

interface Suggestion {
  id: string;
  field_name: string;
  current_value: string | null;
  suggested_value: string;
  source: string;
  confidence: string;
  evidence: string | null;
  created_at: string;
}

interface Props {
  contactId?: string;
  territorySlug?: string;
  entityType: "contact" | "territory";
}

export default function DataPointsTab({ contactId, territorySlug, entityType }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    const param = contactId
      ? `contact_id=${contactId}`
      : `territory_ms_slug=${territorySlug}`;
    try {
      const res = await apiFetch(`/api/suggestions?${param}`);
      if (res.ok) {
        const d = await res.json();
        setSuggestions(d.suggestions ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [contactId, territorySlug]);

  useEffect(() => {
    void fetchSuggestions();
  }, [fetchSuggestions]);

  async function handlePush(id: string, value: string) {
    try {
      await apiFetch("/api/suggestions/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: id, finalValue: value, reviewerId: "current-user" }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silent */ }
  }

  async function handleSkip(id: string) {
    try {
      await apiFetch("/api/suggestions/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: id, reviewerId: "current-user" }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silent */ }
  }

  if (loading) {
    return <div className="py-6 text-center text-caption text-text-tertiary">Loading suggestions...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with Research button */}
      <div className="flex items-center justify-between">
        <h3 className="text-body-sm font-medium text-text-primary">
          Data Points
          {suggestions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {suggestions.length}
            </span>
          )}
        </h3>
        <ResearchButton
          entityType={entityType}
          entityId={(contactId ?? territorySlug)!}
          onNewSuggestions={fetchSuggestions}
        />
      </div>

      <SuggestionCards
        suggestions={suggestions}
        onPush={handlePush}
        onSkip={handleSkip}
      />
    </div>
  );
}
