"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  MapPin,
  Users,
  TrendingUp,
  Home,
  BarChart3,
  Repeat,
  Briefcase,
  Wrench,
  Target,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  Mail,
  Phone,
  User,
  Shield,
  Megaphone,
  Calendar,
} from "lucide-react";
import SourceBadge from "@/components/ui/SourceBadge";
import {
  MARKET_CATEGORIES,
  MARKET_FIELDS,
  type MarketCategory,
  type MarketField,
} from "@/lib/territory/market-field-registry";

interface Territory {
  TerritorySlug: string;
  Nickname: string;
  status: string;
  PersonalName: string | null;
  Owner2: string | null;
  Owner3: string | null;
  FranchiseEmail: string | null;
  PersonalPhoneNumber: string | null;
  EmergencyContact: string | null;
  PrimaryCoach: string | null;
  Broker: string | null;
  StreetAddress: string | null;
  NahCity: string | null;
  NahState: string | null;
  NahZip: string | null;
  LegalEntityName: string | null;
  RealEstateLicensee: string | null;
  LicenseeBroker: string | null;
  LicenseeBrokerNumber: string | null;
  MarketingName: string | null;
  MarketingPhoneNumber: string | null;
  MarketingEmailAddress: string | null;
  MarketingReturnAddress: string | null;
  MarketingLeadGenPhoneNumber: string | null;
  MarketingCallCenterForwardingNumber: string | null;
  MarketingInstagramProfile: string | null;
  MarketingFacebookPage: string | null;
  FranchiseAgreementDate: string | null;
  InitialApplicationDate: string | null;
  TrainingCompleteDate: string | null;
  FirstPurchaseDate: string | null;
  FranchiseClosedDate: string | null;
  ComplianceScore: number | null;
  ComplianceScoreManualDescription: string | null;
  IsFranchise: boolean | null;
  IsFullTime: boolean | null;
  FullTimeOperator: boolean | null;
  GoHighLevelLocationId: string | null;
  NexaActive: boolean | null;
  NexaAccount: string | null;
  Vonage1Active: boolean | null;
  Vonage1Account: string | null;
  Vonage2Active: boolean | null;
  Vonage2Account: string | null;
  ms_synced_at: string | null;
  [key: string]: unknown;
}

interface OwnerOut {
  ownerName: string | null;
  ghlContactId: string | null;
  role?: string;
  start_date?: string | null;
  email?: string | null;
}

interface Props {
  TerritorySlug: string;
  territory: Territory;
  owners?: OwnerOut[];
}

// ═══════════════════════════════════════════════════════════
// Details helpers (territory config from territories table)
// ═══════════════════════════════════════════════════════════

function fmt(val: string | null | undefined): string {
  return val?.trim() || "—";
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-text-tertiary">{label}</dt>
      <dd className="text-body-sm text-text-primary">{value}</dd>
    </div>
  );
}

