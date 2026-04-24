import { describe, it, expect } from "vitest";
import {
  resolveCallParticipants,
  normalizePhone,
  normalizeName,
  type ContactMatch,
  type JourneyPick,
  type ResolverDb,
  type ResolveInput,
} from "./resolve-participants";

/**
 * Test fixtures for journey resolution.
 *
 * journeys: all active journeys keyed by id with their primary_contact_id.
 * journeyMembers: contact_id -> journey_ids they're attached to (non-primary).
 * jpsByJourney: journey_id -> rows to consider for jps selection.
 */
interface JourneyFixture {
  id: string;
  primaryContactId: string;
  updatedAt: string;
}
interface JpsFixture {
  id: string;
  journeyId: string;
  territoryMsSlug: string | null;
  updatedAt: string;
  isActive: boolean;
}

interface Fixture {
  contacts: ContactMatch[];
  teamEmails: Set<string>;
  teamUsers: Map<string, { id: string; full_name: string }>;
  territories: Map<string, string>; // ghl_contact_id -> ms_slug
  journeys?: JourneyFixture[];
  journeyMembers?: Map<string, string[]>; // contact_id -> journey_ids (non-primary)
  jps?: JpsFixture[];
  /** Journey ids that have an active jps in the runway pipeline. */
  inRunway?: Set<string>;
  /** contact_id -> ms_slugs where they're an active territory stakeholder. */
  stakeholderTerritories?: Map<string, string[]>;
}

