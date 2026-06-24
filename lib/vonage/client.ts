/**
 * Vonage boundary client.
 *
 * All Vonage Communications API calls go through this module (mirrors the
 * lib/ghl/client.ts and lib/sms/signalhouse-client.ts discipline).
 *
 * Auth model:
 *   - Outbound (Messages API): RS256 JWT signed with the Application private key.
 *   - Inbound webhooks: HS256 JWT in the Authorization header, signed with the
 *     account signature secret (a DIFFERENT secret from the private key).
 *
 * Docs: https://developer.vonage.com/en/messages/overview
 */

import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { optionalEnv, requireEnv } from "@/lib/env";
import { toSignalHousePhone } from "@/lib/sms/phone";

const VONAGE_MESSAGES_URL = "https://api.nexmo.com/v1/messages";

export type VonageMessageStatus = "submitted" | "delivered" | "rejected" | "accepted" | "failed";

export interface VonageSendResult {
  /** message_uuid returned by the Messages API */
  messageUuid: string;
  to: string;
  from: string;
  status: VonageMessageStatus;
  raw: unknown;
}

interface SendSmsInput {
  to: string;
  body: string;
  from?: string;
}

/** True when Vonage is the active SMS provider. */
export function vonageEnabled() {
  return (process.env.SMS_PROVIDER ?? "").toLowerCase() === "vonage";
}

/** PEM keys are often stored in env with literal "\n" — restore real newlines. */
function getPrivateKey(): string {
  return requireEnv("VONAGE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

/**
 * Mint a short-lived RS256 JWT for Messages API auth.
 * Exported because the Phase 2 voice/client-SDK tokens reuse the same signing key.
 */
export function generateVonageJwt(extraClaims: Record<string, unknown> = {}, ttlSeconds = 300): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      application_id: requireEnv("VONAGE_APPLICATION_ID"),
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      jti: randomUUID(),
      ...extraClaims,
    },
    getPrivateKey(),
    { algorithm: "RS256" }
  );
}

function getFromNumber(inputFrom?: string) {
  return toSignalHousePhone(inputFrom || requireEnv("VONAGE_FROM_NUMBER"));
}

/** Send an SMS via the Vonage Messages API. */
export async function sendVonageSms(input: SendSmsInput): Promise<VonageSendResult> {
  const from = getFromNumber(input.from);
  const to = toSignalHousePhone(input.to);

  const response = await fetch(VONAGE_MESSAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${generateVonageJwt()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      message_type: "text",
      channel: "sms",
      to,
      from,
      text: input.body,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { message_uuid?: string; [key: string]: unknown };

  if (!response.ok || !payload.message_uuid) {
    throw new Error(`Vonage Messages API ${response.status}: ${JSON.stringify(payload)}`);
  }

  return {
    messageUuid: payload.message_uuid,
    to,
    from,
    status: "submitted",
    raw: payload,
  };
}

/**
 * Verify a signed inbound/status webhook from Vonage.
 *
 * Vonage signs webhooks with a JWT in `Authorization: Bearer <token>` (HS256,
 * signed with the signature secret). The reliable check is the signature itself.
 * Returns true if valid. In development (or with no signature secret configured)
 * verification is skipped so local testing works.
 */
export function verifyVonageWebhook(authHeader: string | null): boolean {
  if (process.env.NODE_ENV === "development") return true;

  const secret = optionalEnv("VONAGE_API_SIGNATURE_SECRET");
  if (!secret) return true; // not yet configured — don't hard-fail inbound

  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  try {
    jwt.verify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
