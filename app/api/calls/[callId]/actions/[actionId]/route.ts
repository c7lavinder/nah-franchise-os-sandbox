export const dynamic = "force-dynamic";

/**
 * PATCH /api/calls/:callId/actions/:actionId
 *
 * Updates a call_action_item: push, edit+push, or skip.
 * Always writes a row to call_action_feedback for the learning loop.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface PatchBody {
  action: "push" | "edit" | "skip";
  title?: string;
  description?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string; actionId: string }> }
) {
  const { callId, actionId } = await params;
  const body = (await request.json()) as PatchBody;
  const supabase = createServerClient();

  // Verify the action item exists and belongs to this call
  const { data: item } = await supabase
    .from("call_action_items")
    .select("id, call_id, title, description")
    .eq("id", actionId)
    .eq("call_id", callId)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let editDiff: string | null = null;

  if (body.action === "push") {
    await supabase
      .from("call_action_items")
      .update({ status: "pushed", pushed_at: now, updated_at: now })
      .eq("id", actionId);
  } else if (body.action === "edit") {
    // Store originals, update with edited values
    const newTitle = body.title ?? item.title;
    const newDescription = body.description ?? item.description;

    editDiff = JSON.stringify({
      title: { from: item.title, to: newTitle },
      description: { from: item.description, to: newDescription },
    });

    await supabase
      .from("call_action_items")
      .update({
        status: "edited_pushed",
        title: newTitle,
        description: newDescription,
        original_title: item.title,
        original_description: item.description,
        pushed_at: now,
        updated_at: now,
      })
      .eq("id", actionId);
  } else if (body.action === "skip") {
    await supabase
      .from("call_action_items")
      .update({ status: "skipped", skipped_at: now, updated_at: now })
      .eq("id", actionId);
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Write feedback row for the learning loop
  await supabase.from("call_action_feedback").insert({
    call_action_item_id: actionId,
    action: body.action === "edit" ? "edit" : body.action,
    edit_diff: editDiff,
  });

  return NextResponse.json({ success: true });
}
