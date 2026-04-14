/**
 * Carry-forward: copies contact EOS data into territory EOS as seed data.
 *
 * Trigger: when territory_slug is first assigned to a contact.
 * Rules:
 *   - Contact EOS records are never deleted — they stay as sales history
 *   - Carried items get source='carried_forward' + origin_contact_id FK
 *   - Idempotent — checks for existing carried items to prevent double-seeding
 *   - One carry-forward per territory assignment event
 */

import { createServerClient } from "@/lib/supabase/server";

export async function carryForwardContactEos(
  contactId: string,
  territorySlug: string
): Promise<{ carried: boolean; reason?: string }> {
  const supabase = createServerClient();

  // Guard: check if carry-forward already happened for this contact → territory
  const { data: existingCarried } = await supabase
    .from("eos_territory_issues")
    .select("id")
    .eq("territory_slug", territorySlug)
    .eq("origin_contact_id", contactId)
    .limit(1);

  const { data: existingTodos } = await supabase
    .from("eos_territory_todos")
    .select("id")
    .eq("territory_slug", territorySlug)
    .eq("origin_contact_id", contactId)
    .limit(1);

  if ((existingCarried && existingCarried.length > 0) || (existingTodos && existingTodos.length > 0)) {
    return { carried: false, reason: "already_carried" };
  }

  // 1. Fetch contact EOS data
  const [goalsRes, issuesRes, todosRes] = await Promise.all([
    supabase
      .from("eos_contact_goals")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle(),
    supabase
      .from("eos_contact_issues")
      .select("*")
      .eq("contact_id", contactId),
    supabase
      .from("eos_contact_todos")
      .select("*")
      .eq("contact_id", contactId),
  ]);

  const goals = goalsRes.data;
  const issues = issuesRes.data ?? [];
  const todos = todosRes.data ?? [];

  // Nothing to carry if no EOS data exists
  if (!goals && issues.length === 0 && todos.length === 0) {
    return { carried: false, reason: "no_contact_eos_data" };
  }

  // 2. Seed territory goals — qol_goal only
  if (goals?.qol_goal) {
    await supabase
      .from("eos_territory_goals")
      .upsert(
        {
          territory_slug: territorySlug,
          goal_type: "quality_of_life",
          current_year_goal: goals.qol_goal,
        },
        { onConflict: "territory_slug,goal_type", ignoreDuplicates: true }
      );
  }

  // 3. Copy issues → territory issues
  if (issues.length > 0) {
    const issueRows = issues.map((issue) => ({
      territory_slug: territorySlug,
      issue_text: issue.issue_text,
      source: "carried_forward" as const,
      origin_contact_id: contactId,
    }));
    await supabase.from("eos_territory_issues").insert(issueRows);
  }

  // 4. Copy todos → territory todos
  if (todos.length > 0) {
    const todoRows = todos.map((todo) => ({
      territory_slug: territorySlug,
      todo_text: todo.todo_text,
      owner_user_id: todo.owner_user_id,
      source: "carried_forward" as const,
      origin_contact_id: contactId,
    }));
    await supabase.from("eos_territory_todos").insert(todoRows);
  }

  return { carried: true };
}
