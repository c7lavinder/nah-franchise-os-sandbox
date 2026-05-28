export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { SYNC_JOBS, summarizeSyncHealth, type CronJobLogRow } from "@/lib/mastersuite/sync-health";

/**
 * GET /api/admin/sync-status — returns sync health for admin banner.
 * Only accessible to admins. Returns list of jobs that have failed
 * their last 3+ consecutive runs.
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const failing: { job: string; since: string; consecutiveFailures: number; error: string }[] = [];

  const { data: syncRows } = await supabase
    .from("cron_job_log")
    .select("job_name, status, error, started_at, finished_at")
    .in("job_name", [...SYNC_JOBS])
    .order("started_at", { ascending: false })
    .limit(100);
  const syncHealth = summarizeSyncHealth((syncRows ?? []) as CronJobLogRow[]);

  for (const job of SYNC_JOBS) {
    const { data: recent } = await supabase
      .from("cron_job_log")
      .select("status, error, created_at")
      .eq("job_name", job)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!recent || recent.length === 0) continue;

    // Only alert if ALL of the last 3 runs failed
    const allFailed = recent.every((r) => r.status === "failed");
    if (!allFailed) continue;

    failing.push({
      job: job.replace("sync-ms-", ""),
      since: recent[recent.length - 1].created_at,
      consecutiveFailures: recent.length,
      error: recent[0].error || "Unknown error",
    });
  }

  // Embedding health check — compare source counts to embedding counts
  const [transcriptCount, kbDocCount, transcriptEmbeddingCount, kbEmbeddingCount] = await Promise.all([
    supabase
      .from("call_transcripts")
      .select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .then((r) => r.count ?? 0),
    supabase
      .from("embeddings")
      .select("id", { count: "exact", head: true })
      .eq("content_type", "transcript")
      .then((r) => r.count ?? 0),
    supabase
      .from("embeddings")
      .select("id", { count: "exact", head: true })
      .eq("content_type", "kb_doc")
      .then((r) => r.count ?? 0),
  ]);

  const embeddingHealth = {
    transcripts: {
      source: transcriptCount,
      embedded: transcriptEmbeddingCount > 0,
      embeddingChunks: transcriptEmbeddingCount,
    },
    kbDocs: { source: kbDocCount, embedded: kbEmbeddingCount > 0, embeddingChunks: kbEmbeddingCount },
    healthy: transcriptEmbeddingCount > 0 && kbEmbeddingCount > 0,
    message:
      transcriptEmbeddingCount === 0 && transcriptCount > 0
        ? `${transcriptCount} transcripts have no embeddings — run POST /api/admin/repair-embeddings`
        : kbEmbeddingCount === 0 && kbDocCount > 0
          ? `${kbDocCount} KB docs have no embeddings — run POST /api/admin/repair-embeddings`
          : "All content types have embeddings",
  };

  return NextResponse.json({
    healthy: failing.length === 0 && embeddingHealth.healthy && syncHealth.status !== "critical",
    failing,
    syncHealth,
    embeddingHealth,
  });
}
