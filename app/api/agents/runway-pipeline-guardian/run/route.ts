export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { runRunwayPipelineGuardian } from "@/lib/agents/runway-pipeline-guardian";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = (await request.json().catch(() => ({}))) as { repair?: boolean };
  const result = await runRunwayPipelineGuardian({ repair: body.repair ?? false });

  return NextResponse.json(result, { status: result.success ? 200 : 409 });
}
