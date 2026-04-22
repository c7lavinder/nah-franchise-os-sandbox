export const dynamic = "force-dynamic";

/**
 * DELETE /api/sub-task-logs/:logId
 *
 * Soft-deletes a sub-task log by setting deleted_at. All read paths already
 * filter on deleted_at IS NULL (see lib/contacts/pipeline-state.ts getSubTaskLogs
 * and the logs-by-sub-task queries in the advance route).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  const { logId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("contact_sub_task_logs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", logId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
