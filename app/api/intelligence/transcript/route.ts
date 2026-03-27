export const dynamic = "force-dynamic";

/**
 * POST /api/intelligence/transcript
 *
 * Analyze a call transcript and extract structured intelligence fields.
 * Returns pre-fill data for the call log form.
 *
 * Body: { transcript: string, contactName?: string }
 * Returns: { analysis: TranscriptAnalysis }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeTranscript } from "@/lib/intelligence/transcript-analyzer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, contactName } = body;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 50) {
      return NextResponse.json(
        { error: "transcript is required (minimum 50 characters)" },
        { status: 400 }
      );
    }

    const analysis = await analyzeTranscript(transcript, contactName);

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("Transcript analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
