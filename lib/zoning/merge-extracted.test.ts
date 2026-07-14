import { describe, expect, it } from "vitest";
import { planDistrictMerge, normalizeCode } from "./merge-extracted";
import type { ZoningDistrictRules } from "./types";

function rules(code: string): ZoningDistrictRules {
  return {
    code,
    name: null,
    category: "residential",
    minLotAcres: null,
    minLotWidthFt: null,
    minRoadFrontageFt: null,
    frontSetbackFt: null,
    sideSetbackFt: null,
    rearSetbackFt: null,
    maxHeightFt: null,
    maxLotCoveragePercent: null,
    minDwellingSqft: null,
    aduAllowed: null,
    septicAllowed: null,
    notes: null,
  };
}

describe("planDistrictMerge", () => {
  it("inserts codes that don't exist yet", () => {
    const plan = planDistrictMerge([], [rules("R-1"), rules("R-2")]);
    expect(plan.toInsert.map((r) => r.code)).toEqual(["R-1", "R-2"]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  it("updates rows that are still ai_extracted", () => {
    const plan = planDistrictMerge([{ id: "abc", code: "R-1", extraction_status: "ai_extracted" }], [rules("R-1")]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].id).toBe("abc");
    expect(plan.toInsert).toEqual([]);
  });

  it("never touches verified or manual rows", () => {
    const plan = planDistrictMerge(
      [
        { id: "v1", code: "R-1", extraction_status: "verified" },
        { id: "m1", code: "R-2", extraction_status: "manual" },
      ],
      [rules("R-1"), rules("R-2"), rules("R-3")]
    );
    expect(plan.skipped).toEqual(["R-1", "R-2"]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toInsert.map((r) => r.code)).toEqual(["R-3"]);
  });

  it("matches codes case- and whitespace-insensitively", () => {
    const plan = planDistrictMerge([{ id: "v1", code: "R-1", extraction_status: "verified" }], [rules("r - 1")]);
    expect(plan.skipped).toEqual(["r - 1"]);
  });

  it("dedupes duplicate codes within one extraction run", () => {
    const plan = planDistrictMerge([], [rules("R-1"), rules("R-1")]);
    expect(plan.toInsert).toHaveLength(1);
  });
});

describe("normalizeCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeCode(" r-1 a ")).toBe("R-1A");
  });
});
