/**
 * Webhook shared-secret verification.
 * Checks x-webhook-secret header against WEBHOOK_SHARED_SECRET env var.
 * Returns null if valid, or a 401 Response if invalid.
 * Skips verification in development mode or if env var is not set.
 */

import { NextResponse } from "next/server";

export function verifyWebhookSecret(request: Request): Response | null {
  const secret = process.env.WEBHOOK_SHARED_SECRET;
  if (!secret || process.env.NODE_ENV === "development") return null;

  const headerSecret = request.headers.get("x-webhook-secret");
  const urlSecret = new URL(request.url).searchParams.get("secret");

  if (headerSecret === secret || urlSecret === secret) return null;

  return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
}
