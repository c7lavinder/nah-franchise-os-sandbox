/**
 * Onboarding Pipeline Service
 *
 * Manages the post-close franchisee journey:
 * - Onboarding (first 90 days): 7 stages from Welcome to Complete
 * - Coaching (ongoing quarterly): 6 stages from Q1 Check-in to Graduate
 *
 * Per intelligence plan Phase 4: "The sales pipeline ends at Funds Received.
 * The franchisee pipeline starts there."
 */

import { createServerClient } from "@/lib/supabase/server";

/** Onboarding pipeline stages (first 90 days) */
export const ONBOARDING_STAGES = [
  { number: 1, name: "Welcome & Setup", description: "Credentials, systems access, intro call scheduled" },
  { number: 2, name: "Initial Training", description: "Trainual onboarding track completion" },
  { number: 3, name: "Territory Orientation", description: "Territory walkthrough, first market analysis" },
  { number: 4, name: "First Deal Preparation", description: "Sourcing strategy, offer criteria, funding ready" },
  { number: 5, name: "First Offer Made", description: "Candidate has made their first offer" },
  { number: 6, name: "First House Acquired", description: "First flip property under contract" },
  { number: 7, name: "Onboarding Complete", description: "90-day milestone hit" },
] as const;

/** Coaching pipeline stages (ongoing quarterly) */
export const COACHING_STAGES = [
  { number: 1, name: "Q1 Check-in", description: "30/60/90 day review" },
  { number: 2, name: "Active Coaching", description: "Regular cadence" },
  { number: 3, name: "Performance Review", description: "Quarterly numbers" },
  { number: 4, name: "Milestone Recognition", description: "Hitting goals" },
  { number: 5, name: "Intervention Required", description: "Behind pace, needs support" },
  { number: 6, name: "Graduate", description: "Hitting targets, minimal support needed" },
] as const;

/** Onboarding enrollment record */
export interface OnboardingEnrollment {
  id: string;
  contact_id: string;
  franchisee_name: string;
  pipeline_type: "onboarding" | "coaching";
  current_stage: number;
  stage_name: string;
  stage_entered_at: string;
  days_in_stage: number;
  trainual_completion_pct: number;
  support_calls: number;
  obstacles: string | null;
  mentor_notes: string | null;
  status: "active" | "complete" | "paused" | "intervention";
  created_at: string;
  updated_at: string;
}

/**
 * Create or get an onboarding enrollment for a franchisee.
 * Called when a lead reaches "Funds Received / Closed Won".
 */
export async function createOnboardingEnrollment(params: {
  contactId: string;
  franchiseeName: string;
}): Promise<OnboardingEnrollment | null> {
  const supabase = createServerClient();

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("franchisee_performance")
    .select("id, contact_id")
    .eq("contact_id", params.contactId)
    .single();

  // Ensure franchisee_performance record exists
  if (!existing) {
    await supabase.from("franchisee_performance").insert({
      contact_id: params.contactId,
      franchisee_name: params.franchiseeName,
      funds_received_at: new Date().toISOString(),
      active_status: "active",
      data_source: "manual",
    });
  }

  // Use market_signals table to track onboarding stage progression
  // (repurposing as a lightweight stage tracker until dedicated pipeline exists in GHL)
  const { data: enrollment } = await supabase
    .from("market_signals")
    .select("*")
    .eq("signal_type", "onboarding_enrollment")
    .eq("signal_key", params.contactId)
    .single();

  if (enrollment) {
    const val = enrollment.signal_value as Record<string, unknown>;
    return {
      id: enrollment.id,
      contact_id: params.contactId,
      franchisee_name: params.franchiseeName,
      pipeline_type: (val.pipeline_type as string ?? "onboarding") as "onboarding" | "coaching",
      current_stage: (val.current_stage as number) ?? 1,
      stage_name: (val.stage_name as string) ?? ONBOARDING_STAGES[0].name,
      stage_entered_at: (val.stage_entered_at as string) ?? enrollment.observed_at,
      days_in_stage: Math.floor((Date.now() - new Date((val.stage_entered_at as string) ?? enrollment.observed_at).getTime()) / 86400000),
      trainual_completion_pct: (val.trainual_completion_pct as number) ?? 0,
      support_calls: (val.support_calls as number) ?? 0,
      obstacles: (val.obstacles as string) ?? null,
      mentor_notes: (val.mentor_notes as string) ?? null,
      status: (val.status as string ?? "active") as "active" | "complete" | "paused" | "intervention",
      created_at: enrollment.observed_at,
      updated_at: enrollment.observed_at,
    };
  }

  // Create new enrollment
  const { data: newEnrollment, error } = await supabase
    .from("market_signals")
    .insert({
      signal_type: "onboarding_enrollment",
      signal_key: params.contactId,
      signal_value: {
        franchisee_name: params.franchiseeName,
        pipeline_type: "onboarding",
        current_stage: 1,
        stage_name: ONBOARDING_STAGES[0].name,
        stage_entered_at: new Date().toISOString(),
        trainual_completion_pct: 0,
        support_calls: 0,
        obstacles: null,
        mentor_notes: null,
        status: "active",
      },
      source: "automated",
    })
    .select()
    .single();

  if (error || !newEnrollment) return null;

  return {
    id: newEnrollment.id,
    contact_id: params.contactId,
    franchisee_name: params.franchiseeName,
    pipeline_type: "onboarding",
    current_stage: 1,
    stage_name: ONBOARDING_STAGES[0].name,
    stage_entered_at: new Date().toISOString(),
    days_in_stage: 0,
    trainual_completion_pct: 0,
    support_calls: 0,
    obstacles: null,
    mentor_notes: null,
    status: "active",
    created_at: newEnrollment.observed_at,
    updated_at: newEnrollment.observed_at,
  };
}

