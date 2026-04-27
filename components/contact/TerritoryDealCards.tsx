"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

/**
 * TerritoryDetailsCard + DealDetailsCard — persistent above tabs on contact page.
 * Fields editable inline, saved via PATCH /api/contacts/[contactId].
 */

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface ContactFields {
  legal_entity: string | null;
  website: string | null;
  franchise_fee: number | null;
  royalty_pct: number | null;
  term_months: number | null;
  opportunity_source: string | null;
  sub_source: string | null;
}

interface LeadSourceOption {
  id: string;
  name: string;
  subSources: { id: string; name: string }[];
}

interface Props {
  contactId: string;
  fields: ContactFields;
  onUpdate: (fields: Partial<ContactFields>) => void;
}

function InlineField({ label, value, displayValue, onSave, type = "text", readOnly = false }: {
  label: string; value: string; displayValue?: string; onSave: (v: string) => void; type?: string; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (readOnly || !editing) {
    return (
      <div className="min-w-0">
        <span className="text-[10px] text-text-tertiary block">{label}</span>
        <p
          className={`text-body-sm text-text-primary truncate flex items-center gap-1 ${!readOnly ? "cursor-pointer hover:text-nah-blue" : ""}`}
          onClick={() => { if (!readOnly) { setEditing(true); setDraft(value); } }}
        >
          {displayValue || value || "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <span className="text-[10px] text-text-tertiary block">{label}</span>
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== value) onSave(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setEditing(false); if (draft !== value) onSave(draft); }
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        className="w-full bg-bg-secondary border border-nah-blue rounded px-2 py-0.5 text-body-sm text-text-primary outline-none"
      />
    </div>
  );
}

function formatDollar(amount: number | null): string {
  if (amount == null) return "—";
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function TerritoryDetailsCard({ contactId, fields, onUpdate }: Props) {
  const { toast } = useToast();

  async function save(field: string, value: string) {
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value || null }),
      });
      if (res.ok) {
        onUpdate({ [field]: value || null });
        toast("Saved");
      }
    } catch { /* silent */ }
  }

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3">
      <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">ENTITY</h3>
      <div className="grid grid-cols-2 gap-3">
        <InlineField label="Legal Entity" value={fields.legal_entity ?? ""} onSave={(v) => void save("legal_entity", v)} />
        <InlineField label="Website" value={fields.website ?? ""} onSave={(v) => void save("website", v)} />
      </div>
    </div>
  );
}

export function DealDetailsCard({ contactId, fields, onUpdate }: Props) {
  const { toast } = useToast();
  const [leadSources, setLeadSources] = useState<LeadSourceOption[]>([]);

  useEffect(() => {
    apiFetch("/api/settings/lead-sources")
      .then((r) => r.json())
      .then((d) => setLeadSources(d.sources ?? []))
      .catch(() => {});
  }, []);

  async function saveNum(field: string, value: string) {
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value ? Number(value) : null }),
      });
      if (res.ok) {
        onUpdate({ [field]: value ? Number(value) : null } as Partial<ContactFields>);
        toast("Saved");
      }
    } catch { /* silent */ }
  }

  async function saveStr(field: string, value: string) {
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value || null }),
      });
      if (res.ok) {
        onUpdate({ [field]: value || null } as Partial<ContactFields>);
        toast("Saved");
      }
    } catch { /* silent */ }
  }

  async function saveMulti(updates: Record<string, string | null>) {
    try {
      const res = await apiFetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        onUpdate(updates as Partial<ContactFields>);
        toast("Saved");
      }
    } catch { /* silent */ }
  }

  const currentSource = leadSources.find((s) => s.name === fields.opportunity_source);
  const subOptions = currentSource?.subSources ?? [];

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3">
      <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">DEAL</h3>
      <div className="grid grid-cols-3 gap-3">
        <InlineField
          label="Franchise Fee"
          value={fields.franchise_fee?.toString() ?? ""}
          displayValue={formatDollar(fields.franchise_fee)}
          onSave={(v) => void saveNum("franchise_fee", v)}
          type="number"
        />
        <InlineField label="Royalty" value={fields.royalty_pct?.toString() ?? ""} displayValue={fields.royalty_pct != null ? `${fields.royalty_pct}%` : "—"} onSave={(v) => void saveNum("royalty_pct", v)} type="number" />
        <InlineField
          label="Start Date"
          value={fields.term_months?.toString() ?? ""}
          onSave={(v) => void saveStr("term_months", v)}
          type="date"
        />
      </div>

      {/* Lead Source + Sub Source dropdowns */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="min-w-0">
          <span className="text-[10px] text-text-tertiary block mb-0.5">Lead Source</span>
          <div className="relative">
            <select
              value={fields.opportunity_source ?? ""}
              onChange={(e) => {
                const val = e.target.value || null;
                void saveMulti({ opportunity_source: val, sub_source: null });
              }}
              className="w-full bg-bg-primary border border-border-default rounded px-2 py-1 text-body-sm text-text-primary appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-nah-blue"
            >
              <option value="">—</option>
              {leadSources.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
        </div>
        <div className="min-w-0">
          <span className="text-[10px] text-text-tertiary block mb-0.5">Sub Source</span>
          <div className="relative">
            <select
              value={fields.sub_source ?? ""}
              onChange={(e) => void saveStr("sub_source", e.target.value)}
              disabled={subOptions.length === 0}
              className="w-full bg-bg-primary border border-border-default rounded px-2 py-1 text-body-sm text-text-primary appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-nah-blue disabled:opacity-40"
            >
              <option value="">—</option>
              {subOptions.map((ss) => (
                <option key={ss.id} value={ss.name}>{ss.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
