import { describe, expect, it } from "vitest";
import { buildContactSearchPlan, mergeLimitedIds } from "./search-planner";

describe("buildContactSearchPlan", () => {
  it("ignores empty and one-character queries", () => {
    expect(buildContactSearchPlan(" ")).toEqual({ kind: "empty" });
    expect(buildContactSearchPlan("a")).toEqual({ kind: "empty" });
  });

  it("normalizes query and plans forward + reversed name matching", () => {
    expect(buildContactSearchPlan("  Chintan Patel  ")).toEqual({
      kind: "search",
      query: "chintan patel",
      words: ["chintan", "patel"],
      forwardName: { first: "chintan", last: "patel" },
      reversedName: { first: "patel", last: "chintan" },
      fuzzyThreshold: 0.18,
      limit: 20,
    });
  });

  it("keeps multi-word last names together", () => {
    const plan = buildContactSearchPlan("Mary Van Buren");
    expect(plan.kind).toBe("search");
    if (plan.kind === "search") {
      expect(plan.forwardName).toEqual({ first: "mary", last: "van buren" });
      expect(plan.reversedName).toEqual({ first: "van buren", last: "mary" });
    }
  });
});

describe("mergeLimitedIds", () => {
  it("dedupes while preserving first-seen order and limit", () => {
    expect(mergeLimitedIds(3, ["a", "b"], ["b", "c", "d"])).toEqual(["a", "b", "c"]);
  });
});
