import { describe, expect, it } from "vitest";
import { prescreenParcel } from "./prescreen";
import type { ParcelFacts, ZoningDistrictRules } from "./types";

const r1: ZoningDistrictRules = {
  code: "R-1",
  name: "Low Density Residential",
  category: "residential",
  minLotAcres: 0.5,
  minLotWidthFt: 100,
  minRoadFrontageFt: 50,
  frontSetbackFt: 25,
  sideSetbackFt: 10,
  rearSetbackFt: 20,
  maxHeightFt: 35,
  maxLotCoveragePercent: 30,
  minDwellingSqft: 1200,
  aduAllowed: false,
  septicAllowed: true,
  notes: null,
};

const baseParcel: ParcelFacts = {
  lotAcres: 0.6,
  zoningCode: "R-1",
  buildableAcres: 0.5,
  roadFrontageFt: 120,
  plannedFootprintSqft: 1400,
};

describe("prescreenParcel", () => {
  it("passes a parcel that meets every rule", () => {
    const result = prescreenParcel(baseParcel, r1);
    expect(result.verdict).toBe("pass");
    expect(result.checks.every((c) => c.outcome === "pass")).toBe(true);
  });

  it("fails a lot below the district minimum", () => {
    const result = prescreenParcel({ ...baseParcel, lotAcres: 0.3 }, r1);
    expect(result.verdict).toBe("fail");
    expect(result.checks.find((c) => c.rule === "min_lot_size")?.outcome).toBe("fail");
  });

  it("fails insufficient road frontage", () => {
    const result = prescreenParcel({ ...baseParcel, roadFrontageFt: 30 }, r1);
    expect(result.verdict).toBe("fail");
    expect(result.checks.find((c) => c.rule === "road_frontage")?.outcome).toBe("fail");
  });

  it("fails when setbacks eat the buildable envelope", () => {
    // 0.02 buildable acres ≈ 871 sqft square (~29.5 ft side): setbacks
    // (25 front + 20 rear, 2×10 side) leave nothing
    const result = prescreenParcel({ ...baseParcel, buildableAcres: 0.02 }, r1);
    expect(result.verdict).toBe("fail");
    expect(result.checks.find((c) => c.rule === "buildable_envelope")?.outcome).toBe("fail");
  });

  it("fails a non-residential district", () => {
    const result = prescreenParcel(baseParcel, { ...r1, category: "industrial" });
    expect(result.verdict).toBe("fail");
    expect(result.checks.find((c) => c.rule === "district_use")?.outcome).toBe("fail");
  });

  it("returns unknown (not pass) when data is missing and nothing failed", () => {
    const result = prescreenParcel(
      { lotAcres: null, zoningCode: "R-1", buildableAcres: null, roadFrontageFt: null },
      r1
    );
    expect(result.verdict).toBe("unknown");
    expect(result.checks.some((c) => c.outcome === "fail")).toBe(false);
  });

  it("treats missing district setbacks as unknown envelope, not zero", () => {
    const noSetbacks = { ...r1, frontSetbackFt: null, sideSetbackFt: null, rearSetbackFt: null };
    const result = prescreenParcel(baseParcel, noSetbacks);
    expect(result.checks.find((c) => c.rule === "buildable_envelope")?.outcome).toBe("unknown");
  });

  it("passes mixed-use districts for residential builds", () => {
    const result = prescreenParcel(baseParcel, { ...r1, category: "mixed" });
    expect(result.checks.find((c) => c.rule === "district_use")?.outcome).toBe("pass");
  });
});
