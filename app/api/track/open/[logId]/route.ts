export const dynamic = "force-dynamic";

/**
 * GET /api/track/open/[logId]
 *
 * Email open tracking pixel endpoint.
 * Returns a 1x1 transparent GIF and records the open event
 * in the workflow_step_logs table.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Smallest valid 1x1 transparent GIF (43 bytes) */
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ logId: string }> }
) {
  const { logId } = await params;

  // Fire-and-forget: update the step log in the background
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
        opened: true,
        delivery_data: { ...currentData, openedAt: now },
      })
      .eq("id", logId);
  } catch (err) {
    // Tracking should never block the pixel response
    console.error("Open tracking failed for log:", logId, err);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
