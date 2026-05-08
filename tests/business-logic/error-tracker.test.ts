/**
 * Tests for the structured error tracker.
 */

import { describe, it, expect } from "vitest";
import { trackError, getRecentErrors, getErrorRates } from "@/lib/errors/tracker";

describe("trackError", () => {
  it("returns a short error ID", () => {
    const id = trackError({
      error: new Error("test error"),
      route: "/api/test",
      method: "GET",
    });
    expect(id).toHaveLength(8);
    expect(typeof id).toBe("string");
  });

  it("captures error message from Error objects", () => {
    trackError({
      error: new Error("specific message"),
      route: "/api/test-msg",
      method: "POST",
      userId: "user-123",
    });

    const recent = getRecentErrors();
    const found = recent.find((e) => e.message === "specific message");
    expect(found).toBeDefined();
    expect(found?.route).toBe("/api/test-msg");
    expect(found?.method).toBe("POST");
    expect(found?.userId).toBe("user-123");
  });

  it("handles string errors", () => {
    trackError({
      error: "string error",
      route: "/api/string",
      method: "GET",
    });

    const recent = getRecentErrors();
    const found = recent.find((e) => e.message === "string error");
    expect(found).toBeDefined();
  });

  it("tracks error rates per route", () => {
    const route = `/api/rate-test-${Date.now()}`;
    trackError({ error: "err1", route, method: "GET" });
    trackError({ error: "err2", route, method: "GET" });
    trackError({ error: "err3", route, method: "GET" });

    const rates = getErrorRates();
    const rateEntry = rates.find((r) => r.route === route);
    expect(rateEntry).toBeDefined();
    expect(rateEntry?.errorsThisHour).toBeGreaterThanOrEqual(3);
  });

  it("recent errors don't include stack traces (privacy)", () => {
    trackError({
      error: new Error("no-stack-test"),
      route: "/api/privacy",
      method: "GET",
    });

    const recent = getRecentErrors();
    const found = recent.find((e) => e.message === "no-stack-test");
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("stack");
  });
});
