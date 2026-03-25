"use client";

import { Users, Phone, Award, UserCheck, Video, Shield, FileText, FileCheck, DollarSign, Handshake, Trophy } from "lucide-react";
import type { GHLOpportunity } from "@/types/ghl";

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
}

/** Stage metadata for the path visualization */
const STAGE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string; step: number }> = {
  "New Lead":                     { icon: Users,     color: "from-blue-500 to-blue-600",     label: "New Lead",    step: 1 },
  "Contacted":                    { icon: Phone,     color: "from-blue-400 to-indigo-500",   label: "Contacted",   step: 2 },
  "Qualified":                    { icon: Award,     color: "from-indigo-500 to-purple-500",  label: "Qualified",   step: 3 },
  "Matt Call (Discovery)":        { icon: Video,     color: "from-purple-500 to-purple-600",  label: "Matt Call",   step: 4 },
  "Sam Call (Validation)":        { icon: UserCheck,  color: "from-purple-600 to-violet-600",  label: "Sam Call",    step: 5 },
  "Compliance Gate":              { icon: Shield,    color: "from-violet-600 to-fuchsia-500", label: "Compliance",  step: 6 },
  "Application + Approval":       { icon: FileText,  color: "from-fuchsia-500 to-pink-500",  label: "Application", step: 7 },
  "FDD Issued":                   { icon: FileCheck, color: "from-pink-500 to-orange-500",   label: "FDD Issued",  step: 8 },
  "Mark Call (Capital/Lending)":  { icon: DollarSign, color: "from-orange-500 to-amber-500",  label: "Mark Call",   step: 9 },
  "Award + Agreement":            { icon: Handshake, color: "from-amber-500 to-yellow-500",  label: "Award",       step: 10 },
  "Funds Received":               { icon: Trophy,    color: "from-yellow-500 to-green-500",  label: "Won!",        step: 11 },
};

const LONGTERM_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; label: string }> = {
  "Follow-up":   { icon: Phone,    color: "from-sky-500 to-sky-600",    label: "Follow-up" },
  "Nurture":     { icon: Users,    color: "from-sky-600 to-cyan-600",   label: "Nurture" },
  "Re-engaged":  { icon: Award,    color: "from-cyan-500 to-teal-500",  label: "Re-engaged" },
};

export default function OwnershipPath({ pipelines, selectedStage, onStageClick }: OwnershipPathProps) {
  const activePipeline = pipelines.find((p) => p.name.includes("Active"));
  const longTermPipeline = pipelines.find((p) => p.name.includes("Long-Term"));

  return (
    <div className="mb-8">
      {/* Active Pipeline — The Path */}
      {activePipeline && (
        <div className="mb-8">
          <h2 className="text-overline text-text-tertiary tracking-wider mb-4">
            PATH TO OWNERSHIP
          </h2>
          <div className="relative">
            {/* Path line */}
            <div className="absolute top-8 left-8 right-8 h-1 bg-bg-tertiary rounded-full hidden lg:block" />

            {/* Stages */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-3 lg:gap-1">
              {activePipeline.stages.map((stage) => {
                const meta = STAGE_META[stage.name];
                if (!meta) return null;

                const count = stage.opportunities.length;
                const isSelected = selectedStage === stage.id;
                const Icon = meta.icon;

                return (
                  <button
                    key={stage.id}
                    onClick={() => onStageClick(stage.id, stage.name)}
                    className={`
                      relative flex flex-col items-center text-center group
                      transition-all duration-200
                      ${isSelected ? "scale-110" : "hover:scale-105"}
                    `}
                  >
                    {/* Circle with icon */}
                    <div
                      className={`
                        w-14 h-14 rounded-full flex items-center justify-center mb-1.5
                        bg-gradient-to-br ${meta.color}
                        ${isSelected ? "ring-2 ring-nah-orange ring-offset-2 ring-offset-bg-primary" : ""}
                        ${count === 0 ? "opacity-40" : "opacity-100"}
                        shadow-lg group-hover:shadow-xl transition-shadow
                      `}
                    >
                      <Icon size={20} className="text-white" />
                    </div>

                    {/* Count badge */}
                    {count > 0 && (
                      <span className={`
                        absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full
                        text-caption font-bold text-white
                        flex items-center justify-center
                        ${isSelected ? "bg-nah-orange" : "bg-bg-tertiary text-text-primary border border-border-default"}
                      `}>
                        {count}
                      </span>
                    )}

                    {/* Label */}
                    <span className={`
                      text-caption leading-tight
                      ${isSelected ? "text-nah-orange font-medium" : "text-text-tertiary"}
                    `}>
                      {meta.label}
                    </span>

                    {/* Step number */}
                    <span className="text-[10px] text-text-tertiary/50 mt-0.5">
                      Step {meta.step}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Long-Term Pipeline */}
      {longTermPipeline && (
        <div>
          <h2 className="text-overline text-text-tertiary tracking-wider mb-3">
            LONG-TERM
          </h2>
          <div className="flex gap-3">
            {longTermPipeline.stages.map((stage) => {
              const meta = LONGTERM_META[stage.name];
              if (!meta) return null;

              const count = stage.opportunities.length;
              const isSelected = selectedStage === stage.id;
              const Icon = meta.icon;

              return (
                <button
                  key={stage.id}
                  onClick={() => onStageClick(stage.id, stage.name)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border
                    transition-all duration-150
                    ${isSelected
                      ? "border-nah-orange bg-nah-orange/10"
                      : "border-border-default bg-bg-secondary hover:border-border-hover"
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${meta.color} flex items-center justify-center ${count === 0 ? "opacity-40" : ""}`}>
                    <Icon size={14} className="text-white" />
                  </div>
                  <div className="text-left">
                    <p className={`text-body-sm font-medium ${isSelected ? "text-nah-orange" : "text-text-primary"}`}>
                      {meta.label}
                    </p>
                    <p className="text-caption text-text-tertiary">
                      {count} {count === 1 ? "lead" : "leads"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
