/**
 * GHL webhook signature verification.
 *
 * GHL signs every outbound webhook with two headers:
 *   X-GHL-Signature  — Ed25519 (current, preferred)
 *   X-WH-Signature   — RSA-SHA256 (legacy, deprecated July 1 2026)
 *
 * We verify using GHL's published public keys. No shared secret needed.
 * Source: ghl-masterclass/snippets/webhook-handler.ts
 *
 * Returns null if valid, or a 401 Response if invalid.
 * Also returns the method used for logging.
 */

import * as crypto from "crypto";
import { NextResponse } from "next/server";

// Ed25519 public key from GHL — verify X-GHL-Signature
const GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA3LDseGsRtmozPbDKhSFSFKLLv4i4j3nNJh/4nzXJKgk=
-----END PUBLIC KEY-----`;

// RSA public key from GHL — verify X-WH-Signature (deprecated July 2026)
// Full key available at: https://developer.gohighlevel.com (webhook signing docs)
// Truncated in ghl-masterclass — RSA fallback is best-effort until full key confirmed
const GHL_RSA_PUBLIC_KEY: string | null = null;

export interface GhlSignatureResult {
  valid: boolean;
  method: "ed25519" | "rsa" | "none";
}

function verifyEd25519(body: string, signature: string): boolean {
  try {
    const key = crypto.createPublicKey(GHL_ED25519_PUBLIC_KEY);
    return crypto.verify(null, Buffer.from(body), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

function verifyRSA(body: string, signature: string): boolean {
  if (!GHL_RSA_PUBLIC_KEY) return false;
  try {
    const key = crypto.createPublicKey(GHL_RSA_PUBLIC_KEY);
    return crypto.verify("sha256", Buffer.from(body), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/**
 * Verify a GHL webhook signature from raw body + request headers.
 * Prefers Ed25519 (X-GHL-Signature), falls back to RSA (X-WH-Signature).
 */
export function verifyGhlSignature(rawBody: string, headers: Headers): GhlSignatureResult {
  // Prefer Ed25519
  const ed25519Sig = headers.get("x-ghl-signature");
  if (ed25519Sig) {
    return { valid: verifyEd25519(rawBody, ed25519Sig), method: "ed25519" };
  }

  // Fallback to legacy RSA
  const rsaSig = headers.get("x-wh-signature");
  if (rsaSig) {
    return { valid: verifyRSA(rawBody, rsaSig), method: "rsa" };
  }

  return { valid: false, method: "none" };
}

/**
 * Middleware-style wrapper: returns null if valid, 401 Response if invalid.
 * Matches the pattern used by verifyWebhookSecret.
 *
 * Pass the raw body string (from request.text()) and the request headers.
 * Skips verification in development mode.
 */
export function requireGhlSignature(rawBody: string, headers: Headers): Response | null {
  if (process.env.NODE_ENV === "development") return null;

  const result = verifyGhlSignature(rawBody, headers);
  if (result.valid) return null;

  return NextResponse.json({ error: "Invalid GHL webhook signature" }, { status: 401 });
}
