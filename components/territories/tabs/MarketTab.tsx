"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, MapPin, Users, TrendingUp, Home, BarChart3,
  Repeat, Briefcase, Wrench, Target, DollarSign,
  ChevronDown, ChevronRight, Pencil, X,
} from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import {
  MARKET_CATEGORIES,
  MARKET_FIELDS,
  type MarketCategory,
  type MarketField,
} from "@/lib/territory/market-field-registry";

interface Props {
  msSlug: string;
}

type FieldData = Record<string, { value: string | null; source: string; updated_at: string }>;

const ICON_MAP: Record<string, typeof MapPin> = {
  MapPin, Users, TrendingUp, Home, BarChart3,
  Repeat, Briefcase, Wrench, Target, DollarSign,
};

function formatDisplay(field: MarketField, raw: string | null): string {
  if (!raw) return "—";
  // Tags / multi-select stored as JSON array
  if (field.dataType === "tags" || field.dataType === "multi_select") {
    try {
      const arr = JSON.parse(raw) as string[];
      return arr.length > 0 ? arr.join(", ") : "—";
    } catch { return raw; }
  }
  const num = Number(raw);
  if (field.dataType === "currency" && !isNaN(num)) return `$${num.toLocaleString("en-US")}`;
  if (field.dataType === "percentage" && !isNaN(num)) return `${num}%`;
  if (field.dataType === "number" && !isNaN(num)) return num.toLocaleString("en-US");
  return raw;
}

function MarketSection({
  category,
  fields,
  data,
  msSlug,
}: {
  category: (typeof MARKET_CATEGORIES)[number];
  fields: MarketField[];
  data: FieldData;
  msSlug: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const Icon = ICON_MAP[category.icon] ?? MapPin;

  const filledCount = fields.filter((f) => {
    const v = data[f.name]?.value;
    return v && v !== "[]";
  }).length;

  async function saveField(fieldName: string, value: string) {
    setSaving(true);
    await apiFetch(`/api/territories/${msSlug}/market-data`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field_name: fieldName, field_value: value || null, source: "manual" }),
    }).catch(() => {});
    // Update local data reference
    data[fieldName] = { value: value || null, source: "manual", updated_at: new Date().toISOString() };
    setSaving(false);
    setEditingField(null);
  }

  function renderEditor(field: MarketField) {
    const currentValue = data[field.name]?.value ?? "";

    // Select dropdown
    if (field.dataType === "select" && field.options) {
      return (
        <select
          className="input text-body-sm py-1 w-full"
          value={currentValue}
          autoFocus
          onChange={(e) => saveField(field.name, e.target.value)}
          onBlur={() => setEditingField(null)}
          disabled={saving}
        >
          <option value="">— Select —</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    // Multi-select toggle buttons
    if (field.dataType === "multi_select" && field.options) {
      let selected: string[] = [];
      try { selected = JSON.parse(currentValue || "[]"); } catch { /* empty */ }
      return (
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => (
            <button key={opt}
              onClick={() => {
                const updated = selected.includes(opt)
                  ? selected.filter((s) => s !== opt)
                  : [...selected, opt];
                saveField(field.name, JSON.stringify(updated));
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selected.includes(opt)
                  ? "bg-nah-blue text-white"
                  : "bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary"
              }`}
            >{opt}</button>
          ))}
          <button onClick={() => setEditingField(null)} className="text-text-tertiary text-[10px] ml-1">done</button>
        </div>
      );
    }

    // Tags
    if (field.dataType === "tags") {
      let tags: string[] = [];
      try { tags = JSON.parse(currentValue || "[]"); } catch { /* empty */ }
      return (
        <div>
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-bg-secondary text-body-sm text-text-primary">
                {tag}
                <button onClick={() => {
                  const updated = tags.filter((t) => t !== tag);
                  saveField(field.name, JSON.stringify(updated));
                }} className="text-text-tertiary hover:text-red-500"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <input
            className="input text-body-sm py-1 w-full"
            placeholder="Type and press Enter..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                const newTag = (e.target as HTMLInputElement).value.trim();
                if (!tags.includes(newTag)) {
                  saveField(field.name, JSON.stringify([...tags, newTag]));
                }
                (e.target as HTMLInputElement).value = "";
              }
              if (e.key === "Escape") setEditingField(null);
            }}
            onBlur={() => setEditingField(null)}
            disabled={saving}
          />
        </div>
      );
    }

    // Default: text / number / currency / percentage
    return (
      <input
        type={field.dataType === "number" || field.dataType === "currency" || field.dataType === "percentage" ? "text" : "text"}
        className="input text-body-sm py-1 w-full"
        defaultValue={currentValue}
        autoFocus
        onBlur={(e) => {
          if (e.target.value !== currentValue) {
            saveField(field.name, e.target.value);
          } else {
            setEditingField(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLInputElement;
            if (target.value !== currentValue) {
              saveField(field.name, target.value);
            } else {
              setEditingField(null);
            }
          }
          if (e.key === "Escape") setEditingField(null);
        }}
        disabled={saving}
      />
    );
  }

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
        <Icon size={16} className="text-nah-blue" />
        <span className="text-body-sm font-medium text-text-primary">{category.label}</span>
        <span className="text-caption text-text-tertiary ml-auto">
          {filledCount}/{fields.length} filled
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-border-default">
          {fields.map((field) => {
            const value = data[field.name]?.value ?? null;
            const source = data[field.name]?.source ?? null;
            const isEditing = editingField === field.name;

            return (
              <div
                key={field.name}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover/50 transition-colors"
              >
                {/* Label */}
                <div className="w-44 flex-shrink-0">
                  <span className="text-caption text-text-secondary">{field.label}</span>
                  {field.help && (
                    <span className="text-[10px] text-text-tertiary block">{field.help}</span>
                  )}
                </div>

                {/* Value / Editor */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    renderEditor(field)
                  ) : (
                    <span className={`text-body-sm ${value ? "text-text-primary" : "text-text-tertiary"}`}>
                      {formatDisplay(field, value)}
                    </span>
                  )}
                </div>

                {/* Source badge */}
                <SourceBadge source={source} showManual className="flex-shrink-0" />

                {/* Edit button */}
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

export default function MarketTab({ msSlug }: Props) {
  const [data, setData] = useState<FieldData>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await apiFetch(`/api/territories/${msSlug}/market-data`);
    if (res.ok) {
      const d = await res.json();
      setData(d.fields ?? {});
    }
    setLoading(false);
  }, [msSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  const populated = Object.values(data).filter((d) => d.value && d.value !== "[]").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-caption text-text-tertiary">
          {populated} / {MARKET_FIELDS.length} fields populated
        </span>
      </div>

      {MARKET_CATEGORIES.map((cat) => {
        const fields = MARKET_FIELDS.filter((f) => f.category === cat.key);
        if (fields.length === 0) return null;
        return (
          <MarketSection
            key={cat.key}
            category={cat}
            fields={fields}
            data={data}
            msSlug={msSlug}
          />
        );
      })}
    </div>
  );
}
