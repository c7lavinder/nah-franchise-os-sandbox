export const dynamic = "force-dynamic";

/**
 * GET /api/track/click/[logId]?url=<destination>
 *
 * Email click tracking endpoint.
 * Records the click event in workflow_step_logs, then redirects
 * the user to the original destination URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params;
  const url = request.nextUrl.searchParams.get("url");

  // If no URL provided, redirect to homepage as fallback
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const destination = url || `${process.env.NEXT_PUBLIC_APP_URL || ""}${basePath}` || "/";

  // Record the click event
  try {
    const supabase = createServerClient();
    const now = new Date().toISOString();

    // Fetch existing delivery_data so we can merge
    const { data: existing } = await supabase
      .from("workflow_step_logs")
      .select("delivery_data")
      .eq("id", logId)
      .single();

    const currentData = (existing?.delivery_data ?? {}) as Record<string, unknown>;

    await supabase
      .from("workflow_step_logs")
      .update({
        clicked: true,
        delivery_data: {
          ...currentData,
          clickedAt: now,
          clickedUrl: url,
        },
      })
      .eq("id", logId);
  } catch (err) {
    // Tracking should never block the redirect
    console.error("Click tracking failed for log:", logId, err);
  }

  return NextResponse.redirect(destination, 302);
}
