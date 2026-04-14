"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, MapPin, Users, TrendingUp, Home, BarChart3,
  Repeat, Briefcase, Wrench, Target, DollarSign, Sparkles,
} from "lucide-react";
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

  function renderField(f: MarketField) {
    const source = data[f.name]?.source;
    const isAutoPopulated = source && source !== "manual";
    return (
      <div key={f.name} className="flex items-center justify-between gap-2 py-1.5 border-b border-border-primary/30 last:border-b-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0 w-[55%]">
          <span className="text-body-sm text-text-secondary truncate">{f.label}</span>
          {isAutoPopulated && (
            <span className="inline-flex items-center px-1 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-medium shrink-0" title={`Source: ${source}`}>
              {source === "scout" ? <Sparkles className="h-2.5 w-2.5" /> : source}
            </span>
          )}
        </div>
        <input
          className="w-[45%] rounded border border-border-primary/50 bg-bg-primary px-2 py-1 text-body-sm text-text-primary text-right focus:outline-none focus:ring-1 focus:ring-nah-blue/30 focus:border-nah-blue/30"
          value={local[f.name] ?? ""}
          placeholder="—"
          onChange={(e) => setLocal((prev) => ({ ...prev, [f.name]: e.target.value }))}
          onBlur={() => handleBlur(f.name)}
        />
        {saving === f.name && (
          <Loader2 className="h-3 w-3 animate-spin text-text-tertiary absolute right-2" />
        )}
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
