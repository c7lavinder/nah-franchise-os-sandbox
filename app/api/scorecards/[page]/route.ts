export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getDailyHQScorecard, getCallsScorecard, getPipelineScorecard } from "@/lib/scorecards";

type Params = { params: Promise<{ page: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { page } = await params;

  switch (page) {
    case "daily-hq": {
      const data = await getDailyHQScorecard();
      return NextResponse.json(data);
    }
    case "calls": {
      const data = await getCallsScorecard();
      return NextResponse.json(data);
    }
    case "pipeline": {
      const data = await getPipelineScorecard();
      return NextResponse.json(data);
    }
    default:
      return NextResponse.json({ error: "Unknown page" }, { status: 400 });
  }
}
