import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authUser = vi.fn(async (_request?: Request) => ({ id: "user-1", role: "rep", fullName: "Rep One" }));

vi.mock("@/lib/auth", () => ({
  requireAuth: (request: Request) => authUser(request),
}));

const districtRows = [
  {
    id: "d1",
    jurisdiction_id: "j1",
    code: "R-1",
    name: "Low Density Residential",
    category: "residential",
    min_lot_acres: "0.5", // numeric columns come back as strings
    min_lot_width_ft: null,
    min_road_frontage_ft: "50",
    front_setback_ft: "25",
    side_setback_ft: "10",
    rear_setback_ft: "20",
    max_height_ft: null,
    max_lot_coverage_percent: null,
    min_dwelling_sqft: null,
    adu_allowed: null,
    septic_allowed: null,
    notes: null,
    extraction_status: "verified",
  },
];

let mockDistricts: Record<string, unknown>[] = districtRows;

class QueryBuilder {
  select() {
    return this;
  }
  eq() {
    return this;
  }
  in() {
    return this;
  }
  then(resolve: (value: unknown) => void) {
    resolve({ data: mockDistricts, error: null });
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: () => new QueryBuilder() }),
}));

function makeRequest(body: unknown) {
  return new NextRequest("https://app.test/api/zoning/prescreen", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/zoning/prescreen", () => {
  beforeEach(() => {
    mockDistricts = districtRows;
    authUser.mockResolvedValue({ id: "user-1", role: "rep", fullName: "Rep One" });
  });

  it("screens parcels against verified district rules", async () => {
    const { POST } = await import("@/app/api/zoning/prescreen/route");
    const response = await POST(
      makeRequest({
        jurisdictionId: "j1",
        plannedFootprintSqft: 1400,
        parcels: [
          { id: "good", zoningCode: "R-1", lotAcres: 0.6, buildableAcres: 0.5, roadFrontageFt: 120 },
          { id: "too-small", zoningCode: "R-1", lotAcres: 0.2, buildableAcres: 0.2, roadFrontageFt: 120 },
          { id: "no-district", zoningCode: "C-2", lotAcres: 0.6 },
        ],
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.summary).toEqual({ total: 3, pass: 1, fail: 1, unknown: 1 });

    const byId = Object.fromEntries(json.results.map((r: { id: string }) => [r.id, r]));
    expect(byId["good"].verdict).toBe("pass");
    expect(byId["too-small"].verdict).toBe("fail");
    expect(byId["no-district"].verdict).toBe("unknown");
    expect(byId["no-district"].note).toContain("C-2");
  });

  it("matches zoning codes case-insensitively", async () => {
    const { POST } = await import("@/app/api/zoning/prescreen/route");
    const response = await POST(
      makeRequest({
        jurisdictionId: "j1",
        plannedFootprintSqft: 1400,
        parcels: [{ id: "p1", zoningCode: "r-1", lotAcres: 0.6, buildableAcres: 0.5, roadFrontageFt: 120 }],
      })
    );
    const json = await response.json();
    expect(json.results[0].verdict).toBe("pass");
    expect(json.results[0].district).toBe("R-1");
  });

  it("rejects when the jurisdiction has no verified districts", async () => {
    mockDistricts = [];
    const { POST } = await import("@/app/api/zoning/prescreen/route");
    const response = await POST(
      makeRequest({ jurisdictionId: "j1", parcels: [{ id: "p1", zoningCode: "R-1", lotAcres: 1 }] })
    );
    expect(response.status).toBe(422);
  });

  it("validates the body", async () => {
    const { POST } = await import("@/app/api/zoning/prescreen/route");
    expect((await POST(makeRequest({ parcels: [{}] }))).status).toBe(400);
    expect((await POST(makeRequest({ jurisdictionId: "j1", parcels: [] }))).status).toBe(400);
  });

  it("requires auth", async () => {
    authUser.mockResolvedValue(new Response(null, { status: 401 }) as never);
    const { POST } = await import("@/app/api/zoning/prescreen/route");
    const response = await POST(makeRequest({ jurisdictionId: "j1", parcels: [{ zoningCode: "R-1" }] }));
    expect(response.status).toBe(401);
  });
});
