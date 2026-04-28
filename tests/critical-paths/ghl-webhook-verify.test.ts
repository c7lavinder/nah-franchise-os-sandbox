/**
 * GHL webhook signature verification tests.
 * Uses a test Ed25519 key pair — production uses GHL's published public key.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";

// Generate a test Ed25519 key pair for signing test payloads
const testKeyPair = crypto.generateKeyPairSync("ed25519");
const testPublicKeyPem = testKeyPair.publicKey.export({ type: "spki", format: "pem" }) as string;

// We need to mock the module's public key before importing
vi.mock("@/lib/auth/ghl-webhook-verify", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    // Re-export functions that use the mocked key via a wrapper
  };
});

// Helper: sign a body with our test private key (simulating GHL)
function signEd25519(body: string): string {
  return crypto.sign(null, Buffer.from(body), testKeyPair.privateKey).toString("base64");
}

// Since we can't easily swap the hardcoded public key in the module,
// test the crypto primitives directly and the requireGhlSignature behavior
describe("GHL webhook signature verification", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = "production";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Ed25519 crypto primitives", () => {
    it("verifies a valid Ed25519 signature", () => {
      const body = '{"type":"ContactCreate","id":"abc123"}';
      const signature = signEd25519(body);
      const key = crypto.createPublicKey(testPublicKeyPem);
      const valid = crypto.verify(null, Buffer.from(body), key, Buffer.from(signature, "base64"));
      expect(valid).toBe(true);
    });

    it("rejects a tampered body", () => {
      const body = '{"type":"ContactCreate","id":"abc123"}';
      const signature = signEd25519(body);
      const key = crypto.createPublicKey(testPublicKeyPem);
      const valid = crypto.verify(null, Buffer.from(body + "tampered"), key, Buffer.from(signature, "base64"));
      expect(valid).toBe(false);
    });

    it("rejects a garbage signature", () => {
      const body = '{"type":"ContactCreate","id":"abc123"}';
      const key = crypto.createPublicKey(testPublicKeyPem);
      const valid = crypto.verify(null, Buffer.from(body), key, Buffer.from("not-a-real-signature", "base64"));
      expect(valid).toBe(false);
    });

    it("rejects when signature is from a different key", () => {
      const otherKeyPair = crypto.generateKeyPairSync("ed25519");
      const body = '{"type":"ContactCreate","id":"abc123"}';
      const wrongSig = crypto.sign(null, Buffer.from(body), otherKeyPair.privateKey).toString("base64");
      const key = crypto.createPublicKey(testPublicKeyPem);
      const valid = crypto.verify(null, Buffer.from(body), key, Buffer.from(wrongSig, "base64"));
      expect(valid).toBe(false);
    });
  });

  describe("verifyGhlSignature result shape", () => {
    // Import the real module — tests the function logic with GHL's actual public key
    // These test the code paths, not the actual GHL key (we don't have GHL's private key)
    let verifyGhlSignature: typeof import("@/lib/auth/ghl-webhook-verify").verifyGhlSignature;

    beforeEach(async () => {
      const mod = await import("@/lib/auth/ghl-webhook-verify");
      verifyGhlSignature = mod.verifyGhlSignature;
    });

    it("returns method 'none' when no signature headers present", () => {
      const headers = new Headers({ "content-type": "application/json" });
      const result = verifyGhlSignature('{"test":true}', headers);
      expect(result.valid).toBe(false);
      expect(result.method).toBe("none");
    });

    it("returns method 'ed25519' when X-GHL-Signature header is present", () => {
      const headers = new Headers({ "x-ghl-signature": "some-invalid-sig" });
      const result = verifyGhlSignature('{"test":true}', headers);
      // Invalid sig against GHL's real key → valid: false, but method: 'ed25519'
      expect(result.valid).toBe(false);
      expect(result.method).toBe("ed25519");
    });

    it("returns method 'rsa' when only X-WH-Signature header is present", () => {
      const headers = new Headers({ "x-wh-signature": "some-invalid-sig" });
      const result = verifyGhlSignature('{"test":true}', headers);
      // RSA key is null in current code → valid: false
      expect(result.valid).toBe(false);
      expect(result.method).toBe("rsa");
    });

    it("prefers Ed25519 over RSA when both headers are present", () => {
      const headers = new Headers({
        "x-ghl-signature": "some-sig",
        "x-wh-signature": "some-other-sig",
      });
      const result = verifyGhlSignature('{"test":true}', headers);
      expect(result.method).toBe("ed25519");
    });
  });

  describe("requireGhlSignature", () => {
    let requireGhlSignature: typeof import("@/lib/auth/ghl-webhook-verify").requireGhlSignature;

    beforeEach(async () => {
      const mod = await import("@/lib/auth/ghl-webhook-verify");
      requireGhlSignature = mod.requireGhlSignature;
    });

    it("returns 401 when no signature provided", () => {
      const headers = new Headers({ "content-type": "application/json" });
      const result = requireGhlSignature('{"test":true}', headers);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("returns 401 when signature is invalid", () => {
      const headers = new Headers({ "x-ghl-signature": "invalid" });
      const result = requireGhlSignature('{"test":true}', headers);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("skips verification in development mode", () => {
      (process.env as Record<string, string>).NODE_ENV = "development";
      const headers = new Headers(); // No signature at all
      const result = requireGhlSignature('{"test":true}', headers);
      expect(result).toBeNull();
    });
  });
});
