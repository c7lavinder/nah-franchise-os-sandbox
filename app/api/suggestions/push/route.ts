import { NextRequest, NextResponse } from "next/server";
import { pushSuggestion } from "@/lib/scout-learning";

export async function POST(request: NextRequest) {
  const body = await request.json() as { suggestionId: string; finalValue: string; reviewerId: string };
  if (!body.suggestionId || !body.finalValue) {
    return NextResponse.json({ error: "suggestionId and finalValue required" }, { status: 400 });
  }
  try {
    await pushSuggestion(body.suggestionId, body.finalValue, body.reviewerId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
