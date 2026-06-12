import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: "user-1", role: "admin" })),
}));

class QueryBuilder {
  private inFilter: { column: string; values: string[] } | null = null;

  constructor(private table: string) {}

  select() {
    return this;
  }
  is() {
    return this;
  }
  eq() {
    return this;
  }
  not() {
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  in(column: string, values: string[]) {
    this.inFilter = { column, values };
    return this;
  }
  maybeSingle() {
    return this;
  }
  then(resolve: (value: unknown) => void) {
    resolve(this.result());
  }

  private result() {
    if (this.table === "calls") {
      return {
        data: [
          {
            id: "call-1",
            contact_id: null,
            call_type_id: "type-coaching",
            TerritorySlug: null,
            scheduled_at: "2026-06-12T12:00:00.000Z",
            started_at: null,
            ended_at: null,
            duration_seconds: 1800,
            hosted_by_user_id: "user-chad",
            status: "completed",
            created_at: "2026-06-12T12:00:00.000Z",
            title: "Coaching Call",
            source: "read_ai",
            read_ai_session_id: "session-1",
            raw_transcript: "Transcript",
            ai_summary_generated_at: null,
          },
        ],
        error: null,
      };
    }

    if (this.table === "users") {
      return {
        data: [{ id: "user-chad", email: "chad@example.com", full_name: "Chad Arnold", label_color: "#f97316" }],
        error: null,
      };
    }

    if (this.table === "call_types") {
      return { data: [{ id: "type-coaching", name: "Coaching Call", slug: "coaching" }], error: null };
    }

    if (this.table === "read_ai_sessions") {
      return {
        data: [
          {
            session_id: "session-1",
            participant_emails: [],
            owner_email: "chad@example.com",
            call_type: "coaching",
            platform: "read_ai",
          },
        ],
        error: null,
      };
    }

    if (this.table === "territories") {
      return { data: [], error: null };
    }

    if (this.table === "contacts") {
      return {
        data: [
          { id: "contact-langley", email: "tim@example.com", first_name: "Tim", last_name: "Langley" },
          { id: "contact-sanders", email: "dawn@example.com", first_name: "Dawn", last_name: "Sanders" },
        ],
        error: null,
      };
    }

    if (this.table === "call_participants") {
      expect(this.inFilter).toMatchObject({ column: "call_id", values: ["call-1"] });
      return {
        data: [
          {
            call_id: "call-1",
            email: "chad@example.com",
            display_name: "Chad Arnold",
            user_id: "user-chad",
            role: "nah_team",
            contact_id: null,
          },
          {
            call_id: "call-1",
            email: "tim@example.com",
            display_name: "mlangley",
            user_id: null,
            role: "franchisee",
            contact_id: "contact-langley",
          },
        ],
        error: null,
      };
    }

    return { data: [], error: null };
  }
}

const from = vi.fn((table: string) => new QueryBuilder(table));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from }),
}));

describe("GET /api/calls/list", () => {
  beforeEach(() => {
    from.mockClear();
  });

  it("uses linked contact names for mapped call participants instead of short display handles", async () => {
    const { GET } = await import("@/app/api/calls/list/route");

    const response = await GET(new NextRequest("https://app.test/api/calls/list?limit=200"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.calls[0]).toMatchObject({
      externalContacts: ["Tim Langley"],
      unmappedParticipants: [],
      unmappedCount: 0,
    });
  });
});
