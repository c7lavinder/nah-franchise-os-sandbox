import { describe, expect, it } from "vitest";
import { sanitizeGroupCallActions } from "./next-steps";

describe("sanitizeGroupCallActions", () => {
  it("keeps broad group-call actions at call level when no explicit owner exists", () => {
    const result = sanitizeGroupCallActions(
      {
        actions: [
          {
            category: "task",
            title: "Prepare rollout plan",
            description: "Prepare the rollout plan.",
            why: "The call discussed a system rollout.",
            contact_name: "Anthony Childish",
            assigned_to_name: "Chad Arnold",
            ghl_action: false,
            source: "scout",
            metadata: { task_title: "Prepare rollout plan" },
          },
        ],
      },
      true
    );

    expect(result?.actions[0]).toMatchObject({
      contact_name: "Call",
      target_contact_name: undefined,
      metadata: {
        task_title: "Prepare rollout plan",
        assignment_scope: "call",
        assignment_reason: "Call-level item: no explicit individual owner found in transcript.",
      },
    });
  });

  it("preserves person-specific group-call actions with explicit assignment evidence", () => {
    const result = sanitizeGroupCallActions(
      {
        actions: [
          {
            category: "task",
            title: "Follow up with Marta",
            description: "Follow up with Marta.",
            why: "Marta was assigned the follow-up.",
            contact_name: "Marta Pena",
            assigned_to_name: "Chad Arnold",
            ghl_action: false,
            source: "scout",
            metadata: { assignment_reason: "Transcript says Marta will send the numbers." },
          },
        ],
      },
      true
    );

    expect(result?.actions[0]).toMatchObject({
      contact_name: "Marta Pena",
      metadata: {
        assignment_scope: "person",
        assignment_reason: "Transcript says Marta will send the numbers.",
      },
    });
  });
});
