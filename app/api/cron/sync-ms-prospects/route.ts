export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { syncProspects } from "@/lib/mastersuite/sync-prospects";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";
import { formatSyncProspectsCronResult } from "@/lib/mastersuite/prospect-cron-result";
import { createServerClient } from "@/lib/supabase/server";
import {
  getSyncWatermark,
  recordSyncWatermarkAttempt,
  recordSyncWatermarkSuccess,
} from "@/lib/mastersuite/sync-watermarks";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fallbackSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return withCronLogging(
    "sync-ms-prospects",
    50_000,
    async () => {
      const db = createServerClient();
      const watermark = await getSyncWatermark(db, "sync-ms-prospects").catch((err) => {
        console.warn("sync-ms-prospects: failed to read watermark, using 7-day fallback", err);
        return null;
      });
      const since = watermark?.lastSuccessCursor ?? fallbackSince;

      await recordSyncWatermarkAttempt(db, "sync-ms-prospects", since, { fallback: !watermark?.lastSuccessCursor }).catch(
        (err) => {
          console.warn("sync-ms-prospects: failed to record watermark attempt", err);
        }
      );

      const result = await syncProspects(since);
      const nextCursor = result.sourceCursor ?? since;

      if (result.errors.length === 0) {
        await recordSyncWatermarkSuccess(db, "sync-ms-prospects", nextCursor, {
          created: result.created,
          wired: result.wired,
          skipped: result.skipped,
        }).catch((err) => {
          console.warn("sync-ms-prospects: failed to record watermark success", err);
        });
      }

      return { ...result, watermarkCursor: nextCursor };
    },
    formatSyncProspectsCronResult
  );
}
