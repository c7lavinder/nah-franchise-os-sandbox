export const dynamic = "force-dynamic";

/**
 * GET /api/activity
 *
 * Returns a chronological activity feed combining:
 * - Scout action logs (stage moves, messages, tasks, notes)
 * - Accountability alerts
 * Sorted by most recent first.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export interface ActivityEvent {
  id: string;
  type: "stage_move" | "message" | "task" | "note" | "alert" | "call_grading";
  status: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  timestamp: string;
  details: Record<string, unknown> | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const supabase = createServerClient();

    // Fetch scout action logs
    const { data: actions } = await supabase
      .from("scout_action_logs")
      .select("id, action_type, action_status, ghl_contact_id, draft_content, final_content, created_at, executed_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Fetch recent alerts
    const { data: alerts } = await supabase
      .from("inactivity_alerts")
      .select("id, alert_type, severity, ghl_contact_id, message, details, created_at, is_resolved")
      .order("created_at", { ascending: false })
      .limit(limit);

    const events: ActivityEvent[] = [];

    // Map actions to events
    for (const action of actions ?? []) {
      const draft = action.draft_content as Record<string, unknown> | null;
      const contactName = draft?.contactName as string ?? draft?.name as string ?? null;

      let description = "";
      switch (action.action_type) {
        case "stage_move":
          description = `Pipeline stage moved${draft?.targetStage ? ` → ${draft.targetStage}` : ""}`;
          break;
        case "message":
          description = `Message ${action.action_status === "executed" ? "sent" : action.action_status}`;
          break;
        case "task":
          description = `Task ${action.action_status === "executed" ? "created" : action.action_status}`;
          break;
        case "note":
          description = `Note ${action.action_status === "executed" ? "added" : action.action_status}`;
          break;
        default:
          description = `${action.action_type} — ${action.action_status}`;
      }

      // Check if this came from call grading
      const source = draft?.source as string ?? "";
      const eventType = source === "call_grading" ? "call_grading" : action.action_type;

      events.push({
        id: action.id,
        type: eventType as ActivityEvent["type"],
        status: action.action_status,
        description,
        contactId: action.ghl_contact_id,
        contactName,
        timestamp: action.executed_at ?? action.created_at,
        details: draft,
      });
    }

    // Map alerts to events
    for (const alert of alerts ?? []) {
      events.push({
        id: alert.id,
        type: "alert",
        status: alert.is_resolved ? "resolved" : alert.severity,
        description: alert.message,
        contactId: alert.ghl_contact_id,
        contactName: null,
        timestamp: alert.created_at,
        details: alert.details as Record<string, unknown> | null,
      });
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ events: events.slice(0, limit) });
  } catch (err) {
    console.error("Activity feed failed:", err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 502 });
  }
}
