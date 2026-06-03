import { describe, expect, it } from "vitest";
import { runwayTargetForFacts, type RunwayFacts } from "./runway-target";

const facts = (overrides: Partial<RunwayFacts>): RunwayFacts => ({
  offerCount: 0,
  contractCount: 0,
  purchaseCount: 0,
  constructionStartCount: 0,
  completionCount: 0,
  ...overrides,
});

describe("runwayTargetForFacts", () => {
  it("keeps first-purchase territories out of Running until they have 3 purchases", () => {
    expect(runwayTargetForFacts(facts({ purchaseCount: 1 }), false)).toEqual({
      stageSlug: "first-purchase",
      subTaskSlug: "closing",
    });
    expect(runwayTargetForFacts(facts({ purchaseCount: 2, completionCount: 1 }), false)).toEqual({
      stageSlug: "inventory-building",
      subTaskSlug: "first-completed",
    });
    expect(runwayTargetForFacts(facts({ purchaseCount: 3 }), false)).toEqual({
      stageSlug: "running",
      subTaskSlug: null,
    });
  });

  it("orders Inventory Building milestones as 1st Completed before 100 Offers before Running", () => {
    expect(runwayTargetForFacts(facts({ purchaseCount: 1, completionCount: 1 }), false)).toEqual({
      stageSlug: "inventory-building",
      subTaskSlug: "first-completed",
    });
    expect(runwayTargetForFacts(facts({ purchaseCount: 1, completionCount: 1, offerCount: 100 }), false)).toEqual({
      stageSlug: "inventory-building",
      subTaskSlug: "hundred-offers",
    });
    expect(runwayTargetForFacts(facts({ purchaseCount: 3, completionCount: 1, offerCount: 100 }), false)).toEqual({
      stageSlug: "running",
      subTaskSlug: null,
    });
  });
});