/**
 * Advance a franchisee to the next onboarding stage.
 */
export async function advanceOnboardingStage(
  contactId: string,
  notes?: string
): Promise<OnboardingEnrollment | null> {
  const supabase = createServerClient();

  const { data: record } = await supabase
    .from("market_signals")
    .select("*")
    .eq("signal_type", "onboarding_enrollment")
    .eq("signal_key", contactId)
    .single();

  if (!record) return null;

  const val = record.signal_value as Record<string, unknown>;
  const pipelineType = (val.pipeline_type as string) ?? "onboarding";
  const stages = pipelineType === "onboarding" ? ONBOARDING_STAGES : COACHING_STAGES;
  const currentStage = (val.current_stage as number) ?? 1;
  const nextStage = Math.min(currentStage + 1, stages.length);
  const nextStageDef = stages[nextStage - 1];
  const isComplete = nextStage >= stages.length;

  const updatedValue = {
    ...val,
    current_stage: nextStage,
    stage_name: nextStageDef.name,
    stage_entered_at: new Date().toISOString(),
    mentor_notes: notes ?? val.mentor_notes,
    status: isComplete ? "complete" : "active",
  };

  await supabase
    .from("market_signals")
    .update({ signal_value: updatedValue })
    .eq("id", record.id);

  // Log the stage move as a market signal
  await supabase.from("market_signals").insert({
    signal_type: "onboarding_stage_move",
    signal_key: contactId,
    signal_value: {
      from_stage: currentStage,
      to_stage: nextStage,
      stage_name: nextStageDef.name,
      notes,
    },
    source: "manual",
  });

  return {
    id: record.id,
    contact_id: contactId,
    franchisee_name: (val.franchisee_name as string) ?? "",
    pipeline_type: pipelineType as "onboarding" | "coaching",
    current_stage: nextStage,
    stage_name: nextStageDef.name,
    stage_entered_at: new Date().toISOString(),
    days_in_stage: 0,
    trainual_completion_pct: (val.trainual_completion_pct as number) ?? 0,
    support_calls: (val.support_calls as number) ?? 0,
    obstacles: (val.obstacles as string) ?? null,
    mentor_notes: notes ?? (val.mentor_notes as string) ?? null,
    status: isComplete ? "complete" : "active",
    created_at: record.observed_at,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Get all onboarding enrollments.
 */
export async function getOnboardingEnrollments(
  pipelineType?: "onboarding" | "coaching"
): Promise<OnboardingEnrollment[]> {
  const supabase = createServerClient();

  const { data: records } = await supabase
    .from("market_signals")
    .select("*")
    .eq("signal_type", "onboarding_enrollment")
    .order("observed_at", { ascending: false });

  if (!records) return [];

  const results: OnboardingEnrollment[] = [];
  for (const r of records) {
    const val = r.signal_value as Record<string, unknown>;
    const type = (val.pipeline_type as string) ?? "onboarding";
    if (pipelineType && type !== pipelineType) continue;

    results.push({
      id: r.id,
      contact_id: r.signal_key,
      franchisee_name: (val.franchisee_name as string) ?? "",
      pipeline_type: type as "onboarding" | "coaching",
      current_stage: (val.current_stage as number) ?? 1,
      stage_name: (val.stage_name as string) ?? "",
      stage_entered_at: (val.stage_entered_at as string) ?? r.observed_at,
      days_in_stage: Math.floor((Date.now() - new Date((val.stage_entered_at as string) ?? r.observed_at).getTime()) / 86400000),
      trainual_completion_pct: (val.trainual_completion_pct as number) ?? 0,
      support_calls: (val.support_calls as number) ?? 0,
      obstacles: (val.obstacles as string) ?? null,
      mentor_notes: (val.mentor_notes as string) ?? null,
      status: (val.status as string ?? "active") as "active" | "complete" | "paused" | "intervention",
      created_at: r.observed_at,
      updated_at: r.observed_at,
    });
  }
  return results;
}
