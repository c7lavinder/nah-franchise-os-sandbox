/**
 * POST /api/cron/stale-leads
 *
 * Checks all active pipeline leads for staleness and creates
 * inactivity alerts for leads that haven't been touched.
 *
 * Thresholds (from pipeline.md):
 * - Active pipeline leads: 3+ days without touch = medium alert
 * - Active pipeline leads: 7+ days without touch = high alert
 * - Follow-up leads: 14+ days without touch = high alert
 * - Nurture leads: 45+ days without touch = low alert
 * - Re-engaged leads: 2+ hours without contact = critical alert
 *
 * Intended to run every 4 hours via cron.
 * Skips leads that already have an open (unresolved) alert of the same type.
 */

import { NextResponse } from "next/server";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import type { GHLOpportunity } from "@/types/ghl";

interface AlertToCreate {
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  contactId: string;
  contactName: string;
  stageName: string;
  message: string;
}

export async function POST() {
  try {
    const supabase = createServerClient();

    // Get all NAH pipeline opportunities
    const allPipelines = await ghl.getPipelines();
    const nahPipelines = allPipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));

    const stageMap = new Map<string, string>();
    for (const p of nahPipelines) {
      for (const s of p.stages) {
        stageMap.set(s.id, s.name.trim());
      }
    }

    const allOpps: GHLOpportunity[] = [];
    for (const pipeline of nahPipelines) {
      try {
        const opps = await ghl.searchOpportunitiesPaginated({
          pipelineId: pipeline.id,
          status: "open",
        });
        allOpps.push(...opps);
      } catch {
        // Continue
      }
    }

    // Load existing open alerts to avoid duplicates
    const { data: existingAlerts } = await supabase
      .from("inactivity_alerts")
      .select("ghl_contact_id, alert_type")
      .eq("is_resolved", false);

    const existingAlertKeys = new Set(
      (existingAlerts ?? []).map((a) => `${a.ghl_contact_id}:${a.alert_type}`)
    );

    // Load field mapping for Last Touch Date
    const { data: fieldMappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact")
      .eq("field_name", "Last Touch Date");

    const lastTouchFieldId = fieldMappings?.[0]?.ghl_field_id;

    const alertsToCreate: AlertToCreate[] = [];
    const now = Date.now();

    // Check each opportunity — batch contacts for efficiency
    for (let i = 0; i < allOpps.length; i += 10) {
      const batch = allOpps.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (opp) => {
          const stageName = stageMap.get(opp.pipelineStageId) ?? "Unknown";
          const contact = await ghl.getContact(opp.contactId);
          const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || opp.name;

          // Get last touch date from custom fields
          let lastTouchDate: Date | null = null;
          if (lastTouchFieldId) {
            const field = contact.customFields.find((f) => f.id === lastTouchFieldId);
            if (field?.value) {
              lastTouchDate = new Date(field.value);
            }
          }

          // Fall back to opportunity updatedAt if no touch date
          const referenceDate = lastTouchDate ?? new Date(opp.updatedAt);
          const daysSinceTouch = Math.floor((now - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
          const hoursSinceTouch = Math.floor((now - referenceDate.getTime()) / (1000 * 60 * 60));

          // Determine alert based on stage type
          const isLongTermStage = ["Follow-up", "Nurture", "Re-engaged"].includes(stageName);

          if (stageName === "Re-engaged" && hoursSinceTouch >= 2) {
            // Re-engaged leads must be contacted within 2 hours
            const key = `${opp.contactId}:stale_reengaged`;
            if (!existingAlertKeys.has(key)) {
              alertsToCreate.push({
                alertType: "stale_reengaged",
                severity: "critical",
                contactId: opp.contactId,
                contactName,
                stageName,
                message: `${contactName} re-engaged ${hoursSinceTouch}h ago — contact immediately!`,
              });
            }
          } else if (stageName === "Follow-up" && daysSinceTouch >= 14) {
            const key = `${opp.contactId}:stale_followup`;
            if (!existingAlertKeys.has(key)) {
              alertsToCreate.push({
                alertType: "stale_followup",
                severity: "high",
                contactId: opp.contactId,
                contactName,
                stageName,
                message: `${contactName} in Follow-up — no touch in ${daysSinceTouch} days.`,
              });
            }
          } else if (stageName === "Nurture" && daysSinceTouch >= 45) {
            const key = `${opp.contactId}:stale_nurture`;
            if (!existingAlertKeys.has(key)) {
              alertsToCreate.push({
                alertType: "stale_nurture",
                severity: "low",
                contactId: opp.contactId,
                contactName,
                stageName,
                message: `${contactName} in Nurture — no personal touch in ${daysSinceTouch} days.`,
              });
            }
          } else if (!isLongTermStage && daysSinceTouch >= 7) {
            const key = `${opp.contactId}:stale_active_high`;
            if (!existingAlertKeys.has(key)) {
              alertsToCreate.push({
                alertType: "stale_active_high",
                severity: "high",
                contactId: opp.contactId,
                contactName,
                stageName,
                message: `${contactName} (${stageName}) — no contact in ${daysSinceTouch} days. Lead going cold.`,
              });
            }
          } else if (!isLongTermStage && daysSinceTouch >= 3) {
            const key = `${opp.contactId}:stale_active`;
            if (!existingAlertKeys.has(key)) {
              alertsToCreate.push({
                alertType: "stale_active",
                severity: "medium",
                contactId: opp.contactId,
                contactName,
                stageName,
                message: `${contactName} (${stageName}) — last touch ${daysSinceTouch} days ago. Follow up today.`,
              });
            }
          }
        })
      );
    }

    // Insert alerts
    let created = 0;
    for (const alert of alertsToCreate) {
      try {
        await supabase.from("inactivity_alerts").insert({
          alert_type: alert.alertType,
          severity: alert.severity,
          ghl_contact_id: alert.contactId,
          pipeline_stage: alert.stageName,
          message: alert.message,
          details: { contactName: alert.contactName, stageName: alert.stageName },
        });
        created++;
      } catch {
        // Skip individual insert failures
      }
    }

    return NextResponse.json({
      leadsChecked: allOpps.length,
      alertsCreated: created,
      alertsSkipped: alertsToCreate.length - created,
      breakdown: {
        critical: alertsToCreate.filter((a) => a.severity === "critical").length,
        high: alertsToCreate.filter((a) => a.severity === "high").length,
        medium: alertsToCreate.filter((a) => a.severity === "medium").length,
        low: alertsToCreate.filter((a) => a.severity === "low").length,
      },
    });
  } catch (err) {
    console.error("Stale lead check failed:", err);
    return NextResponse.json({ error: "Stale lead check failed" }, { status: 502 });
  }
}
