"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/auth/api-fetch";
import CallDataField from "./CallDataField";

interface Extraction {
  id: string;
  call_id: string;
  contact_id: string | null;
  field_key: string;
  field_category: string;
  extracted_value: string | null;
  confidence: string | null;
  saved_to_profile: boolean;
  dismissed: boolean;
  TerritorySlug: string | null;
  target_scope: "single" | "both" | null;
  protected_by_newer_profile?: boolean;
  unsupported_contact_field?: boolean;
}

interface PartnerOption {
  id: string;
  name: string;
}
interface TerritoryOption {
  TerritorySlug: string;
  Nickname: string;
}

interface CallDataTabProps {
  callId: string;
  dataExtractions: Extraction[];
  profileFieldCount: number;
  hasTranscript: boolean;
  hasGenerated: boolean;
  isGenerating: boolean;
  partnerOptions: PartnerOption[];
  /** Contacts mapped to this call (for single-contact target labels). */
  linkedContacts?: { id: string | null; name: string }[];
  /** Territories mapped to this call (for territory target labels). */
  callTerritories?: TerritoryOption[];
  onRefresh: () => void;
}

type GenState = "no_transcript" | "ready" | "generating" | "complete";

function getState(props: CallDataTabProps): GenState {
  if (!props.hasTranscript) return "no_transcript";
  if (props.isGenerating) return "generating";
  if (props.dataExtractions.length > 0 || props.hasGenerated) return "complete";
  return "ready";
}

/**
 * Display order + labels for every field_category Scout emits. Any category
 * not listed here lands in a generic "Other" bucket so nothing ever silently
 * disappears from the Data tab (fixes the 31/25 count mismatch).
 */
const CATEGORY_META: Record<string, { label: string; kind: "contact" | "territory" }> = {
  contact: { label: "Contact Profile", kind: "contact" },
  contact_eos: { label: "Contact EOS (issues, todos, rocks)", kind: "contact" },
  territory: { label: "Territory Profile", kind: "territory" },
  territory_eos: { label: "Territory EOS (issues, todos, rocks)", kind: "territory" },
  territory_market: { label: "Territory Market Data", kind: "territory" },
  business_financials: { label: "Business Financials", kind: "territory" },
  business_health: { label: "Business Health", kind: "territory" },
};

const CATEGORY_ORDER = [
  "contact",
  "contact_eos",
  "territory",
  "territory_eos",
  "territory_market",
  "business_financials",
  "business_health",
];

