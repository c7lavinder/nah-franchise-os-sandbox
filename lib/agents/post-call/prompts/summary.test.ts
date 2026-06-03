import { describe, expect, it } from "vitest";
import { buildPrompt } from "./summary";
import type { CallContext } from "../types";

const baseContext: CallContext = {
  callId: "call-1",
  transcript: "Tom completed the first video content phase and discussed rental equity utilization.",
  callType: "Coaching Call",
  callTypeSlug: "coaching_call",
  contactName: "Tom Winspear",
  contactId: "contact-1",
  primaryJourneyId: "journey-1",
  teamMembers: ["John Wright"],
  callDate: "2026-06-03",
  durationSeconds: 3600,
  pipelinePositions: [],
  feedbackBlock: "",
  contactNames: ["Tom Winspear"],
  territoryNames: ["Knoxville"],
  callTerritories: [],
  roster: [],
  isTeamCall: false,
  journeyPartners: [],
};

describe("post-call summary prompt", () => {
  it("tells coaching summaries to prioritize the true constraint and completed-plus-refined commitments", () => {
    const prompt = buildPrompt(baseContext);

    expect(prompt).toContain("lead with the franchisee's biggest operational or financial constraint");
    expect(prompt).toContain("completed commitment plus next-layer refinement");
  });
});
