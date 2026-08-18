"use client";
import { apiFetch } from "@/lib/auth/api-fetch";

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
import { Tag, UserCog, X, Loader2, Search, Star, Trash2, UserPlus, Users, RefreshCw } from "lucide-react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
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
  contactType?: string;
}

interface TerritoryOption {
  TerritorySlug: string;
  Nickname: string;
  /** 'owner' when the contact is a territory_owner (franchisee) or
   *  'stakeholder' when they're linked via the territory ecosystem
   *  (employee/contractor/agent/etc.). Drives chip styling. */
  source?: "owner" | "stakeholder";
}

interface JourneyPipelineStateOption {
  id: string;
  TerritorySlug: string | null;
  Nickname: string | null;
  stage_name: string | null;
}

interface JourneyMembership {
  journey_id: string;
  journey_slug: string | null;
  journey_name: string;
  role: string;
  is_journey_primary: boolean;
  pipeline_states: JourneyPipelineStateOption[];
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
  TerritorySlug: string | null;
}

interface Props {
  callId: string;
  hostedByUserId: string | null;
  currentCallTypeId: string | null;
  /** Group/cohort/internal calls don't have a meaningful "primary" — every
   *  attendee is equal. The mapping modal uses this to skip auto-picking a
   *  primary contact / territory / journey on these call types. */
  currentCallTypeSlug: string | null;
  currentContactId: string | null;
  currentTerritorySlug: string | null;
  participants: RawParticipant[];
  onChange: () => void;
}

export default function CallOverrideControls(props: Props) {
  const { user } = useAuth();

  if (!user) return null;
  const isAdmin = user.role === "admin";
  const isOwner = props.hostedByUserId === user.id;
  if (!isAdmin && !isOwner) return null;

  return (
    <>
      <ReclassifyButton {...props} />
      <DeleteButton callId={props.callId} />
    </>
  );
}

// ─── Reclassify ───────────────────────────────────────────────────────────

