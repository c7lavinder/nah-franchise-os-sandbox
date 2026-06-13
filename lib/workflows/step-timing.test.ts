import { describe, expect, it } from "vitest";
import { formatStepDelay, getStepDelayHours, isStepDueForEnrollment } from "@/lib/workflows/step-timing";

describe("workflow step timing", () => {
  it("uses configured relative delay hours when present", () => {
    expect(getStepDelayHours({ day_number: 1, condition_config: { delayHours: 6 } })).toBe(6);
    expect(formatStepDelay({ day_number: 1, condition_config: { delayHours: 6 } })).toBe("6h after lead");
  });

  it("falls back to day-based relative delay for older steps", () => {
    expect(getStepDelayHours({ day_number: 3, condition_config: null })).toBe(48);
    expect(formatStepDelay({ day_number: 3, condition_config: null })).toBe("48h after lead");
  });

  it("does not mark future relative-delay steps due", () => {
    const now = new Date("2026-06-13T16:00:00.000Z");
    const enrollment = { enrolled_at: "2026-06-13T13:00:00.000Z" };
    const step = { day_number: 1, condition_config: { delayHours: 4 } };

    expect(isStepDueForEnrollment(step, enrollment, now)).toBe(false);
    expect(isStepDueForEnrollment(step, enrollment, new Date("2026-06-13T17:00:00.000Z"))).toBe(true);
  });
});
