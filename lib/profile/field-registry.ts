/**
 * Candidate Profile Field Registry
 *
 * Single source of truth for all custom fields on a contact.
 * Drives the profile UI, API validation, and Scout field access.
 *
 * Each field knows: its category, GHL data type, dropdown options,
 * who fills it (manual vs auto), and which stage it becomes relevant.
 */

export type FieldCategory =
  | "territory"
  | "franchise_fit"
  | "financial"
  | "trainual"
  | "validation"
  | "engagement"
  | "ai_scout"
  | "compliance";

export type FieldDataType = "text" | "dropdown" | "number" | "date";

export type FieldSource = "manual" | "scout" | "system" | "api";

export interface ProfileField {
  /** GHL custom field name (exact match) */
  name: string;
  /** Short label for the UI */
  label: string;
  /** Which category section it belongs to */
  category: FieldCategory;
  /** Data type for rendering */
  dataType: FieldDataType;
  /** Dropdown options (only for dropdown type) */
  options?: string[];
  /** Who typically fills this field */
  source: FieldSource;
  /** Which pipeline stage this becomes relevant */
  relevantStage: string;
  /** Tooltip/help text for Chad */
  help?: string;
}

/** All candidate profile fields organized for the UI */
export const PROFILE_FIELDS: ProfileField[] = [
  // ═══════════════════════════════════════
  // TERRITORY
  // ═══════════════════════════════════════
  { name: "Territory Interest", label: "Desired Territory", category: "territory", dataType: "text", source: "manual", relevantStage: "New Lead", help: "City/state/metro area the prospect wants" },
  { name: "Territory Market", label: "Market Area", category: "territory", dataType: "text", source: "manual", relevantStage: "Qualified", help: "Broader market (e.g., DFW Metro, Atlanta North)" },
  { name: "Territory Status", label: "Territory Status", category: "territory", dataType: "dropdown", options: ["Available", "Waitlist", "Unavailable", "Confirmed"], source: "manual", relevantStage: "Qualified" },
  { name: "Territory Confirmed Date", label: "Confirmed Date", category: "territory", dataType: "date", source: "system", relevantStage: "Award + Agreement" },

  // ═══════════════════════════════════════
  // FRANCHISE FIT
  // ═══════════════════════════════════════
  { name: "RE Experience", label: "Real Estate Experience", category: "franchise_fit", dataType: "dropdown", options: ["None", "Some (1-3 flips)", "Experienced (4-10)", "Expert (10+)"], source: "manual", relevantStage: "Qualified", help: "How much flipping/RE experience do they have?" },
  { name: "Construction Knowledge", label: "Construction Knowledge", category: "franchise_fit", dataType: "dropdown", options: ["None", "Basic", "Intermediate", "Advanced"], source: "manual", relevantStage: "Qualified" },
  { name: "Business Ownership Experience", label: "Business Owner?", category: "franchise_fit", dataType: "dropdown", options: ["Yes", "No"], source: "manual", relevantStage: "Qualified" },
  { name: "Why NAH", label: "Why NAH?", category: "franchise_fit", dataType: "text", source: "manual", relevantStage: "Qualified", help: "In their words — what drew them to NAH?" },
  { name: "Primary Goal", label: "Primary Goal", category: "franchise_fit", dataType: "dropdown", options: ["Full-time business", "Side income", "Portfolio diversification", "Career change", "Legacy building"], source: "manual", relevantStage: "Qualified" },
  { name: "Motivation Clarity", label: "Motivation", category: "franchise_fit", dataType: "dropdown", options: ["Strong", "Moderate", "Weak"], source: "manual", relevantStage: "Qualified" },
  { name: "Timeline to Open", label: "Timeline to Open", category: "franchise_fit", dataType: "dropdown", options: ["Immediately", "1-3 months", "3-6 months", "6-12 months", "12+ months"], source: "manual", relevantStage: "Qualified" },

  // ═══════════════════════════════════════
  // FINANCIAL
  // ═══════════════════════════════════════
  { name: "Capital Availability", label: "Capital Status", category: "financial", dataType: "dropdown", options: ["Confirmed", "Needs Verification", "Unknown"], source: "manual", relevantStage: "Qualified" },
  { name: "Capital Source", label: "Funding Method", category: "financial", dataType: "dropdown", options: ["Cash", "SBA Loan", "ROBS (Retirement Rollover)", "Home Equity", "Partner/Investor", "Combination", "Undecided"], source: "manual", relevantStage: "Qualified", help: "How do they plan to fund the franchise?" },
  { name: "Investment Timeline", label: "Investment Timeline", category: "financial", dataType: "dropdown", options: ["Under 6 months", "6-12 months", "12+ months"], source: "manual", relevantStage: "Qualified" },
  { name: "Financing Pre-Qualified", label: "Pre-Qualified?", category: "financial", dataType: "dropdown", options: ["Yes", "No", "In Progress", "Not Started"], source: "manual", relevantStage: "Mark Call" },
  { name: "Financial Objection", label: "Financial Concern", category: "financial", dataType: "dropdown", options: ["Investment size", "Uncertain ROI", "Wants to compare", "Needs spouse buy-in", "Needs more info", "None"], source: "manual", relevantStage: "Qualified" },

  // ═══════════════════════════════════════
  // TRAINUAL
  // ═══════════════════════════════════════
  { name: "Framing Call Logged", label: "Framing Call Done?", category: "trainual", dataType: "dropdown", options: ["Yes", "No"], source: "manual", relevantStage: "Contacted", help: "Must be Yes before Trainual invite fires" },
  { name: "Trainual Access Sent", label: "Access Sent?", category: "trainual", dataType: "dropdown", options: ["Yes", "No"], source: "system", relevantStage: "New Lead" },
  { name: "Trainual Completion Percent", label: "Completion %", category: "trainual", dataType: "number", source: "api", relevantStage: "New Lead" },
  { name: "Trainual Last Opened Date", label: "Last Opened", category: "trainual", dataType: "date", source: "api", relevantStage: "New Lead" },
  { name: "Trainual Current Section", label: "Current Section", category: "trainual", dataType: "text", source: "api", relevantStage: "New Lead" },

  // ═══════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════
  { name: "Matt Call Done", label: "Matt Call", category: "validation", dataType: "dropdown", options: ["Yes - Fit Confirmed", "Yes - Concerns Flagged", "No - Not Scheduled", "No - No Show"], source: "manual", relevantStage: "Matt Call (Discovery)" },
  { name: "Sam Call Done", label: "Sam Call", category: "validation", dataType: "dropdown", options: ["Yes - Positive", "Yes - Concerns", "No - Not Scheduled", "No - No Show"], source: "manual", relevantStage: "Sam Call (Validation)" },
  { name: "Mark Call Done", label: "Mark Call", category: "validation", dataType: "dropdown", options: ["Yes - Financially Viable", "Yes - Needs More Info", "No - Not Scheduled", "No - No Show"], source: "manual", relevantStage: "Mark Call (Capital/Lending)" },
  { name: "Franchisee Validator Name", label: "Validator", category: "validation", dataType: "text", source: "manual", relevantStage: "Sam Call (Validation)", help: "Which franchisee did they speak with?" },
  { name: "NDA Status", label: "NDA", category: "validation", dataType: "dropdown", options: ["Not Sent", "Sent", "Signed"], source: "manual", relevantStage: "Qualified" },
  { name: "Discovery Scorecard Score", label: "Discovery Score", category: "validation", dataType: "number", source: "scout", relevantStage: "Matt Call (Discovery)" },

  // ═══════════════════════════════════════
  // ENGAGEMENT
  // ═══════════════════════════════════════
  { name: "Sequence Day Number", label: "Sequence Day", category: "engagement", dataType: "number", source: "system", relevantStage: "New Lead" },
  { name: "Sequence Status", label: "Sequence", category: "engagement", dataType: "dropdown", options: ["Active", "Paused", "Completed", "Exited Early"], source: "system", relevantStage: "New Lead" },
  { name: "Last Touch Date", label: "Last Touch", category: "engagement", dataType: "date", source: "system", relevantStage: "All" },
  { name: "Last Touch Channel", label: "Last Channel", category: "engagement", dataType: "dropdown", options: ["Call", "SMS", "Email", "Trainual", "In-Person"], source: "system", relevantStage: "All" },
  { name: "Contact Attempt Count", label: "Attempts", category: "engagement", dataType: "number", source: "system", relevantStage: "Contacted" },
  { name: "Days in Current Stage", label: "Days in Stage", category: "engagement", dataType: "number", source: "system", relevantStage: "All" },

  // ═══════════════════════════════════════
  // AI SCOUT
  // ═══════════════════════════════════════
  { name: "Scout Lead Score", label: "Lead Score", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "New Lead" },
  { name: "Score Breakdown", label: "Score Detail", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "New Lead" },
  { name: "Engagement Velocity", label: "Velocity", category: "ai_scout", dataType: "dropdown", options: ["Accelerating", "Steady", "Slowing", "Stalled"], source: "scout", relevantStage: "All" },
  { name: "Sentiment Trend", label: "Sentiment", category: "ai_scout", dataType: "dropdown", options: ["Very Positive", "Positive", "Neutral", "Cautious", "Negative"], source: "scout", relevantStage: "All" },
  { name: "Predicted Close Probability", label: "Close Prob.", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "Recommended Next Action", label: "Next Action", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "All" },
  { name: "Auto Summary", label: "AI Summary", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "All" },
  { name: "Lookalike Score", label: "Lookalike", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "New Lead" },
  { name: "Communication Style", label: "Comm Style", category: "ai_scout", dataType: "dropdown", options: ["Direct/Fast", "Analytical/Detail", "Relationship/Trust", "Cautious/Slow"], source: "scout", relevantStage: "Contacted" },

  // ═══════════════════════════════════════
  // COMPLIANCE
  // ═══════════════════════════════════════
  { name: "Spouse Aware", label: "Spouse Aware?", category: "compliance", dataType: "dropdown", options: ["Yes", "No", "N/A (Single)", "Unknown"], source: "manual", relevantStage: "Qualified" },
  { name: "OK to SMS Confirmed Date", label: "SMS Opt-In", category: "compliance", dataType: "date", source: "manual", relevantStage: "New Lead" },
  { name: "Earnings Claims Made", label: "Earnings Claims", category: "compliance", dataType: "dropdown", options: ["No - Confirmed Clean", "Yes - Flagged"], source: "manual", relevantStage: "Compliance Gate" },
  { name: "Compliance Checklist Complete", label: "Compliance", category: "compliance", dataType: "dropdown", options: ["Yes", "No"], source: "system", relevantStage: "Compliance Gate" },
];

/** Category display metadata */
export const CATEGORY_META: Record<FieldCategory, { label: string; icon: string; color: string }> = {
  territory: { label: "Territory", icon: "MapPin", color: "text-info" },
  franchise_fit: { label: "Franchise Fit", icon: "Target", color: "text-nah-orange" },
  financial: { label: "Financial", icon: "DollarSign", color: "text-success" },
  trainual: { label: "Trainual", icon: "BookOpen", color: "text-scout-purple" },
  validation: { label: "Validation", icon: "CheckCircle2", color: "text-warning" },
  engagement: { label: "Engagement", icon: "Activity", color: "text-info" },
  ai_scout: { label: "AI Scout", icon: "Zap", color: "text-scout-purple" },
  compliance: { label: "Compliance", icon: "Shield", color: "text-danger" },
};

/** Get fields by category */
export function getFieldsByCategory(category: FieldCategory): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => f.category === category);
}

/** Get only manual fields (what Chad fills in) */
export function getManualFields(): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => f.source === "manual");
}

/** Get only auto-filled fields (Scout/system/API) */
export function getAutoFields(): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => f.source !== "manual");
}
