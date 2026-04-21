"use client";

/**
 * Reclassify + Reassign controls for the call detail page header.
 *
 * Reclassify — pick a new call_type from grouped panels (sales / coaching /
 *   internal / other).
 * Reassign   — full participant-mapping modal:
 *     * "Needs mapping" section for participants with no contact_id.
 *     * "Mapped" section with each participant's contact + territory + star
 *       to mark the call's primary contact.
 *     * Call-level territory override.
 *   Orphan count shows as a red badge on the button when > 0.
 *
 * Both submit to POST /api/calls/[id]/override. Access: admins + the rep who
 * hosts the call.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, UserCog, X, Loader2, Search, Star, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import AddProspectModal from "@/components/pipeline/AddProspectModal";
import AddRelatedContactModal from "@/components/calls/AddRelatedContactModal";

interface CallType {
  id: string;
  name: string;
  slug: string;
  category: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  coaching: "Coaching",
  internal: "Internal",
  other: "Other",
};

const CATEGORY_ORDER = ["sales", "coaching", "internal", "other"] as const;

function groupByCategory(callTypes: CallType[]): { label: string; items: CallType[] }[] {
  const buckets = new Map<string, CallType[]>();
  for (const ct of callTypes) {
    const key = ct.category ?? "other";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(ct);
  }
  const ordered: { label: string; items: CallType[] }[] = [];
  for (const key of CATEGORY_ORDER) {
    if (buckets.has(key)) {
      ordered.push({ label: CATEGORY_LABELS[key], items: buckets.get(key)! });
      buckets.delete(key);
    }
  }
  for (const [key, items] of buckets.entries()) {
    ordered.push({ label: key.charAt(0).toUpperCase() + key.slice(1), items });
  }
  return ordered;
}

interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string | null;
  phone: string | null;
}

interface TerritoryOption {
  ms_slug: string;
  territory_name: string;
}

export interface RawParticipant {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "nah_team" | "prospect" | "franchisee" | "unknown";
  user_id: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  territory_ms_slug: string | null;
}

interface Props {
  callId: string;
  hostedByUserId: string | null;
  currentCallTypeId: string | null;
  currentContactId: string | null;
  currentTerritorySlug: string | null;
  participants: RawParticipant[];
  onChange: () => void;
}

export default function CallOverrideControls(props: Props) {
  const { user, token } = useAuth();

  if (!user) return null;
  const isAdmin = user.role === "admin";
  const isOwner = props.hostedByUserId === user.id;
  if (!isAdmin && !isOwner) return null;

  return (
    <>
      <ReclassifyButton {...props} token={token} />
      <ReassignButton {...props} token={token} />
      <DeleteButton callId={props.callId} token={token} />
    </>
  );
}

// ─── Reclassify ───────────────────────────────────────────────────────────

function ReclassifyButton(props: Props & { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [callTypes, setCallTypes] = useState<CallType[]>([]);
  const [selected, setSelected] = useState<string>(props.currentCallTypeId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(props.currentCallTypeId ?? "");
    setError(null);
    void (async () => {
      const res = await fetch("/api/settings/call-types");
      if (res.ok) {
        const data = await res.json();
        setCallTypes((data.callTypes ?? data ?? []) as CallType[]);
      }
    })();
  }, [open, props.currentCallTypeId]);

  async function submit() {
    if (!selected || selected === props.currentCallTypeId) { setOpen(false); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${props.callId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(props.token ? { Authorization: `Bearer ${props.token}` } : {}),
        },
        body: JSON.stringify({ call_type_id: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setSaving(false);
      setOpen(false);
      props.onChange();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost p-1.5 flex-shrink-0" title="Reclassify call type">
        <Tag size={14} />
      </button>
      {open && (
        <ModalShell title="Reclassify call" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div className="max-h-80 overflow-y-auto space-y-3 -mx-1 px-1">
              {groupByCategory(callTypes).map((group) => (
                <div key={group.label}>
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {group.items.map((ct) => {
                      const active = selected === ct.id;
                      return (
                        <button
                          key={ct.id}
                          onClick={() => setSelected(ct.id)}
                          className={`w-full text-left px-3 py-2 text-body-sm rounded-md border transition-colors ${
                            active
                              ? "border-nah-blue bg-[#E6F1FB] text-text-primary"
                              : "border-border-default bg-bg-primary text-text-primary hover:bg-bg-secondary"
                          }`}
                        >
                          {ct.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {callTypes.length === 0 && (
                <div className="text-caption text-text-tertiary py-4 text-center">Loading…</div>
              )}
            </div>
            {error && <div className="text-caption text-danger">{error}</div>}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default -mx-4 px-4">
              <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-caption">Cancel</button>
              <button onClick={submit} disabled={saving || !selected} className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}

// ─── Reassign (participant mapping) ──────────────────────────────────────

interface ParticipantState {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  role: RawParticipant["role"];
  originalContactId: string | null;
  contactId: string | null;
  contactName: string | null;
  territorySlug: string | null;
}

function buildInitialState(participants: RawParticipant[]): ParticipantState[] {
  return participants
    .filter((p) => p.role !== "nah_team") // NAH team rows are handled by user_id and don't get mapped
    .map((p) => ({
      id: p.id,
      email: p.email,
      phone: p.contact_phone,
      display_name: p.display_name,
      role: p.role,
      originalContactId: p.contact_id,
      contactId: p.contact_id,
      contactName: p.contact_name,
      territorySlug: p.territory_ms_slug,
    }));
}

interface PendingAdd {
  participantId: string;
  kind: "prospect" | "related";
  prefill: { firstName?: string; lastName?: string; email?: string; phone?: string };
}

function splitNameForPrefill(participant: ParticipantState): {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
} {
  const result: { firstName?: string; lastName?: string; email?: string; phone?: string } = {};
  if (participant.email && !participant.email.includes("@newagainhouses.com")) result.email = participant.email;
  if (participant.phone) result.phone = participant.phone;

  const name = participant.display_name?.includes("@") ? null : participant.display_name;
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(" ");
    } else if (parts.length === 1) {
      result.firstName = parts[0];
    }
  } else if (participant.email) {
    const local = participant.email.split("@")[0];
    const pretty = local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const parts = pretty.split(" ");
    if (parts.length >= 2) {
      result.firstName = parts[0];
      result.lastName = parts.slice(1).join(" ");
    } else {
      result.firstName = pretty;
    }
  }
  return result;
}

function ReassignButton(props: Props & { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParticipantState[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(props.currentContactId);
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [primaryTerritory, setPrimaryTerritory] = useState<string | null>(null);
  const [initialSelection, setInitialSelection] = useState<{ list: string[]; primary: string | null }>({ list: [], primary: null });
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);

  const orphanCount = useMemo(
    () => props.participants.filter((p) => p.role !== "nah_team" && !p.contact_id).length,
    [props.participants],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRows(buildInitialState(props.participants));
    setPrimaryContactId(props.currentContactId);
    void (async () => {
      const [tRes, ctRes] = await Promise.all([
        fetch("/api/territories"),
        fetch(`/api/calls/${props.callId}/territories`),
      ]);
      if (tRes.ok) {
        const data = await tRes.json();
        setTerritories(((data.territories ?? data) as TerritoryOption[]) ?? []);
      }
      if (ctRes.ok) {
        const data = await ctRes.json();
        const list = (data.territories ?? []) as Array<{ territory_ms_slug: string; is_primary: boolean }>;
        const slugs = list.map((t) => t.territory_ms_slug);
        const primary = list.find((t) => t.is_primary)?.territory_ms_slug ?? props.currentTerritorySlug ?? slugs[0] ?? null;
        // Ensure the call's primary territory is in the selection even if
        // call_territories hasn't been backfilled for this call yet.
        if (props.currentTerritorySlug && !slugs.includes(props.currentTerritorySlug)) {
          slugs.push(props.currentTerritorySlug);
        }
        setSelectedTerritories(slugs);
        setPrimaryTerritory(primary);
        setInitialSelection({ list: [...slugs].sort(), primary });
      } else {
        const fallback = props.currentTerritorySlug ? [props.currentTerritorySlug] : [];
        setSelectedTerritories(fallback);
        setPrimaryTerritory(props.currentTerritorySlug);
        setInitialSelection({ list: [...fallback].sort(), primary: props.currentTerritorySlug });
      }
    })();
  }, [open, props.callId, props.participants, props.currentContactId, props.currentTerritorySlug]);

  function toggleTerritory(slug: string) {
    setSelectedTerritories((prev) => {
      if (prev.includes(slug)) {
        const next = prev.filter((s) => s !== slug);
        if (primaryTerritory === slug) setPrimaryTerritory(next[0] ?? null);
        return next;
      }
      if (prev.length === 0) setPrimaryTerritory(slug);
      return [...prev, slug];
    });
  }

  async function submit() {
    const payload: Record<string, unknown> = {};
    const changed: Array<{ id: string; contact_id: string | null }> = [];
    for (const r of rows) {
      if (r.contactId !== r.originalContactId) changed.push({ id: r.id, contact_id: r.contactId });
    }
    if (changed.length > 0) payload.participants = changed;
    if (primaryContactId !== props.currentContactId) payload.contact_id = primaryContactId;

    const sortedNow = [...selectedTerritories].sort();
    const listChanged =
      sortedNow.length !== initialSelection.list.length ||
      sortedNow.some((s, i) => s !== initialSelection.list[i]);
    const primaryChanged = primaryTerritory !== initialSelection.primary;
    if (listChanged || primaryChanged) {
      payload.territories = selectedTerritories;
      payload.primary_territory_ms_slug = primaryTerritory;
    }

    if (Object.keys(payload).length === 0) { setOpen(false); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${props.callId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(props.token ? { Authorization: `Bearer ${props.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        setSaving(false);
        return;
      }
      setSaving(false);
      setOpen(false);
      props.onChange();
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  const orphans = rows.filter((r) => !r.contactId);
  const mapped = rows.filter((r) => !!r.contactId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative btn-ghost p-1.5 flex-shrink-0"
        title="Reassign contacts / territory"
      >
        <UserCog size={14} />
        {orphanCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full bg-danger text-white text-[9px] font-semibold flex items-center justify-center">
            {orphanCount}
          </span>
        )}
      </button>
      {open && (
        <ModalShell title="Map call participants" onClose={() => setOpen(false)} wide>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto -mx-1 px-1">
            {orphans.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wider text-danger font-medium mb-1.5">
                  Needs mapping ({orphans.length})
                </div>
                <div className="space-y-1.5">
                  {orphans.map((p) => (
                    <ParticipantRow
                      key={p.id}
                      row={p}
                      isPrimary={false}
                      onContactChange={(contactId, contactName, territory) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === p.id ? { ...r, contactId, contactName, territorySlug: territory } : r,
                          ),
                        )
                      }
                      onPrimaryChange={() => setPrimaryContactId(p.contactId)}
                      onRequestAdd={(kind) =>
                        setPendingAdd({ participantId: p.id, kind, prefill: splitNameForPrefill(p) })
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {mapped.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">
                  Mapped ({mapped.length})
                </div>
                <div className="space-y-1.5">
                  {mapped.map((p) => (
                    <ParticipantRow
                      key={p.id}
                      row={p}
                      isPrimary={primaryContactId === p.contactId}
                      onContactChange={(contactId, contactName, territory) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === p.id ? { ...r, contactId, contactName, territorySlug: territory } : r,
                          ),
                        )
                      }
                      onPrimaryChange={() => setPrimaryContactId(p.contactId)}
                      onRequestAdd={(kind) =>
                        setPendingAdd({ participantId: p.id, kind, prefill: splitNameForPrefill(p) })
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                  Call territories ({selectedTerritories.length})
                </div>
                <div className="text-[10px] text-text-tertiary">
                  star = primary
                </div>
              </div>
              <div className="bg-bg-primary border border-border-default rounded-md max-h-40 overflow-y-auto divide-y divide-border-default">
                {territories.length === 0 && (
                  <div className="px-3 py-2 text-caption text-text-tertiary">Loading…</div>
                )}
                {territories.map((t) => {
                  const checked = selectedTerritories.includes(t.ms_slug);
                  const isPrimary = primaryTerritory === t.ms_slug;
                  return (
                    <label
                      key={t.ms_slug}
                      className="flex items-center gap-2 px-3 py-1.5 text-caption text-text-primary hover:bg-bg-secondary cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTerritory(t.ms_slug)}
                        className="accent-nah-orange"
                      />
                      <span className="flex-1 truncate">{t.territory_name}</span>
                      {checked && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setPrimaryTerritory(t.ms_slug); }}
                          title={isPrimary ? "Primary territory" : "Make primary"}
                          className={`p-0.5 rounded ${isPrimary ? "text-[#EAB308]" : "text-text-tertiary hover:text-text-primary"}`}
                        >
                          <Star size={12} fill={isPrimary ? "currentColor" : "none"} />
                        </button>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            {rows.length === 0 && (
              <div className="text-caption text-text-tertiary py-4 text-center">
                No external participants on this call.
              </div>
            )}
          </div>

          {error && <div className="text-caption text-danger mt-2">{error}</div>}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default -mx-4 px-4 mt-3">
            <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-caption">Cancel</button>
            <button onClick={submit} disabled={saving} className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
            </button>
          </div>
        </ModalShell>
      )}

      <AddProspectModal
        open={pendingAdd?.kind === "prospect"}
        prefill={pendingAdd?.kind === "prospect" ? pendingAdd.prefill : undefined}
        onClose={() => setPendingAdd(null)}
        onCreated={(contactId, displayName) => {
          if (!pendingAdd || !contactId) return;
          const id = pendingAdd.participantId;
          setRows((prev) =>
            prev.map((r) =>
              r.id === id
                ? { ...r, contactId, contactName: displayName ?? r.contactName ?? null }
                : r,
            ),
          );
          setPendingAdd(null);
        }}
      />

      <AddRelatedContactModal
        open={pendingAdd?.kind === "related"}
        primaryContactId={primaryContactId}
        prefill={pendingAdd?.kind === "related" ? pendingAdd.prefill : undefined}
        onClose={() => setPendingAdd(null)}
        onCreated={(newContactId) => {
          if (!pendingAdd) return;
          const id = pendingAdd.participantId;
          const pf = pendingAdd.prefill;
          const derivedName = [pf.firstName, pf.lastName].filter(Boolean).join(" ").trim() || null;
          setRows((prev) =>
            prev.map((r) =>
              r.id === id
                ? { ...r, contactId: newContactId, contactName: derivedName ?? r.contactName ?? null }
                : r,
            ),
          );
          setPendingAdd(null);
        }}
      />
    </>
  );
}

// ─── Participant row with contact search ─────────────────────────────────

interface RowProps {
  row: ParticipantState;
  isPrimary: boolean;
  onContactChange: (contactId: string | null, contactName: string | null, territory: string | null) => void;
  onPrimaryChange: () => void;
  onRequestAdd: (kind: "prospect" | "related") => void;
}

function ParticipantRow({ row, isPrimary, onContactChange, onPrimaryChange, onRequestAdd }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (query.length < 2) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.results ?? data.contacts ?? []) as ContactOption[]);
      }
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [editing, query]);

  const participantLabel = row.display_name?.includes("@") || !row.display_name
    ? row.email ?? row.display_name ?? "Unknown"
    : row.display_name;

  return (
    <div className="bg-bg-primary border border-border-default rounded-md p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-body-sm font-medium text-text-primary truncate">{participantLabel}</div>
          {row.email && row.display_name !== row.email && (
            <div className="text-caption text-text-tertiary truncate">{row.email}</div>
          )}
        </div>
        {row.contactId && (
          <button
            onClick={onPrimaryChange}
            title={isPrimary ? "Primary contact" : "Make primary"}
            className={`p-1 rounded ${isPrimary ? "text-[#EAB308]" : "text-text-tertiary hover:text-text-primary"}`}
          >
            <Star size={14} fill={isPrimary ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {row.contactId && !editing ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-secondary">
          <div className="flex-1 text-caption text-text-primary truncate">
            <span className="font-medium">{row.contactName ?? "Unknown"}</span>
            {row.territorySlug && (
              <span className="text-text-tertiary"> · {row.territorySlug}</span>
            )}
          </div>
          <button
            onClick={() => { setEditing(true); setQuery(""); setResults([]); }}
            className="text-caption text-nah-blue hover:underline"
          >
            Change
          </button>
          <button
            onClick={() => onContactChange(null, null, null)}
            className="text-text-tertiary hover:text-danger"
            title="Unmap"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts by name…"
              autoFocus
              className="w-full bg-bg-primary border border-border-default rounded-md pl-7 pr-8 py-1.5 text-caption text-text-primary placeholder:text-text-tertiary"
            />
            {editing && (
              <button
                onClick={() => { setEditing(false); setQuery(""); setResults([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {editing && query.length >= 2 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-default rounded-md shadow-lg max-h-60 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onContactChange(c.id, c.name, null);
                    setEditing(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full text-left px-3 py-1.5 text-caption hover:bg-bg-secondary"
                >
                  <div className="text-text-primary font-medium">{c.name}</div>
                  {(c.email || c.phone) && (
                    <div className="text-text-tertiary truncate">
                      {c.email ?? ""}{c.email && c.phone ? " · " : ""}{c.phone ?? ""}
                    </div>
                  )}
                </button>
              ))}
              {results.length === 0 && (
                <div className="px-3 py-1.5 text-caption text-text-tertiary">No matches.</div>
              )}
              <div className="border-t border-border-default">
                <button
                  onClick={() => { onRequestAdd("prospect"); setEditing(false); setQuery(""); setResults([]); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-caption text-nah-blue hover:bg-bg-secondary"
                >
                  <UserPlus size={12} />
                  Add new prospect
                </button>
                <button
                  onClick={() => { onRequestAdd("related"); setEditing(false); setQuery(""); setResults([]); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-caption text-nah-blue hover:bg-bg-secondary"
                >
                  <Users size={12} />
                  Add related contact
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Delete (soft-delete the call) ───────────────────────────────────────

function DeleteButton({ callId, token }: { callId: string; token: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/delete`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete");
        setSaving(false);
        return;
      }
      router.push("/calls");
    } catch {
      setError("Network error");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost p-1.5 flex-shrink-0 text-text-tertiary hover:text-danger"
        title="Delete call"
      >
        <Trash2 size={14} />
      </button>
      {open && (
        <ModalShell title="Delete this call?" onClose={() => !saving && setOpen(false)}>
          <div className="space-y-3">
            <p className="text-body-sm text-text-primary">
              Use this for calls that didn&apos;t happen — no-shows, cancellations, or duplicate webhooks.
            </p>
            <p className="text-caption text-text-tertiary">
              The call is soft-deleted and hidden from every view. An admin can restore it from the database if needed.
            </p>
            {error && <div className="text-caption text-danger">{error}</div>}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default -mx-4 px-4">
              <button onClick={() => setOpen(false)} disabled={saving} className="btn-ghost px-3 py-1.5 text-caption">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="px-3 py-1.5 text-caption rounded-md bg-danger text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete call
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onClose}>
      <div
        className={`bg-bg-secondary border border-border-default rounded-lg shadow-xl w-full ${wide ? "max-w-xl" : "max-w-md"} p-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-body-sm font-medium text-text-primary">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
