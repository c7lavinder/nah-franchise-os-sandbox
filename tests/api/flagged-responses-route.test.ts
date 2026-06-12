import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authUser = vi.fn(async (_request?: Request) => ({ id: "admin-1", role: "admin" }));
const updatePayloads: Record<string, unknown>[] = [];
const eqFilters: [string, string][] = [];

vi.mock("@/lib/auth", () => ({
  requireAuth: (request: Request) => authUser(request),
}));

class QueryBuilder {
  update(payload: Record<string, unknown>) {
    updatePayloads.push(payload);
    return this;
  }

  eq(column: string, value: string) {
    eqFilters.push([column, value]);
    return this;
  }

  then(resolve: (value: unknown) => void) {
    resolve({ error: null });
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: () => new QueryBuilder() }),
}));

describe("PATCH /api/flagged-responses/[id]", () => {
  beforeEach(() => {
    authUser.mockResolvedValue({ id: "admin-1", role: "admin" });
    updatePayloads.length = 0;
    eqFilters.length = 0;
  });

  it("rejects non-admin users", async () => {
    authUser.mockResolvedValue({ id: "user-1", role: "rep" });
    const { PATCH } = await import("@/app/api/flagged-responses/[id]/route");

    const response = await PATCH(
      new NextRequest("https://app.test/api/flagged-responses/flag-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "working_on_it" }),
      }),
      { params: Promise.resolve({ id: "flag-1" }) }
    );

    expect(response.status).toBe(403);
    expect(updatePayloads).toHaveLength(0);
  });

  it("rejects invalid statuses", async () => {
    const { PATCH } = await import("@/app/api/flagged-responses/[id]/route");

    const response = await PATCH(
      new NextRequest("https://app.test/api/flagged-responses/flag-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "later" }),
      }),
      { params: Promise.resolve({ id: "flag-1" }) }
    );

    expect(response.status).toBe(400);
    expect(updatePayloads).toHaveLength(0);
  });

  it("moves Scout feedback through the review loop", async () => {
    const { PATCH } = await import("@/app/api/flagged-responses/[id]/route");

    const response = await PATCH(
      new NextRequest("https://app.test/api/flagged-responses/flag-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "fixed" }),
      }),
      { params: Promise.resolve({ id: "flag-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(updatePayloads[0]).toMatchObject({ status: "fixed" });
    expect(updatePayloads[0].reviewed_at).toEqual(expect.any(String));
    expect(updatePayloads[0].resolved_at).toEqual(expect.any(String));
    expect(eqFilters).toContainEqual(["id", "flag-1"]);
  });
});
