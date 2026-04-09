"use client";

/**
 * TerritoryDetailsCard + DealDetailsCard — persistent above tabs on contact page.
 * Fields editable inline, saved via PATCH /api/contacts/[contactId].
 */

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";

interface ContactFields {
  territory: string | null;
  territory_slug: string | null;
  legal_entity: string | null;
  website: string | null;
  franchise_fee: number | null;
  royalty_pct: number | null;
  term_months: number | null;
  opportunity_source: string | null;
}

interface Props {
  contactId: string;
  fields: ContactFields;
  onUpdate: (fields: Partial<ContactFields>) => void;
}

function InlineField({ label, value, onSave, type = "text", readOnly = false }: {
  label: string; value: string; onSave: (v: string) => void; type?: string; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (readOnly || !editing) {
    return (
      <div className="min-w-0">
        <span className="text-[10px] text-text-tertiary block">{label}</span>
        <p
          className={`text-body-sm text-text-primary truncate ${!readOnly ? "cursor-pointer hover:text-nah-blue" : ""}`}
          onClick={() => !readOnly && setEditing(true)}
        >
          {value || "—"}
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
        onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (draft !== value) onSave(draft); } if (e.key === "Escape") { setEditing(false); setDraft(value); } }}
        className="w-full bg-bg-secondary border border-nah-blue rounded px-2 py-0.5 text-body-sm text-text-primary outline-none"
      />
    </div>
  );
}

export function TerritoryDetailsCard({ contactId, fields, onUpdate }: Props) {
  const { toast } = useToast();

  async function save(field: string, value: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
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
      <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">TERRITORY</h3>
      <div className="grid grid-cols-4 gap-3">
        <InlineField label="Territory" value={fields.territory ?? ""} onSave={(v) => void save("territory", v)} />
        <InlineField label="Slug" value={fields.territory_slug ?? ""} onSave={(v) => void save("territory_slug", v)} />
        <InlineField label="Legal Entity" value={fields.legal_entity ?? ""} onSave={(v) => void save("legal_entity", v)} />
        <InlineField label="Website" value={fields.website ?? ""} onSave={(v) => void save("website", v)} />
      </div>
    </div>
  );
}

export function DealDetailsCard({ contactId, fields, onUpdate }: Props) {
  const { toast } = useToast();

  async function save(field: string, value: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value ? Number(value) : null }),
      });
      if (res.ok) {
        onUpdate({ [field]: value ? Number(value) : null });
        toast("Saved");
      }
    } catch { /* silent */ }
  }

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3">
      <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider mb-2">DEAL</h3>
      <div className="grid grid-cols-4 gap-3">
        <InlineField label="Franchise Fee" value={fields.franchise_fee?.toString() ?? ""} onSave={(v) => void save("franchise_fee", v)} type="number" />
        <InlineField label="Royalty %" value={fields.royalty_pct?.toString() ?? ""} onSave={(v) => void save("royalty_pct", v)} type="number" />
        <InlineField label="Term (months)" value={fields.term_months?.toString() ?? ""} onSave={(v) => void save("term_months", v)} type="number" />
        <InlineField label="Lead Source" value={fields.opportunity_source ?? ""} onSave={() => {}} readOnly />
      </div>
    </div>
  );
}
