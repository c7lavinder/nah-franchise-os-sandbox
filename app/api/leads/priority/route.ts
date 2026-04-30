export const dynamic = "force-dynamic";

/**
 * GET /api/leads/priority
 *
 * Returns the top leads that need attention today, sorted by priority.
 * Priority = high score + stale contact = needs Chad's attention NOW.
 *
 * Enriches each lead with intelligence score and critical flag status
 * from the candidate_intelligence table.
 *
 * Lead scores are read from Supabase contacts.scout_lead_score.
 * Used by the Daily HQ "Who Needs Attention" panel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInputFromContact } from "@/lib/profile/lead-scoring";
import type { GHLOpportunity } from "@/types/ghl";
import type { IntelligenceFlag } from "@/lib/intelligence/flags";

interface PriorityLead {
  contactId: string;
  name: string;
  stage: string;
  score: number;
  tier: string;
  daysSinceTouch: number | null;
  reason: string;
  intelligenceScore: number | null;
  hasCriticalFlags: boolean;
}

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  try {
    // Get NAH pipelines + open opportunities (still from GHL until pipeline migration)
    const allPipelines = await ghl.getPipelines();
    const nahPipelines = allPipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));

    const stageMap = new Map<string, string>();
    for (const p of nahPipelines) {
      for (const s of p.stages) {
        stageMap.set(s.id, s.name.trim());
      }
    }

    const openOpps: GHLOpportunity[] = [];
    for (const pipeline of nahPipelines) {
      try {
        const opps = await ghl.searchOpportunitiesPaginated({
          pipelineId: pipeline.id,
          status: "open",
        });
        openOpps.push(...opps);
      } catch {
        // Continue
      }
    }

    const supabase = createServerClient();
    const ghlContactIds = [...new Set(openOpps.map((o) => o.contactId))];

    // Fetch all contacts from Supabase in one query
    const { data: contacts } = await supabase
      .from("contacts")
      .select(
        "id, ghl_contact_id, first_name, last_name, source, opportunity_source, capital_availability, territory_status, business_ownership_experience, investment_timeline, motivation_clarity, trainual_completion_pct, scout_lead_score, created_at"
      )
      .in("ghl_contact_id", ghlContactIds);

    const contactByGhlId = new Map<string, typeof contacts extends (infer T)[] | null ? T : never>();
    for (const c of contacts ?? []) {
      contactByGhlId.set(c.ghl_contact_id, c);
    }

    // Fetch intelligence scores in bulk
    const supabaseIds = (contacts ?? []).map((c) => c.id);
    const { data: intelRecords } = await supabase
      .from("candidate_intelligence")
      .select("contact_id, current_score, active_flags")
      .in("contact_id", supabaseIds);

    const intelMap = new Map<string, { score: number; hasCritical: boolean }>();
    for (const rec of intelRecords ?? []) {
      const flags = Array.isArray(rec.active_flags) ? (rec.active_flags as IntelligenceFlag[]) : [];
      const hasCritical = flags.some((f) => f.severity === "critical");
      intelMap.set(rec.contact_id, { score: rec.current_score ?? 0, hasCritical });
    }

    // Score and rank — only process top 30 by stage recency
    const recentOpps = openOpps
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 30);

    const priorityLeads: PriorityLead[] = [];

    for (const opp of recentOpps) {
      const contact = contactByGhlId.get(opp.contactId);
      if (!contact) continue;

      // Calculate or use stored score
      let score = contact.scout_lead_score;
      let tier = "Cool";

      if (score === null) {
        const input = buildScoringInputFromContact(contact);
        const result = calculateLeadScore(input);
        score = result.total;
        tier = result.tier;
      } else {
        tier = score >= 80 ? "Hot" : score >= 60 ? "Warm" : score >= 40 ? "Cool" : "Cold";
      }

      const daysInStage = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

      let reason = "";
      if (daysInStage >= 10) {
        reason = `${daysInStage}d in stage — stalling`;
      } else if (tier === "Hot") {
        reason = "High score — keep momentum";
      } else {
        reason = `Score ${score} — ${tier}`;
      }

      const stageName = stageMap.get(opp.pipelineStageId) ?? "Unknown";
      const contactName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || opp.name;
      const intel = intelMap.get(contact.id);

      priorityLeads.push({
        contactId: contact.ghl_contact_id,
        name: contactName,
        stage: stageName,
        score,
        tier,
        daysSinceTouch: null,
        reason,
        intelligenceScore: intel?.score ?? null,
        hasCriticalFlags: intel?.hasCritical ?? false,
      });
    }

    // Sort by score descending
    priorityLeads.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      leads: priorityLeads.slice(0, 10),
      total: openOpps.length,
    });
  } catch (err) {
    console.error("Priority leads fetch failed:", err);
    return NextResponse.json({ error: "Failed to load priority leads" }, { status: 502 });
  }
}
