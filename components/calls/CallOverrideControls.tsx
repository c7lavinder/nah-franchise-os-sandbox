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
import { Tag, UserCog, X, Loader2, Search, Star } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

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

function ReassignButton(props: Props & { token: string | null }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParticipantState[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(props.currentContactId);
  const [territorySlug, setTerritorySlug] = useState<string | null>(props.currentTerritorySlug);
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orphanCount = useMemo(
    () => props.participants.filter((p) => p.role !== "nah_team" && !p.contact_id).length,
    [props.participants],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRows(buildInitialState(props.participants));
    setPrimaryContactId(props.currentContactId);
    setTerritorySlug(props.currentTerritorySlug);
    void (async () => {
      const res = await fetch("/api/territories");
      if (res.ok) {
        const data = await res.json();
        setTerritories(((data.territories ?? data) as TerritoryOption[]) ?? []);
      }
    })();
  }, [open, props.participants, props.currentContactId, props.currentTerritorySlug]);

  async function submit() {
    const payload: Record<string, unknown> = {};
    const changed: Array<{ id: string; contact_id: string | null }> = [];
    for (const r of rows) {
      if (r.contactId !== r.originalContactId) changed.push({ id: r.id, contact_id: r.contactId });
    }
    if (changed.length > 0) payload.participants = changed;
    if (primaryContactId !== props.currentContactId) payload.contact_id = primaryContactId;
    if (territorySlug !== props.currentTerritorySlug) payload.territory_ms_slug = territorySlug;

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
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium mb-1.5">
                Call territory
              </div>
              <select
                value={territorySlug ?? ""}
                onChange={(e) => setTerritorySlug(e.target.value || null)}
                className="w-full bg-bg-primary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary"
              >
                <option value="">— none —</option>
                {territories.map((t) => (
                  <option key={t.ms_slug} value={t.ms_slug}>{t.territory_name}</option>
                ))}
              </select>
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
    </>
  );
}

// ─── Participant row with contact search ─────────────────────────────────

interface RowProps {
  row: ParticipantState;
  isPrimary: boolean;
  onContactChange: (contactId: string | null, contactName: string | null, territory: string | null) => void;
  onPrimaryChange: () => void;
}

function ParticipantRow({ row, isPrimary, onContactChange, onPrimaryChange }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (query.length < 2) { setResults([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/pipeline/contacts?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.contacts ?? []) as ContactOption[]);
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
          {results.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-default rounded-md shadow-lg max-h-40 overflow-y-auto">
              {results.map((c) => {
                const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown";
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      onContactChange(c.id, name, null);
                      setEditing(false);
                      setQuery("");
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-1.5 text-caption text-text-primary hover:bg-bg-secondary"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
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
