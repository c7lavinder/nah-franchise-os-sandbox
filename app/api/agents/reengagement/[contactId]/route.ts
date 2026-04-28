/**
 * Reengagement Signal Agent API
 *
 * POST /api/agents/reengagement/:contactId
 * Trigger reengagement signal analysis for a specific contact
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { runReengagementSignal } from "@/lib/agents/reengagement-signal";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  // Fire and forget - don't await
  runReengagementSignal(contactId).catch(console.error);

  return NextResponse.json({ status: "running" });
}
