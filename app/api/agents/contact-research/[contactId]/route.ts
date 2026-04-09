/**
 * Contact Research Agent API
 *
 * POST /api/agents/contact-research/:contactId
 * Trigger contact research agent for a specific contact
 *
 * Query params:
 * - isNew: boolean (default: false) - whether contact is new
 */

import { NextRequest, NextResponse } from "next/server";
import { runContactResearch } from "@/lib/agents/contact-research";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;
  const isNew = request.nextUrl.searchParams.get("isNew") === "true";

  // Fire and forget - don't await
  runContactResearch(contactId, isNew).catch(console.error);

  return NextResponse.json({ status: "running" });
}
