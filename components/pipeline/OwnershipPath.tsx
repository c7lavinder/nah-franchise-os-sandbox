"use client";

/**
 * OwnershipPath — unified pipeline visualization.
 *
 * All pipelines use the same 11-column grid so circles align
 * and spacing is symmetrical regardless of stage count.
 * Shorter pipelines start from the left and leave empty columns.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Users, Phone, Award, UserCheck, Video, Shield, FileText, FileCheck,
  DollarSign, Handshake, Trophy, GraduationCap, BookOpen, Target,
  Lightbulb, Home, CheckCircle2, Star, AlertTriangle, Rocket,
} from "lucide-react";
import type { GHLOpportunity } from "@/types/ghl";
import type { UserRole } from "@/types/database";
import type { OnboardingEnrollment } from "@/lib/intelligence/onboarding";
import { ONBOARDING_STAGES, COACHING_STAGES } from "@/lib/intelligence/onboarding";

interface StageData {
  id: string;
  name: string;
  position: number;
  opportunities: GHLOpportunity[];
}

interface PipelineData {
  id: string;
  name: string;
  stages: StageData[];
}

interface OwnershipPathProps {
  pipelines: PipelineData[];
  selectedStage: string | null;
  onStageClick: (stageId: string, stageName: string) => void;
  userRole?: UserRole;
}

/** Unified stage definition for rendering */
interface UnifiedStage {
  key: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  label: string;
  count: number;
  isSelected: boolean;
  onClick?: () => void;
}

// ═══════════════════════════════════════
// Stage metadata
// ═══════════════════════════════════════

const ACTIVE_STAGES: { name: string; icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string; label: string }[] = [
  { name: "New Lead",                    icon: Users,      gradient: "from-blue-500 to-blue-600",     label: "New Lead" },
  { name: "Contacted",                   icon: Phone,      gradient: "from-blue-400 to-indigo-500",   label: "Contacted" },
  { name: "Qualified",                   icon: Award,      gradient: "from-indigo-500 to-purple-500", label: "Qualified" },
  { name: "Matt Call (Discovery)",       icon: Video,      gradient: "from-purple-500 to-purple-600", label: "Matt Call" },
  { name: "Sam Call (Validation)",       icon: UserCheck,  gradient: "from-purple-600 to-violet-600", label: "Sam Call" },
  { name: "Compliance Gate",             icon: Shield,     gradient: "from-violet-600 to-fuchsia-500",label: "Compliance" },
  { name: "Application + Approval",      icon: FileText,   gradient: "from-fuchsia-500 to-pink-500", label: "Application" },
  { name: "FDD Issued",                  icon: FileCheck,  gradient: "from-pink-500 to-orange-500",  label: "FDD Issued" },
  { name: "Mark Call (Capital/Lending)", icon: DollarSign, gradient: "from-orange-500 to-amber-500",  label: "Mark Call" },
  { name: "Award + Agreement",           icon: Handshake,  gradient: "from-amber-500 to-yellow-500", label: "Award" },
  { name: "Funds Received",              icon: Trophy,     gradient: "from-yellow-500 to-green-500",  label: "Won!" },
];

const LONGTERM_STAGES: { name: string; icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string; label: string }[] = [
  { name: "Follow-up",  icon: Phone, gradient: "from-sky-500 to-sky-600",  label: "Follow-up" },
  { name: "Nurture",    icon: Users, gradient: "from-sky-600 to-cyan-600", label: "Nurture" },
  { name: "Re-engaged", icon: Award, gradient: "from-cyan-500 to-teal-500",label: "Re-engaged" },
];

const ONBOARDING_ICONS: React.ComponentType<{ size?: number; className?: string }>[] = [
  GraduationCap, BookOpen, Target, Lightbulb, FileText, Home, CheckCircle2,
];
const ONBOARDING_GRADIENTS = [
  "from-emerald-400 to-emerald-500", "from-emerald-500 to-teal-500",
  "from-teal-500 to-cyan-500", "from-cyan-500 to-blue-500",
  "from-blue-500 to-indigo-500", "from-indigo-500 to-purple-500",
  "from-purple-500 to-green-500",
];

const COACHING_ICONS: React.ComponentType<{ size?: number; className?: string }>[] = [
  Star, Users, Target, Trophy, AlertTriangle, Rocket,
];
const COACHING_GRADIENTS = [
  "from-amber-400 to-amber-500", "from-amber-500 to-orange-500",
  "from-orange-500 to-red-500", "from-red-500 to-pink-500",
  "from-pink-500 to-rose-500", "from-rose-500 to-green-500",
];

/** Max columns — all pipelines use this grid */
const MAX_COLS = 11;

