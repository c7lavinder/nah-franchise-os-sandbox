export const dynamic = "force-dynamic";

/**
 * POST /api/flagged-responses — Flag a Scout response (any authenticated user)
 * GET  /api/flagged-responses — List flagged responses (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = await request.json();
  const { sessionId, userMessage, aiResponse, pageUrl, selectedText, concernType, correctionNote } = body;

  if (!userMessage || !aiResponse) {
    return NextResponse.json({ error: "userMessage and aiResponse are required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("flagged_responses")
    .insert({
      session_id: sessionId || null,
      user_id: user.id,
      user_name: user.fullName,
      user_message: userMessage,
      ai_response: aiResponse,
      page_url: pageUrl || null,
      selected_text: selectedText || null,
      concern_type: concernType || null,
      correction_note: correctionNote || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = await request.json();
  const { sessionId, userMessage, aiResponse } = body;

  if (!userMessage || !aiResponse) {
    return NextResponse.json({ error: "userMessage and aiResponse are required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Match on session + user message + AI response to find the right flag
  let query = supabase
    .from("flagged_responses")
    .delete()
    .eq("user_id", user.id)
    .eq("user_message", userMessage)
    .eq("ai_response", aiResponse);

  if (sessionId) query = query.eq("session_id", sessionId);

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("flagged_responses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
