"use client";

/**
 * PendingConfirmations — shows queued SMS/email steps awaiting human approval.
 * Each card shows the recipient, message content, and approve/reject buttons.
 * This is the DRC (Draft-Review-Confirm) pattern in action.
 */

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Mail, Check, X, Clock, Send, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";

interface PendingStep {
  logId: string;
  stepId: string;
  enrollmentId: string;
  workflowId: string;
  workflowName: string;
  contactName: string | null;
  ghlContactId: string;
  currentDay: number;
  stepType: string;
  content: string | null;
  subject: string | null;
  sendTime: string | null;
  delayHours: number | null;
  senderName: string | null;
  senderEmail: string | null;
  fromNumber: string | null;
  queuedAt: string;
}

export default function PendingConfirmations() {
  const [steps, setSteps] = useState<PendingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await apiFetch("/api/workflows/pending-steps");
      if (res.ok) {
        const data = await res.json();
        setSteps(data.pendingSteps ?? []);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPending();
    const interval = setInterval(() => void fetchPending(), 30000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  async function handleAction(logId: string, action: "confirm" | "reject") {
    setActionInProgress(logId);
    try {
      const res = await apiFetch(`/api/workflows/pending-steps/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        // Remove from list
        setSteps((prev) => prev.filter((s) => s.logId !== logId));
      } else {
        const data = await res.json();
        console.error(`Failed to ${action} step:`, data.error);
      }
    } catch {
      /* silent */
    }
    setActionInProgress(null);
  }

  if (loading) return null;
  if (steps.length === 0) return null;

  return (
    <div className="mb-4 flex-shrink-0">
      <p className="text-label-caps text-text-tertiary mb-2">PENDING CONFIRMATIONS ({steps.length})</p>
      <div className="space-y-2">
        {steps.map((step) => {
          const isSms = step.stepType === "sms";
          const Icon = isSms ? MessageSquare : Mail;
          const isProcessing = actionInProgress === step.logId;
          const timeAgo = getTimeAgo(step.queuedAt);

          return (
            <div key={step.logId} className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              {/* Header: type + workflow + contact */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-warning/10 flex-shrink-0">
                  <Icon size={13} className="text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-medium text-text-primary truncate">
                      {step.contactName ?? step.ghlContactId}
                    </span>
                    <span className="text-caption text-text-tertiary">Day {step.currentDay}</span>
                  </div>
                  <span className="text-caption text-text-tertiary">{step.workflowName}</span>
                </div>
                <span className="text-caption text-text-tertiary flex items-center gap-1 flex-shrink-0">
                  <Clock size={10} /> {timeAgo}
                </span>
              </div>

              {/* FROM → TO */}
              <div className="flex items-center gap-1.5 mb-1.5 text-caption">
                <span className="font-medium text-text-primary">
                  {step.senderEmail
                    ? `${step.senderName ?? "NAH"} (${step.senderEmail})`
                    : step.fromNumber
                      ? `${step.senderName ?? "NAH"} (${step.fromNumber})`
                      : (step.senderName ?? "NAH")}
                </span>
                <Send size={10} className="text-text-tertiary" />
                <span className="text-text-secondary">{step.contactName ?? step.ghlContactId}</span>
                <span className="text-text-tertiary ml-1">
                  @ {step.delayHours === 0 ? "immediate" : `${step.delayHours ?? 0}h after lead`}
                </span>
              </div>

              {/* Subject (email only) */}
              {step.subject && (
                <p className="text-caption text-text-tertiary mb-1">
                  Subject: <span className="text-text-secondary">{step.subject}</span>
                </p>
              )}

              {/* Content preview */}
              {step.content && (
                <p className="text-body-sm text-text-secondary whitespace-pre-wrap mb-3 bg-bg-primary rounded-md px-3 py-2 border border-border-default">
                  {step.content}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleAction(step.logId, "confirm")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-white text-button hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Approve & Send
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleAction(step.logId, "reject")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-default text-text-secondary text-button hover:bg-bg-secondary transition-colors disabled:opacity-50"
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
