/**
 * Call Review Package API
 *
 * GET  /api/calls/:callId/review-package — Get existing review package
 * POST /api/calls/:callId/review-package — Generate new review package (auto-trigger)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateReviewPackage } from "@/lib/calls/review-package";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("call_review_packages")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ package: null, exists: false });
  }

  return NextResponse.json({ package: data, exists: true });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  // Check if transcript exists
  const supabase = createServerClient();
  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("id")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();

  if (!transcript) {
    return NextResponse.json(
      { error: "No transcript available for this call" },
      { status: 400 }
    );
  }

  // Check if review package already exists
  const { data: existing } = await supabase
    .from("call_review_packages")
    .select("id")
    .eq("call_id", callId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Review package already exists", packageId: existing.id },
      { status: 409 }
    );
  }

  try {
    const pkg = await generateReviewPackage(callId);
    return NextResponse.json({ success: true, package: pkg });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
