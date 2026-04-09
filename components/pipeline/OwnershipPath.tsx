"use client";

/**
 * OwnershipPath — pipeline visualization for Sales + Follow-up.
 *
 * Sprint 3 rewire: pulls stage data from Supabase via /api/pipeline/stages
 * instead of from GHL. Shows the locked 6-stage Sales pipeline (§1.4)
 * and 3-stage Follow-up pipeline (§1.9).
 *
 * Onboarding + Coaching rows hidden per master plan §1.12 — deferred sprint.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users, Phone, Search, Shield, Award, Trophy,
  PhoneForwarded, UserMinus, UserPlus,
  Settings, BookOpen, Rocket, CheckCircle2,
} from "lucide-react";

/** Stage metadata: slug → icon + gradient */
const SALES_STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  engagement:    { icon: Users,  gradient: "from-blue-500 to-blue-600" },
  qualification: { icon: Search, gradient: "from-indigo-500 to-purple-500" },
  discovery:     { icon: Phone,  gradient: "from-purple-500 to-violet-600" },
  compliance:    { icon: Shield, gradient: "from-violet-600 to-fuchsia-500" },
  awarding:      { icon: Award,  gradient: "from-amber-500 to-yellow-500" },
  closed:        { icon: Trophy, gradient: "from-yellow-500 to-green-500" },
};

const FOLLOWUP_STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  followup:  { icon: PhoneForwarded, gradient: "from-sky-500 to-sky-600" },
  nurture:   { icon: UserMinus,      gradient: "from-sky-600 to-cyan-600" },
  reengaged: { icon: UserPlus,       gradient: "from-cyan-500 to-teal-500" },
};

const ONBOARDING_STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  setup:       { icon: Settings,      gradient: "from-emerald-500 to-emerald-600" },
  training:    { icon: BookOpen,      gradient: "from-emerald-600 to-green-500" },
  "launch-prep": { icon: Rocket,     gradient: "from-green-500 to-lime-500" },
  onboarded:   { icon: CheckCircle2,  gradient: "from-lime-500 to-yellow-400" },
};

const RUNWAY_STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  "first-offer":        { icon: Search,       gradient: "from-orange-500 to-orange-600" },
  "first-purchase":     { icon: Award,        gradient: "from-orange-600 to-amber-500" },
  "inventory-building": { icon: Rocket,       gradient: "from-amber-500 to-yellow-500" },
  running:              { icon: Trophy,        gradient: "from-yellow-500 to-green-500" },
};

const TERRITORIES_STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }> = {
  active:    { icon: CheckCircle2, gradient: "from-green-500 to-green-600" },
  inactive:  { icon: UserMinus,    gradient: "from-gray-400 to-gray-500" },
  available: { icon: UserPlus,     gradient: "from-blue-500 to-blue-600" },
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
  onStageClick: (stageId: string, stageName: string) => void;
}

