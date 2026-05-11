export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/coaching-brief — personalized coaching brief for sales reps.
 *
 * Runs daily at 7:00 AM. For each rep user:
 *   1. Top 3 leads needing immediate action (oldest in stage, no recent activity)
 *   2. Overdue follow-ups (leads with no activity in 3+ days)
 *   3. Call quality trend (last 10 graded calls — avg grade + weakest dimension)
 *   4. Objection patterns (top objection type + resolution rate)
 *   5. Weekly scorecard (if Monday: leads contacted, avg days per stage, calls completed)
 *
 * Creates a notification with structured coaching data.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const { data: log } = await supabase
    .from("cron_job_log")
    .insert({ job_name: "coaching-brief", status: "running" })
    .select("id")
    .single();

  try {
    // Get rep users (franchise development reps)
    const { data: reps } = await supabase
      .from("users")
      .select("id, full_name, ghl_user_id")
      .eq("is_active", true)
      .eq("is_real_user", true)
      .eq("role", "rep");

    if (!reps || reps.length === 0) {
      if (log) {
        await supabase
          .from("cron_job_log")
          .update({ finished_at: new Date().toISOString(), status: "completed", result: { briefsSent: 0 } })
          .eq("id", log.id);
      }
      return NextResponse.json({ briefsSent: 0 });
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const isMonday = now.getDay() === 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    let briefsSent = 0;

    for (const rep of reps) {
      const sections: string[] = [];
      const metadata: Record<string, unknown> = {};

      // ── 1. Top leads needing action (oldest in stage, active pipeline) ──
      const { data: stalledLeads } = await supabase
        .from("journey_pipeline_state")
        .select(
          "id, entered_current_stage_at, pipeline_stages(name), journeys!inner(name, primary_contact_id, contacts:primary_contact_id(first_name, last_name))"
        )
        .eq("is_active", true)
        .eq("assigned_user_id", rep.id)
        .order("entered_current_stage_at", { ascending: true })
        .limit(5);

      if (stalledLeads && stalledLeads.length > 0) {
        const topLeads = stalledLeads.slice(0, 3).map((l: any) => {
          const journey = Array.isArray(l.journeys) ? l.journeys[0] : l.journeys;
          const contact = journey?.contacts;
          const c = Array.isArray(contact) ? contact[0] : contact;
          const name = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : (journey?.name ?? "Unknown");
          const stage = Array.isArray(l.pipeline_stages) ? l.pipeline_stages[0]?.name : l.pipeline_stages?.name;
          const daysInStage = Math.round(
            (now.getTime() - new Date(l.entered_current_stage_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          return `${name} — ${stage ?? "?"} (${daysInStage}d)`;
        });
        sections.push(`TOP LEADS: ${topLeads.join(" | ")}`);
        metadata.topLeads = topLeads;
      }

      // ── 2. Overdue follow-ups (3+ days in stage, no activity) ──
      const overdueCount = (stalledLeads ?? []).filter((l: any) => l.entered_current_stage_at < threeDaysAgo).length;
      if (overdueCount > 0) {
        sections.push(`${overdueCount} lead${overdueCount !== 1 ? "s" : ""} overdue (3+ days no progress)`);
        metadata.overdueCount = overdueCount;
      }

      // ── 3. Call quality trend (last 10 graded calls) ──
      const { data: recentGrades } = await supabase
        .from("calls")
        .select("id, call_grades(overall_grade)")
        .eq("hosted_by_user_id", rep.id)
        .not("call_grades", "is", null)
        .order("started_at", { ascending: false })
        .limit(10);

      if (recentGrades && recentGrades.length > 0) {
        const gradeMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        const grades = recentGrades
          .map((c: any) => {
            const g = Array.isArray(c.call_grades) ? c.call_grades[0] : c.call_grades;
            return g?.overall_grade;
          })
          .filter(Boolean);

        if (grades.length > 0) {
          const numericAvg = grades.reduce((sum: number, g: string) => sum + (gradeMap[g] ?? 0), 0) / grades.length;
          const avgLetter =
            numericAvg >= 3.5 ? "A" : numericAvg >= 2.5 ? "B" : numericAvg >= 1.5 ? "C" : numericAvg >= 0.5 ? "D" : "F";
          sections.push(`CALL QUALITY: ${avgLetter} avg (last ${grades.length} graded calls)`);
          metadata.callGradeAvg = avgLetter;
          metadata.callGradeCount = grades.length;
        }
      }

      // ── 4. Objection patterns (last 30 days) ──
      const { data: objections } = await supabase
        .from("objection_registry")
        .select("objection_type, resolved")
        .gte("created_at", thirtyDaysAgo);

      if (objections && objections.length > 0) {
        // Count by type
        const typeCounts = new Map<string, { total: number; resolved: number }>();
        for (const o of objections as { objection_type: string; resolved: boolean }[]) {
          const existing = typeCounts.get(o.objection_type) ?? { total: 0, resolved: 0 };
          existing.total++;
          if (o.resolved) existing.resolved++;
          typeCounts.set(o.objection_type, existing);
        }
        // Top objection type
        const sorted = [...typeCounts.entries()].sort((a, b) => b[1].total - a[1].total);
        if (sorted.length > 0) {
          const [topType, topStats] = sorted[0];
          const resolvePct = topStats.total > 0 ? Math.round((topStats.resolved / topStats.total) * 100) : 0;
          sections.push(`OBJECTIONS: "${topType}" is #1 (${topStats.total} total, ${resolvePct}% resolved)`);
          metadata.topObjection = topType;
          metadata.topObjectionCount = topStats.total;
          metadata.topObjectionResolvePct = resolvePct;
        }
      }

      // ── 5. Weekly scorecard (Monday only) ──
      if (isMonday) {
        const weekAgo = weekStart.toISOString();

        // Calls completed this week
        const { count: callsThisWeek } = await supabase
          .from("calls")
          .select("id", { count: "exact", head: true })
          .eq("hosted_by_user_id", rep.id)
          .eq("status", "completed")
          .gte("started_at", weekAgo);

        // Leads touched this week (stage changes)
        const { count: leadsTouched } = await supabase
          .from("journey_pipeline_state")
          .select("id", { count: "exact", head: true })
          .eq("assigned_user_id", rep.id)
          .gte("updated_at", weekAgo);

        sections.push(`WEEKLY: ${callsThisWeek ?? 0} calls completed, ${leadsTouched ?? 0} leads touched`);
        metadata.weeklyCallsCompleted = callsThisWeek ?? 0;
        metadata.weeklyLeadsTouched = leadsTouched ?? 0;
      }

      if (sections.length === 0) {
        sections.push("Pipeline is clear — no urgent items today.");
      }

      // Create notification
      await supabase.from("notifications").insert({
        recipient_user_id: rep.id,
        type: "coaching_brief",
        title: isMonday ? "Weekly Coaching Brief" : "Daily Coaching Brief",
        body: sections.join("\n"),
        metadata,
      });

      briefsSent++;
    }

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({
          finished_at: new Date().toISOString(),
          status: "completed",
          result: { briefsSent },
        })
        .eq("id", log.id);
    }

    return NextResponse.json({ briefsSent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("coaching-brief FAILED:", message);

    if (log) {
      await supabase
        .from("cron_job_log")
        .update({ finished_at: new Date().toISOString(), status: "failed", error: message })
        .eq("id", log.id);
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
