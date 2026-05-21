export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { embedAllExistingTranscripts, embedAllExistingKBDocs } from "@/lib/rag/embedder";

/**
 * POST /api/admin/backfill-embeddings — embed all existing transcripts + KB docs.
 * Safe to run multiple times (skips already-embedded content).
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const transcripts = await embedAllExistingTranscripts();
  const kbDocs = await embedAllExistingKBDocs();

  return NextResponse.json({
    transcripts,
    kbDocs,
  });
}
