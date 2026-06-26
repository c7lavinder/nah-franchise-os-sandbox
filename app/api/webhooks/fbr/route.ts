export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/fbr
 *
 * Franchise Business Review (FBR) lead adapter. FBR payloads vary by export/
 * integration settings, so this route accepts common field aliases and
 * normalizes them into the canonical /api/leads/intake shape — mirrors the
 * BatchLeads adapter. Leads land in the Sales pipeline at the Engagement stage
 * with source "Franchise Business Review".
 */

import { NextRequest, NextResponse } from "next/server";
import { POST as leadIntakePost } from "@/app/api/leads/intake/route";
import { normalizeFbrPayload, type FbrPayload } from "@/lib/webhooks/fbr";

export async function POST(request: NextRequest) {
  let payload: FbrPayload;
  try {
    payload = (await request.json()) as FbrPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeFbrPayload(payload);
  if (!normalized.email && !normalized.phone) {
    return NextResponse.json({ error: "FBR payload must include at least email or phone" }, { status: 400 });
  }

  const intakeUrl = new URL("/api/leads/intake", request.url);
  intakeUrl.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");

  return leadIntakePost(
    new Request(intakeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(normalized),
    }) as NextRequest
  );
}
