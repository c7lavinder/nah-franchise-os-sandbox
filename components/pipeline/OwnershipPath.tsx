"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

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
 *  Wave-style flow: warm coral → peach-orange → golden → yellow-green → fresh green
 *  Each circle blends into the next for a smooth gradient wave across the row.
 */
const STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  // Sales (6 stages — tight wave)
  engagement:    { icon: Users,          gradient: "from-[#e87461] to-[#e8956a]" },
  qualification: { icon: Search,         gradient: "from-[#e8956a] to-[#e8b468]" },
  discovery:     { icon: Phone,          gradient: "from-[#e8b468] to-[#d4c456]" },
  compliance:    { icon: Shield,         gradient: "from-[#d4c456] to-[#a8c94a]" },
  awarding:      { icon: Award,          gradient: "from-[#a8c94a] to-[#6dba5e]" },
  closed:        { icon: Trophy,         gradient: "from-[#6dba5e] to-[#4aad6b]" },
  // Onboarding (4 stages — wider wave steps)
  setup:         { icon: Settings,       gradient: "from-[#e87461] to-[#e8956a]" },
  training:      { icon: BookOpen,       gradient: "from-[#e8a065] to-[#d4b855]" },
  "launch-prep": { icon: Rocket,         gradient: "from-[#c4c44e] to-[#8ec758]" },
  onboarded:     { icon: CheckCircle2,   gradient: "from-[#6dba5e] to-[#4aad6b]" },
  // Runway (4 stages)
  "first-offer":        { icon: Search,  gradient: "from-[#e87461] to-[#e8956a]" },
  "first-purchase":     { icon: Award,   gradient: "from-[#e8a065] to-[#d4b855]" },
  "inventory-building": { icon: Rocket,  gradient: "from-[#c4c44e] to-[#8ec758]" },
  running:              { icon: Trophy,  gradient: "from-[#6dba5e] to-[#4aad6b]" },
  // Territories (3 stages: Inactive → Available → Active)
  inactive:  { icon: UserMinus,    gradient: "from-[#e87461] to-[#e8956a]" },
  available: { icon: UserPlus,     gradient: "from-[#d4b855] to-[#b8c84e]" },
  active:    { icon: CheckCircle2, gradient: "from-[#6dba5e] to-[#4aad6b]" },
  // Follow-up (3 stages: Nurture → Follow-up → Re-engaged)
  nurture:   { icon: UserMinus,      gradient: "from-[#e87461] to-[#e8956a]" },
  followup:  { icon: PhoneForwarded, gradient: "from-[#d4b855] to-[#b8c84e]" },
  reengaged: { icon: UserPlus,       gradient: "from-[#6dba5e] to-[#4aad6b]" },
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
      const res = await apiFetch("/api/pipeline/stages");
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
