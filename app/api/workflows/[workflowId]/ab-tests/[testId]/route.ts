export const dynamic = "force-dynamic";

/**
 * GET   /api/workflows/:workflowId/ab-tests/:testId — get a single A/B test
 * PATCH /api/workflows/:workflowId/ab-tests/:testId — start, record result, or declare winner
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getTest,
  startTest,
  recordResult,
  declareWinner,
  checkForWinner,
  assignVariant,
} from "@/lib/workflows/ab-testing";
import type { ABTestWinner } from "@/lib/workflows/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; testId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId, testId } = await params;

    const test = await getTest(testId);

    if (!test || test.workflow_id !== workflowId) {
      return NextResponse.json({ error: "A/B test not found" }, { status: 404 });
    }

    // Include winner check and variant assignment info
    const winnerCheck = await checkForWinner(testId);
    const nextVariant = test.status === "running" ? await assignVariant(testId) : null;

    return NextResponse.json({ test, winnerCheck, nextVariant });
  } catch (err) {
    console.error("GET ab-test error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; testId: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const { workflowId, testId } = await params;
    const body = await request.json();

    // Verify the test belongs to this workflow
    const existingTest = await getTest(testId);
    if (!existingTest || existingTest.workflow_id !== workflowId) {
      return NextResponse.json({ error: "A/B test not found" }, { status: 404 });
    }

    const { action } = body as { action?: string };

    if (!action) {
      return NextResponse.json(
        { error: "Missing required field: action (start, record_result, declare_winner)" },
        { status: 400 }
      );
    }

    // ── Start the test ──────────────────────────────────
    if (action === "start") {
      const { approvedBy } = body as { approvedBy?: string };
      if (!approvedBy) {
        return NextResponse.json({ error: "Missing required field: approvedBy" }, { status: 400 });
      }

      const result = await startTest(testId, approvedBy);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ test: result.test });
    }

    // ── Record a result ─────────────────────────────────
    if (action === "record_result") {
      const { variant, success } = body as {
        variant?: string;
        success?: boolean;
      };

      if (!variant || (variant !== "A" && variant !== "B")) {
        return NextResponse.json({ error: "Missing or invalid field: variant (must be 'A' or 'B')" }, { status: 400 });
      }

      if (typeof success !== "boolean") {
        return NextResponse.json({ error: "Missing required field: success (boolean)" }, { status: 400 });
      }

      const result = await recordResult(testId, variant as ABTestWinner, success);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // After recording, check for a winner automatically
      const winnerCheck = await checkForWinner(testId);

      return NextResponse.json({ test: result.test, winnerCheck });
    }

    // ── Declare a winner ────────────────────────────────
    if (action === "declare_winner") {
      const { winner, declaredBy } = body as {
        winner?: string;
        declaredBy?: string;
      };

      if (!winner || (winner !== "A" && winner !== "B")) {
        return NextResponse.json({ error: "Missing or invalid field: winner (must be 'A' or 'B')" }, { status: 400 });
      }

      if (!declaredBy) {
        return NextResponse.json({ error: "Missing required field: declaredBy" }, { status: 400 });
      }

      const result = await declareWinner(testId, winner as ABTestWinner, declaredBy);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ test: result.test });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}. Valid actions: start, record_result, declare_winner` },
      { status: 400 }
    );
  } catch (err) {
    console.error("PATCH ab-test error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
