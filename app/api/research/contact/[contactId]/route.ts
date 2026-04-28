/**
 * Contact Research Button API
 *
 * POST /api/research/contact/:contactId
 * Research button endpoint - triggers contact research agent
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { runContactResearch } from "@/lib/agents/contact-research";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params;

  // Fire and forget - don't await
  runContactResearch(contactId, false).catch(console.error);

  return NextResponse.json({ status: "running" });
}
