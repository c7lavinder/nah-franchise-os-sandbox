export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { embedAllExistingTranscripts, embedAllExistingKBDocs } from "@/lib/rag/embedder";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/backfill-embeddings — embed all existing transcripts + KB docs.
 * Safe to run multiple times (skips already-embedded content).
 * Pass { "force": true } to delete all existing embeddings first (for model migration).
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const force = body.force === true;

  // If force mode, clear all existing embeddings (for Voyage migration)
  if (force) {
    const supabase = createServerClient();
    await supabase.from("embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const transcripts = await embedAllExistingTranscripts();
  const kbDocs = await embedAllExistingKBDocs();

  return NextResponse.json({
    force,
    model: "voyage-3-large",
    dimensions: 1024,
    transcripts,
    kbDocs,
  });
}
