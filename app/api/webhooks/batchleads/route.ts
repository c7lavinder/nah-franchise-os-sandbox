export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/batchleads
 *
 * BatchLeads "Push to CRM" adapter. BatchLeads account payloads can vary by
 * export/integration settings, so this route accepts common field aliases and
 * normalizes them into the canonical /api/leads/intake shape.
 */

import { NextRequest, NextResponse } from "next/server";
import { POST as leadIntakePost } from "@/app/api/leads/intake/route";
import { normalizeBatchLeadsPayload, type BatchLeadsPayload } from "@/lib/webhooks/batchleads";

export async function POST(request: NextRequest) {
  let payload: BatchLeadsPayload;
  try {
    payload = (await request.json()) as BatchLeadsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeBatchLeadsPayload(payload);
  if (!normalized.email && !normalized.phone) {
    return NextResponse.json({ error: "BatchLeads payload must include at least email or phone" }, { status: 400 });
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
