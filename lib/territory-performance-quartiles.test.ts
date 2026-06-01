import { describe, expect, it } from "vitest";
import {
  assignTerritoryPerformanceLabels,
  explainTerritoryScore,
  getQuartileSizes,
  quartileScoringAgent,
} from "./territory-performance-quartiles";

describe("territory performance quartiles", () => {
  it("exposes a named quartile scoring agent", () => {
    expect(quartileScoringAgent.name).toBe("Territory Quartile Scoring Agent");
    expect(quartileScoringAgent.assignQuartiles).toBe(assignTerritoryPerformanceLabels);
  });

  it("splits 54 territories into the June 2026 14/13/14/13 quartile balance", () => {
    expect(getQuartileSizes(54)).toEqual([14, 13, 14, 13]);
  });

  it("assigns balanced quartile labels by rank even when scores tie", () => {
    const territories = Array.from({ length: 54 }, (_, index) => ({
      slug: `T${index + 1}`,
      name: `Territory ${index + 1}`,
      leadListInsertedMonth: 200,
      stage1Last30d: index < 20 ? 30 : 10,
      stage4Last30d: index < 20 ? 10 : 2,
      contractsLast30d: index < 20 ? 1 : 0,
      purchasesLast30d: index < 20 ? 1 : 0,
      purchasesT12: index < 20 ? 10 : 2,
    }));

    const labeled = assignTerritoryPerformanceLabels(territories);

    expect(labeled.filter((t) => t.quartile === "Q1")).toHaveLength(14);
    expect(labeled.filter((t) => t.quartile === "Q2")).toHaveLength(13);
    expect(labeled.filter((t) => t.quartile === "Q3")).toHaveLength(14);
    expect(labeled.filter((t) => t.quartile === "Q4")).toHaveLength(13);
  });

  it("separates quartile score from the coaching reason", () => {
    const leadGenGap = explainTerritoryScore({
      slug: "low-leads",
      leadListInsertedMonth: 0,
      stage1Last30d: 0,
      stage4Last30d: 0,
      contractsLast30d: 0,
      purchasesLast30d: 0,
      purchasesT12: 0,
    });

    const closingGap = explainTerritoryScore({
      slug: "offers-no-contracts",
      leadListInsertedMonth: 250,
      stage1Last30d: 35,
      stage4Last30d: 12,
      contractsLast30d: 0,
      purchasesLast30d: 0,
      purchasesT12: 8,
    });

    expect(leadGenGap.coachingFlag).toBe("Lead Gen Gap");
    expect(closingGap.coachingFlag).toBe("Closing Gap");
    expect(closingGap.leadWorkRate).toBe(34);
  });
});
