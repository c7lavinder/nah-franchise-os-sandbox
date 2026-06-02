export const dynamic = "force-dynamic";

/**
 * POST /api/cron/workflow-analysis
 *
 * Runs Scout's daily health analysis on all live workflows.
 * Updates health scores (A–F) and identifies underperforming steps.
 *
 * Intended to run once daily via cron (e.g., 6:00 AM).
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeAllWorkflows } from "@/lib/workflows/health-scoring";

async function handleWorkflowAnalysis(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const startTime = Date.now();
    const analyses = await analyzeAllWorkflows();
    const durationMs = Date.now() - startTime;

    const summary = {
      workflowsAnalyzed: analyses.length,
      scores: {
        A: analyses.filter((a) => a.score === "A").length,
        B: analyses.filter((a) => a.score === "B").length,
        C: analyses.filter((a) => a.score === "C").length,
        D: analyses.filter((a) => a.score === "D").length,
        F: analyses.filter((a) => a.score === "F").length,
      },
      issuesFound: analyses.filter((a) => a.topIssue).length,
      underperformingSteps: analyses.reduce((sum, a) => sum + a.underperformingSteps.length, 0),
      durationMs,
    };

    console.log(`[workflow-analysis] ${JSON.stringify(summary)}`);

    return NextResponse.json({ summary, analyses });
  } catch (err) {
    console.error("[workflow-analysis] Fatal error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleWorkflowAnalysis(request);
}

export async function POST(request: NextRequest) {
  return handleWorkflowAnalysis(request);
}
