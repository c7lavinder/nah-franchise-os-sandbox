import { describe, expect, it } from "vitest";
import { shouldTriggerNdaAutomation } from "./nda-automation";

const baseItem = {
  id: "action-1",
  call_id: "call-1",
  contact_id: "contact-1",
  category: "pipeline",
  title: "Log off PTO invite sent",
  description: "Mark Path to Ownership invite as completed.",
  metadata: {
    pipeline_action: "log_subtask",
    pipeline_name: "Sales — Path to Ownership",
    pipeline_stage: "Engagement",
    subtask_name: "PTO Invite Sent",
  },
};

describe("shouldTriggerNdaAutomation", () => {
  it("triggers when a PTO invite subtask is pushed", () => {
    expect(shouldTriggerNdaAutomation(baseItem)).toBe(true);
  });

  it("does not trigger for unrelated pipeline actions", () => {
    expect(
      shouldTriggerNdaAutomation({
        ...baseItem,
        title: "Log off Intro Call",
        description: "Mark Intro Call as completed.",
        metadata: { ...baseItem.metadata, subtask_name: "Intro Call" },
      })
    ).toBe(false);
  });

  it("does not trigger without a contact", () => {
    expect(shouldTriggerNdaAutomation({ ...baseItem, contact_id: null })).toBe(false);
  });
});
