/**
 * Rubric Loader — loads call-type-specific rubric content from knowledge_documents.
 *
 * Always returns the Universal rubric. For specific call types (Matt, Sam, Mark, John),
 * appends the call-specific rubric as additional grading criteria.
 */

import { createServerClient } from "@/lib/supabase/server";

/** Map call_type slugs to their KB document titles */
const CALL_TYPE_RUBRIC_MAP: Record<string, string> = {
  matt_call: "Matt Call Rubric — Qualification",
  sam_call: "Sam Call Rubric — Discovery",
  mark_call: "Mark Call Rubric — Capital",
  coaching_call: "John Coaching Call Rubric — Franchisee Coaching",
  intro_call: "Universal Call Rubric",
  fdd_review_call: "Universal Call Rubric",
  territory_call: "Universal Call Rubric",
  matt_final_call: "Universal Call Rubric",
};

/**
 * Load the rubric context string for a given call type slug.
 * Returns universal + specific rubric text for injection into grading prompt.
 */
export async function loadRubricForCallType(callTypeSlug: string): Promise<string> {
  const supabase = createServerClient();

  // Always load universal rubric
  const { data: universalDoc } = await supabase
    .from("knowledge_documents")
    .select("content")
    .eq("title", "Universal Call Rubric")
    .eq("is_active", true)
    .single();

  const universal = universalDoc?.content ?? "";

  // Check if this call type has a specific rubric
  const specificTitle = CALL_TYPE_RUBRIC_MAP[callTypeSlug];
  if (!specificTitle || specificTitle === "Universal Call Rubric") {
    return universal ? `RUBRIC:\n${universal}` : "";
  }

  const { data: specificDoc } = await supabase
    .from("knowledge_documents")
    .select("content")
    .eq("title", specificTitle)
    .eq("is_active", true)
    .single();

  const specific = specificDoc?.content ?? "";

  if (specific) {
    return `UNIVERSAL RUBRIC:\n${universal}\n\nCALL-SPECIFIC RUBRIC (${callTypeSlug}):\n${specific}`;
  }

  return universal ? `RUBRIC:\n${universal}` : "";
}

/**
 * Determine the call type slug from a call record.
 * Looks up the call_type_id → call_types.slug, or falls back to
 * the associated sub-task slug.
 */
export async function determineCallType(callId: string): Promise<string> {
  const supabase = createServerClient();

  const { data: call } = await supabase
    .from("calls")
    .select("call_type_id, sub_task_id")
    .eq("id", callId)
    .single();

  if (!call) return "intro_call";

  // Try call_type_id first
  if (call.call_type_id) {
    const { data: callType } = await supabase
      .from("call_types")
      .select("slug")
      .eq("id", call.call_type_id)
      .single();

    if (callType?.slug) return callType.slug;
  }

  // Fallback: check sub_task slug
  if (call.sub_task_id) {
    const { data: subTask } = await supabase
      .from("pipeline_sub_tasks")
      .select("slug")
      .eq("id", call.sub_task_id)
      .single();

    if (subTask?.slug) {
      // Normalize sub-task slugs to call type slugs
      const slug = subTask.slug.replace(/-/g, "_");
      if (slug in CALL_TYPE_RUBRIC_MAP) return slug;
    }
  }

  return "intro_call";
}
