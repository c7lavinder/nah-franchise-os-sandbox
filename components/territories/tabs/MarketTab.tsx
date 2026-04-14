"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, MapPin, Users, TrendingUp, Home, BarChart3,
  Repeat, Briefcase, Wrench, Target, DollarSign, X,
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

function formatValue(field: MarketField, raw: string | null): string {
  if (!raw) return "—";
  const num = Number(raw);
  if (field.dataType === "currency" && !isNaN(num)) {
    return `$${num.toLocaleString("en-US")}`;
  }
  if (field.dataType === "percentage" && !isNaN(num)) {
    return `${num}%`;
  }
  if (field.dataType === "number" && !isNaN(num)) {
    return num.toLocaleString("en-US");
  }
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
  const [local, setLocal] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, data[f.name]?.value ?? ""]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const Icon = ICON_MAP[category.icon] ?? MapPin;

  function handleBlur(fieldName: string) {
    const newVal = local[fieldName] ?? "";
    const oldVal = data[fieldName]?.value ?? "";
    if (newVal === oldVal) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(fieldName);
      await fetch(`/api/territories/${msSlug}/market-data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_name: fieldName,
          field_value: newVal || null,
          source: "manual",
        }),
      }).catch(() => {});
      setSaving(null);
    }, 200);
  }

  // Half the fields per column (2-col layout for data density)
  const mid = Math.ceil(fields.length / 2);
  const col1 = fields.slice(0, mid);
  const col2 = fields.slice(mid);

  function addTag(fieldName: string, tag: string) {
    const current = local[fieldName] ?? "";
    const tags = current ? JSON.parse(current) as string[] : [];
    if (!tags.includes(tag)) {
      const updated = JSON.stringify([...tags, tag]);
      setLocal((prev) => ({ ...prev, [fieldName]: updated }));
      handleBlurDirect(fieldName, updated);
    }
  }

  function removeTag(fieldName: string, tag: string) {
    const current = local[fieldName] ?? "[]";
    const tags = (JSON.parse(current) as string[]).filter((t) => t !== tag);
    const updated = JSON.stringify(tags);
    setLocal((prev) => ({ ...prev, [fieldName]: updated }));
    handleBlurDirect(fieldName, updated);
  }

  function handleBlurDirect(fieldName: string, value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(fieldName);
      await fetch(`/api/territories/${msSlug}/market-data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_name: fieldName, field_value: value || null, source: "manual" }),
      }).catch(() => {});
      setSaving(null);
    }, 200);
  }

  function toggleMultiSelect(fieldName: string, option: string) {
    const current = local[fieldName] ?? "";
    const selected = current ? JSON.parse(current) as string[] : [];
    const updated = selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option];
    const val = JSON.stringify(updated);
    setLocal((prev) => ({ ...prev, [fieldName]: val }));
    handleBlurDirect(fieldName, val);
  }

  function renderField(f: MarketField) {
    const source = data[f.name]?.source;
    const inputBase = "rounded border border-border-primary/50 bg-bg-primary px-2 py-1 text-body-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-nah-blue/30";

    // Select dropdown
    if (f.dataType === "select" && f.options) {
      return (
        <div key={f.name} className="flex items-center justify-between gap-2 py-1.5 border-b border-border-primary/30 last:border-b-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0 w-[55%]">
            <span className="text-body-sm text-text-secondary truncate">{f.label}</span>
            <SourceBadge source={source} />
          </div>
          <select
            className={`w-[45%] ${inputBase} text-right`}
            value={local[f.name] ?? ""}
            onChange={(e) => {
              setLocal((prev) => ({ ...prev, [f.name]: e.target.value }));
              handleBlurDirect(f.name, e.target.value);
            }}
          >
            <option value="">—</option>
            {f.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    }

    // Multi-select checkboxes
    if (f.dataType === "multi_select" && f.options) {
      const selected: string[] = (() => {
        try { return JSON.parse(local[f.name] ?? "[]"); }
        catch { return []; }
      })();
      return (
        <div key={f.name} className="py-1.5 border-b border-border-primary/30 last:border-b-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-body-sm text-text-secondary">{f.label}</span>
            <SourceBadge source={source} />
          </div>
          <div className="flex flex-wrap gap-1">
            {f.options.map((opt) => (
              <button key={opt} onClick={() => toggleMultiSelect(f.name, opt)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selected.includes(opt)
                    ? "bg-nah-blue text-white"
                    : "bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary"
                }`}
              >{opt}</button>
            ))}
          </div>
        </div>
      );
    }

    // Tags (multi-value text — stored as JSON array)
    if (f.dataType === "tags") {
      const tags: string[] = (() => {
        try { return JSON.parse(local[f.name] ?? "[]"); }
        catch { return []; }
      })();
      return (
        <div key={f.name} className="py-1.5 border-b border-border-primary/30 last:border-b-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-body-sm text-text-secondary">{f.label}</span>
            <SourceBadge source={source} />
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-bg-secondary text-body-sm text-text-primary">
                {tag}
                <button onClick={() => removeTag(f.name, tag)} className="text-text-tertiary hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            className={`w-full ${inputBase}`}
            placeholder={`Add ${f.label.toLowerCase()}...`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                addTag(f.name, (e.target as HTMLInputElement).value.trim());
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </div>
      );
    }

    // Default: text/number/currency/percentage input
    return (
      <div key={f.name} className="flex items-center justify-between gap-2 py-1.5 border-b border-border-primary/30 last:border-b-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0 w-[55%]">
          <span className="text-body-sm text-text-secondary truncate">{f.label}</span>
          <SourceBadge source={source} />
        </div>
        <input
          className={`w-[45%] ${inputBase} text-right`}
          value={local[f.name] ?? ""}
          placeholder="—"
          onChange={(e) => setLocal((prev) => ({ ...prev, [f.name]: e.target.value }))}
          onBlur={() => handleBlur(f.name)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-primary bg-bg-primary p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-nah-blue" />
        <h2 className="text-body-sm font-semibold text-text-primary">{category.label}</h2>
        <span className="text-[10px] text-text-tertiary ml-auto">{fields.length} fields</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        <div>{col1.map(renderField)}</div>
        <div>{col2.map(renderField)}</div>
      </div>
    </div>
  );
}

export default function MarketTab({ msSlug }: Props) {
  const [data, setData] = useState<FieldData>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/territories/${msSlug}/market-data`);
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

  // Count populated fields
  const populated = Object.values(data).filter((d) => d.value).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-body-sm font-semibold text-text-primary">Market & Financial Data</h2>
          <span className="text-caption text-text-tertiary">
            {populated} / {MARKET_FIELDS.length} fields populated
          </span>
        </div>
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
