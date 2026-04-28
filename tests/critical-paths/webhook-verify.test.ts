/**
 * Webhook verification tests — verifies shared-secret pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";

describe("verifyWebhookSecret", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes when WEBHOOK_SHARED_SECRET is not set", () => {
    delete process.env.WEBHOOK_SHARED_SECRET;
    const req = new Request("http://localhost/api/webhooks/ghl", { method: "POST" });
    expect(verifyWebhookSecret(req)).toBeNull();
  });

  it("passes when secret matches via header", () => {
    process.env.WEBHOOK_SHARED_SECRET = "my-secret-123";
    const req = new Request("http://localhost/api/webhooks/ghl", {
      method: "POST",
      headers: { "x-webhook-secret": "my-secret-123" },
    });
    expect(verifyWebhookSecret(req)).toBeNull();
  });

  it("passes when secret matches via query param", () => {
    process.env.WEBHOOK_SHARED_SECRET = "my-secret-123";
    const req = new Request("http://localhost/api/webhooks/ghl?secret=my-secret-123", {
      method: "POST",
    });
    expect(verifyWebhookSecret(req)).toBeNull();
  });

  it("returns 401 when secret is wrong", () => {
    process.env.WEBHOOK_SHARED_SECRET = "my-secret-123";
    const req = new Request("http://localhost/api/webhooks/ghl", {
      method: "POST",
      headers: { "x-webhook-secret": "wrong-secret" },
    });
    const result = verifyWebhookSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when no secret provided but env var is set", () => {
    process.env.WEBHOOK_SHARED_SECRET = "my-secret-123";
    const req = new Request("http://localhost/api/webhooks/ghl", { method: "POST" });
    const result = verifyWebhookSecret(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("skips verification in development mode", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.WEBHOOK_SHARED_SECRET = "my-secret-123";
    const req = new Request("http://localhost/api/webhooks/ghl", { method: "POST" });
    expect(verifyWebhookSecret(req)).toBeNull();
  });
});