export default function OwnershipPath({ pipelines, selectedStage, onStageClick, userRole }: OwnershipPathProps) {
  const activePipeline = pipelines.find((p) => p.name.includes("Active"));
  const longTermPipeline = pipelines.find((p) => p.name.includes("Long-Term"));
  const showPostClose = userRole === "leadership";

  // Build unified stage arrays
  const activeStages: UnifiedStage[] = activePipeline
    ? ACTIVE_STAGES.map((meta) => {
        const stage = activePipeline.stages.find((s) => s.name === meta.name);
        return {
          key: stage?.id ?? meta.name,
          icon: meta.icon,
          gradient: meta.gradient,
          label: meta.label,
          count: stage?.opportunities.length ?? 0,
          isSelected: selectedStage === stage?.id,
          onClick: stage ? () => onStageClick(stage.id, stage.name) : undefined,
        };
      })
    : [];

  const longTermStageData: UnifiedStage[] = longTermPipeline
    ? LONGTERM_STAGES.map((meta) => {
        const stage = longTermPipeline.stages.find((s) => s.name === meta.name);
        return {
          key: stage?.id ?? meta.name,
          icon: meta.icon,
          gradient: meta.gradient,
          label: meta.label,
          count: stage?.opportunities.length ?? 0,
          isSelected: selectedStage === stage?.id,
          onClick: stage ? () => onStageClick(stage.id, stage.name) : undefined,
        };
      })
    : [];

  return (
    <div className="mb-8 space-y-6">
      {/* Path to Ownership — 11 stages */}
      {activeStages.length > 0 && (
        <PipelineRow
          title="PATH TO OWNERSHIP"
          stages={activeStages}
          totalColumns={MAX_COLS}
        />
      )}

      {/* Long-Term — 3 stages */}
      {longTermStageData.length > 0 && (
        <PipelineRow
          title="LONG-TERM"
          stages={longTermStageData}
          totalColumns={MAX_COLS}
        />
      )}

      {/* Post-Close — Leadership only */}
      {showPostClose && (
        <PostClosePipelines totalColumns={MAX_COLS} />
      )}
    </div>
  );
}

/** Renders a single pipeline row with stages aligned to the grid */
function PipelineRow({
  title,
  stages,
  totalColumns,
}: {
  title: string;
  stages: UnifiedStage[];
  totalColumns: number;
}) {
  return (
    <div>
      <h2 className="text-overline text-text-tertiary tracking-wider mb-4">
        {title}
      </h2>
      <div className="relative">
        {/* Connection line — spans across filled columns */}
        {stages.length > 1 && (
          <div
            className="absolute top-7 h-0.5 bg-bg-tertiary rounded-full hidden lg:block"
            style={{
              left: "2rem",
              width: `calc(${(stages.length / totalColumns) * 100}% - 4rem)`,
            }}
          />
        )}

        {/* Grid — always totalColumns wide for alignment */}
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))` }}
        >
          {stages.map((stage) => (
            <StageCircle key={stage.key} stage={stage} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Single stage circle — consistent size across all pipelines */
function StageCircle({ stage }: { stage: UnifiedStage }) {
  return (
    <button
      onClick={stage.onClick}
      disabled={!stage.onClick}
      className={`
        relative flex flex-col items-center text-center group
        transition-all duration-200
        ${stage.isSelected ? "scale-110" : stage.onClick ? "hover:scale-105" : ""}
      `}
    >
      {/* Circle */}
      <div
        className={`
          w-14 h-14 rounded-full flex items-center justify-center mb-1.5
          bg-gradient-to-br ${stage.gradient}
          ${stage.isSelected ? "ring-2 ring-nah-blue ring-offset-2 ring-offset-bg-primary" : ""}
          ${stage.count === 0 ? "opacity-35" : "opacity-100"}
          shadow-lg group-hover:shadow-xl transition-shadow
        `}
      >
        <stage.icon size={20} className="text-white" />
      </div>

      {/* Count badge */}
      {stage.count > 0 && (
        <span className={`
          absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full
          text-caption font-bold flex items-center justify-center
          ${stage.isSelected
            ? "bg-nah-blue text-white"
            : "bg-bg-tertiary text-text-primary border border-border-default"
          }
        `}>
          {stage.count}
        </span>
      )}

      {/* Label */}
      <span className={`
        text-caption leading-tight max-w-[72px]
        ${stage.isSelected ? "text-nah-blue font-medium" : "text-text-tertiary"}
      `}>
        {stage.label}
      </span>
    </button>
  );
}

/** Post-close pipelines: Onboarding + Coaching */
function PostClosePipelines({ totalColumns }: { totalColumns: number }) {
  const [enrollments, setEnrollments] = useState<OnboardingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence/onboarding");
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.enrollments ?? []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchEnrollments();
  }, [fetchEnrollments]);

  const onboarding = enrollments.filter((e) => e.pipeline_type === "onboarding");
  const coaching = enrollments.filter((e) => e.pipeline_type === "coaching");

  if (loading) {
    return <div className="h-20 bg-bg-secondary border border-border-default rounded-lg animate-pulse mt-6" />;
  }

  const onboardingStages: UnifiedStage[] = ONBOARDING_STAGES.map((s, i) => ({
    key: `onb-${s.number}`,
    icon: ONBOARDING_ICONS[i],
    gradient: ONBOARDING_GRADIENTS[i],
    label: s.name,
    count: onboarding.filter((e) => e.current_stage === s.number).length,
    isSelected: false,
  }));

  const coachingStages: UnifiedStage[] = COACHING_STAGES.map((s, i) => ({
    key: `coach-${s.number}`,
    icon: COACHING_ICONS[i],
    gradient: COACHING_GRADIENTS[i],
    label: s.name,
    count: coaching.filter((e) => e.current_stage === s.number).length,
    isSelected: false,
  }));

  return (
    <>
      <PipelineRow
        title={`ONBOARDING (${onboarding.length})`}
        stages={onboardingStages}
        totalColumns={totalColumns}
      />

      <PipelineRow
        title={`COACHING (${coaching.length})`}
        stages={coachingStages}
        totalColumns={totalColumns}
      />
    </>
  );
}
