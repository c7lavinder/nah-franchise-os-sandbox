/**
 * Territory Market Research Agent API
 *
 * POST /api/agents/territory-market/:msSlug
 * Trigger territory market research agent for a specific market
 */

import { NextRequest, NextResponse } from "next/server";
import { runTerritoryMarketResearch } from "@/lib/agents/territory-market";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;

  // Fire and forget - don't await
  runTerritoryMarketResearch(msSlug).catch(console.error);

  return NextResponse.json({ status: "running" });
}
