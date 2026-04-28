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
  /** The territory attached to the chosen jps row (null if pre-award).
   *  Used by the resolver when the contact isn't directly listed as a
   *  territory_owner — e.g., a journey's driver/spouse who shares the
   *  franchisee's journey but isn't the GHL owner of record. */
  territory_ms_slug: string | null;
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
  getActiveJourneyForContact(contactId: string, territoryMsSlug: string | null): Promise<JourneyPick | null>;
  /**
   * Fallback journey lookup for contacts linked to a territory's ecosystem
   * (territory_stakeholders.contact_id) but not listed on the journey
   * directly — employees, contractors, local agents. Returns the active
   * journey on any territory where this contact is a stakeholder.
   */
  getJourneyForStakeholderContact(contactId: string): Promise<JourneyPick | null>;
  /**
   * Has this journey entered the Runway pipeline (Path to Inventory)?
   * True when the journey has any active jps row in the `runway` pipeline.
   * This is the threshold between Onboarding and Coaching — once a
   * franchisee is working Runway they're operational and their calls are
   * Coaching.
   */
  isJourneyInRunway(journeyId: string): Promise<boolean>;
  isTeamEmail(email: string): Promise<boolean>;
  findUserByEmail(email: string): Promise<{ id: string; full_name: string } | null>;
  /** Match a NAH team member by display name (Rylyn Ricker, Sam Ferguson) when
   *  Read.ai sent us a name with no email. Returns the user row when full_name
   *  matches case-insensitively. */
  findUserByFullName(fullName: string): Promise<{ id: string; email: string; full_name: string } | null>;
}

/** Digits-only, last 10 characters. Returns null if fewer than 10 digits. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Lowercase, strip punctuation, collapse whitespace. Returns null if empty. */
/** Strip self-identification suffixes Read.ai picks up from Zoom display names.
 *  Franchisees on group calls often label themselves like "Ken Tolbert
 *  (Chattanooga, TN)" or "John Wright (Dir Franchise Success)" — those parens
 *  break first/last token matching against the contacts table. We drop them
 *  before normalization so name-only resolution still finds the contact. */
function stripDisplayNameSuffixes(raw: string): string {
  // Remove anything inside (parens), [brackets], or after a " - " / " — " dash
  // (typical patterns: "Ken Tolbert (Chattanooga, TN)", "John Wright - Director").
  return raw
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s+[-–—]\s+.*$/, "")
    .trim();
}

export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = stripDisplayNameSuffixes(raw);
  const cleaned = stripped
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
  if (name && !name.includes("@") && name.trim().length > 0) {
    // Drop self-id suffixes ("Ken Tolbert (Chattanooga, TN)" → "Ken Tolbert")
    // so the modal/header pills are clean.
    const stripped = stripDisplayNameSuffixes(name).trim();
    if (stripped.length > 0) return stripped;
    return name.trim();
  }
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

