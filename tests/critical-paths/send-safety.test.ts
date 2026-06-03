import { describe, expect, it } from "vitest";
import {
  CUSTOMER_FACING_SENDS_ENABLED_ENV,
  SEND_SAFETY_CONTRACT,
  customerFacingSendsEnabled,
  isWithinQuietHours,
  isCustomerFacingGHLActionCode,
  isCustomerFacingScoutSend,
  validateScoutActionApproval,
} from "@/lib/ghl/action-safety";
import { executeGHLAction } from "@/lib/ghl/actions/executor";
import type { DraftedAction } from "@/types/scout";

function messageAction(status: DraftedAction["status"]): DraftedAction {
  return {
    id: "draft-1",
    type: "message",
    status,
    contactId: "ghl-contact-1",
    contactName: "Test Contact",
    payload: {
      actionType: "message",
      channel: "SMS",
      content: "Test send",
    },
  };
}

describe("send safety contract", () => {
  it("blocks customer-facing Scout sends without explicit human confirmation", () => {
    const decision = validateScoutActionApproval(messageAction("pending"), "user-1");

    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe(409);
    expect(decision.metadata.riskTier).toBe("high");
    expect(decision.metadata.requiredGates).toContain("human_approval");
    expect(decision.metadata.requiredGates).toContain("immutable_action_log");
  });

  it("allows confirmed Scout sends and records all required safety gates", () => {
    const action = messageAction("confirmed");
    const decision = validateScoutActionApproval(action, "user-1");

    expect(isCustomerFacingScoutSend(action)).toBe(true);
    expect(decision.allowed).toBe(true);
    expect(decision.metadata.outputSchemaVersion).toBe("send-safety.v1");
    expect(decision.metadata.requiredGates).toEqual(SEND_SAFETY_CONTRACT.customerFacingSendGates);
  });

  it("classifies GHL customer-facing send action codes separately from internal notes", () => {
    expect(isCustomerFacingGHLActionCode("C1")).toBe(true);
    expect(isCustomerFacingGHLActionCode("C2")).toBe(true);
    expect(isCustomerFacingGHLActionCode("A5")).toBe(true);
    expect(isCustomerFacingGHLActionCode("C8")).toBe(false);
  });

  it("enforces the configured quiet-hours window across midnight", () => {
    expect(isWithinQuietHours(new Date("2026-05-29T03:00:00.000Z"))).toBe(true); // 23:00 America/New_York
    expect(isWithinQuietHours(new Date("2026-05-29T14:00:00.000Z"))).toBe(false); // 10:00 America/New_York
  });

  it("keeps customer-facing sends disabled unless the live-send env switch is enabled", async () => {
    const previous = process.env[CUSTOMER_FACING_SENDS_ENABLED_ENV];
    delete process.env[CUSTOMER_FACING_SENDS_ENABLED_ENV];

    expect(customerFacingSendsEnabled()).toBe(false);

    const decision = await executeGHLAction("C1", { contactId: "ghl-contact-1", message: "Test" }, "user-1", null);
    expect(decision.success).toBe(false);
    expect(decision.error).toContain(CUSTOMER_FACING_SENDS_ENABLED_ENV);

    if (previous === undefined) {
      delete process.env[CUSTOMER_FACING_SENDS_ENABLED_ENV];
    } else {
      process.env[CUSTOMER_FACING_SENDS_ENABLED_ENV] = previous;
    }
  });
});
