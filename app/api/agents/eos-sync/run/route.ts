export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runEosSyncAgent } from "@/lib/agents/eos-sync-agent";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const result = await runEosSyncAgent();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "EOS Operator failed" },
      { status: 500 }
    );
  }
}