function ReclassifyButton(props: Props) {
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
      const res = await apiFetch("/api/settings/call-types");
      if (res.ok) {
        const data = await res.json();
        setCallTypes((data.callTypes ?? data ?? []) as CallType[]);
      }
    })();
  }, [open, props.currentCallTypeId]);

  async function submit() {
    if (!selected || selected === props.currentCallTypeId) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/calls/${props.callId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
        <ModalShell
          title="Reclassify call"
          onClose={() => setOpen(false)}
          footer={
            <>
              {error && <div className="text-caption text-danger flex-1">{error}</div>}
              <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-caption">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving || !selected}
                className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
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
                            : "border-border-default bg-bg-primary text-text-primary hover:bg-bg-tertiary"
                        }`}
                      >
                        {ct.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {callTypes.length === 0 && <div className="text-caption text-text-tertiary py-4 text-center">Loading…</div>}
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
  /** Territories the mapped contact owns (franchisees can own multiple). */
  ownedTerritories: TerritoryOption[];
  /** Slugs of territories this call touches for this participant — default is all owned. */
  selectedTerritories: string[];
  /** Active journeys this contact is a member of. Surfaced inline so the rep
   *  can jump from a call's participant straight to the deal. */
  journeys: JourneyMembership[];
  /** jps ids this call advances for this participant — default is the primary
   *  journey's best-fit jps (territory match → null territory → first). */
  selectedJps: string[];
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
      territorySlug: p.TerritorySlug,
      ownedTerritories: [],
      selectedTerritories: [],
      journeys: [],
      selectedJps: [],
    }));
}

async function fetchContactTerritories(contactId: string): Promise<TerritoryOption[]> {
  try {
    const res = await apiFetch(`/api/contacts/${contactId}/territories`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      current?: Array<{
        TerritorySlug: string;
        source?: string;
        territories?: { Nickname?: string } | Array<{ Nickname?: string }>;
      }>;
    };
    return (data.current ?? []).map((row) => {
      const t = Array.isArray(row.territories) ? row.territories[0] : row.territories;
      return {
        TerritorySlug: row.TerritorySlug,
        Nickname: t?.Nickname ?? row.TerritorySlug,
        source: row.source === "stakeholder" ? "stakeholder" : "owner",
      } as TerritoryOption;
    });
  } catch {
    return [];
  }
}

async function fetchContactJourneys(contactId: string): Promise<JourneyMembership[]> {
  try {
    const res = await apiFetch(`/api/contacts/${contactId}/journey`);
    if (!res.ok) return [];
    const data = (await res.json()) as { journeys?: JourneyMembership[] };
    return data.journeys ?? [];
  } catch {
    return [];
  }
}

/** When a contact owns no territory in territory_owners, derive territory from
 *  their journey's pipeline states. Common for journey drivers, spouses, or
 *  ecosystem stakeholders whose name isn't on the territory directly. */
function deriveTerritoriesFromJourneys(journeys: JourneyMembership[]): TerritoryOption[] {
  const seen = new Set<string>();
  const out: TerritoryOption[] = [];
  for (const j of journeys) {
    for (const s of j.pipeline_states) {
      if (s.TerritorySlug && !seen.has(s.TerritorySlug)) {
        seen.add(s.TerritorySlug);
        out.push({
          TerritorySlug: s.TerritorySlug,
          Nickname: s.Nickname ?? s.TerritorySlug,
          source: "stakeholder",
        });
      }
    }
  }
  return out;
}

/**
 * Pick the best jps for a journey given the call's selected territories —
 * mirrors lib/calls/resolve-participants.ts#getActiveJourneyForContact.
 * Prefer a jps whose territory is on the call → pre-award NULL territory
 * → first available.
 */
function autoPickJps(journey: JourneyMembership, selectedTerritories: string[]): string | null {
  const states = journey.pipeline_states;
  if (states.length === 0) return null;
  const matchByTerritory = states.find((s) => s.TerritorySlug && selectedTerritories.includes(s.TerritorySlug));
  if (matchByTerritory) return matchByTerritory.id;
  const nullTerritory = states.find((s) => s.TerritorySlug === null);
  if (nullTerritory) return nullTerritory.id;
  return states[0].id;
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
  // Don't strip @newagainhouses.com emails — franchisee employees legitimately
  // use nah-provisioned addresses and we want to carry them over.
  if (participant.email) result.email = participant.email;
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

/** Group/cohort/internal calls have no meaningful "primary" — every attendee
 *  is equal. Used to suppress auto-pick of primary contact/territory/journey. */
function isGroupOrInternalSlug(slug: string | null): boolean {
  if (!slug) return false;
  return slug === "internal" || slug === "team_call" || slug === "group_call" || slug === "cohort_call";
}

/** Re-runs the participant resolver against the current team-emails + users +
 *  contacts state. Used when team members or contacts were added after the
 *  call was first processed and the rep wants stale "unknown" rows fixed
 *  without manually mapping each one. */
function ReclassifyParticipantsButton({ callId, onDone }: { callId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await apiFetch(`/api/calls/${callId}/reclassify-participants`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const parts: string[] = [];
        if (data.promotedToTeam) parts.push(`${data.promotedToTeam} → team`);
        if (data.resolvedToContact) parts.push(`${data.resolvedToContact} matched to contact`);
        setResult(
          data.updated
            ? `Updated ${data.updated} of ${data.total}${parts.length ? ` (${parts.join(", ")})` : ""}`
            : "Nothing to update"
        );
        onDone();
      } else {
        setResult(`Failed: ${data.error ?? res.statusText}`);
      }
    } catch (err) {
      setResult(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setBusy(false);
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border-default bg-bg-primary px-3 py-2">
      <div className="text-[11px] text-text-tertiary leading-relaxed">
        <span className="font-medium text-text-secondary">Re-check classifications.</span> Re-runs the resolver against
        the current team list + contacts. Fixes stale &quot;unknown&quot; rows after team members or contacts are added.
      </div>
      <button
        onClick={run}
        disabled={busy}
        className="btn-ghost px-2.5 py-1 text-caption flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Re-check
      </button>
      {result && <span className="text-[10px] text-text-tertiary">{result}</span>}
    </div>
  );
}

function ReassignButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParticipantState[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(props.currentContactId);
  const [primaryTerritory, setPrimaryTerritory] = useState<string | null>(null);
  const [primaryJps, setPrimaryJps] = useState<string | null>(null);
  const [initialSelection, setInitialSelection] = useState<{ list: string[]; primary: string | null }>({
    list: [],
    primary: null,
  });
  const [initialJourneySelection, setInitialJourneySelection] = useState<{ list: string[]; primary: string | null }>({
    list: [],
    primary: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [successFlash, setSuccessFlash] = useState<string | null>(null);

  const orphanCount = useMemo(
    () => props.participants.filter((p) => p.role !== "nah_team" && !p.contact_id).length,
    [props.participants]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    const initial = buildInitialState(props.participants);
    setRows(initial);
    setPrimaryContactId(props.currentContactId);

    void (async () => {
      const ctPromise = apiFetch(`/api/calls/${props.callId}/territories`);
      const cjPromise = apiFetch(`/api/calls/${props.callId}/journeys`);
      const territoryPromises = initial.map((r) =>
        r.contactId ? fetchContactTerritories(r.contactId) : Promise.resolve([])
      );
      const journeyPromises = initial.map((r) =>
        r.contactId ? fetchContactJourneys(r.contactId) : Promise.resolve([])
      );
      const [ctRes, cjRes, territoryResults, journeyResults] = await Promise.all([
        ctPromise,
        cjPromise,
        Promise.all(territoryPromises),
        Promise.all(journeyPromises),
      ]);

      // Pull the call's existing territory selection + primary.
      let selectedSet = new Set<string>();
      let primary = props.currentTerritorySlug;
      if (ctRes.ok) {
        const data = await ctRes.json();
        const list = (data.territories ?? []) as Array<{ TerritorySlug: string; is_primary: boolean }>;
        selectedSet = new Set(list.map((t) => t.TerritorySlug));
        primary = list.find((t) => t.is_primary)?.TerritorySlug ?? props.currentTerritorySlug;
      }
      if (props.currentTerritorySlug) selectedSet.add(props.currentTerritorySlug);

      // Pull the call's existing journey selection + primary jps.
      let selectedJpsSet = new Set<string>();
      let primaryJpsId: string | null = null;
      if (cjRes.ok) {
        const data = await cjRes.json();
        const list = (data.journeys ?? []) as Array<{
          journey_id: string;
          journey_pipeline_state_id: string;
          is_primary: boolean;
        }>;
        selectedJpsSet = new Set(list.map((j) => j.journey_pipeline_state_id));
        primaryJpsId = list.find((j) => j.is_primary)?.journey_pipeline_state_id ?? null;
      }

      // Merge each participant's owned territories + journey memberships into
      // their row. Default territory selection = (prior call selection ∩ owned)
      // if the call already has selections, otherwise all owned territories.
      const hasPriorSelection = selectedSet.size > 0;
      const hasPriorJourneySelection = selectedJpsSet.size > 0;
      const merged = initial.map((r, i) => {
        const ownedRaw = territoryResults[i];
        const journeys = journeyResults[i];
        // Journey-derived territory fallback: if the contact owns no territory
        // directly (common for journey drivers, spouses, employees attached
        // via the stakeholder model), pull TerritorySlug off their journey
        // pipeline states so the row still shows the right territory chip.
        const owned = ownedRaw.length > 0 ? ownedRaw : deriveTerritoriesFromJourneys(journeys);
        const defaulted = hasPriorSelection
          ? owned.filter((t) => selectedSet.has(t.TerritorySlug)).map((t) => t.TerritorySlug)
          : owned.map((t) => t.TerritorySlug);
        // Default jps selection = prior call selection ∩ contact's jps ids,
        // else auto-pick best jps per membership using the same rule the
        // resolver uses (territory match → null territory → first).
        const availableJpsIds = journeys.flatMap((j) => j.pipeline_states.map((s) => s.id));
        let defaultedJps: string[];
        if (hasPriorJourneySelection) {
          defaultedJps = availableJpsIds.filter((id) => selectedJpsSet.has(id));
        } else {
          defaultedJps = journeys.map((j) => autoPickJps(j, defaulted)).filter((id): id is string => !!id);
        }
        return {
          ...r,
          ownedTerritories: owned,
          selectedTerritories: defaulted,
          journeys,
          selectedJps: defaultedJps,
        };
      });
      setRows(merged);

      // Compute the call-level union for the initial snapshot (for change-detection on save).
      // On group/cohort/internal calls there's no meaningful "primary" — every
      // attendee is equal — so the auto-fallback to "first item in the list" is
      // skipped. The user-saved primary is still respected if one was set.
      const isGroup = isGroupOrInternalSlug(props.currentCallTypeSlug);
      const union = new Set<string>();
      for (const r of merged) for (const s of r.selectedTerritories) union.add(s);
      for (const s of selectedSet) union.add(s);
      const unionList = [...union];
      const resolvedPrimary = primary && union.has(primary) ? primary : isGroup ? null : (unionList[0] ?? null);
      setPrimaryTerritory(resolvedPrimary);
      setInitialSelection({ list: [...unionList].sort(), primary: resolvedPrimary });

      const jpsUnion = new Set<string>();
      for (const r of merged) for (const id of r.selectedJps) jpsUnion.add(id);
      for (const id of selectedJpsSet) jpsUnion.add(id);
      const jpsUnionList = [...jpsUnion];
      const resolvedJpsPrimary =
        primaryJpsId && jpsUnion.has(primaryJpsId) ? primaryJpsId : isGroup ? null : (jpsUnionList[0] ?? null);
      setPrimaryJps(resolvedJpsPrimary);
      setInitialJourneySelection({ list: [...jpsUnionList].sort(), primary: resolvedJpsPrimary });
    })();
  }, [
    open,
    props.callId,
    props.participants,
    props.currentContactId,
    props.currentTerritorySlug,
    props.currentCallTypeSlug,
  ]);

  // Compute the current call-level union of selected territories across participants.
  const unionSelected = useMemo(() => {
    const seen = new Map<string, string>(); // slug -> name
    for (const r of rows) {
      for (const slug of r.selectedTerritories) {
        if (!seen.has(slug)) {
          const name = r.ownedTerritories.find((t) => t.TerritorySlug === slug)?.Nickname ?? slug;
          seen.set(slug, name);
        }
      }
    }
    return [...seen.entries()].map(([TerritorySlug, Nickname]) => ({ TerritorySlug, Nickname }));
  }, [rows]);

  // If the primary was unchecked across all participants, fall back to first union slug.
  useEffect(() => {
    if (primaryTerritory && unionSelected.some((t) => t.TerritorySlug === primaryTerritory)) return;
    setPrimaryTerritory(unionSelected[0]?.TerritorySlug ?? null);
  }, [unionSelected, primaryTerritory]);

  // Call-level union of selected journey pipeline states across every participant.
  const unionSelectedJps = useMemo(() => {
    type JpsLabel = {
      id: string;
      journey_id: string;
      journey_name: string;
      journey_slug: string | null;
      Nickname: string | null;
      stage_name: string | null;
    };
    const seen = new Map<string, JpsLabel>();
    for (const r of rows) {
      for (const jpsId of r.selectedJps) {
        if (seen.has(jpsId)) continue;
        for (const j of r.journeys) {
          const s = j.pipeline_states.find((x) => x.id === jpsId);
          if (!s) continue;
          seen.set(jpsId, {
            id: jpsId,
            journey_id: j.journey_id,
            journey_name: j.journey_name,
            journey_slug: j.journey_slug,
            Nickname: s.Nickname,
            stage_name: s.stage_name,
          });
          break;
        }
      }
    }
    return [...seen.values()];
  }, [rows]);

  useEffect(() => {
    if (primaryJps && unionSelectedJps.some((j) => j.id === primaryJps)) return;
    setPrimaryJps(unionSelectedJps[0]?.id ?? null);
  }, [unionSelectedJps, primaryJps]);

  function setParticipantTerritories(participantId: string, slugs: string[]) {
    setRows((prev) => prev.map((r) => (r.id === participantId ? { ...r, selectedTerritories: slugs } : r)));
  }

  function setParticipantJps(participantId: string, jpsIds: string[]) {
    setRows((prev) => prev.map((r) => (r.id === participantId ? { ...r, selectedJps: jpsIds } : r)));
  }

  async function submit() {
    const payload: Record<string, unknown> = {};
    const changed: Array<{ id: string; contact_id: string | null }> = [];
    for (const r of rows) {
      if (r.contactId !== r.originalContactId) changed.push({ id: r.id, contact_id: r.contactId });
    }
    if (changed.length > 0) payload.participants = changed;
    if (primaryContactId !== props.currentContactId) payload.contact_id = primaryContactId;

    const unionSlugs = unionSelected.map((t) => t.TerritorySlug);
    const sortedNow = [...unionSlugs].sort();
    const listChanged =
      sortedNow.length !== initialSelection.list.length || sortedNow.some((s, i) => s !== initialSelection.list[i]);
    const primaryChanged = primaryTerritory !== initialSelection.primary;
    if (listChanged || primaryChanged) {
      payload.territories = unionSlugs;
      payload.primary_TerritorySlug = primaryTerritory;
    }

    const unionJpsIds = unionSelectedJps.map((j) => j.id);
    const sortedJpsNow = [...unionJpsIds].sort();
    const jpsListChanged =
      sortedJpsNow.length !== initialJourneySelection.list.length ||
      sortedJpsNow.some((id, i) => id !== initialJourneySelection.list[i]);
    const jpsPrimaryChanged = primaryJps !== initialJourneySelection.primary;
    if (jpsListChanged || jpsPrimaryChanged) {
      payload.journeys = unionSelectedJps.map((j) => ({
        journey_id: j.journey_id,
        journey_pipeline_state_id: j.id,
      }));
      payload.primary_journey_pipeline_state_id = primaryJps;
    }

    if (Object.keys(payload).length === 0) {
      setOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/calls/${props.callId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  // Collapse rows that share a contact_id — show one card, list the other
  // participant emails underneath. Keeps the star state unambiguous (one
  // star per contact, not per participant row).
  const { mappedPrimaries, mappedMateEmails } = useMemo(() => {
    const primaries: ParticipantState[] = [];
    const mateEmails = new Map<string, string[]>();
    const seenContacts = new Set<string>();
    for (const r of mapped) {
      const cid = r.contactId!;
      if (!seenContacts.has(cid)) {
        seenContacts.add(cid);
        primaries.push(r);
        mateEmails.set(cid, []);
      } else {
        const emails = mateEmails.get(cid) ?? [];
        if (r.email && !emails.includes(r.email)) emails.push(r.email);
        mateEmails.set(cid, emails);
      }
    }
    return { mappedPrimaries: primaries, mappedMateEmails: mateEmails };
  }, [mapped]);

  // Group mapped contacts by their selected journey for the journey-centric view.
  const journeyGroups = useMemo(() => {
    const groups = new Map<
      string,
      { journeyId: string; journeyName: string; stageName: string | null; contacts: ParticipantState[] }
    >();
    for (const r of mappedPrimaries) {
      let placed = false;
      for (const j of r.journeys) {
        const jpsIds = new Set(j.pipeline_states.map((s) => s.id));
        const hasSelected = r.selectedJps.some((id) => jpsIds.has(id));
        if (!hasSelected) continue;
        if (!groups.has(j.journey_id)) {
          const bestJps = j.pipeline_states.find((s) => r.selectedJps.includes(s.id));
          groups.set(j.journey_id, {
            journeyId: j.journey_id,
            journeyName: j.journey_name,
            stageName: bestJps?.stage_name ?? null,
            contacts: [],
          });
        }
        groups.get(j.journey_id)!.contacts.push(r);
        placed = true;
        break; // one group per contact (use first matching journey)
      }
      if (!placed) {
        // Contact has no journey — goes into "unlinked" bucket
        const key = "__no_journey__";
        if (!groups.has(key))
          groups.set(key, { journeyId: key, journeyName: "No journey linked", stageName: null, contacts: [] });
        groups.get(key)!.contacts.push(r);
      }
    }
    return Array.from(groups.values());
  }, [mappedPrimaries]);

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
        <ModalShell
          title="Map call participants"
          onClose={() => setOpen(false)}
          wide
          footer={
            <>
              {error && <div className="text-caption text-danger flex-1">{error}</div>}
              <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-caption">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="btn-primary px-3 py-1.5 text-caption disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Success flash */}
            {successFlash && (
              <div className="flex items-center gap-2 rounded-md bg-success/10 border border-success/30 px-3 py-2 text-body-sm text-success font-medium">
                <span className="text-success">✓</span> {successFlash}
              </div>
            )}

            <ReclassifyParticipantsButton callId={props.callId} onDone={props.onChange} />

            {/* ── Unmapped participants ── */}
            {orphans.length > 0 && (
              <section>
                <div className="text-[10px] uppercase tracking-wider text-danger font-medium mb-1.5">
                  Unmapped ({orphans.length})
                </div>
                <div className="space-y-1.5">
                  {orphans.map((p) => (
                    <ParticipantRow
                      key={p.id}
                      row={p}
                      isPrimary={false}
                      callPrimaryTerritory={primaryTerritory}
                      onContactChange={async (contactId, contactName, territory) => {
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === p.id
                              ? {
                                  ...r,
                                  contactId,
                                  contactName,
                                  territorySlug: territory,
                                  ownedTerritories: [],
                                  selectedTerritories: [],
                                  journeys: [],
                                  selectedJps: [],
                                }
                              : r
                          )
                        );
                        if (contactId) {
                          const [ownedRaw, journeys] = await Promise.all([
                            fetchContactTerritories(contactId),
                            fetchContactJourneys(contactId),
                          ]);
                          const owned = ownedRaw.length > 0 ? ownedRaw : deriveTerritoriesFromJourneys(journeys);
                          const territorySlugs = owned.map((t) => t.TerritorySlug);
                          const selectedJps = journeys
                            .map((j) => autoPickJps(j, territorySlugs))
                            .filter((id): id is string => !!id);
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === p.id
                                ? {
                                    ...r,
                                    ownedTerritories: owned,
                                    selectedTerritories: territorySlugs,
                                    journeys,
                                    selectedJps,
                                  }
                                : r
                            )
                          );
                          setSuccessFlash(`${contactName ?? "Contact"} mapped`);
                          setTimeout(() => setSuccessFlash(null), 3000);
                        }
                      }}
                      onTerritoriesChange={(slugs) => setParticipantTerritories(p.id, slugs)}
                      onJpsChange={(ids) => setParticipantJps(p.id, ids)}
                      onPrimaryChange={() => setPrimaryContactId(p.contactId)}
                      onPrimaryTerritoryChange={(slug) => setPrimaryTerritory(slug)}
                      onPrimaryJpsChange={(id) => setPrimaryJps(id)}
                      callPrimaryJps={primaryJps}
                      onRequestAdd={(kind) =>
                        setPendingAdd({ participantId: p.id, kind, prefill: splitNameForPrefill(p) })
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Journey-centric mapped section ── */}
            {journeyGroups.length > 0 && (
              <section className="space-y-3">
                {journeyGroups.map((group) => (
                  <div key={group.journeyId} className="border border-border-default rounded-lg overflow-hidden">
                    {/* Journey header */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 ${
                        group.journeyId === "__no_journey__"
                          ? "bg-[#FAEEDA] border-b border-[#EF9F27]/30"
                          : "bg-[#EEEDFE] border-b border-[#3A2FAE]/20"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-body-sm font-medium ${
                            group.journeyId === "__no_journey__" ? "text-[#854F0B]" : "text-[#3A2FAE]"
                          }`}
                        >
                          {group.journeyName}
                        </span>
                        {group.stageName && (
                          <span className="text-[10px] text-text-tertiary ml-1.5">· {group.stageName}</span>
                        )}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/50 text-text-tertiary">
                        {group.contacts.length} contact{group.contacts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {/* Contacts within this journey */}
                    <div className="divide-y divide-border-default">
                      {group.contacts.map((p) => (
                        <div key={p.id} className="p-2">
                          <ParticipantRow
                            row={p}
                            extraMateEmails={mappedMateEmails.get(p.contactId!) ?? []}
                            isPrimary={primaryContactId === p.contactId}
                            callPrimaryTerritory={primaryTerritory}
                            onContactChange={async (contactId, contactName, territory) => {
                              const oldContactId = p.contactId;
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.contactId === oldContactId
                                    ? {
                                        ...r,
                                        contactId,
                                        contactName,
                                        territorySlug: territory,
                                        ownedTerritories: [],
                                        selectedTerritories: [],
                                        journeys: [],
                                        selectedJps: [],
                                      }
                                    : r
                                )
                              );
                              if (contactId) {
                                const [ownedRaw, journeys] = await Promise.all([
                                  fetchContactTerritories(contactId),
                                  fetchContactJourneys(contactId),
                                ]);
                                const owned = ownedRaw.length > 0 ? ownedRaw : deriveTerritoriesFromJourneys(journeys);
                                const territorySlugs = owned.map((t) => t.TerritorySlug);
                                const selectedJps = journeys
                                  .map((j) => autoPickJps(j, territorySlugs))
                                  .filter((id): id is string => !!id);
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.contactId === contactId
                                      ? {
                                          ...r,
                                          ownedTerritories: owned,
                                          selectedTerritories: territorySlugs,
                                          journeys,
                                          selectedJps,
                                        }
                                      : r
                                  )
                                );
                              }
                            }}
                            onTerritoriesChange={(slugs) => {
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.contactId === p.contactId ? { ...r, selectedTerritories: slugs } : r
                                )
                              );
                            }}
                            onJpsChange={(ids) => {
                              setRows((prev) =>
                                prev.map((r) => (r.contactId === p.contactId ? { ...r, selectedJps: ids } : r))
                              );
                            }}
                            onPrimaryChange={() => setPrimaryContactId(p.contactId)}
                            onPrimaryTerritoryChange={(slug) => setPrimaryTerritory(slug)}
                            onPrimaryJpsChange={(id) => setPrimaryJps(id)}
                            callPrimaryJps={primaryJps}
                            onRequestAdd={(kind) =>
                              setPendingAdd({ participantId: p.id, kind, prefill: splitNameForPrefill(p) })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {rows.length === 0 && (
              <div className="text-caption text-text-tertiary py-4 text-center">
                No external participants on this call.
              </div>
            )}
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
            prev.map((r) => (r.id === id ? { ...r, contactId, contactName: displayName ?? r.contactName ?? null } : r))
          );
          setPendingAdd(null);
        }}
      />

      <AddRelatedContactModal
        open={pendingAdd?.kind === "related"}
        primaryContactId={primaryContactId}
        primaryContactName={rows.find((r) => r.contactId === primaryContactId)?.contactName ?? null}
        callTerritorySlugs={unionSelected.map((t) => t.TerritorySlug)}
        existingContactId={pendingAdd ? (rows.find((r) => r.id === pendingAdd.participantId)?.contactId ?? null) : null}
        prefill={pendingAdd?.kind === "related" ? pendingAdd.prefill : undefined}
        onClose={() => setPendingAdd(null)}
        onCreated={async (newContactId) => {
          if (!pendingAdd) return;
          const id = pendingAdd.participantId;
          const pf = pendingAdd.prefill;
          const derivedName = [pf.firstName, pf.lastName].filter(Boolean).join(" ").trim() || null;
          // Refresh the new participant's territories + journeys.
          const [owned, journeys] = await Promise.all([
            fetchContactTerritories(newContactId),
            fetchContactJourneys(newContactId),
          ]);
          const territorySlugs = owned.map((t) => t.TerritorySlug);
          const selectedJps = journeys
            .map((j) => autoPickJps(j, territorySlugs))
            .filter((jpsId): jpsId is string => !!jpsId);
          // Also refetch every other mapped contact's journeys — the
          // journey-partner flow may have renamed a shared journey (e.g.
          // Kevin's row needs to update to "Kylie Kremer + Kevin Kremer"
          // after Kylie was added as co-primary).
          const otherContactIds = Array.from(
            new Set(
              rows
                .filter((r) => r.contactId && r.contactId !== newContactId && r.id !== id)
                .map((r) => r.contactId as string)
            )
          );
          const refreshedJourneys = new Map<string, JourneyMembership[]>();
          await Promise.all(
            otherContactIds.map(async (cid) => {
              refreshedJourneys.set(cid, await fetchContactJourneys(cid));
            })
          );
          setRows((prev) =>
            prev.map((r) => {
              if (r.id === id) {
                return {
                  ...r,
                  contactId: newContactId,
                  contactName: derivedName ?? r.contactName ?? null,
                  ownedTerritories: owned,
                  selectedTerritories: territorySlugs,
                  journeys,
                  selectedJps,
                };
              }
              if (r.contactId && refreshedJourneys.has(r.contactId)) {
                return { ...r, journeys: refreshedJourneys.get(r.contactId)! };
              }
              return r;
            })
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
  /** Other participant emails that were mapped to the same contact, shown
   *  inline so the rep knows both invitation emails were grouped. */
  extraMateEmails?: string[];
  isPrimary: boolean;
  callPrimaryTerritory: string | null;
  callPrimaryJps: string | null;
  onContactChange: (contactId: string | null, contactName: string | null, territory: string | null) => void;
  onTerritoriesChange: (slugs: string[]) => void;
  onJpsChange: (jpsIds: string[]) => void;
  onPrimaryChange: () => void;
  onPrimaryTerritoryChange: (slug: string) => void;
  onPrimaryJpsChange: (jpsId: string) => void;
  onRequestAdd: (kind: "prospect" | "related") => void;
}

function ParticipantRow({
  row,
  extraMateEmails = [],
  isPrimary,
  callPrimaryTerritory,
  callPrimaryJps,
  onContactChange,
  onTerritoriesChange,
  onJpsChange,
  onPrimaryChange,
  onPrimaryTerritoryChange,
  onPrimaryJpsChange,
  onRequestAdd,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Orphans (no contactId yet) are implicitly in search mode — the input is
  // always showing for them, so the search fetch + dropdown must work without
  // requiring an explicit "editing" toggle.
  const searchActive = editing || !row.contactId;

  useEffect(() => {
    if (!searchActive) return;
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await apiFetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults((data.results ?? data.contacts ?? []) as ContactOption[]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [searchActive, query]);

  const participantLabel =
    row.display_name?.includes("@") || !row.display_name
      ? (row.email ?? row.display_name ?? "Unknown")
      : row.display_name;

  return (
    <div className="bg-bg-primary border border-border-default rounded-md p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-body-sm font-medium text-text-primary truncate">{participantLabel}</div>
          {row.email && row.display_name !== row.email && (
            <div className="text-caption text-text-tertiary truncate">{row.email}</div>
          )}
          {extraMateEmails.length > 0 && (
            <div className="text-[10px] text-text-tertiary mt-0.5 truncate">
              + {extraMateEmails.join(", ")} <span className="text-text-tertiary/70">(same contact)</span>
            </div>
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
        <>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-tertiary">
            <div className="flex-1 text-caption text-text-primary truncate">
              <span className="font-medium">{row.contactName ?? "Unknown"}</span>
              {row.ownedTerritories.length > 0 && (
                <span className="text-text-tertiary">
                  {" "}
                  · {row.ownedTerritories.length} territor{row.ownedTerritories.length === 1 ? "y" : "ies"}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setEditing(true);
                setQuery("");
                setResults([]);
              }}
              className="text-caption text-nah-blue hover:underline"
              title={
                extraMateEmails.length > 0
                  ? `Changes both emails (${extraMateEmails.length + 1} mapped)`
                  : "Swap this participant's contact"
              }
            >
              Change{extraMateEmails.length > 0 ? ` (both emails)` : ""}
            </button>
            <button
              onClick={() => onContactChange(null, null, null)}
              className="text-text-tertiary hover:text-danger"
              title="Unmap"
            >
              <X size={12} />
            </button>
          </div>

          {row.journeys.length > 0 && (
            <div className="pl-3 border-l-2 border-border-default space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                  Journey{row.journeys.length > 1 ? "s" : ""} on this call
                </span>
                <span className="text-[10px] text-text-tertiary/80">— tick to attach</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.journeys.map((j) => {
                  // One chip per journey (collapse multiple jps/pipelines into
                  // one selection). On tick, save the best-fit jps using the
                  // same rules the resolver uses (territory match → null
                  // territory → first). On untick, drop every jps id from
                  // this journey out of selectedJps.
                  const journeyJpsIds = new Set(j.pipeline_states.map((s) => s.id));
                  const pickedJpsId = autoPickJps(j, row.selectedTerritories);
                  const selectedForJourney = row.selectedJps.find((id) => journeyJpsIds.has(id));
                  const checked = !!selectedForJourney;
                  const isJourneyPrimary =
                    checked && selectedForJourney != null && callPrimaryJps === selectedForJourney;
                  const isStakeholder = j.role === "stakeholder";
                  const palette = isStakeholder
                    ? {
                        checked: "border-[#0E8F8F] bg-[#E0F7F7] text-text-primary",
                        unchecked: "border-[#0E8F8F]/40 bg-bg-primary text-[#0E8F8F] hover:text-[#0A7070]",
                      }
                    : {
                        checked: "border-[#3A2FAE] bg-[#EEEDFE] text-text-primary",
                        unchecked: "border-border-default bg-bg-primary text-text-tertiary hover:text-text-primary",
                      };
                  const baseClass = checked
                    ? isJourneyPrimary
                      ? "border-[#EAB308] bg-[#EAB308]/10 text-text-primary"
                      : palette.checked
                    : palette.unchecked;
                  return (
                    <label
                      key={j.journey_id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border cursor-pointer transition-colors ${baseClass}`}
                      title={isStakeholder ? `${j.journey_name} — via territory ecosystem` : j.journey_name}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            onJpsChange(row.selectedJps.filter((id) => !journeyJpsIds.has(id)));
                          } else if (pickedJpsId) {
                            onJpsChange([...row.selectedJps, pickedJpsId]);
                          }
                        }}
                        className="sr-only"
                      />
                      {checked && selectedForJourney && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPrimaryJpsChange(selectedForJourney);
                          }}
                          title={isJourneyPrimary ? "Primary journey" : "Make primary"}
                          className={isJourneyPrimary ? "text-[#EAB308]" : "text-text-tertiary hover:text-text-primary"}
                        >
                          <Star size={10} fill={isJourneyPrimary ? "currentColor" : "none"} />
                        </button>
                      )}
                      <span>{j.journey_name}</span>
                      {isStakeholder && <span className="text-[9px] opacity-80">· via ecosystem</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {row.ownedTerritories.length > 0 && (
            <div className="pl-3 border-l-2 border-border-default space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                  Territor{row.ownedTerritories.length === 1 ? "y" : "ies"} on this call
                </span>
                <span className="text-[10px] text-text-tertiary/80">— tick to attach</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.ownedTerritories.map((t) => {
                  const checked = row.selectedTerritories.includes(t.TerritorySlug);
                  const isPrimary = checked && callPrimaryTerritory === t.TerritorySlug;
                  const isStakeholder = t.source === "stakeholder";
                  const palette = isStakeholder
                    ? {
                        checked: "border-[#0E8F8F] bg-[#E0F7F7] text-text-primary",
                        unchecked: "border-[#0E8F8F]/40 bg-bg-primary text-[#0E8F8F] hover:text-[#0A7070]",
                      }
                    : {
                        checked: "border-nah-orange bg-nah-orange/10 text-text-primary",
                        unchecked: "border-border-default bg-bg-primary text-text-tertiary hover:text-text-primary",
                      };
                  const baseClass = checked
                    ? isPrimary
                      ? "border-[#EAB308] bg-[#EAB308]/10 text-text-primary"
                      : palette.checked
                    : palette.unchecked;
                  return (
                    <label
                      key={t.TerritorySlug}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border cursor-pointer transition-colors ${baseClass}`}
                      title={
                        isStakeholder
                          ? `${t.Nickname} — via ecosystem (employee/contractor/agent)`
                          : `${t.Nickname} — owner`
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? row.selectedTerritories.filter((s) => s !== t.TerritorySlug)
                            : [...row.selectedTerritories, t.TerritorySlug];
                          onTerritoriesChange(next);
                        }}
                        className="sr-only"
                      />
                      {checked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onPrimaryTerritoryChange(t.TerritorySlug);
                          }}
                          title={isPrimary ? "Primary territory" : "Make primary"}
                          className={isPrimary ? "text-[#EAB308]" : "text-text-tertiary hover:text-text-primary"}
                        >
                          <Star size={10} fill={isPrimary ? "currentColor" : "none"} />
                        </button>
                      )}
                      <span>{t.Nickname}</span>
                      {isStakeholder && <span className="text-[9px] opacity-80">· via ecosystem</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts by name…"
              autoFocus
              className="w-full bg-bg-primary border border-border-default rounded-md pl-7 pr-8 py-1.5 text-caption text-text-primary placeholder:text-text-tertiary"
            />
            {editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {searchActive && query.length >= 2 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-default rounded-md shadow-lg max-h-96 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onContactChange(c.id, c.name, null);
                    setEditing(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-body-sm hover:bg-bg-tertiary"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium">{c.name}</span>
                    {c.contactType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary font-medium whitespace-nowrap">
                        {c.contactType}
                      </span>
                    )}
                  </div>
                  {(c.email || c.phone) && (
                    <div className="text-caption text-text-tertiary truncate">
                      {c.email ?? ""}
                      {c.email && c.phone ? " · " : ""}
                      {c.phone ?? ""}
                    </div>
                  )}
                </button>
              ))}
              {results.length === 0 && <div className="px-3 py-2 text-caption text-text-tertiary">No matches.</div>}
              <div className="border-t border-border-default">
                <button
                  onClick={() => {
                    onRequestAdd("prospect");
                    setEditing(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-nah-blue hover:bg-bg-tertiary"
                >
                  <UserPlus size={14} />
                  Create new prospect
                </button>
                <button
                  onClick={() => {
                    onRequestAdd("related");
                    setEditing(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-nah-blue hover:bg-bg-tertiary"
                >
                  <Users size={14} />
                  Add spouse / partner / employee to ecosystem
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

function DeleteButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/calls/${callId}/delete`, {
        method: "POST",
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
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** Sticky footer (typically Cancel + Save) so the action stays visible
   *  while the rep scrolls through participant cards. */
  footer?: React.ReactNode;
}) {
  useScrollLock(true);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div
        className={`bg-surface-solid border border-border-default rounded-lg shadow-xl w-full mx-4 ${wide ? "max-w-xl" : "max-w-md"} max-h-[90vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default flex-shrink-0">
          <h3 className="text-body-sm font-medium text-text-primary">{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-default flex-shrink-0 bg-surface-solid">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