function BoolField({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${value ? "bg-success" : "bg-gray-300"}`} />
      <span className="text-body-sm text-text-primary">{label}</span>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-text-tertiary" />
        ) : (
          <ChevronRight size={14} className="text-text-tertiary" />
        )}
        <Icon size={16} className="text-nah-blue" />
        <span className="text-body-sm font-medium text-text-primary">{title}</span>
      </button>
      {expanded && (
        <div className="p-4">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">{children}</dl>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Market helpers (EAV from territory_market_data)
// ═══════════════════════════════════════════════════════════

type FieldData = Record<string, { value: string | null; source: string; updated_at: string }>;

const ICON_MAP: Record<string, typeof MapPin> = {
  MapPin,
  Users,
  TrendingUp,
  Home,
  BarChart3,
  Repeat,
  Briefcase,
  Wrench,
  Target,
};

function formatDisplay(field: MarketField, raw: string | null): string {
  if (!raw) return "—";
  if (field.dataType === "tags" || field.dataType === "multi_select") {
    try {
      const arr = JSON.parse(raw) as string[];
      return arr.length > 0 ? arr.join(", ") : "—";
    } catch {
      return raw;
    }
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
  TerritorySlug,
}: {
  category: (typeof MARKET_CATEGORIES)[number];
  fields: MarketField[];
  data: FieldData;
  TerritorySlug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const Icon = ICON_MAP[category.icon] ?? MapPin;

  const filledCount = fields.filter((f) => {
    const v = data[f.name]?.value;
    return v && v !== "[]";
  }).length;

  async function saveField(fieldName: string, value: string) {
    setSaving(true);
    await apiFetch(`/api/territories/${TerritorySlug}/market-data`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field_name: fieldName, field_value: value || null, source: "manual" }),
    }).catch(() => {});
    data[fieldName] = { value: value || null, source: "manual", updated_at: new Date().toISOString() };
    setSaving(false);
    setEditingField(null);
  }

  function renderEditor(field: MarketField) {
    const currentValue = data[field.name]?.value ?? "";

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
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.dataType === "multi_select" && field.options) {
      let selected: string[] = [];
      try {
        selected = JSON.parse(currentValue || "[]");
      } catch {
        /* empty */
      }
      return (
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                const updated = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
                saveField(field.name, JSON.stringify(updated));
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selected.includes(opt)
                  ? "bg-nah-blue text-white"
                  : "bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary"
              }`}
            >
              {opt}
            </button>
          ))}
          <button onClick={() => setEditingField(null)} className="text-text-tertiary text-[10px] ml-1">
            done
          </button>
        </div>
      );
    }

    if (field.dataType === "tags") {
      let tags: string[] = [];
      try {
        tags = JSON.parse(currentValue || "[]");
      } catch {
        /* empty */
      }
      return (
        <div>
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-bg-secondary text-body-sm text-text-primary"
              >
                {tag}
                <button
                  onClick={() => saveField(field.name, JSON.stringify(tags.filter((t) => t !== tag)))}
                  className="text-text-tertiary hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
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
                if (!tags.includes(newTag)) saveField(field.name, JSON.stringify([...tags, newTag]));
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

    return (
      <input
        type="text"
        className="input text-body-sm py-1 w-full"
        defaultValue={currentValue}
        autoFocus
        onBlur={(e) => {
          if (e.target.value !== currentValue) saveField(field.name, e.target.value);
          else setEditingField(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLInputElement;
            if (target.value !== currentValue) saveField(field.name, target.value);
            else setEditingField(null);
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
        {expanded ? (
          <ChevronDown size={14} className="text-text-tertiary" />
        ) : (
          <ChevronRight size={14} className="text-text-tertiary" />
        )}
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
                <div className="w-44 flex-shrink-0">
                  <span className="text-caption text-text-secondary">{field.label}</span>
                  {field.help && <span className="text-[10px] text-text-tertiary block">{field.help}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    renderEditor(field)
                  ) : (
                    <span className={`text-body-sm ${value ? "text-text-primary" : "text-text-tertiary"}`}>
                      {formatDisplay(field, value)}
                    </span>
                  )}
                </div>
                <SourceBadge source={source} showManual className="flex-shrink-0" />
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

// ═══════════════════════════════════════════════════════════
// DataTab — merged Details + Market (minus Financial Performance)
// ═══════════════════════════════════════════════════════════

export default function DataTab({ TerritorySlug, territory, owners = [] }: Props) {
  const t = territory;
  const [marketData, setMarketData] = useState<FieldData>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await apiFetch(`/api/territories/${TerritorySlug}/market-data`);
    if (res.ok) {
      const d = await res.json();
      setMarketData(d.fields ?? {});
    }
    setLoading(false);
  }, [TerritorySlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-3">
      {/* Owner & Contact — from linked contact records */}
      <DetailSection icon={User} title="Owner & Contact">
        {owners.length > 0 ? (
          owners.map((o, i) => (
            <div key={o.ghlContactId ?? i} className="col-span-full grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
              <Field label={o.role === "co_primary" ? "Co-Owner" : "Owner"} value={o.ownerName ?? "—"} />
              <Field label="Email" value={o.email ?? "—"} />
              {o.start_date && <Field label="Since" value={fmtDate(o.start_date)} />}
            </div>
          ))
        ) : (
          <>
            <Field label="Primary Owner" value={fmt(t.PersonalName)} />
            <Field label="Franchise Email" value={fmt(t.FranchiseEmail)} />
            <Field label="Phone" value={fmt(t.PersonalPhoneNumber)} />
          </>
        )}
        {t.EmergencyContact && <Field label="Emergency Contact" value={t.EmergencyContact} />}
      </DetailSection>

      <DetailSection icon={MapPin} title="Address">
        <Field label="Street" value={fmt(t.StreetAddress)} />
        <Field label="City" value={fmt(t.NahCity)} />
        <Field label="State" value={fmt(t.NahState)} />
        <Field label="Zip" value={fmt(t.NahZip)} />
      </DetailSection>

      <DetailSection icon={Briefcase} title="Business">
        <Field label="Legal Entity" value={fmt(t.LegalEntityName)} />
        <Field label="Coach" value={fmt(t.PrimaryCoach)} />
        <Field label="Broker" value={fmt(t.Broker)} />
        <Field label="RE Licensee" value={fmt(t.RealEstateLicensee)} />
        {t.LicenseeBroker && <Field label="Licensee Broker" value={t.LicenseeBroker} />}
        {t.LicenseeBrokerNumber && <Field label="Broker #" value={t.LicenseeBrokerNumber} />}
        <div className="col-span-full flex flex-wrap gap-4 pt-1">
          <BoolField label="Franchise" value={t.IsFranchise} />
          <BoolField label="Full-Time" value={t.IsFullTime} />
          <BoolField label="Full-Time Operator" value={t.FullTimeOperator} />
        </div>
      </DetailSection>

      <DetailSection icon={Calendar} title="Key Dates">
        <Field label="Application" value={fmtDate(t.InitialApplicationDate)} />
        <Field label="Franchise Agreement" value={fmtDate(t.FranchiseAgreementDate)} />
        <Field label="Training Complete" value={fmtDate(t.TrainingCompleteDate)} />
        <Field label="First Purchase" value={fmtDate(t.FirstPurchaseDate)} />
        {t.FranchiseClosedDate && <Field label="Closed" value={fmtDate(t.FranchiseClosedDate)} />}
      </DetailSection>

      <DetailSection icon={Megaphone} title="Marketing">
        <Field label="Marketing Name" value={fmt(t.MarketingName)} />
        <Field label="Marketing Phone" value={fmt(t.MarketingPhoneNumber)} />
        <Field label="Marketing Email" value={fmt(t.MarketingEmailAddress)} />
        <Field label="Lead Gen Phone" value={fmt(t.MarketingLeadGenPhoneNumber)} />
        <Field label="Call Center Fwd" value={fmt(t.MarketingCallCenterForwardingNumber)} />
        <Field label="Return Address" value={fmt(t.MarketingReturnAddress)} />
        {t.MarketingInstagramProfile && <Field label="Instagram" value={t.MarketingInstagramProfile} />}
        {t.MarketingFacebookPage && <Field label="Facebook" value={t.MarketingFacebookPage} />}
      </DetailSection>

      <DetailSection icon={Shield} title="Compliance & Accounts">
        <Field label="Compliance Score" value={t.ComplianceScore != null ? String(t.ComplianceScore) : "—"} />
        {t.ComplianceScoreManualDescription && (
          <div className="col-span-2">
            <Field label="Compliance Notes" value={t.ComplianceScoreManualDescription} />
          </div>
        )}
        <Field label="GHL Location ID" value={fmt(t.GoHighLevelLocationId)} />
        <div className="col-span-full flex flex-wrap gap-4 pt-1">
          <BoolField label="Nexa Active" value={t.NexaActive} />
          <BoolField label="Vonage 1 Active" value={t.Vonage1Active} />
          <BoolField label="Vonage 2 Active" value={t.Vonage2Active} />
        </div>
        {t.NexaAccount && <Field label="Nexa Account" value={t.NexaAccount} />}
        {t.Vonage1Account && <Field label="Vonage 1" value={t.Vonage1Account} />}
        {t.Vonage2Account && <Field label="Vonage 2" value={t.Vonage2Account} />}
      </DetailSection>

      {/* Market data sections (from territory_market_data EAV) */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
        </div>
      ) : (
        <>
          {MARKET_CATEGORIES.map((cat) => {
            const fields = MARKET_FIELDS.filter((f) => f.category === cat.key);
            if (fields.length === 0) return null;
            return (
              <MarketSection
                key={cat.key}
                category={cat}
                fields={fields}
                data={marketData}
                TerritorySlug={TerritorySlug}
              />
            );
          })}
        </>
      )}

      {t.ms_synced_at && (
        <p className="text-caption text-text-tertiary text-right">
          Last synced from MasterSuite: {new Date(t.ms_synced_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
