/**
 * Tasks two-way sync — Supabase ↔ GHL.
 *
 * WRITE: Create/update tasks in Supabase, then push to GHL.
 * READ: Query tasks from Supabase (no GHL API calls).
 * SYNC: GHL TaskUpdate webhook → update Supabase.
 */

import { createServerClient } from "@/lib/supabase/server";
import * as ghl from "@/lib/ghl";

export interface Task {
  id: string;
  ghl_task_id: string | null;
  contact_id: string | null;
  ghl_contact_id: string | null;
  title: string;
  body: string | null;
  due_date: string | null;
  assigned_to_user_id: string | null;
  assigned_to_ghl_user_id: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

/** Fetch tasks from Supabase — replaces ghl.searchTasks() */
export async function getTasksForUser(
  ghlUserId: string,
  options?: {
    completed?: boolean;
    limit?: number;
  }
): Promise<Task[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to_ghl_user_id", ghlUserId)
    .order("due_date", { ascending: true });

  if (options?.completed !== undefined) {
    query = query.eq("completed", options.completed);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;
  return (data ?? []) as Task[];
}

/** Fetch tasks for a contact from Supabase — replaces ghl.getTasks() */
export async function getTasksForContact(contactId: string): Promise<Task[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("contact_id", contactId)
    .order("due_date", { ascending: true });

  return (data ?? []) as Task[];
}

/** Create a task in Supabase and push to GHL */
export async function createTask(params: {
  contactId?: string | null;
  ghlContactId: string;
  title: string;
  body?: string;
  dueDate: string;
  assignedToUserId?: string;
  assignedToGhlUserId?: string;
}): Promise<Task> {
  const supabase = createServerClient();

  // 1. Create in Supabase
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      contact_id: params.contactId,
      ghl_contact_id: params.ghlContactId,
      title: params.title,
      body: params.body ?? null,
      due_date: params.dueDate,
      assigned_to_user_id: params.assignedToUserId ?? null,
      assigned_to_ghl_user_id: params.assignedToGhlUserId ?? null,
      source: "nah_os",
    })
    .select()
    .single();

  if (error || !task) throw new Error(`Failed to create task: ${error?.message}`);

  // 2. Push to GHL (best-effort)
  try {
    const ghlTask = await ghl.createTask(params.ghlContactId, {
      title: params.title,
      body: params.body,
      dueDate: params.dueDate,
      assignedTo: params.assignedToGhlUserId,
    });

    // Store the GHL task ID for sync
    await supabase
      .from("tasks")
      .update({ ghl_task_id: ghlTask.id, ghl_synced_at: new Date().toISOString() })
      .eq("id", task.id);
  } catch (err) {
    console.error("[tasks/sync] GHL push failed:", err instanceof Error ? err.message : err);
  }

  return task as Task;
}

/** Update a task in Supabase and sync to GHL */
export async function updateTask(
  taskId: string,
  updates: {
    completed?: boolean;
    title?: string;
    body?: string;
    dueDate?: string;
  }
): Promise<void> {
  const supabase = createServerClient();

  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.completed !== undefined) {
    dbUpdates.completed = updates.completed;
    dbUpdates.completed_at = updates.completed ? new Date().toISOString() : null;
  }
  if (updates.title) dbUpdates.title = updates.title;
  if (updates.body !== undefined) dbUpdates.body = updates.body;
  if (updates.dueDate) dbUpdates.due_date = updates.dueDate;

  // 1. Update Supabase
  const { data: task } = await supabase
    .from("tasks")
    .update(dbUpdates)
    .eq("id", taskId)
    .select("ghl_task_id, ghl_contact_id")
    .single();

  if (!task) return;
  const row = task as { ghl_task_id: string | null; ghl_contact_id: string | null };

  // 2. Sync to GHL (best-effort)
  if (row.ghl_task_id && row.ghl_contact_id) {
    try {
      const ghlUpdates: Record<string, unknown> = {};
      if (updates.completed !== undefined) ghlUpdates.completed = updates.completed;
      if (updates.title) ghlUpdates.title = updates.title;
      if (updates.body !== undefined) ghlUpdates.body = updates.body;
      if (updates.dueDate) ghlUpdates.dueDate = updates.dueDate;

      await ghl.updateTask(row.ghl_contact_id, row.ghl_task_id, ghlUpdates);
    } catch (err) {
      console.error("[tasks/sync] GHL update failed:", err instanceof Error ? err.message : err);
    }
  }
}

/** Handle a GHL TaskUpdate webhook — sync completion/updates back to Supabase */
export async function handleGhlTaskUpdate(payload: {
  id: string;
  contactId: string;
  title?: string;
  body?: string;
  dueDate?: string;
  completed?: boolean;
  assignedTo?: string;
}): Promise<void> {
  const supabase = createServerClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.completed !== undefined) {
    updates.completed = payload.completed;
    updates.completed_at = payload.completed ? new Date().toISOString() : null;
  }
  if (payload.title !== undefined) updates.title = payload.title || undefined;
  if (payload.body !== undefined) updates.body = payload.body;
  if (payload.dueDate !== undefined) updates.due_date = payload.dueDate || null;
  if (payload.assignedTo) updates.assigned_to_ghl_user_id = payload.assignedTo;

  // Try to find existing task by ghl_task_id
  const { data: existing } = await supabase.from("tasks").select("id").eq("ghl_task_id", payload.id).maybeSingle();

  if (existing) {
    await supabase.from("tasks").update(updates).eq("id", existing.id);
  } else {
    // Task created in GHL directly — resolve contact UUID from ghl_contact_id
    let contactUuid: string | null = null;
    if (payload.contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("ghl_contact_id", payload.contactId)
        .maybeSingle();
      contactUuid = contact?.id ?? null;
    }

    await supabase.from("tasks").insert({
      ghl_task_id: payload.id,
      contact_id: contactUuid,
      ghl_contact_id: payload.contactId,
      title: payload.title ?? "Untitled task",
      body: payload.body ?? null,
      due_date: payload.dueDate ?? null,
      assigned_to_ghl_user_id: payload.assignedTo ?? null,
      completed: payload.completed ?? false,
      completed_at: payload.completed ? new Date().toISOString() : null,
      source: "ghl",
    });
  }
}
