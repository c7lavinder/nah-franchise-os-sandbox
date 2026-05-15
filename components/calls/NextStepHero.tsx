"use client";

// Prominent "Next Step" hero card shown above the call detail tabs.
// Shows coaching instructions — what the rep should do/say next to
// advance the prospect or franchisee. NOT action buttons.

import { Sparkles, Target, TrendingUp, GraduationCap, Rocket } from "lucide-react";

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
  callTypeSlug?: string | null;
  journeyStage?: string | null;
  contactName?: string | null;
  suggestedNextAction?: string | null;
  nextCallPrep?: string | null;
}

/**
 * Stage-aware fallback instructions when the AI doesn't provide a
 * suggested_next_action or next_call_prep.
 */
function getFallbackInstruction(
  callTypeSlug: string | null,
  journeyStage: string | null
): { instruction: string; context: string } | null {
  // Sales calls — push toward buying a franchise
  if (
    callTypeSlug === "intro_call" ||
    callTypeSlug === "matt_call" ||
    callTypeSlug === "sam_call" ||
    callTypeSlug === "mark_call" ||
    callTypeSlug === "matt_final_call" ||
    callTypeSlug === "fdd_review_call"
  ) {
    if (callTypeSlug === "intro_call") {
      return {
        instruction:
          "Schedule the next call in the Path to Ownership. Confirm they understand the franchise model, initial investment range, and timeline. Ask what questions came up since you last spoke.",
        context: "Sales — Intro Call",
      };
    }
    if (callTypeSlug === "matt_call") {
      return {
        instruction:
          "Walk through the business model deep-dive. Make sure they understand unit economics, territory size, and support structure. Gauge their commitment level and capital readiness.",
        context: "Sales — Matt Call",
      };
    }
    if (callTypeSlug === "sam_call") {
      return {
        instruction:
          "Cover operations and day-to-day reality. Address any concerns from the previous call. Confirm they have a clear picture of what running a territory looks like.",
        context: "Sales — Sam Call",
      };
    }
    if (callTypeSlug === "mark_call") {
      return {
        instruction:
          "Review financials, funding options (SBA, ROBS, cash), and ROI timeline. Make sure capital plan is realistic. Address any remaining objections before FDD review.",
        context: "Sales — Mark Call",
      };
    }
    if (callTypeSlug === "fdd_review_call") {
      return {
        instruction:
          "Walk through the FDD key sections. Confirm they've had time to review with their attorney. Push toward signing — set a specific date for the franchise agreement.",
        context: "Sales — FDD Review",
      };
    }
    if (callTypeSlug === "matt_final_call") {
      return {
        instruction:
          "Final decision call. Confirm their territory selection, funding plan, and start date. Handle any last objections and close the deal.",
        context: "Sales — Final Call",
      };
    }
  }

  // Follow-up (prospect went cold or needs nurturing)
  if (journeyStage?.toLowerCase().includes("follow")) {
    return {
      instruction:
        "Re-engage the prospect. Reference their original interest and what excited them about NAH. Find out what changed and whether timing, capital, or something else is the blocker. Set a specific follow-up date.",
      context: "Follow-up",
    };
  }

  // Onboarding calls — get them through onboarding
  if (callTypeSlug === "onboarding_call" || journeyStage?.toLowerCase().includes("onboard")) {
    return {
      instruction:
        "Review their onboarding checklist progress. Identify any blockers or tasks they're stuck on. Set clear deadlines for remaining items and make sure they know who to contact for help.",
      context: "Onboarding",
    };
  }

  // Coaching / Running — get them buying more houses
  if (callTypeSlug === "coaching_call" || journeyStage?.toLowerCase().includes("running")) {
    return {
      instruction:
        "Review their deal pipeline and marketing activity. Identify what's working and what's not. Set a specific goal for deals in the next 30 days and the actions needed to hit it.",
      context: "Coaching — Running",
    };
  }

  return null;
}

function getIcon(callTypeSlug: string | null, journeyStage: string | null) {
  if (callTypeSlug === "coaching_call" || journeyStage?.toLowerCase().includes("running")) return TrendingUp;
  if (callTypeSlug === "onboarding_call" || journeyStage?.toLowerCase().includes("onboard")) return GraduationCap;
  if (journeyStage?.toLowerCase().includes("follow")) return Rocket;
  return Target;
}

export default function NextStepHero({
  actionItems,
  suggestedNextAction,
  nextCallPrep,
  callTypeSlug,
  journeyStage,
  contactName,
}: NextStepHeroProps) {
  // Primary instruction: AI-generated suggested_next_action > next_call_prep > fallback
  const aiInstruction = suggestedNextAction || nextCallPrep || null;
  const fallback = getFallbackInstruction(callTypeSlug ?? null, journeyStage ?? null);
  const instruction = aiInstruction || fallback?.instruction || null;

  // Don't show if there's nothing to say and no pending action items
  if (!instruction && actionItems.filter((a) => a.status === "pending").length === 0) return null;
  if (!instruction) return null;

  const isAI = !!aiInstruction;
  const contextLabel =
    fallback?.context || (callTypeSlug?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Next Step");
  const Icon = getIcon(callTypeSlug ?? null, journeyStage ?? null);

  const pendingCount = actionItems.filter((a) => a.status === "pending").length;

  return (
    <div className="bg-gradient-to-r from-nah-blue-light to-bg-secondary border border-nah-blue-mid rounded-xl px-5 py-4 mb-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-nah-blue text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <Icon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-overline text-nah-blue font-semibold tracking-wider">
              {contactName ? `WHAT TO DO NEXT WITH ${contactName.toUpperCase()}` : "WHAT TO DO NEXT"}
            </span>
            {isAI && (
              <span className="inline-flex items-center gap-1 text-[10px] text-scout-purple">
                <Sparkles size={9} /> Scout
              </span>
            )}
          </div>

          <p className="text-body-sm text-text-primary leading-relaxed">{instruction}</p>

          {!isAI && fallback && (
            <p className="text-caption text-text-tertiary mt-1.5 italic">{fallback.context} stage guidance</p>
          )}

          {pendingCount > 0 && (
            <p className="text-caption text-text-tertiary mt-2">
              {pendingCount} action item{pendingCount === 1 ? "" : "s"} in the Next Steps tab ready to push.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
