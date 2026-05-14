"use client";

// Prominent "Next Step" hero card shown above the call detail tabs.
// Matt's feedback: of all the things on the call page, knowing the correct
// next step matters most — pull the first pending action up out of the tab
// so it's visible without clicking.

import { useState } from "react";
import { apiFetch } from "@/lib/auth/api-fetch";
import {
  Send,
  CalendarPlus,
  ListChecks,
  FileText,
  Save,
  ArrowRightCircle,
  Mail,
  MessageSquare,
  Loader2,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface ActionItem {
  id: string;
  call_id: string;
  category: string;
  title: string;
  description: string | null;
  why: string | null;
  contact_name: string | null;
  source: string;
  status: string;
  metadata: Record<string, unknown> | null;
}

interface NextStepHeroProps {
  actionItems: ActionItem[];
  onAction: () => void;
  onJumpToTab?: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Send> = {
  comms: Send,
  task: ListChecks,
  apt: CalendarPlus,
  note: FileText,
  data: Save,
  pipeline: ArrowRightCircle,
};

const CTA_LABELS: Record<string, string> = {
  comms: "Send",
  task: "Create Task",
  apt: "Schedule",
  note: "Log Note",
  data: "Save to Profile",
  workflow: "Trigger",
  pipeline: "Move Stage",
};

const CTA_TOOLTIPS: Record<string, string> = {
  comms: "Sends this message through GoHighLevel right now. Open the Next Steps tab to review and edit content first.",
  task: "Creates this task in GoHighLevel — the assigned team member will see it in their task list.",
  apt: "Books this appointment in GoHighLevel and adds it to the calendar.",
  note: "Saves this note to the contact's record in GoHighLevel.",
  data: "Saves the extracted value to this contact's profile in NAH OS.",
  workflow: "Triggers this workflow in GoHighLevel.",
  pipeline: "Moves this contact to the next stage in the pipeline.",
};

export default function NextStepHero({ actionItems, onAction, onJumpToTab }: NextStepHeroProps) {
  const pending = actionItems.filter((a) => a.status === "pending");

  if (pending.length === 0) {
    if (actionItems.length === 0) return null;
    return (
      <div className="bg-bg-secondary border border-border-default rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
          <Check size={16} className="text-success" />
        </div>
        <div className="flex-1">
          <div className="text-overline text-text-tertiary">NEXT STEPS</div>
          <p className="text-body-sm text-text-secondary">All next steps from this call have been handled.</p>
        </div>
      </div>
    );
  }

  const next = pending[0];
  const remaining = pending.length - 1;
  const channel = (next.metadata?.comms_channel as string) ?? "sms";
  const Icon =
    next.category === "comms" ? (channel === "email" ? Mail : MessageSquare) : (CATEGORY_ICONS[next.category] ?? Check);
  const ctaLabel = CTA_LABELS[next.category] ?? "Push";
  const ctaTooltip = CTA_TOOLTIPS[next.category] ?? "Run this action.";

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePush() {
    setLoading("push");
    setError(null);
    try {
      const res = await apiFetch(`/api/calls/${next.call_id}/actions/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push", payload: {} }),
      });
      if (res.ok) {
        onAction();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Push failed. Open the Next Steps tab to edit details first.");
      }
    } catch {
      setError("Network error.");
    }
    setLoading(null);
  }

  async function handleSkip() {
    setLoading("skip");
    setError(null);
    try {
      const res = await apiFetch(`/api/calls/${next.call_id}/actions/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (res.ok) onAction();
    } catch {
      /* silent */
    }
    setLoading(null);
  }

  return (
    <div className="bg-gradient-to-r from-nah-blue-light to-bg-secondary border border-nah-blue-mid rounded-xl px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-nah-blue text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <Icon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-overline text-nah-blue font-semibold tracking-wider">NEXT STEP</span>
            {next.source === "scout" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-scout-purple">
                <Sparkles size={9} /> Scout
              </span>
            )}
            {remaining > 0 && onJumpToTab && (
              <button
                onClick={onJumpToTab}
                className="ml-auto text-caption text-text-tertiary hover:text-nah-blue inline-flex items-center gap-1"
              >
                +{remaining} more <ChevronRight size={12} />
              </button>
            )}
          </div>

          <h3 className="text-card-title text-text-primary leading-tight">{next.title}</h3>

          {next.description && (
            <p className="text-body-sm text-text-secondary mt-1.5 line-clamp-2">{next.description}</p>
          )}

          {next.contact_name && (
            <p className="text-caption text-text-tertiary mt-1.5">
              For <span className="font-medium text-text-secondary">{next.contact_name}</span>
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => void handlePush()}
              disabled={loading !== null}
              title={ctaTooltip}
              className="btn-primary px-3.5 py-1.5 text-caption flex items-center gap-1.5"
            >
              {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
              {ctaLabel}
            </button>
            {onJumpToTab && (
              <button
                onClick={onJumpToTab}
                className="btn-secondary px-3.5 py-1.5 text-caption"
                title="Open the Next Steps tab to edit content, change recipient, or see why Scout suggested this."
              >
                Edit details
              </button>
            )}
            <button
              onClick={() => void handleSkip()}
              disabled={loading !== null}
              className="text-caption text-text-tertiary hover:text-danger px-2 py-1.5"
              title="Dismiss this next step — it won't be taken."
            >
              Skip
            </button>
          </div>

          {error && <p className="text-caption text-danger mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
