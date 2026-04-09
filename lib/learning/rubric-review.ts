/**
 * Monthly Rubric Review Prompt Generator
 *
 * Runs 1st of each month at 11pm. Analyzes suggestion_feedback for
 * coaching edits and identifies rubric criteria that need attention.
 * Creates draft suggestions — never auto-applies.
 */

import { createServerClient } from "@/lib/supabase/server";

export async function generateRubricReviewSuggestions(
  month?: string
): Promise<{ suggestionsCreated: number }> {
  const supabase = createServerClient();

  const reviewMonth = month ?? new Date().toISOString().slice(0, 7) + "-01";
  const monthStart = `${reviewMonth}T00:00:00Z`;

  // Get last 30 days of coaching edits
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: coachingEdits } = await supabase
    .from("suggestion_feedback")
    .select("original_value, accepted_value, edit_delta, outcome")
    .eq("suggestion_type", "coaching_edit")
    .gte("created_at", thirtyDaysAgo);

  const { data: rubricEdits } = await supabase
    .from("suggestion_feedback")
    .select("original_value, accepted_value, edit_delta, outcome")
    .eq("suggestion_type", "rubric_edit")
    .gte("created_at", thirtyDaysAgo);

  // Get all rubric criteria
  const { data: criteria } = await supabase
    .from("rubric_criteria")
    .select("id, name, rubric_id, weight")
    .order("sort_order");

  if (!criteria || criteria.length === 0) {
    return { suggestionsCreated: 0 };
  }

  const suggestions: Array<{
    criterion_id: string;
    criterion_name: string;
    issue_type: string;
    current_state: Record<string, unknown>;
    suggested_change: string;
    supporting_data: Record<string, unknown>;
  }> = [];

  // Analyze coaching feedback patterns
  const totalCoachingEdits = (coachingEdits ?? []).length;
  const totalRubricEdits = (rubricEdits ?? []).length;

  // If high edit rate on coaching, suggest rubric refinement
  if (totalCoachingEdits > 10) {
    const editRate = (coachingEdits ?? []).filter((r) => r.outcome === "edited").length / totalCoachingEdits;
    if (editRate > 0.4) {
      suggestions.push({
        criterion_id: criteria[0].id,
        criterion_name: "General Coaching Quality",
        issue_type: "high_edit_rate",
        current_state: { totalEdits: totalCoachingEdits, editRate },
        suggested_change: `Coaching edit rate is ${Math.round(editRate * 100)}% this month. Review coaching prompts and rubric criteria to better align with team expectations.`,
        supporting_data: { sampleEdits: (coachingEdits ?? []).slice(0, 5) },
      });
    }
  }

  // Check if any criteria consistently produce low-confidence grades
  // (This would require grade_detail analysis — simplified for now)
  if (totalRubricEdits > 5) {
    suggestions.push({
      criterion_id: criteria[0].id,
      criterion_name: "Rubric Scoring",
      issue_type: "low_confidence",
      current_state: { totalRubricEdits },
      suggested_change: `${totalRubricEdits} rubric scores were manually edited this month. Review whether scoring criteria align with team's quality standards.`,
      supporting_data: { edits: (rubricEdits ?? []).slice(0, 5) },
    });
  }

  // Insert suggestions
  let created = 0;
  for (const suggestion of suggestions) {
    const { error } = await supabase.from("rubric_review_suggestions").insert({
      review_month: reviewMonth,
      criterion_id: suggestion.criterion_id,
      criterion_name: suggestion.criterion_name,
      issue_type: suggestion.issue_type,
      current_state: suggestion.current_state,
      suggested_change: suggestion.suggested_change,
      supporting_data: suggestion.supporting_data,
      status: "pending",
    });

    if (!error) created++;
  }

  return { suggestionsCreated: created };
}
