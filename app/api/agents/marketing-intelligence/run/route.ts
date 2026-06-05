export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runMarketingIntelligence } from "@/lib/agents/marketing-intelligence";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const result = await runMarketingIntelligence();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Marketing Intelligence failed" },
      { status: 500 }
    );
  }
}
