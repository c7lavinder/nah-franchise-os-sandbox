import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * Pins the one thing that makes a merged journey still findable:
 * `journeys.primary_contact_id` must move to the keeper.
 *
 * Why this is a test and not a review note — of the 5 merges this route had actually
 * performed on production, 3 left a journey pointing at a contact that had just been
 * marked merged-away. The route already reassigns 20+ tables meticulously, including
 * `journey_contacts` memberships, and closing those is exactly what made this look
 * handled. But a journey is REACHED through `journeys.primary_contact_id`, a different
 * column in a different table. Leave it behind and the journey still exists, still says
 * "active", and can no longer be reached from the person it belongs to. Nothing errors,
 * nothing logs, and the merge reports success.
 */

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: "user-1", role: "admin" })),
}));

vi.mock("@/lib/ghl", () => ({
  addNote: vi.fn(async () => ({})),
  updateContact: vi.fn(async () => ({})),
}));

vi.mock("@/lib/contacts/pipeline-state", () => ({
  resolveContactId: vi.fn(async (raw: string) => raw),
}));

/** Every write the route attempts, in order, so a test can assert one happened. */
interface Write {
  table: string;
  payload: Record<string, unknown>;
  eq: Record<string, unknown>;
}
const writes: Write[] = [];

class Builder {
  private payload: Record<string, unknown> = {};
  private eqs: Record<string, unknown> = {};
  private isWrite = false;

  constructor(private table: string) {}

  select() {
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.payload = payload;
    this.isWrite = true;
    return this;
  }
  delete() {
    this.isWrite = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqs[col] = val;
    return this;
  }
  in(col: string, val: unknown) {
    this.eqs[col] = val;
    return this;
  }
  is(col: string, val: unknown) {
    this.eqs[col] = val;
    return this;
  }
  maybeSingle() {
    return this;
  }

  then(resolve: (value: unknown) => void) {
    if (this.isWrite) {
      writes.push({ table: this.table, payload: this.payload, eq: this.eqs });
    }
    resolve(this.result());
  }

  private result() {
    // Both contacts exist, neither already merged.
    if (this.table === "contacts" && !this.isWrite) {
      return {
        data: [
          {
            id: "dup-1",
            ghl_contact_id: "ghl-dup",
            first_name: "Jarrod",
            last_name: "Turner",
            email: "j@x.com",
            merged_into_contact_id: null,
          },
          {
            id: "keep-1",
            ghl_contact_id: "ghl-keep",
            first_name: "Jarrod",
            last_name: "Turner",
            email: "j2@x.com",
            merged_into_contact_id: null,
          },
        ],
        error: null,
      };
    }
    // The duplicate is the primary contact of one active journey.
    if (this.table === "journeys") {
      return { data: [{ id: "journey-1", name: "Jarrod Turner", status: "active" }], error: null };
    }
    return { data: [], error: null };
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: (table: string) => new Builder(table) }),
}));

const { POST } = await import("@/app/api/contacts/[contactId]/merge/route");

const call = () =>
  POST(
    new NextRequest("http://localhost/api/contacts/dup-1/merge", {
      method: "POST",
      body: JSON.stringify({ keepContactId: "keep-1" }),
    }),
    { params: { contactId: "dup-1" } }
  );

describe("POST /api/contacts/[contactId]/merge — journey reachability", () => {
  beforeEach(() => {
    writes.length = 0;
  });

  it("repoints journeys.primary_contact_id at the keeper", async () => {
    await call();

    const journeyWrite = writes.find((w) => w.table === "journeys" && "primary_contact_id" in w.payload);

    expect(
      journeyWrite,
      "The merge never updated journeys.primary_contact_id. Any journey whose primary was " +
        "the duplicate is now unreachable from the person it belongs to — it still exists " +
        "and still says active. This happened to 3 of the first 5 real merges."
    ).toBeDefined();

    expect(journeyWrite!.payload.primary_contact_id).toBe("keep-1");
    expect(journeyWrite!.eq.primary_contact_id).toBe("dup-1");
  });

  it("still closes journey memberships — the two are different tables and both matter", async () => {
    await call();

    const membership = writes.find((w) => w.table === "journey_contacts");
    expect(
      membership,
      "journey_contacts memberships are no longer being closed. That is a separate column " +
        "in a separate table from journeys.primary_contact_id; fixing one must not replace the other."
    ).toBeDefined();
    expect(membership!.payload).toHaveProperty("left_at");
  });

  it("reports what it moved, naming the journey", async () => {
    const res = await call();
    const body = (await res.json()) as { steps: { step: string; ok: boolean; detail?: string }[] };

    const step = body.steps.find((s) => s.step === "journey_primary_contact");
    expect(step, "The merge summary must include a journey_primary_contact step.").toBeDefined();
    expect(step!.ok).toBe(true);
    // Repointing moves someone's journey onto another record — the operator sees which one.
    expect(step!.detail).toContain("Jarrod Turner");
  });

  it("marks the duplicate merged only after the journey has been repointed", async () => {
    await call();

    const journeyAt = writes.findIndex((w) => w.table === "journeys" && "primary_contact_id" in w.payload);
    const markAt = writes.findIndex((w) => w.table === "contacts" && "merged_into_contact_id" in w.payload);

    expect(journeyAt).toBeGreaterThanOrEqual(0);
    expect(markAt).toBeGreaterThanOrEqual(0);
    expect(
      journeyAt,
      "The duplicate was marked merged before its journey was repointed. If the repoint then " +
        "fails, the contact is flagged merged and the journey is stranded — the exact state " +
        "found on production."
    ).toBeLessThan(markAt);
  });
});

/**
 * Until 2026-08-08 this route imported `requireAuth` and never called it, and there is no
 * `middleware.ts` gating it either — so the import read as protection while an unauthenticated
 * POST could reassign 20+ tables and mark a contact merged. An unused import is invisible to
 * every other test, which is why this one asserts the CALL, not the import.
 */
describe("POST /api/contacts/[contactId]/merge — authentication", () => {
  beforeEach(() => {
    writes.length = 0;
    vi.mocked(requireAuth).mockClear();
  });

  it("returns the 401 from requireAuth instead of merging", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never
    );

    const res = await call();

    expect(
      res.status,
      "An unauthenticated POST was not rejected. This endpoint reassigns 20+ tables and marks " +
        "a contact merged; nothing else gates it, as there is no middleware.ts."
    ).toBe(401);
  });

  it("writes nothing at all when the caller is rejected", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never
    );

    await call();

    expect(
      writes,
      "A rejected caller still reached the database. The auth check must sit above every write, " +
        "not partway down the route — a half-applied merge is worse than a refused one."
    ).toHaveLength(0);
  });

  it("actually calls requireAuth — an unused import is not a gate", async () => {
    await call();
    expect(vi.mocked(requireAuth)).toHaveBeenCalledTimes(1);
  });
});
