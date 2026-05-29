import { describe, expect, it } from "vitest";
import { getWorkQueueStatusLabel, normalizeWorkQueueStatus, WORK_QUEUE_STATUS_LABELS } from "./status";

describe("work queue statuses", () => {
  it("keeps the approved display vocabulary mapped to DB-safe values", () => {
    expect(WORK_QUEUE_STATUS_LABELS).toEqual({
      blocked: "Blocked",
      needs_review: "Needs Review",
      due: "Due",
      waiting: "Waiting",
      stale: "Stale",
      healthy: "Healthy",
      done: "Done",
    });
    expect(getWorkQueueStatusLabel("needs_review")).toBe("Needs Review");
  });

  it("normalizes display labels and URL-safe values", () => {
    expect(normalizeWorkQueueStatus("Needs Review")).toBe("needs_review");
    expect(normalizeWorkQueueStatus("needs-review")).toBe("needs_review");
    expect(normalizeWorkQueueStatus("Done")).toBe("done");
    expect(normalizeWorkQueueStatus("unknown")).toBeNull();
  });
});
