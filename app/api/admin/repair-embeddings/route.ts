export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { embedTranscript, embedKBDoc } from "@/lib/rag/embedder";

/**
 * POST /api/admin/repair-embeddings — find and re-embed content that is missing embeddings.
 * Unlike backfill-embeddings (which skips already-embedded), this specifically targets gaps.
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const results = {
    transcripts: { missing: 0, repaired: 0, failed: 0, errors: [] as string[] },
    kbDocs: { missing: 0, repaired: 0, failed: 0, errors: [] as string[] },
  };

  // Find transcripts without embeddings
  const { data: allTranscripts } = await supabase
    .from("call_transcripts")
    .select("id")
    .order("created_at", { ascending: true });

  for (const tx of allTranscripts ?? []) {
    const { count } = await supabase
      .from("embeddings")
      .select("id", { count: "exact", head: true })
      .eq("content_type", "transcript")
      .contains("metadata", { source_id: tx.id });

    if (count && count > 0) continue;
    results.transcripts.missing++;

    try {
      await embedTranscript(tx.id);
      results.transcripts.repaired++;
    } catch (err) {
      results.transcripts.failed++;
      results.transcripts.errors.push(`${tx.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Find KB docs without embeddings
  const { data: allDocs } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  for (const doc of allDocs ?? []) {
    const { count } = await supabase
      .from("embeddings")
      .select("id", { count: "exact", head: true })
      .eq("content_type", "kb_doc")
      .contains("metadata", { source_id: doc.id });

    if (count && count > 0) continue;
    results.kbDocs.missing++;

    try {
      await embedKBDoc(doc.id);
      results.kbDocs.repaired++;
    } catch (err) {
      results.kbDocs.failed++;
      results.kbDocs.errors.push(`${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json(results);
}
