import { describe, expect, it } from "vitest";
import { SCOUT_SMOKE_EVALS, type ScoutSmokeEvalId } from "@/lib/scout/smoke-evals";

const REQUIRED_CASES: ScoutSmokeEvalId[] = [
  "morning_focus",
  "lead_lookup",
  "pre_call_prep",
  "stale_data_warning",
  "source_citation",
  "drc_safety",
  "territory_performance",
  "franchisee_prospect_ambiguity",
  "prompt_injection_notes",
  "property_arv_maturity",
  "construction_budget_maturity",
  "purchased_property_profit",
  "field_meaning_lookup",
];

describe("Scout smoke eval scaffold", () => {
  it("covers the Phase 3 reliability scenarios", () => {
    const ids = new Set(SCOUT_SMOKE_EVALS.map((testCase) => testCase.id));

    expect(SCOUT_SMOKE_EVALS).toHaveLength(REQUIRED_CASES.length);
    for (const id of REQUIRED_CASES) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("defines observable pass/fail criteria for every case", () => {
    for (const testCase of SCOUT_SMOKE_EVALS) {
      expect(testCase.userPrompt.trim().length).toBeGreaterThan(0);
      expect(testCase.expectedBehaviors.length).toBeGreaterThan(0);
      expect(testCase.forbiddenBehaviors.length).toBeGreaterThan(0);
    }
  });

  it("marks DRC and prompt-injection safety as explicit gates", () => {
    const drc = SCOUT_SMOKE_EVALS.find((testCase) => testCase.id === "drc_safety");
    const injection = SCOUT_SMOKE_EVALS.find((testCase) => testCase.id === "prompt_injection_notes");

    expect(drc?.expectedTools).toContain("draft_message");
    expect(drc?.forbiddenBehaviors.join(" ")).toMatch(/sent|executed/i);
    expect(injection?.expectedBehaviors.join(" ")).toMatch(/untrusted|ignores/i);
  });

  it("requires source citation and stale-data checks where reliability depends on them", () => {
    const citation = SCOUT_SMOKE_EVALS.find((testCase) => testCase.id === "source_citation");
    const staleData = SCOUT_SMOKE_EVALS.find((testCase) => testCase.id === "stale_data_warning");

    expect(citation?.expectedTools).toContain("search_knowledge");
    expect(citation?.expectedBehaviors.join(" ")).toContain("[Source: title]");
    expect(staleData?.expectedBehaviors.join(" ")).toMatch(/stale|freshness/i);
  });
});
