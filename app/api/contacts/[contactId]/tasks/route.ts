export const dynamic = "force-dynamic";

/**
 * GET  /api/contacts/[contactId]/tasks — Fetch tasks from Supabase
 * POST /api/contacts/[contactId]/tasks — Create task in Supabase + GHL
 *
 * The contactId param is expected to be the GHL contact ID (matching
 * the existing notes endpoint's convention; LeadDetailView resolves
 * UUIDs to GHL IDs before mounting).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId } = await params;
    const supabase = createServerClient();

    // contactId here is the GHL contact ID
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("ghl_contact_id", contactId)
      .order("due_date", { ascending: true });

    if (error) throw new Error(error.message);
    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  try {
    const { contactId } = await params;
    const body = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    if (!body.dueDate) {
      return NextResponse.json({ error: "dueDate is required" }, { status: 400 });
    }
    if (isNaN(Date.parse(body.dueDate))) {
      return NextResponse.json({ error: "dueDate must be a valid ISO date" }, { status: 400 });
    }

    const task = await ghl.createTask(contactId, {
      title: body.title.trim(),
      body: body.body?.trim() || undefined,
      dueDate: body.dueDate,
    });

    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
