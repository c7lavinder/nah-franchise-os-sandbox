"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import DraftedActionCard from "@/components/scout/DraftedActionCard";
import { apiFetch } from "@/lib/auth/api-fetch";
import type { DraftedAction } from "@/types/scout";

interface DraftedActionContextValue {
  /** Show a DraftedActionCard modal for the user to review and confirm */
  showDraftCard: (action: DraftedAction, onSuccess?: () => void) => void;
}

const DraftedActionContext = createContext<DraftedActionContextValue | null>(null);

export function useDraftedAction() {
  const ctx = useContext(DraftedActionContext);
  if (!ctx) throw new Error("useDraftedAction must be used inside DraftedActionProvider");
  return ctx;
}

/** Helper to create a DraftedAction with defaults */
export function buildDraftedAction(
  type: DraftedAction["type"],
  contactId: string,
  contactName: string,
  payload: DraftedAction["payload"]
): DraftedAction {
  return {
    id: crypto.randomUUID(),
    type,
    status: "pending",
    contactId,
    contactName,
    payload,
  };
}

export default function DraftedActionProvider({ children }: { children: React.ReactNode }) {
  const [activeAction, setActiveAction] = useState<DraftedAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCallback, setSuccessCallback] = useState<(() => void) | null>(null);
  useScrollLock(!!activeAction);

  const showDraftCard = useCallback((action: DraftedAction, onSuccess?: () => void) => {
    setActiveAction(action);
    setError(null);
    setSuccessCallback(() => onSuccess ?? null);
  }, []);

  async function handleConfirm(action: DraftedAction) {
    setExecuting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/scout/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId: "direct-action" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to execute action");
      }

      setActiveAction((prev) => (prev ? { ...prev, status: "confirmed" as const } : null));

      successCallback?.();

      // Auto-dismiss after a brief delay
      setTimeout(() => setActiveAction(null), 1200);
    } catch (err) {
      // Surface the failure in the card instead of swallowing it — a silent
      // console.error is why "it doesn't save" looked like nothing happened.
      console.error("Action failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      // Keep the card open so the user can see the reason and retry.
    } finally {
      setExecuting(false);
    }
  }

  function handleCancel() {
    setError(null);
    setActiveAction((prev) => (prev ? { ...prev, status: "cancelled" as const } : null));
    setTimeout(() => setActiveAction(null), 400);
  }

  return (
    <DraftedActionContext.Provider value={{ showDraftCard }}>
      {children}

      {/* Modal overlay */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !executing && handleCancel()} />
          <div className="relative w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-200">
            <DraftedActionCard
              action={activeAction}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              isExecuting={executing}
              error={error}
            />
          </div>
        </div>
      )}
    </DraftedActionContext.Provider>
  );
}
