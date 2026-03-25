export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[contactId]/scout-actions
 *
 * Returns all Scout action logs for a specific contact.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = createServerClient();
    const { data: actions, error } = await supabase
      .from("scout_action_logs")
      .select("id, action_type, action_status, draft_content, final_content, created_at, executed_at")
      .eq("ghl_contact_id", params.contactId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Scout actions query failed:", error);
      return NextResponse.json({ actions: [] });
    }

    return NextResponse.json({ actions: actions ?? [] });
  } catch (err) {
    console.error("Scout actions fetch failed:", err);
    return NextResponse.json({ actions: [] });
  }
}
