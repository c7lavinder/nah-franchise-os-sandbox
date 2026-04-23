/**
 * Shared call-participant resolver.
 *
 * Every entry point that inserts or updates a `calls` row routes through this
 * helper so matching logic lives in one place. See docs/call-matching-audit.md
 * for the consolidation rationale.
 *
 * Signal priority (first tier with any hit wins the call-level contact):
 *   1. Exact email match on contacts.email     → confidence 1.00
 *   2. Last-10-digit phone match on contacts.phone → confidence 0.90
 *   3. Fuzzy two-token name match              → confidence 0.60
 *   4. No signals                              → null, confidence 0.00
 *
 * Within the winning tier, if multiple contacts match, the most recently
 * updated contact wins. The reason string records the tie-break for audit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContactMatch {
  id: string;
  ghl_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  updated_at: string;
}

export interface ParticipantSignal {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

export type ResolveSource = "read_ai" | "ghl_calendar" | "manual";

export interface ResolveInput {
  participants: ParticipantSignal[];
  meeting_title: string | null;
  source: ResolveSource;
}

export type ParticipantRole = "nah_team" | "prospect" | "franchisee" | "unknown";
export type MatchMethod = "email" | "phone" | "name" | "none";

export interface ResolvedCallParticipant {
  email: string | null;
  phone: string | null;
  display_name: string;
  role: ParticipantRole;
  user_id: string | null;
  contact_id: string | null;
  contact_ghl_id: string | null;
  territory_ms_slug: string | null;
  journey_id: string | null;
  journey_pipeline_state_id: string | null;
  match_method: MatchMethod;
}

export interface ResolveResult {
  contact_id: string | null;
  territory_ms_slug: string | null;
  journey_id: string | null;
  journey_pipeline_state_id: string | null;
  confidence: number;
  reason: string;
  participants: ResolvedCallParticipant[];
}

/**
 * A journey pick for a single contact.
 *
 * Journey is pipeline-invariant — the same journey carries a contact from
 * sales through coaching through ownership, only the pipeline changes.
 * So selection depends on (contact, territory), not on call_type.
 */
export interface JourneyPick {
  journey_id: string;
  journey_pipeline_state_id: string;
}

export interface ResolverDb {
  findContactsByEmail(email: string): Promise<ContactMatch[]>;
  findContactsByLast10Phone(last10: string): Promise<ContactMatch[]>;
  findContactsByNameTokens(firstToken: string, lastToken: string): Promise<ContactMatch[]>;
  getActiveTerritoryForContact(ghlContactId: string): Promise<string | null>;
  /**
   * Pick the journey_pipeline_state row that represents this contact's
   * current stage on this call. See resolver JSDoc for priority rules.
   * territoryMsSlug is the participant's own territory when known, null otherwise.
   */
  getActiveJourneyForContact(
    contactId: string,
    territoryMsSlug: string | null,
  ): Promise<JourneyPick | null>;
  /**
   * Has this journey completed onboarding? True when the journey has any
   * jps row in the `onboarding` pipeline whose current_stage.slug is
   * `onboarded`. Used by the classifier to distinguish Onboarding from
   * Coaching calls when distinct_journey_count === 1.
   */
  hasJourneyReachedOnboarded(journeyId: string): Promise<boolean>;
  isTeamEmail(email: string): Promise<boolean>;
  findUserByEmail(email: string): Promise<{ id: string; full_name: string } | null>;
}

/** Digits-only, last 10 characters. Returns null if fewer than 10 digits. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Lowercase, strip punctuation, collapse whitespace. Returns null if empty. */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function nameTokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 0);
}

