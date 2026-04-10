"use client";

/**
 * OwnershipPath — pipeline visualization for all pipelines.
 *
 * Features:
 * - Smaller circles, symmetrical columns (all rows use same grid)
 * - Collapsible rows with localStorage persistence
 * - Stage click filters the lead list below
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users, Phone, Search, Shield, Award, Trophy,
  PhoneForwarded, UserMinus, UserPlus,
  Settings, BookOpen, Rocket, CheckCircle2,
  ChevronDown, ChevronRight,
} from "lucide-react";

/** Stage metadata: slug → icon + gradient
 *  Color scheme: red (left/early) → orange → yellow → green (right/complete)
 *  Applied consistently across all pipelines.
 */
const STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  // Sales (6 stages: red → orange → amber → yellow → lime → green)
  engagement:    { icon: Users,          gradient: "from-red-500 to-red-600" },
  qualification: { icon: Search,         gradient: "from-orange-500 to-orange-600" },
  discovery:     { icon: Phone,          gradient: "from-amber-500 to-amber-600" },
  compliance:    { icon: Shield,         gradient: "from-yellow-500 to-yellow-600" },
  awarding:      { icon: Award,          gradient: "from-lime-500 to-lime-600" },
  closed:        { icon: Trophy,         gradient: "from-green-500 to-green-600" },
  // Onboarding (4 stages: red → orange → yellow → green)
  setup:         { icon: Settings,       gradient: "from-red-500 to-red-600" },
  training:      { icon: BookOpen,       gradient: "from-orange-500 to-orange-600" },
  "launch-prep": { icon: Rocket,         gradient: "from-yellow-500 to-yellow-600" },
  onboarded:     { icon: CheckCircle2,   gradient: "from-green-500 to-green-600" },
  // Runway (4 stages: red → orange → yellow → green)
  "first-offer":        { icon: Search,  gradient: "from-red-500 to-red-600" },
  "first-purchase":     { icon: Award,   gradient: "from-orange-500 to-orange-600" },
  "inventory-building": { icon: Rocket,  gradient: "from-yellow-500 to-yellow-600" },
  running:              { icon: Trophy,  gradient: "from-green-500 to-green-600" },
  // Territories (3 stages: red → yellow → green)  Order: Inactive → Available → Active
  inactive:  { icon: UserMinus,    gradient: "from-red-500 to-red-600" },
  available: { icon: UserPlus,     gradient: "from-yellow-500 to-yellow-600" },
  active:    { icon: CheckCircle2, gradient: "from-green-500 to-green-600" },
  // Follow-up (3 stages: red → yellow → green)  Order: Nurture → Follow-up → Re-engaged
  nurture:   { icon: UserMinus,      gradient: "from-red-500 to-red-600" },
  followup:  { icon: PhoneForwarded, gradient: "from-yellow-500 to-yellow-600" },
  reengaged: { icon: UserPlus,       gradient: "from-green-500 to-green-600" },
};

interface StageAPI {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_terminal: boolean;
  active_count: number;
}

interface PipelineAPI {
  id: string;
  slug: string;
  name: string;
  stages: StageAPI[];
}

interface OwnershipPathProps {
  selectedStage: string | null;
  onStageClick: (stageId: string, stageName: string, pipelineSlug: string) => void;
}

const STORAGE_KEY = "nah-pipeline-expanded";
const MAX_COLS = 6; // Sales has 6 — all rows align to this grid

/** Stores which pipelines are EXPANDED. Default (no entry) = collapsed. */
function getExpandedState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveExpandedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* silent */ }
}

const PIPELINE_ORDER = ["sales", "onboarding", "runway", "territories", "followup"];
const PIPELINE_TITLES: Record<string, string> = {
  sales: "PATH TO OWNERSHIP",
  onboarding: "ONBOARDING",
  runway: "RUNWAY",
  territories: "TERRITORIES",
  followup: "LONG-TERM",
};

