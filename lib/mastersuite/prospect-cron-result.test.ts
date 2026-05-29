import { describe, expect, it } from "vitest";
import { formatSyncProspectsCronResult } from "./prospect-cron-result";

describe("formatSyncProspectsCronResult", () => {
  it("keeps clean prospect syncs successful", () => {
    const formatted = formatSyncProspectsCronResult({ created: 2, wired: 1, skipped: 3, errors: [] });

    expect(formatted).toEqual({
      status: "success",
      result: { created: 2, wired: 1, skipped: 3, errors: [], partialFailure: false },
      error: null,
    });
  });

  it("marks partial prospect sync errors as failed for cron health", () => {
    const formatted = formatSyncProspectsCronResult({
      created: 2,
      wired: 1,
      skipped: 3,
      errors: ["Journey for Jane Prospect: duplicate slug"],
    });

    expect(formatted.status).toBe("failed");
    expect(formatted.result).toMatchObject({ created: 2, wired: 1, skipped: 3, partialFailure: true });
    expect(formatted.error).toBe("Journey for Jane Prospect: duplicate slug");
  });
});
