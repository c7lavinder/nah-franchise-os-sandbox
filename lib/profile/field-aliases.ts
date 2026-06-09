const CONTACT_PROFILE_FIELD_ALIASES: Record<string, string> = {
  current_role: "current_occupation",
  decision_style: "decision_making_style",
  prior_business_ownership: "entrepreneurial_history",
  skill_set: "skill_set_notes",
  primary_motivation: "definition_of_success",
};

export function normalizeContactProfileFieldKey(fieldKey: string): string {
  return CONTACT_PROFILE_FIELD_ALIASES[fieldKey] ?? fieldKey;
}
