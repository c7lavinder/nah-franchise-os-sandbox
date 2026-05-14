export const dynamic = "force-dynamic";

/**
 * POST /api/scout/action
 *
 * Executes a confirmed drafted action in GHL.
 * This is called when the user clicks "Confirm" on a drafted action card.
 * Logs the execution to scout_action_logs.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { enrollContact, pauseEnrollment, resumeEnrollment, exitEnrollment } from "@/lib/workflows/enrollment";
import type {
  DraftedAction,
  DraftedMessagePayload,
  DraftedTaskPayload,
  DraftedStageMovePayload,
  DraftedProfileUpdatePayload,
  DraftedEosUpdatePayload,
  DraftedMarketDataUpdatePayload,
  DraftedJourneyActionPayload,
  DraftedAppointmentPayload,
  DraftedNotePayload,
  DraftedTriggerWorkflowPayload,
  DraftedSubTaskLogPayload,
} from "@/types/scout";

/** Update engagement tracking fields after an action touches a contact */
async function updateTouchFields(contactId: string, channel: string) {
  try {
    const supabase = createServerClient();
    const { data: mappings } = await supabase
      .from("ghl_custom_fields")
      .select("field_name, ghl_field_id")
      .eq("entity_type", "contact")
      .in("field_name", ["Last Touch Date", "Last Touch Channel"]);

    if (!mappings || mappings.length === 0) return;

    const customFields: { id: string; value: string }[] = [];
    for (const m of mappings) {
      if (m.field_name === "Last Touch Date") {
        customFields.push({ id: m.ghl_field_id, value: new Date().toISOString() });
      }
      if (m.field_name === "Last Touch Channel") {
        customFields.push({ id: m.ghl_field_id, value: channel });
      }
    }

    if (customFields.length > 0) {
      await ghl.updateContact(contactId, { customFields });
    }
  } catch {
    console.warn("Failed to update touch fields for", contactId);
  }
}

/** Load GHL field name → field ID mapping from Supabase cache */
async function loadFieldMapping(): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("ghl_custom_fields")
    .select("field_name, ghl_field_id")
    .eq("entity_type", "contact");

  const map = new Map<string, string>();
  if (data) {
    for (const row of data) {
      map.set(row.field_name.toLowerCase(), row.ghl_field_id);
    }
  }
  return map;
}