export default function CallDataTab(props: CallDataTabProps) {
  const state = getState(props);

  // Split pending vs reviewed.
  const pending = props.dataExtractions.filter((e) => !e.saved_to_profile && !e.dismissed);
  const reviewed = props.dataExtractions.filter((e) => e.saved_to_profile || e.dismissed);

  // Batch-push selection. Default to all pending checked so the rep unchecks
  // the few they don't want rather than checking dozens individually.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const defaultSelectable = pending.filter((e) => isDefaultSelectable(e));

  useEffect(() => {
    setSelected(new Set(defaultSelectable.map((e) => e.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(defaultSelectable.map((e) => e.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function pushSelected() {
    if (selected.size === 0) return;
    setBatchLoading(true);
    const ids = [...selected];
    // Parallel saves. Each /save call defaults to the extraction's stored
    // contact_id / TerritorySlug / target_scope so an empty body works.
    await Promise.allSettled(
      ids.map((id) =>
        apiFetch(`/api/calls/${props.callId}/data/${id}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )
    );
    setBatchLoading(false);
    props.onRefresh();
  }

  // Group pending by category. Keep unknown categories in their own bucket.
  const groupedPending = new Map<string, Extraction[]>();
  for (const e of pending) {
    const list = groupedPending.get(e.field_category) ?? [];
    list.push(e);
    groupedPending.set(e.field_category, list);
  }
  // Ordered list of (category, items) to render.
  const orderedGroups: { category: string; items: Extraction[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = groupedPending.get(cat);
    if (items && items.length > 0) orderedGroups.push({ category: cat, items });
  }
  // Any leftover categories Scout emitted that we haven't listed above.
  for (const [cat, items] of groupedPending) {
    if (!CATEGORY_ORDER.includes(cat) && items.length > 0) {
      orderedGroups.push({ category: cat, items });
    }
  }

  // Completeness: saved / total extracted with values.
  const totalExtracted = props.dataExtractions.filter((e) => !!e.extracted_value).length;
  const totalSaved = props.dataExtractions.filter((e) => e.saved_to_profile).length;
  const completePct = totalExtracted > 0 ? Math.round((totalSaved / totalExtracted) * 100) : 0;
  const hasMapping = (props.linkedContacts ?? []).some((c) => !!c.id) || (props.callTerritories ?? []).length > 0;

  if (state === "no_transcript") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Data extraction will be available once the transcript arrives from Read.ai.
        </p>
      </div>
    );
  }
  if (state === "ready") {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">Generate on the Overview tab to unlock data extraction.</p>
      </div>
    );
  }
  if (state === "generating") {
    return (
      <div className="text-center py-12">
        <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto mb-2" />
        <p className="text-body-sm text-text-tertiary">Scout is extracting data points...</p>
      </div>
    );
  }
  if (props.hasGenerated && props.dataExtractions.length === 0 && !hasMapping) {
    return (
      <div className="text-center py-12">
        <p className="text-body-sm text-text-tertiary">
          Map the prospect, journey, or territory first, then regenerate to extract data points.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile completeness bar */}
      {totalExtracted > 0 && (
        <div className="bg-bg-secondary border border-border-default rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-body-sm font-medium text-text-primary">
              {totalSaved} / {totalExtracted} extracted fields saved to profile
            </span>
            <span className="text-caption text-text-tertiary">{completePct}%</span>
          </div>
          <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${completePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Batch action bar — pending only. Default-checked; rep unchecks rows
          they don't want. */}
      {pending.length > 0 && (
        <div className="flex items-center justify-between bg-bg-secondary border border-border-default rounded-lg px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-text-secondary">
              {selected.size} of {pending.length} selected
            </span>
            <button
              onClick={selectAll}
              disabled={selected.size === defaultSelectable.length}
              className="text-caption text-nah-blue hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Select all
            </button>
            <span className="text-text-tertiary">·</span>
            <button
              onClick={clearAll}
              disabled={selected.size === 0}
              className="text-caption text-text-tertiary hover:text-text-primary disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <button
            onClick={() => void pushSelected()}
            disabled={selected.size === 0 || batchLoading}
            className="btn-primary px-3 py-1.5 text-caption flex items-center gap-1.5"
            title="Save all selected suggestions to their default targets (contact or territory profile). Edit individual rows first if you need to change the value or target."
          >
            {batchLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Push selected ({selected.size})
          </button>
        </div>
      )}

      {orderedGroups.map((g) => (
        <CategorySection
          key={g.category}
          category={g.category}
          items={g.items}
          partnerOptions={props.partnerOptions}
          linkedContacts={props.linkedContacts ?? []}
          callTerritories={props.callTerritories ?? []}
          selected={selected}
          onToggleSelected={toggleSelected}
          onRefresh={props.onRefresh}
        />
      ))}

      {pending.length === 0 && reviewed.length > 0 && (
        <div className="text-center py-6">
          <p className="text-body-sm text-text-tertiary">All extracted fields have been reviewed.</p>
        </div>
      )}

      {reviewed.length > 0 && (
        <ReviewedBlock
          items={reviewed}
          partnerOptions={props.partnerOptions}
          linkedContacts={props.linkedContacts ?? []}
          callTerritories={props.callTerritories ?? []}
          onRefresh={props.onRefresh}
        />
      )}
    </div>
  );
}

function isDefaultSelectable(extraction: Extraction): boolean {
  return (
    extraction.confidence?.toLowerCase() === "high" &&
    !extraction.protected_by_newer_profile &&
    !extraction.unsupported_contact_field
  );
}

function CategorySection({
  category,
  items,
  partnerOptions,
  linkedContacts,
  callTerritories,
  selected,
  onToggleSelected,
  onRefresh,
}: {
  category: string;
  items: Extraction[];
  partnerOptions: PartnerOption[];
  linkedContacts: { id: string | null; name: string }[];
  callTerritories: TerritoryOption[];
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category] ?? { label: prettifyCategory(category), kind: "contact" as const };

  return (
    <div className="bg-bg-secondary border border-border-default rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-hover transition-colors"
      >
        <h3 className="text-body-sm font-medium text-text-primary">{meta.label}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
            {items.length}
          </span>
          {open ? (
            <ChevronDown size={14} className="text-text-tertiary" />
          ) : (
            <ChevronRight size={14} className="text-text-tertiary" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {items.map((e) => (
            <CallDataField
              key={e.id}
              extraction={e}
              partnerOptions={partnerOptions}
              linkedContacts={linkedContacts}
              callTerritories={callTerritories}
              selected={selected.has(e.id)}
              onToggleSelected={() => onToggleSelected(e.id)}
              onAction={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewedBlock({
  items,
  partnerOptions,
  linkedContacts,
  callTerritories,
  onRefresh,
}: {
  items: Extraction[];
  partnerOptions: PartnerOption[];
  linkedContacts: { id: string | null; name: string }[];
  callTerritories: TerritoryOption[];
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border-default pt-3">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
        {open ? (
          <ChevronDown size={14} className="text-text-tertiary" />
        ) : (
          <ChevronRight size={14} className="text-text-tertiary" />
        )}
        <span className="text-overline text-text-tertiary tracking-wider">REVIEWED</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">{items.length}</span>
      </button>
      {open && (
        <div className="mt-2">
          {items.map((e) => (
            <CallDataField
              key={e.id}
              extraction={e}
              partnerOptions={partnerOptions}
              linkedContacts={linkedContacts}
              callTerritories={callTerritories}
              onAction={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function prettifyCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
