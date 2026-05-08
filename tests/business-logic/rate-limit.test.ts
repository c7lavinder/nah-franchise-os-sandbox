/**
 * Tests for the in-memory rate limiter.
 */

import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  const config = { maxRequests: 3, windowSeconds: 60 };

  it("allows requests under the limit", () => {
    const key = `test-under-${Date.now()}`;
    expect(checkRateLimit(key, config)).toBeNull();
    expect(checkRateLimit(key, config)).toBeNull();
    expect(checkRateLimit(key, config)).toBeNull();
  });

  it("blocks requests over the limit with 429", () => {
    const key = `test-over-${Date.now()}`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const blocked = checkRateLimit(key, config);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it("includes Retry-After header", async () => {
    const key = `test-header-${Date.now()}`;
    for (let i = 0; i < 4; i++) checkRateLimit(key, config);

    const blocked = checkRateLimit(key, config);
    expect(blocked).not.toBeNull();
    const retryAfter = blocked?.headers.get("Retry-After");
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("different keys have independent limits", () => {
    const keyA = `test-a-${Date.now()}`;
    const keyB = `test-b-${Date.now()}`;

    // Exhaust keyA
    for (let i = 0; i < 4; i++) checkRateLimit(keyA, config);
    expect(checkRateLimit(keyA, config)).not.toBeNull(); // blocked

    // keyB should still be fine
    expect(checkRateLimit(keyB, config)).toBeNull(); // allowed
  });

  it("different configs have independent windows", () => {
    const key = `test-configs-${Date.now()}`;
    const tight = { maxRequests: 1, windowSeconds: 60 };
    const loose = { maxRequests: 100, windowSeconds: 60 };

    checkRateLimit(key, tight); // use the 1 allowed
    expect(checkRateLimit(key, tight)).not.toBeNull(); // blocked on tight
    expect(checkRateLimit(key, loose)).toBeNull(); // allowed on loose
  });
});
