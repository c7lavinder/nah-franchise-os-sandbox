/**
 * Territory Market Research Button API
 *
 * POST /api/research/territory/:msSlug
 * Research button endpoint - triggers territory market research agent
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runTerritoryMarketResearch } from "@/lib/agents/territory-market";

export async function POST(request: NextRequest, { params }: { params: Promise<{ msSlug: string }> }) {
  const { msSlug } = await params;

  // Fire and forget - don't await
  runTerritoryMarketResearch(msSlug).catch(console.error);

  return NextResponse.json({ status: "running" });
}
