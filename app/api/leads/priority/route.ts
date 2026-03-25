export const dynamic = "force-dynamic";

/**
 * GET /api/leads/priority
 *
 * Returns the top leads that need attention today, sorted by priority.
 * Priority = high score + stale contact = needs Chad's attention NOW.
 *
 * Used by the Daily HQ "Who Needs Attention" panel.
 */

import { NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { calculateLeadScore, buildScoringInput } from "@/lib/profile/lead-scoring";
import type { GHLOpportunity } from "@/types/ghl";

interface PriorityLead {
  contactId: string;
  name: string;
  stage: string;
  score: number;
  tier: string;
  daysSinceTouch: number | null;
  reason: string;
}

export async function GET() {
  try {
    // Get NAH pipelines + open opportunities
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

    // Load field mapping
    const supabase = createServerClient();
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact");

    const idToName = new Map<string, string>();
    if (fieldMappings) {
      for (const m of fieldMappings) {
        idToName.set(m.ghl_field_id, m.field_name);
      }
    }

    // Score and rank — only process top 30 by stage recency to limit API calls
    const recentOpps = openOpps
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 30);

    const priorityLeads: PriorityLead[] = [];

    // Batch-fetch contacts
    for (let i = 0; i < recentOpps.length; i += 10) {
      const batch = recentOpps.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (opp) => {
          const contact = await ghl.getContact(opp.contactId);

          // Extract profile
          const profile: Record<string, string | null> = {};
          for (const cf of contact.customFields) {
            const name = idToName.get(cf.id);
            if (name && cf.value) profile[name] = cf.value;
          }

          // Calculate score
          const input = buildScoringInput(
            { source: contact.source, dateAdded: contact.dateAdded },
            profile
          );
          const scoreResult = calculateLeadScore(input);

          // Calculate days since touch
          const lastTouchStr = profile["Last Touch Date"];
          const daysSinceTouch = lastTouchStr
            ? Math.floor((Date.now() - new Date(lastTouchStr).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const daysInStage = Math.floor(
            (Date.now() - new Date(opp.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Determine why this lead needs attention
          let reason = "";
          if (daysSinceTouch !== null && daysSinceTouch >= 7) {
            reason = `No contact in ${daysSinceTouch} days — going cold`;
          } else if (daysSinceTouch !== null && daysSinceTouch >= 3) {
            reason = `Last touch ${daysSinceTouch}d ago — follow up`;
          } else if (daysInStage >= 10) {
            reason = `${daysInStage}d in stage — stalling`;
          } else if (scoreResult.tier === "Hot") {
            reason = "High score — keep momentum";
          } else {
            reason = `Score ${scoreResult.total} — ${scoreResult.tier}`;
          }

          const stageName = stageMap.get(opp.pipelineStageId) ?? "Unknown";
          const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || opp.name;

          // Priority score: high lead score + stale = highest priority
          const stalePenalty = daysSinceTouch !== null ? daysSinceTouch * 3 : 0;
          const priorityScore = scoreResult.total + stalePenalty;

          return {
            lead: {
              contactId: opp.contactId,
              name: contactName,
              stage: stageName,
              score: scoreResult.total,
              tier: scoreResult.tier,
              daysSinceTouch,
              reason,
            },
            priorityScore,
          };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          priorityLeads.push(r.value.lead);
        }
      }
    }

    // Sort: stale high-score leads first, then by score
    priorityLeads.sort((a, b) => {
      const aStale = (a.daysSinceTouch ?? 0) >= 3 ? 1 : 0;
      const bStale = (b.daysSinceTouch ?? 0) >= 3 ? 1 : 0;
      if (aStale !== bStale) return bStale - aStale; // Stale first
      return b.score - a.score; // Then by score
    });

    return NextResponse.json({
      leads: priorityLeads.slice(0, 10),
      total: openOpps.length,
    });
  } catch (err) {
    console.error("Priority leads fetch failed:", err);
    return NextResponse.json({ error: "Failed to load priority leads" }, { status: 502 });
  }
}