export default function OwnershipPath({ selectedStage, onStageClick }: OwnershipPathProps) {
  const [pipelines, setPipelines] = useState<PipelineAPI[]>([]);
  const [loading, setLoading] = useState(true);

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

  const salesPipeline = pipelines.find((p) => p.slug === "sales");
  const onboardingPipeline = pipelines.find((p) => p.slug === "onboarding");
  const runwayPipeline = pipelines.find((p) => p.slug === "runway");
  const territoriesPipeline = pipelines.find((p) => p.slug === "territories");
  const followupPipeline = pipelines.find((p) => p.slug === "followup");

  if (loading) {
    return (
      <div className="mb-8 space-y-4">
        <div className="h-24 bg-bg-secondary border border-border-default rounded-lg animate-pulse" />
        <div className="h-24 bg-bg-secondary border border-border-default rounded-lg animate-pulse" />
      </div>
    );
  }

  // Reorder Follow-up stages: Nurture → Follow-up → Re-engaged (display only)
  const followupDisplayOrder = ["nurture", "followup", "reengaged"];
  const reorderedFollowup = followupPipeline
    ? [...followupPipeline.stages].sort(
        (a, b) => followupDisplayOrder.indexOf(a.slug) - followupDisplayOrder.indexOf(b.slug)
      )
    : [];

  return (
    <div className="mb-8 space-y-6">
      {/* Sales Pipeline — 6 stages per §1.4 */}
      {salesPipeline && (
        <PipelineRow
          title="PATH TO OWNERSHIP"
          stages={salesPipeline.stages}
          metaMap={SALES_STAGE_META}
          selectedStage={selectedStage}
          onStageClick={onStageClick}
        />
      )}

      {/* Onboarding Pipeline — 4 stages */}
      {onboardingPipeline && (
        <PipelineRow
          title="ONBOARDING"
          stages={onboardingPipeline.stages}
          metaMap={ONBOARDING_STAGE_META}
          selectedStage={selectedStage}
          onStageClick={onStageClick}
        />
      )}

      {/* Runway Pipeline — 4 stages */}
      {runwayPipeline && (
        <PipelineRow
          title="RUNWAY"
          stages={runwayPipeline.stages}
          metaMap={RUNWAY_STAGE_META}
          selectedStage={selectedStage}
          onStageClick={onStageClick}
        />
      )}

      {/* Territories Pipeline — 3 stages */}
      {territoriesPipeline && (
        <PipelineRow
          title="TERRITORIES"
          stages={territoriesPipeline.stages}
          metaMap={TERRITORIES_STAGE_META}
          selectedStage={selectedStage}
          onStageClick={onStageClick}
        />
      )}

      {/* Follow-up Pipeline — 3 stages, display: Nurture → Follow-up → Re-engaged */}
      {followupPipeline && (
        <PipelineRow
          title="LONG-TERM"
          stages={reorderedFollowup}
          metaMap={FOLLOWUP_STAGE_META}
          selectedStage={selectedStage}
          onStageClick={onStageClick}
        />
      )}
    </div>
  );
}

function PipelineRow({
  title,
  stages,
  metaMap,
  selectedStage,
  onStageClick,
}: {
  title: string;
  stages: StageAPI[];
  metaMap: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }>;
  selectedStage: string | null;
  onStageClick: (stageId: string, stageName: string) => void;
}) {
  const totalCount = stages.reduce((sum, s) => sum + s.active_count, 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-overline text-text-tertiary tracking-wider">{title}</h2>
        <span className="text-caption text-text-tertiary">({totalCount})</span>
      </div>
      <div className="relative">
        {/* Connection line */}
        {stages.length > 1 && (
          <div
            className="absolute top-7 h-0.5 bg-bg-tertiary rounded-full hidden lg:block"
            style={{ left: "2rem", width: `calc(100% - 4rem)` }}
          />
        )}

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
        >
          {stages.map((stage) => {
            const meta = metaMap[stage.slug] ?? { icon: Users, gradient: "from-gray-400 to-gray-500" };
            const isSelected = selectedStage === stage.id;

            return (
              <button
                key={stage.id}
                onClick={() => onStageClick(stage.id, stage.name)}
                className={`
                  relative flex flex-col items-center text-center group transition-all duration-200
                  ${isSelected ? "scale-110" : "hover:scale-105"}
                `}
              >
                {/* Circle */}
                <div
                  className={`
                    w-14 h-14 rounded-full flex items-center justify-center mb-1.5
                    bg-gradient-to-br ${meta.gradient}
                    ${isSelected ? "ring-2 ring-nah-blue ring-offset-2 ring-offset-bg-primary" : ""}
                    ${stage.active_count === 0 ? "opacity-35" : "opacity-100"}
                    shadow-lg group-hover:shadow-xl transition-shadow
                  `}
                >
                  <meta.icon size={20} className="text-white" />
                </div>

                {/* Count pill badge — centered above circle */}
                {stage.active_count > 0 && (
                  <span className={`
                    absolute -top-2 left-1/2 -translate-x-1/2 min-w-[20px] h-5 px-1.5 rounded-full
                    text-[10px] font-bold flex items-center justify-center
                    ${isSelected
                      ? "bg-nah-blue text-white"
                      : "bg-text-primary/90 text-white"
                    }
                  `}>
                    {stage.active_count}
                  </span>
                )}

                {/* Label */}
                <span className={`
                  text-caption leading-tight max-w-[72px]
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
  );
}