interface ActionRequestBody {
  action: DraftedAction;
  userId: string;
  sessionId: string;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  try {
    const body = (await request.json()) as ActionRequestBody;

    if (!body.action) {
      return NextResponse.json({ error: "Missing required field: action" }, { status: 400 });
    }

    const { action } = body;
    let ghlResponse: Record<string, unknown> | null = null;
    let errorMessage: string | null = null;

    try {
      switch (action.type) {
        case "message": {
          const payload = action.payload as DraftedMessagePayload;
          const result =
            payload.channel === "Email"
              ? await ghl.sendMessage({
                  type: "Email",
                  contactId: action.contactId,
                  html: payload.content,
                  subject: payload.subject ?? "NAH Franchise",
                  emailFrom: process.env.GHL_SENDING_EMAIL ?? "chad@newagainhouses.com",
                })
              : await ghl.sendMessage({
                  type: "SMS",
                  contactId: action.contactId,
                  message: payload.content,
                });
          ghlResponse = result as unknown as Record<string, unknown>;
          break;
        }
        case "task": {
          const payload = action.payload as DraftedTaskPayload;
          const result = await ghl.createTask(action.contactId, {
            title: payload.title,
            body: payload.description,
            dueDate: payload.dueDate,
            assignedTo: payload.assignedTo,
          });
          ghlResponse = result as unknown as Record<string, unknown>;
          break;
        }
        case "stage_move": {
          const payload = action.payload as DraftedStageMovePayload;
          // Search for the open opportunity for this contact
          const opportunities = await ghl.searchOpportunities({
            status: "open",
          });
          const opportunity = opportunities.find((opp) => opp.contactId === action.contactId);
          if (!opportunity) {
            throw new Error(`No open opportunity found for contact ${action.contactId}`);
          }

          // Find the target stage — search all pipelines to support cross-pipeline moves
          const allPipelines = await ghl.getPipelines();
          let targetStage: { id: string; name: string } | undefined;
          let targetPipelineId: string | undefined;

          // If a specific target pipeline is set, search that one first
          if (payload.newPipelineId) {
            const targetPl = allPipelines.find((p) => p.id === payload.newPipelineId);
            targetStage = targetPl?.stages.find((s) => s.name.toLowerCase() === payload.newStage.toLowerCase());
            if (targetStage) targetPipelineId = targetPl?.id;
          }

          // Fall back to searching current pipeline, then all pipelines
          if (!targetStage) {
            const currentPl = allPipelines.find((p) => p.id === opportunity.pipelineId);
            targetStage = currentPl?.stages.find((s) => s.name.toLowerCase() === payload.newStage.toLowerCase());
            if (targetStage) {
              targetPipelineId = currentPl?.id;
            } else {
              // Cross-pipeline: search all pipelines for the stage name
              for (const pl of allPipelines) {
                const match = pl.stages.find((s) => s.name.toLowerCase() === payload.newStage.toLowerCase());
                if (match) {
                  targetStage = match;
                  targetPipelineId = pl.id;
                  break;
                }
              }
            }
          }

          if (!targetStage) {
            throw new Error(`Pipeline stage "${payload.newStage}" not found in any pipeline`);
          }

          // If moving to a different pipeline, create a new opportunity there
          if (targetPipelineId && targetPipelineId !== opportunity.pipelineId) {
            // Close the old opportunity
            await ghl.movePipelineStage(opportunity.id, opportunity.pipelineStageId);
            // Create new opportunity in target pipeline at target stage
            const newOpp = await ghl.createOpportunity({
              pipelineId: targetPipelineId,
              pipelineStageId: targetStage.id,
              contactId: action.contactId,
              name: opportunity.name ?? `${action.contactName} - Pipeline Move`,
              status: "open",
            });
            ghlResponse = newOpp as unknown as Record<string, unknown>;
          } else {
            const result = await ghl.movePipelineStage(opportunity.id, targetStage.id);
            ghlResponse = result as unknown as Record<string, unknown>;
          }
          break;
        }
        case "profile_update": {
          const payload = action.payload as DraftedProfileUpdatePayload;
          // Build the field updates and push via profile API
          const fieldMapping = await loadFieldMapping();
          const customFields: { id: string; value: string }[] = [];
          for (const update of payload.fields) {
            const mapping = fieldMapping.get(update.fieldName.toLowerCase());
            if (mapping) {
              customFields.push({ id: mapping, value: update.value });
            }
          }
          if (customFields.length > 0) {
            const result = await ghl.updateContact(action.contactId, { customFields });
            ghlResponse = result as unknown as Record<string, unknown>;
          } else {
            throw new Error("No valid field mappings found — run setup script to populate ghl_custom_fields");
          }
          break;
        }
        case "eos_update": {
          const eosPayload = action.payload as DraftedEosUpdatePayload;
          const supabaseEos = createServerClient();

          if (eosPayload.entityType === "contact") {
            // Contact EOS updates
            if (eosPayload.section === "goals") {
              const goalUpdates: Record<string, unknown> = {
                contact_id: eosPayload.entityId,
                updated_at: new Date().toISOString(),
              };
              for (const u of eosPayload.updates) {
                goalUpdates[u.fieldName] = u.value;
              }
              await supabaseEos.from("eos_contact_goals").upsert(goalUpdates, { onConflict: "contact_id" });
            } else if (eosPayload.section === "issues") {
              for (const u of eosPayload.updates) {
                await supabaseEos.from("eos_contact_issues").insert({
                  contact_id: eosPayload.entityId,
                  Issue: u.value,
                  source: "ai",
                });
              }
            } else if (eosPayload.section === "todos") {
              for (const u of eosPayload.updates) {
                await supabaseEos.from("eos_contact_todos").insert({
                  contact_id: eosPayload.entityId,
                  Todo: u.value,
                  source: "ai",
                });
              }
            }
          } else {
            // Territory EOS updates
            const slug = eosPayload.entityId;
            if (eosPayload.section === "goals") {
              for (const u of eosPayload.updates) {
                await supabaseEos.from("eos_territory_goals").upsert(
                  {
                    TerritorySlug: slug,
                    goal_type: u.fieldName,
                    current_year_goal: u.value,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "TerritorySlug,goal_type" }
                );
              }
            } else if (eosPayload.section === "issues") {
              for (const u of eosPayload.updates) {
                await supabaseEos.from("eos_territory_issues").insert({
                  TerritorySlug: slug,
                  Issue: u.value,
                  source: "ai",
                });
              }
            } else if (eosPayload.section === "todos") {
              for (const u of eosPayload.updates) {
                await supabaseEos.from("eos_territory_todos").insert({
                  TerritorySlug: slug,
                  Todo: u.value,
                  source: "ai",
                });
              }
            } else if (eosPayload.section === "rocks") {
              const now = new Date();
              for (const u of eosPayload.updates) {
                await supabaseEos.from("eos_territory_rocks").insert({
                  TerritorySlug: slug,
                  Rock: u.value,
                  quarter: Math.ceil((now.getMonth() + 1) / 3),
                  year: now.getFullYear(),
                });
              }
            } else if (eosPayload.section === "scorecard") {
              for (const u of eosPayload.updates) {
                await supabaseEos
                  .from("eos_territory_scorecard")
                  .update({
                    goal_value: u.value,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("TerritorySlug", slug)
                  .eq("metric_key", u.fieldName);
              }
            } else if (eosPayload.section === "habits") {
              for (const u of eosPayload.updates) {
                await supabaseEos
                  .from("eos_territory_habits")
                  .update({
                    grade: u.value,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("TerritorySlug", slug)
                  .eq("habit_key", u.fieldName);
              }
            }
          }
          ghlResponse = { updated: eosPayload.updates.length };
          break;
        }
        case "market_data_update": {
          const mdPayload = action.payload as DraftedMarketDataUpdatePayload;
          const supabaseMd = createServerClient();

          for (const u of mdPayload.fields) {
            await supabaseMd.from("territory_market_data").upsert(
              {
                TerritorySlug: mdPayload.territorySlug,
                field_name: u.fieldName,
                field_value: u.value,
                source: "scout",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "TerritorySlug,field_name" }
            );
          }
          ghlResponse = { updated: mdPayload.fields.length };
          break;
        }
        case "appointment": {
          const apptPayload = action.payload as DraftedAppointmentPayload;
          if (!apptPayload.calendarId) throw new Error("calendarId required");
          try {
            const result = await ghl.createAppointment({
              calendarId: apptPayload.calendarId,
              contactId: action.contactId,
              title: apptPayload.title,
              startTime: apptPayload.startTime,
              endTime: apptPayload.endTime,
              assignedUserId: apptPayload.assignedUserId,
            });
            ghlResponse = result as unknown as Record<string, unknown>;
            // Audit success — pairs with the 'draft' log written by Scout.
            const apptSupabase = createServerClient();
            await apptSupabase.from("integration_logs").insert({
              integration_name: "scout-appointment",
              event_type: "push",
              status: "success",
              payload_summary: `"${apptPayload.title}" booked on ${apptPayload.calendarName ?? apptPayload.calendarId} (appt=${result.id})`,
              related_contact_id: action.contactId,
            });
          } catch (apptErr) {
            // Audit failure — captures exactly what GHL rejected so future
            // breakage is diagnosable from Settings without console access.
            const apptErrMsg = apptErr instanceof Error ? apptErr.message : "Unknown error";
            const apptSupabase = createServerClient();
            await apptSupabase.from("integration_logs").insert({
              integration_name: "scout-appointment",
              event_type: "push",
              status: "failed",
              payload_summary: `"${apptPayload.title}" → ${apptPayload.calendarName ?? apptPayload.calendarId}`,
              error_message: apptErrMsg,
              related_contact_id: action.contactId,
            });
            throw apptErr;
          }
          break;
        }
        case "note": {
          const notePayload = action.payload as DraftedNotePayload;
          const result = await ghl.addNote(action.contactId, notePayload.body);
          ghlResponse = result as unknown as Record<string, unknown>;
          break;
        }
        case "trigger_workflow": {
          const twPayload = action.payload as DraftedTriggerWorkflowPayload;
          await ghl.triggerWorkflow(action.contactId, twPayload.workflowName ?? twPayload.workflowId);
          ghlResponse = {
            workflowId: twPayload.workflowId,
            contactId: action.contactId,
            triggered: true,
          };
          break;
        }
        case "journey_action": {
          const jaPayload = action.payload as DraftedJourneyActionPayload;
          if (jaPayload.kind === "enroll_workflow") {
            if (!jaPayload.workflowId) throw new Error("workflowId required for enroll_workflow");
            // Look up the current workflow version
            const supabaseJa = createServerClient();
            const { data: wf } = await supabaseJa
              .from("workflows")
              .select("current_version_id, name")
              .eq("id", jaPayload.workflowId)
              .single();
            const versionId = (wf as { current_version_id: string | null } | null)?.current_version_id;
            if (!versionId) throw new Error(`Workflow ${jaPayload.workflowId} has no current version`);
            const result = await enrollContact({
              workflowId: jaPayload.workflowId,
              workflowVersionId: versionId,
              ghlContactId: action.contactId,
              contactName: action.contactName,
            });
            if (!result.success) throw new Error(result.error ?? "Enrollment failed");
            ghlResponse = { enrollmentId: result.enrollment?.id };
          } else if (jaPayload.kind === "pause_workflow") {
            if (!jaPayload.enrollmentId) throw new Error("enrollmentId required");
            const result = await pauseEnrollment(jaPayload.enrollmentId);
            if (!result.success) throw new Error(result.error ?? "Pause failed");
            ghlResponse = { enrollmentId: jaPayload.enrollmentId, status: "paused" };
          } else if (jaPayload.kind === "resume_workflow") {
            if (!jaPayload.enrollmentId) throw new Error("enrollmentId required");
            const result = await resumeEnrollment(jaPayload.enrollmentId);
            if (!result.success) throw new Error(result.error ?? "Resume failed");
            ghlResponse = { enrollmentId: jaPayload.enrollmentId, status: "active" };
          } else if (jaPayload.kind === "exit_workflow") {
            if (!jaPayload.enrollmentId) throw new Error("enrollmentId required");
            if (!jaPayload.reason) throw new Error("reason required for exit_workflow");
            const result = await exitEnrollment({
              enrollmentId: jaPayload.enrollmentId,
              reason: jaPayload.reason,
              goalAchieved: false,
            });
            if (!result.success) throw new Error(result.error ?? "Exit failed");
            ghlResponse = { enrollmentId: jaPayload.enrollmentId, status: "exited" };
          } else {
            throw new Error(`Unknown journey action kind: ${jaPayload.kind}`);
          }
          break;
        }
        case "sub_task_log": {
          const stlPayload = action.payload as DraftedSubTaskLogPayload;
          const stlSupabase = createServerClient();

          // Resolve contact to local Supabase ID
          const { data: stlContact } = await stlSupabase
            .from("contacts")
            .select("id")
            .or(`ghl_contact_id.eq.${action.contactId},id.eq.${action.contactId}`)
            .limit(1)
            .single();

          if (!stlContact) throw new Error("Contact not found");

          // Call the sub-task log API internally
          const logRes = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/contacts/${stlContact.id}/sub-tasks/${stlPayload.subTaskId}/logs`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: request.headers.get("Authorization") ?? "",
              },
              body: JSON.stringify({
                contentType: stlPayload.contentType,
                contentText: stlPayload.contentText,
                contentFileUrl: stlPayload.contentFileUrl,
                contentLinkUrl: stlPayload.contentLinkUrl,
                stateAdvance: stlPayload.stateAdvance,
                loggerUserId: stlPayload.loggerUserId,
              }),
            }
          );

          if (!logRes.ok) {
            const errBody = await logRes.json().catch(() => ({ error: "Unknown" }));
            throw new Error(errBody.error ?? "Failed to create sub-task log");
          }

          ghlResponse = await logRes.json();
          break;
        }
        case "compliance_update": {
          const compPayload = action.payload as {
            contactId: string;
            updates: Record<string, unknown>;
            reason?: string;
          };
          const compSupabase = createServerClient();

          const { data: compResult, error: compError } = await compSupabase
            .from("compliance_tracking")
            .upsert(
              {
                contact_id: compPayload.contactId,
                ...compPayload.updates,
                updated_by: user.id,
              },
              { onConflict: "contact_id" }
            )
            .select("id")
            .single();

          if (compError) throw new Error(compError.message);
          ghlResponse = { complianceId: compResult?.id, updated: Object.keys(compPayload.updates) };
          break;
        }
        default: {
          throw new Error(`Unknown action type: ${action.type}`);
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error executing action";
    }

    // Update touch tracking and auto-resolve alerts for message actions
    if (!errorMessage && action.type === "message") {
      const msgPayload = action.payload as DraftedMessagePayload;
      void updateTouchFields(action.contactId, msgPayload.channel);

      // Auto-resolve stale alerts
      try {
        const resolveSupabase = createServerClient();
        await resolveSupabase
          .from("inactivity_alerts")
          .update({ is_resolved: true, resolved_at: new Date().toISOString() })
          .eq("ghl_contact_id", action.contactId)
          .eq("is_resolved", false)
          .in("alert_type", [
            "stale_active",
            "stale_active_high",
            "stale_followup",
            "stale_reengaged",
            "speed_to_lead",
          ]);
      } catch {
        // Non-critical
      }
    }

    // Log the execution result
    try {
      const supabase = createServerClient();
      const now = new Date().toISOString();

      await supabase.from("scout_action_logs").insert({
        user_id: user.id,
        session_id: body.sessionId,
        action_type: action.type,
        action_status: errorMessage ? "failed" : "executed",
        ghl_contact_id: action.contactId,
        draft_content: action.payload as unknown as Record<string, unknown>,
        final_content: action.payload as unknown as Record<string, unknown>,
        ghl_response: ghlResponse,
        error_message: errorMessage,
        confirmed_at: now,
        executed_at: errorMessage ? null : now,
      });
    } catch {
      console.error("Failed to log action execution — continuing");
    }

    if (errorMessage) {
      return NextResponse.json({ error: errorMessage, success: false }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ghlResponse,
    });
  } catch (err) {
    console.error("Action execution error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}