function pickMostRecent(contacts: ContactMatch[]): ContactMatch {
  return [...contacts].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

function cleanDisplayName(email: string | null, name: string | null): string {
  if (name && !name.includes("@") && name.trim().length > 0) return name.trim();
  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return "Unknown";
}

function fmtContactName(c: ContactMatch): string {
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return full || c.email || c.id;
}

export async function resolveCallParticipants(
  input: ResolveInput,
  db: ResolverDb,
): Promise<ResolveResult> {
  const perParticipant: ResolvedCallParticipant[] = [];
  // Every contact ever matched, bucketed by tier, across all participants.
  const hitsByTier: Record<"email" | "phone" | "name", ContactMatch[]> = {
    email: [],
    phone: [],
    name: [],
  };

  for (const p of input.participants) {
    const email = p.email?.toLowerCase().trim() || null;
    const phoneDigits = normalizePhone(p.phone);
    const normName = normalizeName(p.name);

    // NAH team: check first, independent of contact matching.
    if (email && (await db.isTeamEmail(email))) {
      const user = await db.findUserByEmail(email);
      perParticipant.push({
        email,
        phone: phoneDigits,
        display_name: user?.full_name ?? cleanDisplayName(email, p.name ?? null),
        role: "nah_team",
        user_id: user?.id ?? null,
        contact_id: null,
        contact_ghl_id: null,
        territory_ms_slug: null,
        journey_id: null,
        journey_pipeline_state_id: null,
        match_method: "email",
      });
      continue;
    }

    let participantWinner: ContactMatch | null = null;
    let participantMethod: MatchMethod = "none";

    if (email) {
      const hits = await db.findContactsByEmail(email);
      hitsByTier.email.push(...hits);
      if (hits.length > 0) {
        participantWinner = pickMostRecent(hits);
        participantMethod = "email";
      }
    }

    if (!participantWinner && phoneDigits) {
      const hits = await db.findContactsByLast10Phone(phoneDigits);
      hitsByTier.phone.push(...hits);
      if (hits.length > 0) {
        participantWinner = pickMostRecent(hits);
        participantMethod = "phone";
      }
    }

    if (!participantWinner && normName) {
      const toks = nameTokens(normName);
      const first = toks[0];
      const last = toks[toks.length - 1];
      const eligible = toks.length >= 2 && !!first && !!last && first.length >= 2 && last.length >= 2;
      if (eligible) {
        const hits = await db.findContactsByNameTokens(first, last);
        hitsByTier.name.push(...hits);
        if (hits.length > 0) {
          participantWinner = pickMostRecent(hits);
          participantMethod = "name";
        }
      }
    }

    if (participantWinner) {
      const territory = participantWinner.ghl_contact_id
        ? await db.getActiveTerritoryForContact(participantWinner.ghl_contact_id)
        : null;
      const journey = await db.getActiveJourneyForContact(participantWinner.id, territory);
      const role: ParticipantRole = territory ? "franchisee" : "prospect";
      const displayName = [participantWinner.first_name, participantWinner.last_name].filter(Boolean).join(" ").trim()
        || cleanDisplayName(email, p.name ?? null);
      perParticipant.push({
        email,
        phone: phoneDigits,
        display_name: displayName,
        role,
        user_id: null,
        contact_id: participantWinner.id,
        contact_ghl_id: participantWinner.ghl_contact_id,
        territory_ms_slug: territory,
        journey_id: journey?.journey_id ?? null,
        journey_pipeline_state_id: journey?.journey_pipeline_state_id ?? null,
        match_method: participantMethod,
      });
    } else {
      perParticipant.push({
        email,
        phone: phoneDigits,
        display_name: cleanDisplayName(email, p.name ?? null),
        role: "unknown",
        user_id: null,
        contact_id: null,
        contact_ghl_id: null,
        territory_ms_slug: null,
        journey_id: null,
        journey_pipeline_state_id: null,
        match_method: "none",
      });
    }
  }

  // Pick the call-level contact: highest-priority tier, most-recent wins
  // across every contact matched at that tier (dedupe by id first so
  // duplicate participants hitting the same contact don't inflate the count).
  let contact_id: string | null = null;
  let territory_ms_slug: string | null = null;
  let journey_id: string | null = null;
  let journey_pipeline_state_id: string | null = null;
  let confidence = 0;
  let reason = "no signals matched";

  for (const [tier, score, label] of [
    ["email", 1.0, "email"],
    ["phone", 0.9, "phone (last 10 digits)"],
    ["name", 0.6, "fuzzy name"],
  ] as const) {
    const hits = hitsByTier[tier];
    if (hits.length === 0) continue;
    const unique = dedupeById(hits);
    const winner = pickMostRecent(unique);
    contact_id = winner.id;
    confidence = score;
    reason = unique.length > 1
      ? `${unique.length} contacts matched ${label}, picked most recent: ${fmtContactName(winner)}`
      : `matched contact by ${label}: ${fmtContactName(winner)}`;
    break;
  }

  if (contact_id) {
    const cp = perParticipant.find((p) => p.contact_id === contact_id);
    if (cp?.territory_ms_slug) territory_ms_slug = cp.territory_ms_slug;
    if (cp?.journey_id) journey_id = cp.journey_id;
    if (cp?.journey_pipeline_state_id) journey_pipeline_state_id = cp.journey_pipeline_state_id;
  }

  return {
    contact_id,
    territory_ms_slug,
    journey_id,
    journey_pipeline_state_id,
    confidence,
    reason,
    participants: perParticipant,
  };
}

function dedupeById(contacts: ContactMatch[]): ContactMatch[] {
  const seen = new Set<string>();
  const out: ContactMatch[] = [];
  for (const c of contacts) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/** Build a Supabase-backed `ResolverDb`. */
export function createSupabaseResolverDb(supabase: SupabaseClient): ResolverDb {
  return {
    async findContactsByEmail(email) {
      const { data } = await supabase
        .from("contacts")
        .select("id, ghl_contact_id, first_name, last_name, email, phone, updated_at")
        .ilike("email", email);
      return (data ?? []) as ContactMatch[];
    },
    async findContactsByLast10Phone(last10) {
      // Prefilter on last 4 digits to narrow the scan; exact match client-side.
      const { data } = await supabase
        .from("contacts")
        .select("id, ghl_contact_id, first_name, last_name, email, phone, updated_at")
        .ilike("phone", `%${last10.slice(-4)}%`);
      return ((data ?? []) as ContactMatch[]).filter((c) => {
        const d = (c.phone ?? "").replace(/\D/g, "");
        return d.length >= 10 && d.slice(-10) === last10;
      });
    },
    async findContactsByNameTokens(firstToken, lastToken) {
      const { data } = await supabase
        .from("contacts")
        .select("id, ghl_contact_id, first_name, last_name, email, phone, updated_at")
        .ilike("first_name", `%${firstToken}%`)
        .ilike("last_name", `%${lastToken}%`);
      return (data ?? []) as ContactMatch[];
    },
    async getActiveTerritoryForContact(ghlContactId) {
      const { data } = await supabase
        .from("territory_owners")
        .select("ms_slug")
        .eq("ghl_contact_id", ghlContactId)
        .is("end_date", null)
        .maybeSingle();
      return data?.ms_slug ?? null;
    },
    async getActiveJourneyForContact(contactId, territoryMsSlug) {
      // 1. Gather candidate active journeys: ones where the contact is the
      //    primary, plus ones where they're an attached member. Prefer primary.
      const { data: primaryJourneys } = await supabase
        .from("journeys")
        .select("id, updated_at")
        .eq("primary_contact_id", contactId)
        .eq("status", "active")
        .order("updated_at", { ascending: false });

      const { data: memberRows } = await supabase
        .from("journey_contacts")
        .select("journey_id, journeys!inner(id, updated_at, status)")
        .eq("contact_id", contactId)
        .is("left_at", null);

      type JourneyRow = { id: string; updated_at: string; isPrimary: boolean };
      const candidates: JourneyRow[] = [];
      for (const j of primaryJourneys ?? []) {
        candidates.push({ id: j.id, updated_at: j.updated_at, isPrimary: true });
      }
      for (const m of (memberRows ?? []) as unknown as {
        journey_id: string;
        journeys: { id: string; updated_at: string; status: string } | null;
      }[]) {
        if (!m.journeys || m.journeys.status !== "active") continue;
        if (candidates.some((c) => c.id === m.journey_id)) continue;
        candidates.push({
          id: m.journey_id,
          updated_at: m.journeys.updated_at,
          isPrimary: false,
        });
      }
      if (candidates.length === 0) return null;

      // Primary-journey membership wins; tie-break most-recent updated_at.
      candidates.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
      const journey = candidates[0];

      // 2. Pick the jps row. Prefer the one matching the call's territory; then
      //    the pre-award NULL-territory row; then the most-recently-updated active.
      const { data: jpsRows } = await supabase
        .from("journey_pipeline_state")
        .select("id, territory_ms_slug, updated_at, is_active")
        .eq("journey_id", journey.id)
        .eq("is_active", true);

      if (!jpsRows || jpsRows.length === 0) return null;

      const ranked = [...jpsRows].sort((a, b) => {
        const aTerrMatch = territoryMsSlug !== null && a.territory_ms_slug === territoryMsSlug ? 1 : 0;
        const bTerrMatch = territoryMsSlug !== null && b.territory_ms_slug === territoryMsSlug ? 1 : 0;
        if (aTerrMatch !== bTerrMatch) return bTerrMatch - aTerrMatch;
        const aNull = a.territory_ms_slug === null ? 1 : 0;
        const bNull = b.territory_ms_slug === null ? 1 : 0;
        if (aNull !== bNull) return bNull - aNull;
        return b.updated_at.localeCompare(a.updated_at);
      });

      return { journey_id: journey.id, journey_pipeline_state_id: ranked[0].id };
    },
    async hasJourneyReachedOnboarded(journeyId) {
      // Look for any jps row in the onboarding pipeline whose current
      // stage is `onboarded`. One query pulls the jps + stage + pipeline.
      const { data } = await supabase
        .from("journey_pipeline_state")
        .select("id, pipelines!inner(slug), pipeline_stages!inner(slug)")
        .eq("journey_id", journeyId)
        .eq("pipelines.slug", "onboarding")
        .eq("pipeline_stages.slug", "onboarded")
        .limit(1);
      return (data ?? []).length > 0;
    },
    async isTeamEmail(email) {
      const { data } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    },
    async findUserByEmail(email) {
      const { data } = await supabase
        .from("users")
        .select("id, full_name")
        .ilike("email", email)
        .maybeSingle();
      return data ?? null;
    },
  };
}
