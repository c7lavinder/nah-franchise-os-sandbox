/**
 * Tests for the lead scoring engine.
 * Validates scoring model weights, tier boundaries, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { calculateLeadScore, buildScoringInputFromContact } from "@/lib/profile/lead-scoring";

/** Helper: create a default input with all nulls */
function emptyInput() {
  return {
    source: null,
    capitalAvailability: null,
    capitalSource: null,
    territoryStatus: null,
    lastTouchDate: null,
    daysSinceAdded: 0,
    contactAttemptCount: null,
    businessOwnershipExperience: null,
    investmentTimeline: null,
    timelineToOpen: null,
    motivationClarity: null,
    trainualCompletion: null,
  };
}

describe("calculateLeadScore", () => {
  it("returns a low score for empty input (baseline points for recency)", () => {
    const result = calculateLeadScore(emptyInput());
    // New lead with daysSinceAdded=0 gets some engagement points (recency)
    expect(result.total).toBeLessThan(40);
    expect(result.tier).toBe("Cold");
  });

  it("scores a referral source at 20/20", () => {
    const input = { ...emptyInput(), source: "Referral" };
    const result = calculateLeadScore(input);
    expect(result.components.source).toBe(20);
  });

  it("scores a paid ad source lower than referral", () => {
    const paid = calculateLeadScore({ ...emptyInput(), source: "Paid Ad" });
    const referral = calculateLeadScore({ ...emptyInput(), source: "Referral" });
    expect(referral.components.source).toBeGreaterThan(paid.components.source);
  });

  it("scores confirmed capital at max", () => {
    const input = { ...emptyInput(), capitalAvailability: "Confirmed", capitalSource: "Self-funded" };
    const result = calculateLeadScore(input);
    expect(result.components.capital).toBe(20);
  });

  it("scores confirmed territory at 15/15", () => {
    const input = { ...emptyInput(), territoryStatus: "Confirmed" };
    const result = calculateLeadScore(input);
    expect(result.components.territory).toBe(15);
  });

  it("scores 'Immediately' timeline at max", () => {
    const input = { ...emptyInput(), investmentTimeline: "Immediately" };
    const result = calculateLeadScore(input);
    expect(result.components.timeline).toBe(15);
  });

  it("tiers correctly at boundaries", () => {
    // Build a hot lead: referral + confirmed capital + confirmed territory + immediate + experience
    const hot = calculateLeadScore({
      ...emptyInput(),
      source: "Referral",
      capitalAvailability: "Confirmed",
      capitalSource: "Self-funded",
      territoryStatus: "Confirmed",
      investmentTimeline: "Immediately",
      businessOwnershipExperience: "Yes",
      motivationClarity: "Strong",
    });
    expect(hot.tier).toBe("Hot");
    expect(hot.total).toBeGreaterThanOrEqual(80);
  });

  it("cold tier for unknown/empty everything", () => {
    const cold = calculateLeadScore(emptyInput());
    expect(cold.tier).toBe("Cold");
    expect(cold.total).toBeLessThan(40);
  });

  it("breakdown string contains all 6 components", () => {
    const result = calculateLeadScore(emptyInput());
    expect(result.breakdown).toContain("source:");
    expect(result.breakdown).toContain("capital:");
    expect(result.breakdown).toContain("territory:");
    expect(result.breakdown).toContain("engagement:");
    expect(result.breakdown).toContain("experience:");
    expect(result.breakdown).toContain("timeline:");
  });

  it("total equals sum of all components", () => {
    const input = {
      ...emptyInput(),
      source: "Organic",
      capitalAvailability: "Needs Verification",
      territoryStatus: "Available",
      investmentTimeline: "6-12 months",
    };
    const result = calculateLeadScore(input);
    const sum = Object.values(result.components).reduce((a, b) => a + b, 0);
    expect(result.total).toBe(sum);
  });
});

describe("buildScoringInputFromContact", () => {
  it("maps contact fields to scoring input", () => {
    const contact = {
      opportunity_source: "Referral",
      capital_availability: "Confirmed",
      territory_status: "Available",
      business_ownership_experience: "Yes",
      investment_timeline: "1-3 months",
      motivation_clarity: "Strong",
      trainual_completion_pct: 75,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const input = buildScoringInputFromContact(contact);
    expect(input.source).toBe("Referral");
    expect(input.capitalAvailability).toBe("Confirmed");
    expect(input.territoryStatus).toBe("Available");
    expect(input.businessOwnershipExperience).toBe("Yes");
    expect(input.investmentTimeline).toBe("1-3 months");
    expect(input.motivationClarity).toBe("Strong");
    expect(input.trainualCompletion).toBe(75);
    expect(input.daysSinceAdded).toBeGreaterThanOrEqual(9);
    expect(input.daysSinceAdded).toBeLessThanOrEqual(11);
  });

  it("handles null fields gracefully", () => {
    const contact = { created_at: new Date().toISOString() };
    const input = buildScoringInputFromContact(contact);
    expect(input.source).toBeNull();
    expect(input.capitalAvailability).toBeNull();
    expect(input.daysSinceAdded).toBe(0);
  });
});