function makeDb(fx: Fixture): ResolverDb {
  return {
    async findContactsByEmail(email) {
      return fx.contacts.filter((c) => c.email?.toLowerCase() === email.toLowerCase());
    },
    async findContactsByLast10Phone(last10) {
      return fx.contacts.filter((c) => {
        const d = (c.phone ?? "").replace(/\D/g, "");
        return d.length >= 10 && d.slice(-10) === last10;
      });
    },
    async findContactsByNameTokens(first, last) {
      return fx.contacts.filter(
        (c) =>
          (c.first_name ?? "").toLowerCase().includes(first.toLowerCase()) &&
          (c.last_name ?? "").toLowerCase().includes(last.toLowerCase()),
      );
    },
    async getActiveTerritoryForContact(ghl) {
      return fx.territories.get(ghl) ?? null;
    },
    async getActiveJourneyForContact(contactId, territoryMsSlug): Promise<JourneyPick | null> {
      const journeys = fx.journeys ?? [];
      const members = fx.journeyMembers ?? new Map();
      const jpsRows = (fx.jps ?? []).filter((r) => r.isActive);

      type Cand = { id: string; updatedAt: string; isPrimary: boolean };
      const cands: Cand[] = [];
      for (const j of journeys) {
        if (j.primaryContactId === contactId) {
          cands.push({ id: j.id, updatedAt: j.updatedAt, isPrimary: true });
        }
      }
      for (const jid of members.get(contactId) ?? []) {
        if (cands.some((c) => c.id === jid)) continue;
        const j = journeys.find((x) => x.id === jid);
        if (!j) continue;
        cands.push({ id: j.id, updatedAt: j.updatedAt, isPrimary: false });
      }
      if (cands.length === 0) return null;
      cands.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
      const chosen = cands[0];
      const rows = jpsRows.filter((r) => r.journeyId === chosen.id);
      if (rows.length === 0) return null;
      rows.sort((a, b) => {
        const aMatch = territoryMsSlug !== null && a.territoryMsSlug === territoryMsSlug ? 1 : 0;
        const bMatch = territoryMsSlug !== null && b.territoryMsSlug === territoryMsSlug ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
      return {
        journey_id: chosen.id,
        journey_pipeline_state_id: rows[0].id,
        territory_ms_slug: rows[0].territoryMsSlug ?? null,
      };
    },
    async getJourneyForStakeholderContact(contactId): Promise<JourneyPick | null> {
      const slugs = fx.stakeholderTerritories?.get(contactId) ?? [];
      if (slugs.length === 0) return null;
      const rows = (fx.jps ?? [])
        .filter((r) => r.isActive && r.territoryMsSlug && slugs.includes(r.territoryMsSlug))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const first = rows[0];
      if (!first) return null;
      return {
        journey_id: first.journeyId,
        journey_pipeline_state_id: first.id,
        territory_ms_slug: first.territoryMsSlug ?? null,
      };
    },
    async isJourneyInRunway(journeyId) {
      return fx.inRunway?.has(journeyId) ?? false;
    },
    async isTeamEmail(email) {
      return fx.teamEmails.has(email.toLowerCase());
    },
    async findUserByEmail(email) {
      return fx.teamUsers.get(email.toLowerCase()) ?? null;
    },
    async findUserByFullName(fullName) {
      const target = fullName.toLowerCase().trim();
      for (const [email, user] of fx.teamUsers) {
        if (user.full_name.toLowerCase() === target) {
          return { ...user, email };
        }
      }
      return null;
    },
  };
}

function c(overrides: Partial<ContactMatch>): ContactMatch {
  return {
    id: overrides.id ?? "contact-x",
    ghl_contact_id: overrides.ghl_contact_id ?? "ghl-x",
    first_name: overrides.first_name ?? null,
    last_name: overrides.last_name ?? null,
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

function baseInput(overrides: Partial<ResolveInput> = {}): ResolveInput {
  return {
    participants: [],
    meeting_title: null,
    source: "read_ai",
    ...overrides,
  };
}

describe("normalizePhone", () => {
  it("strips non-digits and returns last 10", () => {
    expect(normalizePhone("+1 (615) 555-1212")).toBe("6155551212");
    expect(normalizePhone("615.555.1212")).toBe("6155551212");
    expect(normalizePhone("6155551212")).toBe("6155551212");
    expect(normalizePhone("   +1-615-555-1212   ")).toBe("6155551212");
  });
  it("returns null for fewer than 10 digits", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("normalizeName", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeName("John D. Smith")).toBe("john d smith");
    // Apostrophe becomes space (same as other punctuation) — callers should
    // rely on the token-based match for names like O'Brien.
    expect(normalizeName("  O'Brien,  Patrick  ")).toBe("o brien patrick");
  });
  it("returns null for empty / punctuation-only input", () => {
    expect(normalizeName("")).toBeNull();
    expect(normalizeName("   ")).toBeNull();
    expect(normalizeName(null)).toBeNull();
  });
});

describe("resolveCallParticipants", () => {
  it("returns no match for empty participants", async () => {
    const db = makeDb({
      contacts: [],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(baseInput(), db);
    expect(r.contact_id).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.reason).toBe("no signals matched");
    expect(r.participants).toHaveLength(0);
  });

  it("matches contact by exact email → confidence 1.0", async () => {
    const db = makeDb({
      contacts: [c({ id: "c1", email: "jane@acme.com", first_name: "Jane", last_name: "Doe" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "jane@acme.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("c1");
    expect(r.confidence).toBe(1.0);
    expect(r.reason).toMatch(/matched contact by email/);
    expect(r.participants[0].role).toBe("prospect");
  });

  it("recognizes NAH team emails, no contact match attempted", async () => {
    const db = makeDb({
      contacts: [],
      teamEmails: new Set(["matt@newagainhouses.com"]),
      teamUsers: new Map([["matt@newagainhouses.com", { id: "u1", full_name: "Matt Lavinder" }]]),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "Matt@newagainhouses.com" }] }),
      db,
    );
    expect(r.contact_id).toBeNull();
    expect(r.participants[0].role).toBe("nah_team");
    expect(r.participants[0].user_id).toBe("u1");
    expect(r.participants[0].display_name).toBe("Matt Lavinder");
  });

  it("falls through to phone when email misses → confidence 0.9", async () => {
    const db = makeDb({
      contacts: [c({ id: "c2", phone: "+1 (615) 555-0100", first_name: "Phone", last_name: "Guy" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "unknown@x.com", phone: "6155550100" }] }),
      db,
    );
    expect(r.contact_id).toBe("c2");
    expect(r.confidence).toBe(0.9);
    expect(r.reason).toMatch(/phone \(last 10 digits\)/);
  });

  it("phone-only participant (no email) matches", async () => {
    const db = makeDb({
      contacts: [c({ id: "c3", phone: "615-555-9999" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ phone: "+1 615 555 9999" }] }),
      db,
    );
    expect(r.contact_id).toBe("c3");
    expect(r.confidence).toBe(0.9);
  });

  it("falls through to name when email + phone miss → confidence 0.6", async () => {
    const db = makeDb({
      contacts: [c({ id: "c4", first_name: "Alice", last_name: "Johnson" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ name: "Alice Johnson" }] }),
      db,
    );
    expect(r.contact_id).toBe("c4");
    expect(r.confidence).toBe(0.6);
    expect(r.reason).toMatch(/fuzzy name/);
  });

  it("single-token names are excluded from name matching", async () => {
    const db = makeDb({
      contacts: [c({ id: "c5", first_name: "Alice", last_name: "Johnson" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ name: "Alice" }] }),
      db,
    );
    expect(r.contact_id).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("middle-initial names still resolve via first+last tokens", async () => {
    const db = makeDb({
      contacts: [c({ id: "c6", first_name: "John", last_name: "Smith" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ name: "John D. Smith" }] }),
      db,
    );
    expect(r.contact_id).toBe("c6");
    expect(r.confidence).toBe(0.6);
  });

  it("duplicate email contacts → picks most recently updated", async () => {
    const db = makeDb({
      contacts: [
        c({ id: "old", email: "dupe@x.com", first_name: "Old", updated_at: "2026-01-01T00:00:00Z" }),
        c({ id: "new", email: "dupe@x.com", first_name: "New", updated_at: "2026-06-01T00:00:00Z" }),
      ],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "dupe@x.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("new");
    expect(r.reason).toMatch(/2 contacts matched email, picked most recent/);
  });

  it("territory is set when matched contact is an active franchisee", async () => {
    const db = makeDb({
      contacts: [c({ id: "fr1", ghl_contact_id: "ghl1", email: "owner@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map([["ghl1", "tn-chattanooga"]]),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "owner@x.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("fr1");
    expect(r.territory_ms_slug).toBe("tn-chattanooga");
    expect(r.participants[0].role).toBe("franchisee");
  });

  it("non-franchisee contact → role=prospect, no territory", async () => {
    const db = makeDb({
      contacts: [c({ id: "p1", ghl_contact_id: "ghl2", email: "prospect@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "prospect@x.com" }] }),
      db,
    );
    expect(r.participants[0].role).toBe("prospect");
    expect(r.territory_ms_slug).toBeNull();
  });

  it("two participants match different contacts by email → picks most recent across both", async () => {
    const db = makeDb({
      contacts: [
        c({ id: "a", email: "a@x.com", updated_at: "2026-01-01T00:00:00Z" }),
        c({ id: "b", email: "b@x.com", updated_at: "2026-08-01T00:00:00Z" }),
      ],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }, { email: "b@x.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("b");
    expect(r.reason).toMatch(/2 contacts matched email, picked most recent/);
  });

  it("no signals at all → contact_id null, role=unknown", async () => {
    const db = makeDb({
      contacts: [],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "stranger@unknown.com" }] }),
      db,
    );
    expect(r.contact_id).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.participants[0].role).toBe("unknown");
    expect(r.participants[0].match_method).toBe("none");
  });

  it("uppercase email input is matched case-insensitively", async () => {
    const db = makeDb({
      contacts: [c({ id: "ci1", email: "mixed@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "MiXeD@X.COM" }] }),
      db,
    );
    expect(r.contact_id).toBe("ci1");
  });

  it("email wins over phone when both would match different contacts", async () => {
    const db = makeDb({
      contacts: [
        c({ id: "by-email", email: "e@x.com" }),
        c({ id: "by-phone", phone: "6155550000" }),
      ],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({
        participants: [
          { email: "e@x.com" },
          { phone: "6155550000" },
        ],
      }),
      db,
    );
    expect(r.contact_id).toBe("by-email");
    expect(r.confidence).toBe(1.0);
  });

  it("nah_team + prospect combined → call gets the prospect contact", async () => {
    const db = makeDb({
      contacts: [c({ id: "pp", email: "prospect@x.com", first_name: "Pete" })],
      teamEmails: new Set(["matt@newagainhouses.com"]),
      teamUsers: new Map([["matt@newagainhouses.com", { id: "u1", full_name: "Matt" }]]),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({
        participants: [
          { email: "matt@newagainhouses.com" },
          { email: "prospect@x.com" },
        ],
      }),
      db,
    );
    expect(r.contact_id).toBe("pp");
    expect(r.participants).toHaveLength(2);
    expect(r.participants[0].role).toBe("nah_team");
    expect(r.participants[1].role).toBe("prospect");
  });

  it("short participant phone (< 10 digits) is ignored, not matched", async () => {
    const db = makeDb({
      contacts: [c({ id: "cP", phone: "6155551212" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ phone: "555-1212" }] }),
      db,
    );
    expect(r.contact_id).toBeNull();
    expect(r.participants[0].match_method).toBe("none");
  });
});

describe("resolveCallParticipants — journey selection", () => {
  it("picks the journey where the contact is the primary", async () => {
    const db = makeDb({
      contacts: [c({ id: "c1", email: "a@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [
        { id: "j-primary", primaryContactId: "c1", updatedAt: "2026-01-01T00:00:00Z" },
        { id: "j-member", primaryContactId: "other", updatedAt: "2026-06-01T00:00:00Z" },
      ],
      journeyMembers: new Map([["c1", ["j-member"]]]),
      jps: [
        { id: "jps-primary", journeyId: "j-primary", territoryMsSlug: null, updatedAt: "2026-01-01T00:00:00Z", isActive: true },
        { id: "jps-member", journeyId: "j-member", territoryMsSlug: null, updatedAt: "2026-06-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }] }),
      db,
    );
    expect(r.journey_id).toBe("j-primary");
    expect(r.journey_pipeline_state_id).toBe("jps-primary");
  });

  it("within the chosen journey, prefers jps matching the call's territory", async () => {
    const db = makeDb({
      contacts: [c({ id: "fr1", ghl_contact_id: "ghl1", email: "owner@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map([["ghl1", "tn-chat"]]),
      journeys: [{ id: "j1", primaryContactId: "fr1", updatedAt: "2026-01-01T00:00:00Z" }],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-null", journeyId: "j1", territoryMsSlug: null, updatedAt: "2026-06-01T00:00:00Z", isActive: true },
        { id: "jps-chat", journeyId: "j1", territoryMsSlug: "tn-chat", updatedAt: "2026-01-01T00:00:00Z", isActive: true },
        { id: "jps-other", journeyId: "j1", territoryMsSlug: "tn-other", updatedAt: "2026-07-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "owner@x.com" }] }),
      db,
    );
    expect(r.territory_ms_slug).toBe("tn-chat");
    expect(r.journey_id).toBe("j1");
    expect(r.journey_pipeline_state_id).toBe("jps-chat");
  });

  it("with no territory hint, picks the most-recently-updated active jps (surfaces current stage, not stale pre-award)", async () => {
    // Contact isn't a direct territory owner, but their journey has a stale
    // sales/closed jps (null territory) alongside an active onboarding jps
    // (with territory). We want the current stage to win, not the leftover.
    const db = makeDb({
      contacts: [c({ id: "c1", email: "a@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [{ id: "j1", primaryContactId: "c1", updatedAt: "2026-01-01T00:00:00Z" }],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-onboarding", journeyId: "j1", territoryMsSlug: "tn-nash", updatedAt: "2026-06-01T00:00:00Z", isActive: true },
        { id: "jps-sales-closed", journeyId: "j1", territoryMsSlug: null, updatedAt: "2026-01-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }] }),
      db,
    );
    expect(r.territory_ms_slug).toBe("tn-nash");
    expect(r.journey_pipeline_state_id).toBe("jps-onboarding");
  });

  it("tie-break: most recently updated active jps when no territory or null row", async () => {
    const db = makeDb({
      contacts: [c({ id: "c1", email: "a@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [{ id: "j1", primaryContactId: "c1", updatedAt: "2026-01-01T00:00:00Z" }],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-old", journeyId: "j1", territoryMsSlug: "a", updatedAt: "2026-01-01T00:00:00Z", isActive: true },
        { id: "jps-new", journeyId: "j1", territoryMsSlug: "b", updatedAt: "2026-06-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }] }),
      db,
    );
    expect(r.journey_pipeline_state_id).toBe("jps-new");
  });

  it("returns null journey when contact has no active journeys", async () => {
    const db = makeDb({
      contacts: [c({ id: "c1", email: "a@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [],
      journeyMembers: new Map(),
      jps: [],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("c1");
    expect(r.journey_id).toBeNull();
    expect(r.journey_pipeline_state_id).toBeNull();
  });

  it("group call: each participant gets their own journey pick", async () => {
    const db = makeDb({
      contacts: [
        c({ id: "p1", email: "p1@x.com" }),
        c({ id: "p2", email: "p2@x.com" }),
      ],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [
        { id: "j-a", primaryContactId: "p1", updatedAt: "2026-01-01T00:00:00Z" },
        { id: "j-b", primaryContactId: "p2", updatedAt: "2026-02-01T00:00:00Z" },
      ],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-a", journeyId: "j-a", territoryMsSlug: null, updatedAt: "2026-01-01T00:00:00Z", isActive: true },
        { id: "jps-b", journeyId: "j-b", territoryMsSlug: null, updatedAt: "2026-02-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "p1@x.com" }, { email: "p2@x.com" }] }),
      db,
    );
    expect(r.participants).toHaveLength(2);
    const p1 = r.participants.find((p) => p.contact_id === "p1");
    const p2 = r.participants.find((p) => p.contact_id === "p2");
    expect(p1?.journey_id).toBe("j-a");
    expect(p1?.journey_pipeline_state_id).toBe("jps-a");
    expect(p2?.journey_id).toBe("j-b");
    expect(p2?.journey_pipeline_state_id).toBe("jps-b");
  });

  it("inactive jps rows are ignored", async () => {
    const db = makeDb({
      contacts: [c({ id: "c1", email: "a@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [{ id: "j1", primaryContactId: "c1", updatedAt: "2026-01-01T00:00:00Z" }],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-inactive", journeyId: "j1", territoryMsSlug: null, updatedAt: "2026-06-01T00:00:00Z", isActive: false },
        { id: "jps-active", journeyId: "j1", territoryMsSlug: "tn", updatedAt: "2026-01-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }] }),
      db,
    );
    expect(r.journey_pipeline_state_id).toBe("jps-active");
  });

  it("contact not listed as territory owner — jps territory wins (journey driver case)", async () => {
    // Nicki-style: her ghl_contact_id isn't in territory_owners, but her
    // journey's active jps carries a territory. The call should show that
    // territory so the classifier doesn't call it Sales.
    const db = makeDb({
      contacts: [c({ id: "nicki", ghl_contact_id: "related_nicki", email: "ncates@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(), // Nicki isn't in territory_owners
      journeys: [{ id: "j1", primaryContactId: "nicki", updatedAt: "2026-01-01T00:00:00Z" }],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-chs", journeyId: "j1", territoryMsSlug: "CHARSC", updatedAt: "2026-01-01T00:00:00Z", isActive: true },
      ],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "ncates@x.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("nicki");
    expect(r.territory_ms_slug).toBe("CHARSC");
    expect(r.journey_pipeline_state_id).toBe("jps-chs");
    expect(r.participants[0].role).toBe("franchisee");
  });

  it("nah_team participants never get a journey", async () => {
    const db = makeDb({
      contacts: [],
      teamEmails: new Set(["matt@newagainhouses.com"]),
      teamUsers: new Map([["matt@newagainhouses.com", { id: "u1", full_name: "Matt" }]]),
      territories: new Map(),
      journeys: [],
      journeyMembers: new Map(),
      jps: [],
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "matt@newagainhouses.com" }] }),
      db,
    );
    expect(r.participants[0].role).toBe("nah_team");
    expect(r.participants[0].journey_id).toBeNull();
    expect(r.participants[0].journey_pipeline_state_id).toBeNull();
  });

  it("stakeholder fallback: contact not on the journey but in the territory ecosystem picks up the active journey", async () => {
    // Brett-Boyd case: new employee of Brian-Boll's franchise. Brett has a
    // contact record but no journey_contacts row. Linking him to the
    // BLLNGS territory_stakeholders should be enough for his calls to
    // classify against Brian's active journey.
    const db = makeDb({
      contacts: [c({ id: "brett", email: "brett@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [{ id: "j-brian", primaryContactId: "brian", updatedAt: "2026-01-01T00:00:00Z" }],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-bllngs", journeyId: "j-brian", territoryMsSlug: "BLLNGS", updatedAt: "2026-04-01T00:00:00Z", isActive: true },
      ],
      stakeholderTerritories: new Map([["brett", ["BLLNGS"]]]),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "brett@x.com" }] }),
      db,
    );
    expect(r.contact_id).toBe("brett");
    expect(r.journey_id).toBe("j-brian");
    expect(r.journey_pipeline_state_id).toBe("jps-bllngs");
    expect(r.territory_ms_slug).toBe("BLLNGS");
    expect(r.participants[0].role).toBe("franchisee");
  });

  it("stakeholder fallback: does not fire when contact already has a direct journey", async () => {
    // A co_primary on their own journey should not accidentally pick up
    // a different territory's journey via stakeholder membership.
    const db = makeDb({
      contacts: [c({ id: "c1", email: "a@x.com" })],
      teamEmails: new Set(),
      teamUsers: new Map(),
      territories: new Map(),
      journeys: [
        { id: "j-own", primaryContactId: "c1", updatedAt: "2026-06-01T00:00:00Z" },
        { id: "j-other", primaryContactId: "other", updatedAt: "2026-01-01T00:00:00Z" },
      ],
      journeyMembers: new Map(),
      jps: [
        { id: "jps-own", journeyId: "j-own", territoryMsSlug: null, updatedAt: "2026-06-01T00:00:00Z", isActive: true },
        { id: "jps-other", journeyId: "j-other", territoryMsSlug: "OTHER", updatedAt: "2026-01-01T00:00:00Z", isActive: true },
      ],
      stakeholderTerritories: new Map([["c1", ["OTHER"]]]),
    });
    const r = await resolveCallParticipants(
      baseInput({ participants: [{ email: "a@x.com" }] }),
      db,
    );
    expect(r.journey_id).toBe("j-own");
    expect(r.journey_pipeline_state_id).toBe("jps-own");
  });
});
