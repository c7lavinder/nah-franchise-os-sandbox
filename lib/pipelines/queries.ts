/**
 * Pipeline data queries from Supabase — replaces ghl.getPipelines()
 * and ghl.searchOpportunitiesPaginated() for read operations.
 *
 * GHL pipelines are still used for WRITE operations (stage moves, opportunity creation).
 * This module handles all READ operations from Supabase.
 */

import { createServerClient } from "@/lib/supabase/server";

export interface PipelineWithStages {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  stages: {
    id: string;
    name: string;
    slug: string;
    sort_order: number;
    is_terminal: boolean;
  }[];
}

/** Fetch all active pipelines with their stages from Supabase */
export async function getPipelinesFromSupabase(): Promise<PipelineWithStages[]> {
  const supabase = createServerClient();

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, slug, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order");

  if (!pipelines?.length) return [];

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, slug, sort_order, is_terminal, pipeline_id")
    .in(
      "pipeline_id",
      pipelines.map((p) => p.id)
    )
    .order("sort_order");

  return pipelines.map((p) => ({
    ...p,
    stages: (stages ?? []).filter((s) => s.pipeline_id === p.id).map(({ pipeline_id: _, ...rest }) => rest),
  }));
}

/** Build a stage ID → stage name map from Supabase pipelines */
export async function getStageNameMap(): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const { data: stages } = await supabase.from("pipeline_stages").select("id, name");

  const map = new Map<string, string>();
  for (const s of stages ?? []) {
    map.set(s.id, s.name);
  }
  return map;
}

export interface PipelineContactState {
  contact_id: string;
  pipeline_id: string;
  current_stage_id: string;
  entered_current_stage_at: string;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  ghl_contact_id: string;
}

/** Fetch contacts in a pipeline with their current stage — replaces searchOpportunitiesPaginated */
export async function getContactsInPipeline(
  pipelineId: string,
  options?: {
    stageId?: string;
    activeOnly?: boolean;
    limit?: number;
  }
): Promise<PipelineContactState[]> {
  const supabase = createServerClient();

  let query = supabase
    .from("journey_pipeline_state")
    .select(
      `
      contact_id,
      pipeline_id,
      current_stage_id,
      entered_current_stage_at,
      is_active,
      contacts!inner(first_name, last_name, email, ghl_contact_id)
    `
    )
    .eq("pipeline_id", pipelineId);

  if (options?.stageId) {
    query = query.eq("current_stage_id", options.stageId);
  }
  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;

  return (data ?? []).map((row) => {
    const contact = row.contacts as unknown as {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      ghl_contact_id: string;
    };
    return {
      contact_id: row.contact_id,
      pipeline_id: row.pipeline_id,
      current_stage_id: row.current_stage_id,
      entered_current_stage_at: row.entered_current_stage_at,
      is_active: row.is_active,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      ghl_contact_id: contact.ghl_contact_id,
    };
  });
}

/** Count contacts per stage in a pipeline */
export async function countContactsByStage(pipelineId: string): Promise<Map<string, number>> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from("journey_pipeline_state")
    .select("current_stage_id")
    .eq("pipeline_id", pipelineId)
    .eq("is_active", true);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.current_stage_id, (counts.get(row.current_stage_id) ?? 0) + 1);
  }
  return counts;
}
