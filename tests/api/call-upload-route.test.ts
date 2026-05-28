import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: "user-1", role: "admin" })),
}));

class QueryBuilder {
  constructor(private table: string) {}
  select() { return this; }
  eq() { return this; }
  single() {
    if (this.table === "calls") {
      return Promise.resolve({
        data: {
          id: "call-1",
          contact_id: null,
          sub_task_id: null,
          journey_pipeline_state_id: null,
          hosted_by_user_id: "user-1",
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: (table: string) => new QueryBuilder(table) }),
}));

vi.mock("@/lib/calls/whisper", () => ({ transcribeAudio: vi.fn() }));

describe("POST /api/calls/[callId]/upload", () => {
  it("returns a route-level validation error when no file is provided", async () => {
    const { POST } = await import("@/app/api/calls/[callId]/upload/route");
    const form = new FormData();
    const request = new NextRequest("https://app.test/api/calls/call-1/upload", { method: "POST", body: form });

    const response = await POST(request, { params: Promise.resolve({ callId: "call-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No file provided" });
  });
});
