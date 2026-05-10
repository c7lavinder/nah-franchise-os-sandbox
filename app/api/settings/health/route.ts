export const dynamic = "force-dynamic";

/**
 * GET /api/settings/health — system health overview.
 *
 * Returns data counts, error rates, recent errors, and cron status.
 * Admin-only for error details; basic counts for all authenticated users.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getRecentErrors, getErrorRates } from "@/lib/errors/tracker";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();

  const [contacts, territories, users, kbDocs, suggestions, recentCronLogs] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("territories").select("TerritorySlug", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("data_update_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("cron_job_log")
      .select("job_name, status, started_at")
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  // Cron health: count failures in last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCrons = (recentCronLogs.data ?? []) as { job_name: string; status: string; started_at: string }[];
  const cronFailures = recentCrons.filter((l) => l.status !== "success" && new Date(l.started_at) > oneDayAgo).length;

  const response: Record<string, unknown> = {
    totalContacts: contacts.count ?? 0,
    totalTerritories: territories.count ?? 0,
    activeUsers: users.count ?? 0,
    kbDocuments: kbDocs.count ?? 0,
    pendingSuggestions: suggestions.count ?? 0,
    cronFailures24h: cronFailures,
    status: cronFailures === 0 ? "healthy" : "degraded",
  };

  // Admin gets error details
  if (user.role === "admin") {
    response.recentErrors = getRecentErrors().slice(0, 20);
    response.errorRates = getErrorRates();
    response.recentCronRuns = recentCrons.slice(0, 10);
  }

  return NextResponse.json(response);
}
