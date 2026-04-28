/**
 * Cron auth tests — verifies CRON_SECRET Bearer token check pattern.
 */

import { describe, it, expect, afterEach } from "vitest";

describe("CRON_SECRET verification pattern", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Test the verification logic inline (same pattern used in all 16 cron routes)
  function verifyCron(authHeader: string | null): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
      return false; // blocked
    }
    return true; // allowed
  }

  it("allows when CRON_SECRET is not set", () => {
    delete process.env.CRON_SECRET;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(verifyCron(null)).toBe(true);
  });

  it("allows when secret matches", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(verifyCron("Bearer my-cron-secret")).toBe(true);
  });

  it("blocks when secret is wrong", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(verifyCron("Bearer wrong-secret")).toBe(false);
  });

  it("blocks when no auth header provided", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(verifyCron(null)).toBe(false);
  });

  it("allows in development mode regardless of secret", () => {
    process.env.CRON_SECRET = "my-cron-secret";
    (process.env as Record<string, string>).NODE_ENV = "development";
    expect(verifyCron(null)).toBe(true);
  });
});
