"use client";

import { useState } from "react";
import {
  MapPin, Target, DollarSign, BookOpen, CheckCircle2,
  Activity, Zap, Shield, ChevronDown, ChevronRight, Pencil,
  User, Briefcase, Brain, TrendingUp, Search, Bot,
  BarChart3, Database, AlertTriangle, Puzzle,
} from "lucide-react";
import type { FieldCategory, ProfileField } from "@/lib/profile/field-registry";
import { CATEGORY_META } from "@/lib/profile/field-registry";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  MapPin, Target, DollarSign, BookOpen, CheckCircle2, Activity, Zap, Shield,
  User, Briefcase, Brain, TrendingUp, Search, Bot, BarChart3, Database,
  AlertTriangle, Puzzle,
};

interface ProfileSectionProps {
  category: FieldCategory;
  fields: ProfileField[];
  values: Record<string, string | null>;
  onFieldChange: (fieldName: string, value: string) => void;
  saving: boolean;
}

function fieldDisplayValue(field: ProfileField, value: string | null): string {
  if (!value) return "—";
  if (field.dataType === "number") return value;
  if (field.dataType === "date") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }
  return value;
}

function sourceLabel(source: string): string {
  switch (source) {
    case "manual": return "Chad fills";
    case "scout": return "Scout AI";
    case "system": return "Auto";
    case "api": return "API sync";
    default: return source;
  }
}

function sourceBadgeColor(source: string): string {
  switch (source) {
    case "manual": return "bg-[#fff3e0] text-[#e65100]";     // orange — Chad fills
    case "scout": return "bg-[#e3f2fd] text-[#1565c0]";      // blue — Scout AI
    case "system": return "bg-[#f3e5f5] text-[#6a1b9a]";     // purple — Auto
    case "api": return "bg-[#e8f5e9] text-[#2e7d32]";        // green — API sync
    default: return "bg-[#f1f5f9] text-[#64748b]";
  }
}

export default function ProfileSection({
  category,
  fields,
  values,
  onFieldChange,
  saving,
}: ProfileSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const meta = CATEGORY_META[category];
  const Icon = ICON_MAP[meta.icon] ?? Activity;

  const filledCount = fields.filter((f) => values[f.name]).length;

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
        <Icon size={16} className={meta.color} />
        <span className="text-body-sm font-medium text-text-primary">{meta.label}</span>
        <span className="text-caption text-text-tertiary ml-auto">
          {filledCount}/{fields.length} filled
        </span>
      </button>

      {/* Fields */}
      {expanded && (
        <div className="divide-y divide-border-default">
          {fields.map((field) => {
            const value = values[field.name];
            const isEditing = editingField === field.name;

            return (
              <div
                key={field.name}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover/50 transition-colors"
              >
                {/* Label */}
                <div className="w-36 flex-shrink-0">
                  <span className="text-caption text-text-secondary">{field.label}</span>
                  {field.help && (
                    <span className="text-[10px] text-text-tertiary block">{field.help}</span>
                  )}
                </div>

                {/* Value / Editor */}
                <div className="flex-1 min-w-0">
                  {isEditing && field.dataType === "dropdown" ? (
                    <select
                      className="input text-body-sm py-1 w-full"
                      value={value ?? ""}
                      onChange={(e) => {
                        onFieldChange(field.name, e.target.value);
                        setEditingField(null);
                      }}
                      autoFocus
                      onBlur={() => setEditingField(null)}
                      disabled={saving}
                    >
                      <option value="">— Select —</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : isEditing && (field.dataType === "text" || field.dataType === "number") ? (
                    <input
                      type={field.dataType === "number" ? "number" : "text"}
                      className="input text-body-sm py-1 w-full"
                      defaultValue={value ?? ""}
                      autoFocus
                      onBlur={(e) => {
                        if (e.target.value !== (value ?? "")) {
                          onFieldChange(field.name, e.target.value);
                        }
                        setEditingField(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const target = e.target as HTMLInputElement;
                          if (target.value !== (value ?? "")) {
                            onFieldChange(field.name, target.value);
                          }
                          setEditingField(null);
                        }
                        if (e.key === "Escape") setEditingField(null);
                      }}
                      disabled={saving}
                    />
                  ) : isEditing && field.dataType === "date" ? (
                    <input
                      type="date"
                      className="input text-body-sm py-1 w-full"
                      defaultValue={value ?? ""}
                      autoFocus
                      onBlur={(e) => {
                        if (e.target.value !== (value ?? "")) {
                          onFieldChange(field.name, e.target.value);
                        }
                        setEditingField(null);
                      }}
                      disabled={saving}
                    />
                  ) : (
                    <span className={`text-body-sm ${value ? "text-text-primary" : "text-text-tertiary"}`}>
                      {fieldDisplayValue(field, value)}
                    </span>
                  )}
                </div>

                {/* Source badge */}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${sourceBadgeColor(field.source)}`}>
                  {sourceLabel(field.source)}
                </span>

                {/* Edit button — all fields are manually overridable */}
                {!isEditing && (
                  <button
                    onClick={() => setEditingField(field.name)}
                    className="p-1 text-text-tertiary hover:text-text-primary flex-shrink-0"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
