import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: "user-1", role: "admin" })),
}));

class QueryBuilder {
  private filters: Record<string, unknown> = {};

  constructor(private table: string, private selected = "") {}

  select(columns: string) {
    this.selected = columns;
    return this;
  }
  ilike() { return this; }
  or() { return this; }
  eq() { return this; }
  is() { return this; }
  limit() { return this; }
  single() { return this; }
  maybeSingle() { return this; }
  in(column: string, values: string[]) {
    this.filters[column] = values;
    return this;
  }
  then(resolve: (value: unknown) => void) {
    resolve(this.result());
  }

  private result() {
    if (this.table === "contacts" && this.selected === "id") {
      return { data: [{ id: "contact-1" }], error: null };
    }
    if (this.table === "contacts") {
      return {
        data: [
          {
            id: "contact-1",
            ghl_contact_id: "ghl-1",
            first_name: "Chintan",
            last_name: "Patel",
            email: "chintan@example.com",
            phone: "555-111-2222",
            is_converted_franchisee: false,
          },
        ],
        error: null,
      };
    }
    if (this.table === "journey_contacts") {
      return { data: [{ contact_id: "contact-1", role: "primary", journeys: { name: "Chintan Patel" } }], error: null };
    }
    return { data: [], error: null };
  }
}

const from = vi.fn((table: string) => new QueryBuilder(table));
const rpc = vi.fn(async () => ({ data: [], error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from, rpc }),
}));

describe("GET /api/contacts/search", () => {
  beforeEach(() => {
    from.mockClear();
    rpc.mockClear();
  });

  it("returns an empty result without touching Supabase for empty queries", async () => {
    const { GET } = await import("@/app/api/contacts/search/route");
    const response = await GET(new NextRequest("https://app.test/api/contacts/search?q="));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ contacts: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns enriched contacts for a normal search query", async () => {
    const { GET } = await import("@/app/api/contacts/search/route");
    const response = await GET(new NextRequest("https://app.test/api/contacts/search?q=Chintan%20Patel"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contacts).toHaveLength(1);
    expect(body.contacts[0]).toMatchObject({
      id: "contact-1",
      name: "Chintan Patel",
      contactType: "Prospect — Chintan Patel",
    });
  });
});
