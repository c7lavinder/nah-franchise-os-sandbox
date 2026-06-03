export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { runRunwayPipelineGuardian } from "@/lib/agents/runway-pipeline-guardian";
import { withCronLogging } from "@/lib/mastersuite/cron-helpers";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronLogging(
    "runway-pipeline-guardian",
    50_000,
    () => runRunwayPipelineGuardian({ repair: false }),
    (result) => ({
      status: result.success ? "success" : "failed",
      result: {
        repaired: result.repaired,
        activeRunwayRows: result.audit.activeRunwayRows,
        expectedRunwayRows: result.audit.expectedRunwayRows,
        runningRows: result.audit.runningRows,
        inventoryBuildingRows: result.audit.inventoryBuildingRows,
        firstPurchaseRows: result.audit.firstPurchaseRows,
        criticalIssues: result.audit.issues.filter((issue) => issue.severity === "critical").length,
      },
      error: result.success
        ? null
        : (result.audit.issues[0]?.message ?? result.repairResult?.errors[0] ?? "Runway audit failed"),
    })
  );
}