export default function OwnershipPath({ selectedStage, onStageClick }: OwnershipPathProps) {
  const [pipelines, setPipelines] = useState<PipelineAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(getExpandedState);

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/stages");
      if (res.ok) {
        const data = await res.json();
        setPipelines(data.pipelines ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchStages();
  }, [fetchStages]);

  function toggleExpanded(slug: string) {
    const next = { ...expanded, [slug]: !expanded[slug] };
    setExpanded(next);
    saveExpandedState(next);
  }

  if (loading) {
    return (
      <div className="mb-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 bg-bg-secondary border border-border-default rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Order pipelines
  const ordered = PIPELINE_ORDER
    .map((slug) => pipelines.find((p) => p.slug === slug))
    .filter((p): p is PipelineAPI => !!p);

  return (
    <div className="mb-6 space-y-2">
      {ordered.map((pipeline) => {
        const title = PIPELINE_TITLES[pipeline.slug] ?? pipeline.name.toUpperCase();
        const totalCount = pipeline.stages.reduce((sum, s) => sum + s.active_count, 0);
        const isExpanded = expanded[pipeline.slug] ?? false;

        return (
          <div key={pipeline.id} className="border border-border-default rounded-lg overflow-hidden">
            {/* Header — click to expand/collapse */}
            <button
              onClick={() => toggleExpanded(pipeline.slug)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-hover transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={12} className="text-text-tertiary flex-shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-text-tertiary flex-shrink-0" />
              )}
              <span className="text-[10px] font-semibold text-text-tertiary tracking-wider">{title}</span>
              <span className="text-[10px] text-text-tertiary">({totalCount})</span>
            </button>

            {/* Stage circles */}
            {isExpanded && (
              <div className="px-3 py-3">
                <div className="relative">
                  {/* Connection line */}
                  {pipeline.stages.length > 1 && (
                    <div
                      className="absolute top-5 h-0.5 bg-bg-tertiary rounded-full hidden sm:block"
                      style={{
                        left: `calc(100% / ${MAX_COLS} / 2)`,
                        width: `calc(100% / ${MAX_COLS} * ${pipeline.stages.length - 1})`,
                      }}
                    />
                  )}

                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${MAX_COLS}, minmax(0, 1fr))` }}
                  >
                    {pipeline.stages.map((stage) => {
                      const meta = STAGE_META[stage.slug] ?? { icon: Users, gradient: "from-gray-400 to-gray-500" };
                      const isSelected = selectedStage === stage.id;
                      const Icon = meta.icon;

                      return (
                        <button
                          key={stage.id}
                          onClick={(e) => { e.stopPropagation(); onStageClick(stage.id, stage.name, pipeline.slug); }}
                          className={`
                            relative flex flex-col items-center text-center group transition-all duration-200
                            ${isSelected ? "scale-110" : "hover:scale-105"}
                          `}
                        >
                          {/* Circle — smaller */}
                          <div
                            className={`
                              w-10 h-10 rounded-full flex items-center justify-center mb-1
                              bg-gradient-to-br ${meta.gradient}
                              ${isSelected ? "ring-2 ring-nah-blue ring-offset-1 ring-offset-bg-primary" : ""}
                              ${stage.active_count === 0 ? "opacity-35" : "opacity-100"}
                              shadow-md group-hover:shadow-lg transition-shadow
                            `}
                          >
                            <Icon size={16} className="text-white" />
                          </div>

                          {/* Count badge */}
                          {stage.active_count > 0 && (
                            <span className={`
                              absolute -top-1.5 left-1/2 -translate-x-1/2 min-w-[18px] h-4 px-1 rounded-full
                              text-[9px] font-bold flex items-center justify-center
                              ${isSelected ? "bg-nah-blue text-white" : "bg-text-primary/90 text-white"}
                            `}>
                              {stage.active_count}
                            </span>
                          )}

                          {/* Label */}
                          <span className={`
                            text-[10px] leading-tight max-w-[64px]
                            ${isSelected ? "text-nah-blue font-medium" : "text-text-tertiary"}
                          `}>
                            {stage.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
