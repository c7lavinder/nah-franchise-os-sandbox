/**
 * KB Health Monitor
 *
 * Tracks document retrieval, staleness, and content gaps.
 * Powers the Settings KB health view.
 */

import { createServerClient } from "@/lib/supabase/server";

/**
 * Flag documents not updated in 90+ days as stale.
 */
export async function flagStaleDocuments(): Promise<number> {
  const supabase = createServerClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .update({ flagged_as_stale: true })
    .lt("updated_at", ninetyDaysAgo)
    .eq("flagged_as_stale", false)
    .eq("is_active", true)
    .select("id");

  if (error) throw new Error(`Failed to flag stale docs: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Log a KB document retrieval for health tracking.
 */
export async function logRetrieval(
  docId: string,
  callId?: string,
  gradeScore?: number
): Promise<void> {
  const supabase = createServerClient();

  // Increment retrieval count + update last_retrieved_at
  const { data: doc } = await supabase
    .from("knowledge_documents")
    .select("retrieval_count, retrieval_quality_score")
    .eq("id", docId)
    .single();

  const currentCount = doc?.retrieval_count ?? 0;
  const currentQuality = doc?.retrieval_quality_score ?? null;

  // Rolling average of quality score
  let newQuality = currentQuality;
  if (gradeScore !== undefined) {
    newQuality = currentQuality
      ? (currentQuality * currentCount + gradeScore) / (currentCount + 1)
      : gradeScore;
  }

  await supabase
    .from("knowledge_documents")
    .update({
      last_retrieved_at: new Date().toISOString(),
      retrieval_count: currentCount + 1,
      retrieval_quality_score: newQuality,
      flagged_as_stale: false,
    })
    .eq("id", docId);
}

/**
 * Record a gap signal when Scout searched for content but found nothing.
 */
export async function detectGap(
  failedSearchQuery: string,
  resultsFound: number,
  suggestedCategory?: string
): Promise<void> {
  const supabase = createServerClient();

  await supabase.from("kb_gap_signals").insert({
    query: failedSearchQuery,
    results_found: resultsFound,
    suggested_category: suggestedCategory,
  });
}

/**
 * Generate KB health report.
 */
export async function generateHealthReport(): Promise<{
  totalDocs: number;
  activeDocs: number;
  staleDocs: number;
  docsWithNoContent: number;
  totalRetrievals: number;
  topRetrieved: Array<{ id: string; title: string; count: number }>;
  neverRetrieved: Array<{ id: string; title: string }>;
  gapSignals: Array<{ query: string; count: number }>;
  avgQualityScore: number | null;
}> {
  const supabase = createServerClient();

  const { count: totalDocs } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true });

  const { count: activeDocs } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: staleDocs } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("flagged_as_stale", true);

  const { count: noContent } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .or("content.is.null,content.eq.");

  // Top 10 most retrieved
  const { data: topDocs } = await supabase
    .from("knowledge_documents")
    .select("id, title, retrieval_count")
    .gt("retrieval_count", 0)
    .order("retrieval_count", { ascending: false })
    .limit(10);

  // Never retrieved
  const { data: neverDocs } = await supabase
    .from("knowledge_documents")
    .select("id, title")
    .eq("retrieval_count", 0)
    .eq("is_active", true)
    .limit(20);

  // Total retrievals
  const { data: allDocs } = await supabase
    .from("knowledge_documents")
    .select("retrieval_count, retrieval_quality_score")
    .eq("is_active", true);

  const totalRetrievals = (allDocs ?? []).reduce((s, d) => s + (d.retrieval_count ?? 0), 0);
  const qualityScores = (allDocs ?? [])
    .filter((d) => d.retrieval_quality_score != null)
    .map((d) => d.retrieval_quality_score as number);
  const avgQualityScore = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    : null;

  // Gap signals (grouped by query)
  const { data: gaps } = await supabase
    .from("kb_gap_signals")
    .select("query")
    .eq("resolved", false)
    .order("searched_at", { ascending: false })
    .limit(50);

  const gapCounts: Record<string, number> = {};
  for (const g of gaps ?? []) {
    gapCounts[g.query] = (gapCounts[g.query] ?? 0) + 1;
  }
  const gapSignals = Object.entries(gapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  return {
    totalDocs: totalDocs ?? 0,
    activeDocs: activeDocs ?? 0,
    staleDocs: staleDocs ?? 0,
    docsWithNoContent: noContent ?? 0,
    totalRetrievals,
    topRetrieved: (topDocs ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      count: d.retrieval_count,
    })),
    neverRetrieved: (neverDocs ?? []).map((d) => ({ id: d.id, title: d.title })),
    gapSignals,
    avgQualityScore,
  };
}
