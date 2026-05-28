export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { syncTerritories } from "@/lib/mastersuite/sync-territories";
import { createServerClient } from "@/lib/supabase/server";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronLogging(
    "sync-ms-territories",
    50_000,
    () => syncTerritories(),
    (result) => {
      // Mark territory briefs stale after successful sync
      if (result.synced > 0) {
        const supabase = createServerClient();
        supabase
          .from("territory_briefs")
          .update({ stale: true })
          .eq("stale", false)
          .then(() => {});
      }

      return {
        status: result.errors.length === 0 ? "success" : "failed",
        result: { synced: result.synced, errors: result.errors },
        error: result.errors.length > 0 ? result.errors[0] : null,
      };
    }
  );
}
