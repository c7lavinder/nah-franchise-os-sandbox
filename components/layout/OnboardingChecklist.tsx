"use client";

/**
 * OnboardingChecklist — guides new team members through first-time setup.
 * Shows on first login, persists completion state in localStorage.
 * Dismissible and non-blocking.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, X, Sparkles, ChevronRight } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  route: string;
  checkKey: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "scout",
    label: "Meet Scout AI",
    description: "Ask Scout a question — try 'Who should I call today?'",
    route: "/scout",
    checkKey: "onboard_scout",
  },
  {
    id: "pipeline",
    label: "Explore the Pipeline",
    description: "See where every prospect stands in the sales process",
    route: "/pipeline",
    checkKey: "onboard_pipeline",
  },
  {
    id: "dashboard",
    label: "Check the Dashboard",
    description: "See pipeline health, rep performance, and lead sources",
    route: "/dashboard",
    checkKey: "onboard_dashboard",
  },
  {
    id: "knowledge",
    label: "Browse the Knowledge Base",
    description: "Playbooks, objection handling, and franchise operations",
    route: "/knowledge",
    checkKey: "onboard_knowledge",
  },
  {
    id: "calls",
    label: "Review a Call",
    description: "See AI-graded calls with coaching feedback and next steps",
    route: "/calls",
    checkKey: "onboard_calls",
  },
];

const STORAGE_KEY = "nah_onboarding_state";
const DISMISSED_KEY = "nah_onboarding_dismissed";

interface OnboardingState {
  [key: string]: boolean;
}

export default function OnboardingChecklist() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>({});
  const [dismissed, setDismissed] = useState(true); // Default hidden until we check
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    const isDismissed = localStorage.getItem(DISMISSED_KEY);

    if (isDismissed === "true") {
      setDismissed(true);
      return;
    }

    setState(saved ? JSON.parse(saved) : {});
    setDismissed(false);
  }, []);

  if (!mounted || dismissed) return null;

  const completedCount = CHECKLIST_ITEMS.filter((item) => state[item.checkKey]).length;
  const allComplete = completedCount === CHECKLIST_ITEMS.length;

  function markComplete(checkKey: string) {
    const next = { ...state, [checkKey]: true };
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function handleItemClick(item: ChecklistItem) {
    markComplete(item.checkKey);
    router.push(item.route);
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "true");
  }

  if (allComplete) {
    // Show completion state briefly, then auto-dismiss
    setTimeout(() => handleDismiss(), 3000);
  }

  return (
    <div className="mb-6 rounded-xl border border-purple-800/30 bg-purple-900/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">{allComplete ? "You're all set!" : "Get Started"}</h3>
          <span className="text-xs text-zinc-400">
            {completedCount}/{CHECKLIST_ITEMS.length}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss onboarding"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-zinc-800 mb-3">
        <div
          className="h-1 rounded-full bg-purple-500 transition-all duration-500"
          style={{ width: `${(completedCount / CHECKLIST_ITEMS.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {CHECKLIST_ITEMS.map((item) => {
          const done = state[item.checkKey];
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                done ? "opacity-60" : "hover:bg-purple-900/20"
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
              ) : (
                <Circle className="h-4 w-4 flex-shrink-0 text-zinc-600" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? "text-zinc-500 line-through" : "text-white"}`}>{item.label}</p>
                <p className="text-xs text-zinc-500 truncate">{item.description}</p>
              </div>
              {!done && <ChevronRight className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
