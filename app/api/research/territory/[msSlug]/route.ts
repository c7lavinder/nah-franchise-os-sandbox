/**
 * Territory Market Research Button API
 *
 * POST /api/research/territory/:TerritorySlug
 * Research button endpoint - triggers territory market research agent
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runTerritoryMarketResearch } from "@/lib/agents/territory-market";

export async function POST(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;

  // Fire and forget - don't await
  runTerritoryMarketResearch(TerritorySlug).catch(console.error);

  return NextResponse.json({ status: "running" });
}
