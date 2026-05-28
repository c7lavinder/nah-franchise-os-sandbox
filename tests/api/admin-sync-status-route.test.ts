import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authUser = vi.fn(async (_request?: Request) => ({ id: "admin-1", role: "admin" }));

vi.mock("@/lib/auth", () => ({
  requireAuth: (request: Request) => authUser(request),
}));

class QueryBuilder {
  private table = "";
  from(table: string) {
    this.table = table;
    return this;
  }
  select() { return this; }
  eq() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }
  then(resolve: (value: unknown) => void) {
    resolve(this.result());
  }
  private result() {
    if (this.table === "cron_job_log") {
      return {
        data: [
          { job_name: "sync-ms-prospects", status: "success", error: null, started_at: new Date().toISOString(), finished_at: new Date().toISOString() },
        ],
        error: null,
      };
    }
    return { data: [], count: 1, error: null };
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: (table: string) => new QueryBuilder().from(table) }),
}));

describe("GET /api/admin/sync-status", () => {
  beforeEach(() => {
    authUser.mockResolvedValue({ id: "admin-1", role: "admin" });
  });

  it("rejects non-admin users", async () => {
    authUser.mockResolvedValue({ id: "user-1", role: "rep" });
    const { GET } = await import("@/app/api/admin/sync-status/route");

    const response = await GET(new NextRequest("https://app.test/api/admin/sync-status"));

    expect(response.status).toBe(403);
  });

  it("returns sync health for admins", async () => {
    const { GET } = await import("@/app/api/admin/sync-status/route");

    const response = await GET(new NextRequest("https://app.test/api/admin/sync-status"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("syncHealth");
    expect(body).toHaveProperty("embeddingHealth");
  });
});
