const CONTACT_PROFILE_FIELD_ALIASES: Record<string, string> = {
  current_role: "current_occupation",
  decision_style: "decision_making_style",
  prior_business_ownership: "entrepreneurial_history",
  skill_set: "skill_set_notes",
  primary_motivation: "definition_of_success",
  // G3 (2026-08-09): legacy keys found in the store that named a registry field by a
  // different spelling — 3,048 stored rows were renamed to the registry names in the
  // same change. These aliases keep the writers (extraction prompts, backfill script)
  // from re-creating the drift on the next call.
  lookalike_score: "Lookalike Score",
  lead_source: "referral_lead_source",
  lead_source_detail: "LeadSource",
  desired_territory: "Territory Interest",
  market_area: "Territory Market",
};

export function normalizeContactProfileFieldKey(fieldKey: string): string {
  return CONTACT_PROFILE_FIELD_ALIASES[fieldKey] ?? fieldKey;
}
