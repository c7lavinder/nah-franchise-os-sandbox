export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";
import { resolveContactId } from "@/lib/contacts/pipeline-state";

/** GET — returns all contact EOS data: goals, issues, todos */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const supabase = createServerClient();
  const localId = await resolveContactId(rawId);
  if (!localId) return NextResponse.json({ goals: null, issues: [], todos: [], habits: [] });

  const [goalsRes, issuesRes, todosRes, habitsRes] = await Promise.all([
    supabase
      .from("eos_contact_goals")
      .select("*")
      .eq("contact_id", localId)
      .maybeSingle(),
    supabase
      .from("eos_contact_issues")
      .select("*")
      .eq("contact_id", localId)
      .order("created_at"),
    supabase
      .from("eos_contact_todos")
      .select("*")
      .eq("contact_id", localId)
      .order("created_at"),
    supabase
      .from("eos_contact_habits")
      .select("*")
      .eq("contact_id", localId)
      .order("sort_order")
      .order("created_at"),
  ]);

  if (goalsRes.error) return NextResponse.json({ error: goalsRes.error.message }, { status: 500 });
  if (issuesRes.error) return NextResponse.json({ error: issuesRes.error.message }, { status: 500 });
  if (todosRes.error) return NextResponse.json({ error: todosRes.error.message }, { status: 500 });
  if (habitsRes.error) return NextResponse.json({ error: habitsRes.error.message }, { status: 500 });

  return NextResponse.json({
    goals: goalsRes.data ?? null,
    issues: issuesRes.data ?? [],
    todos: todosRes.data ?? [],
    habits: habitsRes.data ?? [],
  });
}