export async function resolveCallParticipants(input: ResolveInput, db: ResolverDb): Promise<ResolveResult> {
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

    // No email but we got a name? Try to match a NAH team member by full_name.
    // Read.ai sometimes ships dial-in/mobile participants without emails — on
    // a group call that means Rylyn / Sam Ferguson / etc fall through to
    // "unknown" without this fallback.
    if (!email && p.name) {
      const stripped = stripDisplayNameSuffixes(p.name).trim();
      if (stripped.length >= 3) {
        const user = await db.findUserByFullName(stripped);
        if (user) {
          perParticipant.push({
            email: user.email,
            phone: phoneDigits,
            display_name: user.full_name,
            role: "nah_team",
            user_id: user.id,
            contact_id: null,
            contact_ghl_id: null,
            territory_ms_slug: null,
            journey_id: null,
            journey_pipeline_state_id: null,
            match_method: "name",
          });
          continue;
        }
      }
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
      const ownedTerritory = participantWinner.ghl_contact_id
        ? await db.getActiveTerritoryForContact(participantWinner.ghl_contact_id)
        : null;
      let journey = await db.getActiveJourneyForContact(participantWinner.id, ownedTerritory);
      // Stakeholder fallback — contact isn't on the journey directly but IS
      // attached to a territory's ecosystem (employee/contractor/agent).
      // Use the active journey on that territory so their calls classify
      // against the right deal.
      if (!journey) {
        journey = await db.getJourneyForStakeholderContact(participantWinner.id);
      }
      // Contact isn't listed as owner but their journey's jps has a territory
      // (common for journey drivers / spouses / stakeholders) — honor it.
      const territory = ownedTerritory ?? journey?.territory_ms_slug ?? null;
      const role: ParticipantRole = territory ? "franchisee" : "prospect";
      const displayName =
        [participantWinner.first_name, participantWinner.last_name].filter(Boolean).join(" ").trim() ||
        cleanDisplayName(email, p.name ?? null);
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
    reason =
      unique.length > 1
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

      // Ranking:
      //   1. Prefer the jps whose territory matches the call's known territory.
      //   2. Otherwise prefer most-recently-updated jps — this surfaces the
      //      journey's current stage (onboarding/runway) instead of a stale
      //      pre-award sales row that lingers after the journey advances.
      const ranked = [...jpsRows].sort((a, b) => {
        const aTerrMatch = territoryMsSlug !== null && a.territory_ms_slug === territoryMsSlug ? 1 : 0;
        const bTerrMatch = territoryMsSlug !== null && b.territory_ms_slug === territoryMsSlug ? 1 : 0;
        if (aTerrMatch !== bTerrMatch) return bTerrMatch - aTerrMatch;
        return b.updated_at.localeCompare(a.updated_at);
      });

      return {
        journey_id: journey.id,
        journey_pipeline_state_id: ranked[0].id,
        territory_ms_slug: ranked[0].territory_ms_slug ?? null,
      };
    },
    async getJourneyForStakeholderContact(contactId) {
      // 1. Find territories where this contact is an active stakeholder.
      const { data: stakeRows } = await supabase
        .from("territory_stakeholders")
        .select("ms_slug")
        .eq("contact_id", contactId)
        .eq("is_active", true);
      const slugs = [...new Set((stakeRows ?? []).map((r) => r.ms_slug))];
      if (slugs.length === 0) return null;

      // 2. Find active journey_pipeline_state rows on any of those territories.
      const { data: jpsRows } = await supabase
        .from("journey_pipeline_state")
        .select("id, journey_id, territory_ms_slug, updated_at")
        .in("territory_ms_slug", slugs)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1);
      const jps = jpsRows?.[0];
      if (!jps) return null;

      return {
        journey_id: jps.journey_id,
        journey_pipeline_state_id: jps.id,
        territory_ms_slug: jps.territory_ms_slug ?? null,
      };
    },
    async isJourneyInRunway(journeyId) {
      // True iff the journey has an active jps row in the `runway` pipeline
      // (Path to Inventory). Entering runway = operational franchisee.
      const { data } = await supabase
        .from("journey_pipeline_state")
        .select("id, pipelines!inner(slug)")
        .eq("journey_id", journeyId)
        .eq("pipelines.slug", "runway")
        .eq("is_active", true)
        .limit(1);
      return (data ?? []).length > 0;
    },
    async isTeamEmail(email) {
      // Check primary email
      const { data } = await supabase
        .from("users")
        .select("id")
        .ilike("email", email)
        .eq("is_active", true)
        .maybeSingle();
      if (data) return true;
      // Check aliases
      const { data: alias } = await supabase
        .from("user_email_aliases")
        .select("user_id")
        .ilike("email", email)
        .maybeSingle();
      return !!alias;
    },
    async findUserByEmail(email) {
      // Check primary email
      const { data } = await supabase.from("users").select("id, full_name").ilike("email", email).maybeSingle();
      if (data) return data;
      // Check aliases → look up the user
      const { data: alias } = await supabase
        .from("user_email_aliases")
        .select("user_id")
        .ilike("email", email)
        .maybeSingle();
      if (alias) {
        const { data: user } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("id", alias.user_id)
          .maybeSingle();
        return user ?? null;
      }
      return null;
    },
    async findUserByFullName(fullName) {
      const { data } = await supabase
        .from("users")
        .select("id, email, full_name")
        .ilike("full_name", fullName)
        .eq("is_active", true)
        .maybeSingle();
      return data ?? null;
    },
  };
}
