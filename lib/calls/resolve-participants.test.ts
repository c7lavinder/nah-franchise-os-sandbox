import { describe, it, expect } from "vitest";
import {
  resolveCallParticipants,
  normalizePhone,
  normalizeName,
  type ContactMatch,
  type ResolverDb,
  type ResolveInput,
} from "./resolve-participants";

interface Fixture {
  contacts: ContactMatch[];
  teamEmails: Set<string>;
  teamUsers: Map<string, { id: string; full_name: string }>;
  territories: Map<string, string>; // ghl_contact_id -> ms_slug
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
    async isTeamEmail(email) {
      return fx.teamEmails.has(email.toLowerCase());
    },
    async findUserByEmail(email) {
      return fx.teamUsers.get(email.toLowerCase()) ?? null;
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
