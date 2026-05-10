"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

import { useState } from "react";
import { Check, Pencil, X, Loader2, AlertTriangle, Sparkles, Users } from "lucide-react";

/**
 * Uniform confidence badge — every row gets one so the UI stays consistent.
 * Null confidence renders as "high" (Scout rarely omits it, but we fall back
 * rather than leave the card visually different).
 */
function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  const c = (confidence ?? "high").toLowerCase();
  const styles =
    c === "low"
      ? "bg-danger/10 text-danger border-danger/30"
      : c === "medium"
        ? "bg-warning/15 text-warning border-warning/40"
        : "bg-success/15 text-success border-success/40";
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 uppercase tracking-wider font-semibold ${styles}`}
    >
      {c}
    </span>
  );
}

/** Target badge — clickable on pending rows so the rep can reassign a push to
 *  a different contact or a territory with one click. Color-coded: blue =
 *  contact, orange = territory, purple = both primaries on a partnership. */
function TargetBadge({
  kind,
  label,
  onClick,
  editable,
}: {
  kind: "contact" | "territory" | "partnership";
  label: string;
  onClick?: () => void;
  editable?: boolean;
}) {
  const styles =
    kind === "territory"
      ? "bg-nah-orange/10 text-nah-orange border-nah-orange/30"
      : kind === "partnership"
        ? "bg-scout-purple/10 text-scout-purple border-scout-purple/30"
        : "bg-nah-blue/10 text-nah-blue border-nah-blue/30";
  const prefix = kind === "territory" ? "→ Territory" : kind === "partnership" ? "→ Partnership" : "→ Contact";
  const interactive = editable ? "cursor-pointer hover:opacity-80" : "";
  const suffix = editable ? " ▾" : "";
  return (
    <span
      onClick={onClick}
      className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 font-medium ${styles} ${interactive}`}
    >
      {prefix}: {label}
      {suffix}
    </span>
  );
}

interface ExtractionData {
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
}

interface PartnerOption {
  id: string;
  name: string;
}
interface TerritoryOption {
  TerritorySlug: string;
  Nickname: string;
}

interface CallDataFieldProps {
  extraction: ExtractionData;
  /** Real journey co-primaries on this call (Kevin + Kylie style). When length
   *  >= 2 the "Both primaries" option shows. Empty on plain group calls. */
  partnerOptions?: PartnerOption[];
  linkedContacts?: { id: string | null; name: string }[];
  callTerritories?: TerritoryOption[];
  onAction: () => void;
}

/** Unified target model. A row is always pushed to ONE of three things:
 *  - a specific contact (most contact-fields)
 *  - a specific territory (operations/market data)
 *  - both journey primaries (only when it's a real partnership journey) */
type TargetPick =
  | { kind: "contact"; contactId: string; label: string }
  | { kind: "territory"; territorySlug: string; label: string }
  | { kind: "both"; label: string };

const FIELD_LABELS: Record<string, string> = {
  employment_status: "Employment Status",
  years_in_current_role: "Years in Current Role",
  timeline_intent: "Timeline Intent",
  capital_range: "Capital Range",
  lead_source: "Lead Source",
  competitors_mentioned: "Competitors Mentioned",
  stated_why: 'Stated "Why"',
  risk_tolerance: "Risk Tolerance",
  family_situation: "Family Situation",
  prior_business_ownership: "Prior Business Ownership",
  market_interest: "Market Interest",
  territory_type_preference: "Territory Type Preference",
  availability_confirmed: "Availability Confirmed",
};

const IMPORTANT_FIELDS = new Set(["capital_range", "timeline_intent", "stated_why", "market_interest"]);

