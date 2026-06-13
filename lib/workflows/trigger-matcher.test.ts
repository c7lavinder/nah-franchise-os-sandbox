import { describe, expect, it } from "vitest";
import { doesWorkflowEventMatch } from "@/lib/workflows/trigger-matcher";

describe("workflow trigger matcher", () => {
  it("matches website-form leads entering the Sales Engagement journey", () => {
    const matches = doesWorkflowEventMatch(
      "journey.created",
      "journey.created",
      [
        { field: "pipelineSlug", operator: "equals", value: "sales" },
        { field: "stageName", operator: "equals", value: "Engagement" },
        { field: "source", operator: "contains", value: "Website" },
      ],
      {
        pipelineName: "Sales - Path to Ownership",
        pipelineSlug: "sales",
        stageName: "Engagement",
        contactName: "Proof Lead",
        source: "Website Form",
      }
    );

    expect(matches).toBe(true);
  });

  it("does not match non-website lead sources for the Website Form Leads workflow", () => {
    const matches = doesWorkflowEventMatch(
      "journey.created",
      "journey.created",
      [
        { field: "pipelineSlug", operator: "equals", value: "sales" },
        { field: "stageName", operator: "equals", value: "Engagement" },
        { field: "source", operator: "contains", value: "Website" },
      ],
      {
        pipelineSlug: "sales",
        stageName: "Engagement",
        source: "Referral",
      }
    );

    expect(matches).toBe(false);
  });
});
