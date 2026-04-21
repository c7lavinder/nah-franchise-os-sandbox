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
  match_method: MatchMethod;
}

export interface ResolveResult {
  contact_id: string | null;
  territory_ms_slug: string | null;
  confidence: number;
  reason: string;
  participants: ResolvedCallParticipant[];
}

export interface ResolverDb {
  findContactsByEmail(email: string): Promise<ContactMatch[]>;
  findContactsByLast10Phone(last10: string): Promise<ContactMatch[]>;
  findContactsByNameTokens(firstToken: string, lastToken: string): Promise<ContactMatch[]>;
  getActiveTerritoryForContact(ghlContactId: string): Promise<string | null>;
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
        match_method: "none",
      });
    }
  }

  // Pick the call-level contact: highest-priority tier, most-recent wins
  // across every contact matched at that tier (dedupe by id first so
  // duplicate participants hitting the same contact don't inflate the count).
  let contact_id: string | null = null;
  let territory_ms_slug: string | null = null;
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
  }

  return { contact_id, territory_ms_slug, confidence, reason, participants: perParticipant };
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
