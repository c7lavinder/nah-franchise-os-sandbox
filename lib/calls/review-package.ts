/**
 * Call Review Package Generator
 *
 * Orchestrates the full post-call processing pipeline:
 * 1. Grade the call (enhanced with per-criterion detail)
 * 2. Generate coaching feedback (enhanced with transcript citations)
 * 3. Extract profile update suggestions
 * 4. Generate next step action cards
 *
 * Stores everything in call_review_packages table.
 * Auto-triggers when a transcript is saved.
 */

import { createServerClient } from "@/lib/supabase/server";
import { gradeCall, type GradeResult } from "./grader";
import { coachCall, type CoachingResult } from "./coach";
import { extractProfileUpdates, type ProfileSuggestion } from "./profile-extractor";
import { generateNextSteps, type NextStepCard } from "./next-steps-generator";

export interface ReviewPackage {
  id: string;
  callId: string;
  contactId: string | null;
  repId: string | null;
  grade: string | null;
  gradeDetail: GradeResult | null;
  coachingFeedback: string | null;
  coachingCitations: Array<{ quote: string; criterion: string; timestamp?: string }>;
  profileSuggestions: ProfileSuggestion[];
  nextStepCards: NextStepCard[];
  status: "pending_review" | "partially_reviewed" | "complete";
}

/**
 * Process a call and generate the full review package.
 * Runs grade, coach, profile extraction, and next steps in parallel where possible.
 */
export async function generateReviewPackage(callId: string): Promise<ReviewPackage> {
  const supabase = createServerClient();

  // Fetch call info
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, hosted_by_user_id")
    .eq("id", callId)
    .single();

  if (!call) throw new Error("Call not found");

  // Fetch transcript for profile extraction
  const { data: transcript } = await supabase
    .from("call_transcripts")
    .select("full_text")
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!transcript) throw new Error("No transcript found for this call");

  // Run grade + coach + profile extraction in parallel
  // Next steps depends on grade, so it runs after
  const [gradeResult, coachResult, profileSuggestions] = await Promise.allSettled([
    gradeCall(callId),
    coachCall(callId),
    call.contact_id
      ? extractProfileUpdates(transcript.full_text, call.contact_id)
      : Promise.resolve([] as ProfileSuggestion[]),
  ]);

  const grade = gradeResult.status === "fulfilled" ? gradeResult.value : null;
  const coaching = coachResult.status === "fulfilled" ? coachResult.value : null;
  const suggestions =
    profileSuggestions.status === "fulfilled" ? profileSuggestions.value : [];

  // Generate next steps (uses grade data if available)
  let nextSteps: NextStepCard[] = [];
  try {
    nextSteps = await generateNextSteps(callId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Next steps generation failed: ${msg}`);
  }

  // Extract coaching citations (parse from coaching notes)
  const citations = extractCitations(coaching?.coachingNotes ?? "");

  // Save review package
  const { data: pkg, error } = await supabase
    .from("call_review_packages")
    .insert({
      call_id: callId,
      contact_id: call.contact_id,
      rep_id: call.hosted_by_user_id,
      grade: grade?.overallGrade ?? null,
      grade_detail: grade,
      coaching_feedback: coaching?.coachingNotes ?? null,
      coaching_citations: citations,
      profile_suggestions: suggestions,
      next_step_cards: nextSteps,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save review package: ${error.message}`);
  }

  // Log processing errors
  if (gradeResult.status === "rejected") {
    console.error("Grading failed:", gradeResult.reason);
  }
  if (coachResult.status === "rejected") {
    console.error("Coaching failed:", coachResult.reason);
  }

  return {
    id: pkg.id,
    callId,
    contactId: call.contact_id,
    repId: call.hosted_by_user_id,
    grade: grade?.overallGrade ?? null,
    gradeDetail: grade,
    coachingFeedback: coaching?.coachingNotes ?? null,
    coachingCitations: citations,
    profileSuggestions: suggestions,
    nextStepCards: nextSteps,
    status: "pending_review",
  };
}

/**
 * Extract citation-like patterns from coaching text.
 * Looks for patterns like 'At X:XX you said "quote"' or quoted transcript segments.
 */
function extractCitations(
  coachingText: string
): Array<{ quote: string; criterion: string; timestamp?: string }> {
  if (!coachingText) return [];

  const citations: Array<{ quote: string; criterion: string; timestamp?: string }> = [];

  // Match patterns like: At 4:32 you said "..." or "..." (quoted text in coaching)
  const quoteRegex = /"([^"]{10,200})"/g;
  let match;
  while ((match = quoteRegex.exec(coachingText)) !== null) {
    // Get surrounding context as the criterion
    const start = Math.max(0, match.index - 100);
    const context = coachingText.slice(start, match.index).trim();

    // Look for timestamp pattern near the quote
    const timeMatch = context.match(/(\d{1,2}:\d{2})/);

    citations.push({
      quote: match[1],
      criterion: context.split(/[.!?]/).pop()?.trim() ?? "General",
      timestamp: timeMatch?.[1],
    });
  }

  return citations;
}

/**
 * Update review package status when rep acts on cards.
 */
export async function updateReviewPackageStatus(
  packageId: string,
  profileSuggestions?: ProfileSuggestion[],
  nextStepCards?: NextStepCard[]
): Promise<void> {
  const supabase = createServerClient();

  const updates: Record<string, unknown> = {};

  if (profileSuggestions) {
    updates.profile_suggestions = profileSuggestions;
  }
  if (nextStepCards) {
    updates.next_step_cards = nextStepCards;
  }

  // Check if all cards have been reviewed
  const allProfileReviewed = profileSuggestions
    ? profileSuggestions.every((s) => s.outcome != null)
    : true;
  const allNextStepsReviewed = nextStepCards
    ? nextStepCards.every((c) => c.outcome != null)
    : true;

  if (allProfileReviewed && allNextStepsReviewed) {
    updates.status = "complete";
  } else {
    updates.status = "partially_reviewed";
  }

  const { error } = await supabase
    .from("call_review_packages")
    .update(updates)
    .eq("id", packageId);

  if (error) {
    throw new Error(`Failed to update review package: ${error.message}`);
  }
}
