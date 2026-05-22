import { describe, it, expect } from "vitest";
import { calculateLookalikeScore, type LookalikeInput } from "../../lib/intelligence/lookalike-scoring";

function baseInput(overrides: Partial<LookalikeInput> = {}): LookalikeInput {
  return {
    profileFieldCount: 0,
    opportunitySource: null,
    state: null,
    callCount: 0,
    commitmentCount: 0,
    commitmentFulfillmentRate: null,
    capitalAvailability: null,
    fundingPath: null,
    hasPfs: false,
    intelligenceScore: null,
    priorBusinessOwner: null,
    constructionComfort: null,
    spouseSupportive: null,
    trainualCompletionPct: null,
    avgResponseTimeHours: null,
    urgency: null,
    ...overrides,
  };
}

describe("calculateLookalikeScore", () => {
  it("returns 0-100 score with tier", () => {
    const result = calculateLookalikeScore(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["Strong Match", "Moderate", "Weak", "No Match"]).toContain(result.tier);
  });

  it("scores empty profile as No Match or Weak", () => {
    const result = calculateLookalikeScore(baseInput());
    expect(result.tier).toMatch(/No Match|Weak/);
  });

  it("scores a rich profile higher", () => {
    const sparse = calculateLookalikeScore(baseInput({ profileFieldCount: 1 }));
    const rich = calculateLookalikeScore(baseInput({ profileFieldCount: 14 }));
    expect(rich.breakdown.profileCompleteness).toBeGreaterThan(sparse.breakdown.profileCompleteness);
  });

  it("rewards multiple calls and commitments", () => {
    const noEngagement = calculateLookalikeScore(baseInput());
    const engaged = calculateLookalikeScore(
      baseInput({
        callCount: 4,
        commitmentCount: 10,
        commitmentFulfillmentRate: 0.8,
      })
    );
    expect(engaged.breakdown.engagementDepth).toBeGreaterThan(noEngagement.breakdown.engagementDepth);
  });

  it("rewards confirmed capital and funding path", () => {
    const noFinancials = calculateLookalikeScore(baseInput());
    const ready = calculateLookalikeScore(
      baseInput({
        capitalAvailability: "Confirmed",
        fundingPath: "cash",
        hasPfs: true,
      })
    );
    expect(ready.breakdown.financialReadiness).toBeGreaterThan(noFinancials.breakdown.financialReadiness);
  });

  it("rewards referral source", () => {
    const noSource = calculateLookalikeScore(baseInput());
    const referral = calculateLookalikeScore(baseInput({ opportunitySource: "Referral" }));
    expect(referral.breakdown.behavioralSignals).toBeGreaterThan(noSource.breakdown.behavioralSignals);
  });

  it("produces Strong Match for ideal candidate", () => {
    const ideal = calculateLookalikeScore(
      baseInput({
        profileFieldCount: 14,
        opportunitySource: "Referral",
        callCount: 4,
        commitmentCount: 12,
        commitmentFulfillmentRate: 0.9,
        capitalAvailability: "Confirmed",
        fundingPath: "cash",
        hasPfs: true,
        priorBusinessOwner: true,
        constructionComfort: "hands_on",
        spouseSupportive: "yes",
        intelligenceScore: 75,
        trainualCompletionPct: 90,
        avgResponseTimeHours: 2,
        urgency: "ready_now",
      })
    );
    expect(ideal.tier).toBe("Strong Match");
    expect(ideal.score).toBeGreaterThanOrEqual(70);
  });

  it("includes top match factors and gaps", () => {
    const result = calculateLookalikeScore(
      baseInput({
        profileFieldCount: 12,
        capitalAvailability: "Confirmed",
      })
    );
    expect(result.topMatchFactors.length).toBeGreaterThan(0);
  });

  it("breakdown dimensions each cap at 20", () => {
    const result = calculateLookalikeScore(
      baseInput({
        profileFieldCount: 20,
        callCount: 10,
        commitmentCount: 20,
        commitmentFulfillmentRate: 1,
        capitalAvailability: "Confirmed",
        fundingPath: "cash",
        hasPfs: true,
        priorBusinessOwner: true,
        constructionComfort: "hands_on",
        spouseSupportive: "yes",
        intelligenceScore: 90,
        trainualCompletionPct: 100,
        avgResponseTimeHours: 1,
        urgency: "ready_now",
        opportunitySource: "Referral",
      })
    );
    expect(result.breakdown.profileCompleteness).toBeLessThanOrEqual(20);
    expect(result.breakdown.engagementDepth).toBeLessThanOrEqual(20);
    expect(result.breakdown.financialReadiness).toBeLessThanOrEqual(20);
    expect(result.breakdown.operationalFit).toBeLessThanOrEqual(20);
    expect(result.breakdown.behavioralSignals).toBeLessThanOrEqual(20);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
