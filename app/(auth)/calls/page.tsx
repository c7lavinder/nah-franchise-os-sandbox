"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, RefreshCw } from "lucide-react";
import { CallList, CallDetail } from "@/components/calls";

interface CallSummary {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  contactName: string;
  phone: string | null;
  direction: "inbound" | "outbound";
  dateAdded: string;
  duration: string | null;
  type: string;
}

/**
 * Call Center Page
 *
 * Left: List of recent calls
 * Right: Selected call detail with 3 tabs (Coaching, Transcript, AI Actions)
 */
export default function CallsPage() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calls");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls ?? []);
      }
    } catch {
      // Continue with empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-3 flex-shrink-0">
        <Phone size={20} className="text-nah-orange" />
        <h1 className="text-h1 text-text-primary">Call Center</h1>
        <span className="text-caption text-text-tertiary ml-1">
          {calls.length} {calls.length === 1 ? "call" : "calls"}
        </span>
        <button
          onClick={fetchCalls}
          className="btn-ghost p-1.5 ml-auto"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 border border-border-default rounded-lg overflow-hidden min-h-0">
        {/* Call list — 1/3 */}
        <div className="bg-bg-secondary overflow-y-auto p-3 border-r border-border-default">
          <CallList
            calls={calls}
            selectedId={selectedCall?.id ?? null}
            onSelect={setSelectedCall}
          />
        </div>

        {/* Call detail — 2/3 */}
        <div className="lg:col-span-2 bg-bg-primary flex flex-col min-h-0">
          {selectedCall ? (
            <CallDetail call={selectedCall} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Phone size={32} className="text-text-tertiary mx-auto mb-3" />
                <p className="text-body-sm text-text-tertiary">Select a call to view details</p>
                <p className="text-caption text-text-tertiary mt-1">
                  Scout will grade the call, show the transcript, and suggest next actions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
