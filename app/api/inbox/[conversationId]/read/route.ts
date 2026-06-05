export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function PUT(request: NextRequest, { params }: { params: { conversationId: string } }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("sms_conversation_reads").upsert(
      {
        user_id: user.id,
        conversation_key: decodeURIComponent(params.conversationId),
        read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,conversation_key" }
    );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Mark read failed:", err);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