export default function CallDataField({
  extraction,
  partnerOptions,
  linkedContacts,
  callTerritories,
  onAction,
}: CallDataFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(extraction.extracted_value ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const label = FIELD_LABELS[extraction.field_key] ?? extraction.field_key.replace(/_/g, " ");
  const hasValue = !!extraction.extracted_value;
  const isDone = extraction.saved_to_profile || extraction.dismissed;
  const isImportant = IMPORTANT_FIELDS.has(extraction.field_key);

  // Target label — always show where this extraction is being pushed.
  const isTerritoryField =
    extraction.field_category.startsWith("territory") || extraction.field_category.startsWith("business_");
  const territoryName = extraction.TerritorySlug
    ? (callTerritories?.find((t) => t.TerritorySlug === extraction.TerritorySlug)?.Nickname ?? extraction.TerritorySlug)
    : null;
  const contactName = extraction.contact_id
    ? (linkedContacts?.find((c) => c.id === extraction.contact_id)?.name ??
      partnerOptions?.find((p) => p.id === extraction.contact_id)?.name ??
      null)
    : null;

  // Picker options: every contact + every territory on the call. Always
  // editable so the rep can move a row that Scout mis-routed (e.g. move Brett-
  // the-employee's operations comment from "Brett contact" to "Brian's
  // territory"). Partnership "Both" only surfaces when partnerOptions is a
  // real journey partnership (2+ co_primaries on the same journey).
  const contactChoices = (linkedContacts ?? [])
    .filter((c): c is { id: string; name: string } => !!c.id)
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
  const territoryChoices = callTerritories ?? [];
  const hasPartnership = (partnerOptions?.length ?? 0) >= 2;

  const initialPick: TargetPick = (() => {
    if (extraction.target_scope === "both" && hasPartnership) {
      return { kind: "both", label: "Both primaries" };
    }
    if (extraction.TerritorySlug) {
      const t = territoryChoices.find((t) => t.TerritorySlug === extraction.TerritorySlug);
      if (t) return { kind: "territory", territorySlug: t.TerritorySlug, label: t.Nickname };
    }
    if (extraction.contact_id) {
      const c = contactChoices.find((c) => c.id === extraction.contact_id);
      if (c) return { kind: "contact", contactId: c.id, label: c.name };
    }
    // Scout didn't route — default by field category.
    if (isTerritoryField && territoryChoices[0]) {
      return {
        kind: "territory",
        territorySlug: territoryChoices[0].TerritorySlug,
        label: territoryChoices[0].Nickname,
      };
    }
    if (contactChoices[0]) {
      return { kind: "contact", contactId: contactChoices[0].id, label: contactChoices[0].name };
    }
    return { kind: "contact", contactId: extraction.contact_id ?? "", label: "Unassigned" };
  })();
  const [pick, setPick] = useState<TargetPick>(initialPick);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Done state
  if (isDone) {
    const doneIsTerritory =
      extraction.field_category.startsWith("territory") || extraction.field_category.startsWith("business_");
    const doneTerritoryName = extraction.TerritorySlug
      ? (callTerritories?.find((t) => t.TerritorySlug === extraction.TerritorySlug)?.Nickname ??
        extraction.TerritorySlug)
      : null;
    const doneContactName = extraction.contact_id
      ? (linkedContacts?.find((c) => c.id === extraction.contact_id)?.name ??
        partnerOptions?.find((p) => p.id === extraction.contact_id)?.name ??
        null)
      : null;
    const doneTargetKind: "contact" | "territory" = doneIsTerritory ? "territory" : "contact";
    const doneTargetLabel = doneIsTerritory ? (doneTerritoryName ?? "Unassigned") : (doneContactName ?? "Unassigned");

    return (
      <div
        className={`flex items-start gap-3 py-2 border-b border-border-default last:border-b-0 ${
          extraction.dismissed ? "opacity-50" : "opacity-70"
        }`}
      >
        <div className="mt-0.5">
          {extraction.dismissed ? (
            <X size={12} className="text-text-tertiary" />
          ) : (
            <Check size={12} className="text-success" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-caption text-text-tertiary capitalize">{label}</p>
            <ConfidenceBadge confidence={extraction.confidence} />
            <TargetBadge kind={doneTargetKind} label={doneTargetLabel} />
          </div>
          {hasValue && (
            <p className={`text-body-sm text-text-secondary mt-0.5 ${extraction.dismissed ? "line-through" : ""}`}>
              {extraction.extracted_value}
            </p>
          )}
        </div>
        <span className="text-[10px] text-text-tertiary flex-shrink-0 mt-1">
          {extraction.dismissed ? "Skipped" : "Saved"}
        </span>
      </div>
    );
  }

  // No value extracted
  if (!hasValue) {
    return (
      <div className="flex items-center gap-3 py-2 border-b border-border-default last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-caption text-text-tertiary capitalize">{label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm text-text-tertiary italic">Not captured</span>
          {isImportant && (
            <span className="flex items-center gap-0.5 text-[10px] text-warning">
              <AlertTriangle size={10} /> Flag for next call
            </span>
          )}
        </div>
      </div>
    );
  }

  async function handlePush() {
    setLoading("push");
    try {
      const body: Record<string, unknown> = {};
      if (pick.kind === "contact") {
        body.target_type = "contact";
        body.target_contact_id = pick.contactId;
        body.target_scope = "single";
      } else if (pick.kind === "territory") {
        body.target_type = "territory";
        body.target_TerritorySlug = pick.territorySlug;
      } else {
        body.target_type = "contact";
        body.target_scope = "both";
      }
      const res = await apiFetch(`/api/calls/${extraction.call_id}/data/${extraction.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onAction();
    } catch {
      /* silent */
    }
    setLoading(null);
  }

  async function handleEditSave() {
    setLoading("edit");
    try {
      const res = await apiFetch(`/api/calls/${extraction.call_id}/data/${extraction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_save", field_value: editValue }),
      });
      if (res.ok) {
        setEditing(false);
        onAction();
      }
    } catch {
      /* silent */
    }
    setLoading(null);
  }

  async function handleSkip() {
    setLoading("skip");
    try {
      const res = await apiFetch(`/api/calls/${extraction.call_id}/data/${extraction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      if (res.ok) onAction();
    } catch {
      /* silent */
    }
    setLoading(null);
  }

  async function handleAiRewrite() {
    if (!aiInstruction.trim()) return;
    setAiLoading(true);
    try {
      const res = await apiFetch(`/api/calls/${extraction.call_id}/actions/_/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: aiInstruction,
          currentFields: { field_value: editValue, field_label: label },
          category: "data",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fields?.field_value) setEditValue(data.fields.field_value);
        setAiInstruction("");
      }
    } catch {
      /* silent */
    }
    setAiLoading(false);
  }

  // Target label reflects the current pick. Badge is clickable and opens the
  // unified picker (contacts + territories + optional "Both primaries").
  const targetKind: "contact" | "territory" | "partnership" =
    pick.kind === "territory" ? "territory" : pick.kind === "both" ? "partnership" : "contact";
  const targetLabel = pick.label;

  // Pending state — with Push/Edit/Skip
  return (
    <div className="py-2 border-b border-border-default last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-caption text-text-tertiary capitalize">{label}</p>
            {!editing && <ConfidenceBadge confidence={extraction.confidence} />}
            {!editing && (
              <TargetBadge kind={targetKind} label={targetLabel} editable onClick={() => setPickerOpen((v) => !v)} />
            )}
          </div>
          {editing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                className="w-full bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary resize-none"
              />
              {/* Tell AI what to change */}
              <div>
                <label className="text-[10px] text-scout-purple font-medium flex items-center gap-1 mb-1">
                  <Sparkles size={10} /> TELL SCOUT WHAT TO CHANGE
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="e.g. Shorten to key phrase only..."
                    className="flex-1 bg-bg-primary border border-border-default rounded-md px-2 py-1.5 text-body-sm text-text-primary placeholder:text-text-tertiary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAiRewrite();
                    }}
                  />
                  <button
                    onClick={() => void handleAiRewrite()}
                    disabled={aiLoading || !aiInstruction.trim()}
                    className="btn-ghost px-2 py-1.5 text-caption flex items-center gap-1 text-scout-purple"
                  >
                    {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Apply
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleEditSave()}
                  disabled={loading !== null}
                  className="btn-primary px-3 py-1 text-caption flex items-center gap-1"
                >
                  {loading === "edit" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save to Profile
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditValue(extraction.extracted_value ?? "");
                  }}
                  className="btn-ghost px-3 py-1 text-caption"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-body-sm text-text-primary mt-0.5">{extraction.extracted_value}</p>
          )}
        </div>
      </div>

      {/* Unified target picker — dropdown with every contact + every territory
          on the call, plus "Both primaries" when the journey is a real
          partnership (Kevin + Kylie). Rep can move any row freely. */}
      {!editing && pickerOpen && (
        <div className="mt-2 bg-white border border-border-default rounded-md p-2 space-y-1 shadow-sm">
          {contactChoices.length > 0 && (
            <>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary px-1 pb-0.5">
                Contacts
              </div>
              <div className="flex flex-wrap gap-1">
                {contactChoices.map((c) => {
                  const selected = pick.kind === "contact" && pick.contactId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setPick({ kind: "contact", contactId: c.id, label: c.name });
                        setPickerOpen(false);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                        selected ? "bg-nah-blue text-white" : "bg-nah-blue/10 text-nah-blue hover:bg-nah-blue/20"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {territoryChoices.length > 0 && (
            <>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary px-1 pt-1 pb-0.5">
                Territories
              </div>
              <div className="flex flex-wrap gap-1">
                {territoryChoices.map((t) => {
                  const selected = pick.kind === "territory" && pick.territorySlug === t.TerritorySlug;
                  return (
                    <button
                      key={t.TerritorySlug}
                      onClick={() => {
                        setPick({ kind: "territory", territorySlug: t.TerritorySlug, label: t.Nickname });
                        setPickerOpen(false);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                        selected
                          ? "bg-nah-orange text-white"
                          : "bg-nah-orange/10 text-nah-orange hover:bg-nah-orange/20"
                      }`}
                    >
                      {t.Nickname}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {hasPartnership && (
            <>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary px-1 pt-1 pb-0.5">
                Partnership
              </div>
              <button
                onClick={() => {
                  setPick({ kind: "both", label: "Both primaries" });
                  setPickerOpen(false);
                }}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
                  pick.kind === "both"
                    ? "bg-scout-purple text-white"
                    : "bg-scout-purple/10 text-scout-purple hover:bg-scout-purple/20"
                }`}
              >
                <Users size={9} /> Both primaries
              </button>
            </>
          )}
        </div>
      )}

      {/* Action buttons — only when not editing */}
      {!editing && (
        <div className="flex items-center gap-2 mt-1.5 ml-0">
          <button
            onClick={() => void handlePush()}
            disabled={
              loading !== null ||
              (pick.kind === "contact" && !pick.contactId) ||
              (pick.kind === "territory" && !pick.territorySlug)
            }
            className="btn-primary px-3 py-1 text-caption flex items-center gap-1"
          >
            {loading === "push" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Push to Profile
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={loading !== null}
            className="btn-ghost px-3 py-1 text-caption flex items-center gap-1"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => void handleSkip()}
            disabled={loading !== null}
            className="btn-ghost px-3 py-1 text-caption flex items-center gap-1 text-text-tertiary"
          >
            {loading === "skip" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
