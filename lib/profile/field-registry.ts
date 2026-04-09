/**
 * Candidate Profile Field Registry — v2 (199 fields, 18 categories)
 *
 * Single source of truth for all custom fields on a contact.
 * Drives the profile UI, API validation, and Scout field access.
 *
 * Each field knows: its category, data type, dropdown options,
 * who fills it (manual/scout/system/api), and which stage it becomes relevant.
 *
 * Source metadata per field is tracked in the contact_profile_fields table (EAV).
 */

export type FieldCategory =
  | "identity_contact"
  | "background_demographics"
  | "personality_psychology"
  | "goals_vision"
  | "financial"
  | "franchise_fit"
  | "territory"
  | "sales_journey"
  | "validation"
  | "trainual"
  | "compliance"
  | "objections_concerns"
  | "behavioral_signals"
  | "engagement"
  | "external_research"
  | "ai_scout"
  | "predictive_scores"
  | "metadata_audit";

export type FieldDataType = "text" | "dropdown" | "number" | "date" | "boolean" | "jsonb";

export type FieldSource = "manual" | "scout" | "system" | "api";

export interface ProfileField {
  /** Unique field key (stored in contact_profile_fields.field_name) */
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
  /** Tooltip/help text */
  help?: string;
}

/** All candidate profile fields organized for the UI — 199 fields across 18 categories */
export const PROFILE_FIELDS: ProfileField[] = [
  // ═══════════════════════════════════════
  // 1. IDENTITY & CONTACT (8 fields) — API
  // ═══════════════════════════════════════
  { name: "full_name", label: "Full Name", category: "identity_contact", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "preferred_name", label: "Preferred Name", category: "identity_contact", dataType: "text", source: "manual", relevantStage: "Contacted" },
  { name: "email_primary", label: "Primary Email", category: "identity_contact", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "phone_primary", label: "Primary Phone", category: "identity_contact", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "phone_secondary", label: "Secondary Phone", category: "identity_contact", dataType: "text", source: "manual", relevantStage: "Contacted" },
  { name: "mailing_address", label: "Mailing Address", category: "identity_contact", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "timezone", label: "Timezone", category: "identity_contact", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "preferred_contact_method", label: "Preferred Contact Method", category: "identity_contact", dataType: "dropdown", options: ["Call", "SMS", "Email", "No Preference"], source: "manual", relevantStage: "Contacted" },

  // ═══════════════════════════════════════
  // 2. BACKGROUND & DEMOGRAPHICS (14 fields) — AI
  // ═══════════════════════════════════════
  { name: "current_occupation", label: "Current Occupation", category: "background_demographics", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "current_employer", label: "Current Employer", category: "background_demographics", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "years_in_current_role", label: "Years in Current Role", category: "background_demographics", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "industry_background", label: "Industry Background", category: "background_demographics", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "education_level", label: "Education Level", category: "background_demographics", dataType: "dropdown", options: ["High School", "Some College", "Bachelors", "Masters", "Doctorate", "Trade/Vocational", "Other"], source: "scout", relevantStage: "Qualified" },
  { name: "military_veteran", label: "Military Veteran", category: "background_demographics", dataType: "dropdown", options: ["Yes", "No", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "age_range", label: "Age Range", category: "background_demographics", dataType: "dropdown", options: ["25-34", "35-44", "45-54", "55-64", "65+", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "marital_status", label: "Marital Status", category: "background_demographics", dataType: "dropdown", options: ["Single", "Married", "Divorced", "Widowed", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "dependents_count", label: "Dependents", category: "background_demographics", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "geographic_flexibility", label: "Geographic Flexibility", category: "background_demographics", dataType: "dropdown", options: ["Local Only", "Regional", "Willing to Relocate", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "prior_franchise_experience", label: "Prior Franchise Experience", category: "background_demographics", dataType: "dropdown", options: ["None", "Researched", "Owned Previously", "Currently Owns"], source: "scout", relevantStage: "Qualified" },
  { name: "linkedin_url", label: "LinkedIn URL", category: "background_demographics", dataType: "text", source: "scout", relevantStage: "New Lead" },
  { name: "notable_skills", label: "Notable Skills", category: "background_demographics", dataType: "text", source: "scout", relevantStage: "Qualified", help: "Key skills relevant to franchise operation" },
  { name: "leadership_experience", label: "Leadership Experience", category: "background_demographics", dataType: "dropdown", options: ["None", "Team Lead (1-5)", "Manager (5-20)", "Director/VP (20+)", "C-Suite/Owner"], source: "scout", relevantStage: "Qualified" },

  // ═══════════════════════════════════════
  // 3. PERSONALITY & PSYCHOLOGY (14 fields) — API (Zorakle)
  // ═══════════════════════════════════════
  { name: "disc_profile", label: "DISC Profile", category: "personality_psychology", dataType: "dropdown", options: ["D - Dominance", "I - Influence", "S - Steadiness", "C - Conscientiousness", "DI", "DS", "DC", "IS", "IC", "SC"], source: "api", relevantStage: "Qualified" },
  { name: "disc_primary_trait", label: "Primary DISC Trait", category: "personality_psychology", dataType: "text", source: "api", relevantStage: "Qualified" },
  { name: "disc_secondary_trait", label: "Secondary DISC Trait", category: "personality_psychology", dataType: "text", source: "api", relevantStage: "Qualified" },
  { name: "zorakle_completed", label: "Zorakle Completed", category: "personality_psychology", dataType: "boolean", source: "api", relevantStage: "Qualified" },
  { name: "zorakle_results_raw", label: "Zorakle Raw Results", category: "personality_psychology", dataType: "jsonb", source: "api", relevantStage: "Qualified" },
  { name: "risk_tolerance", label: "Risk Tolerance", category: "personality_psychology", dataType: "dropdown", options: ["Very Low", "Low", "Moderate", "High", "Very High"], source: "api", relevantStage: "Qualified" },
  { name: "risk_tolerance_score", label: "Risk Tolerance Score", category: "personality_psychology", dataType: "number", source: "api", relevantStage: "Qualified", help: "0-100 from Zorakle" },
  { name: "decision_making_style", label: "Decision Making Style", category: "personality_psychology", dataType: "dropdown", options: ["Analytical", "Intuitive", "Collaborative", "Directive"], source: "scout", relevantStage: "Qualified" },
  { name: "communication_style", label: "Communication Style", category: "personality_psychology", dataType: "dropdown", options: ["Direct/Fast", "Analytical/Detail", "Relationship/Trust", "Cautious/Slow"], source: "scout", relevantStage: "Contacted" },
  { name: "learning_style", label: "Learning Style", category: "personality_psychology", dataType: "dropdown", options: ["Visual", "Auditory", "Reading", "Kinesthetic", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "stress_response", label: "Stress Response Pattern", category: "personality_psychology", dataType: "text", source: "scout", relevantStage: "Qualified", help: "How they respond under pressure (observed in calls)" },
  { name: "personality_flags", label: "Personality Flags", category: "personality_psychology", dataType: "jsonb", source: "scout", relevantStage: "Qualified" },
  { name: "pfs_match_score", label: "PFS Match Score", category: "personality_psychology", dataType: "number", source: "api", relevantStage: "Qualified", help: "Predictive Fit Score from Zorakle/PFS" },
  { name: "ideal_candidate_match_pct", label: "Ideal Candidate Match %", category: "personality_psychology", dataType: "number", source: "scout", relevantStage: "Qualified" },

  // ═══════════════════════════════════════
  // 4. GOALS & VISION (12 fields) — AI
  // ═══════════════════════════════════════
  { name: "primary_goal", label: "Primary Goal", category: "goals_vision", dataType: "dropdown", options: ["Full-time business", "Side income", "Portfolio diversification", "Career change", "Legacy building"], source: "manual", relevantStage: "Qualified" },
  { name: "secondary_goal", label: "Secondary Goal", category: "goals_vision", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "why_nah", label: "Why NAH?", category: "goals_vision", dataType: "text", source: "manual", relevantStage: "Qualified", help: "In their words — what drew them to NAH?" },
  { name: "five_year_vision", label: "5-Year Vision", category: "goals_vision", dataType: "text", source: "scout", relevantStage: "Discovery" },
  { name: "income_expectation_year1", label: "Year 1 Income Expectation", category: "goals_vision", dataType: "text", source: "scout", relevantStage: "Discovery" },
  { name: "income_expectation_year3", label: "Year 3 Income Expectation", category: "goals_vision", dataType: "text", source: "scout", relevantStage: "Discovery" },
  { name: "motivation_clarity", label: "Motivation Clarity", category: "goals_vision", dataType: "dropdown", options: ["Strong", "Moderate", "Weak"], source: "manual", relevantStage: "Qualified" },
  { name: "stated_motivation", label: "Stated Motivation", category: "goals_vision", dataType: "dropdown", options: ["Buy Job", "Wealth Building", "Escape Corporate", "Family Legacy", "Community Impact", "Other"], source: "scout", relevantStage: "Qualified" },
  { name: "exit_strategy", label: "Exit Strategy", category: "goals_vision", dataType: "dropdown", options: ["Build & Sell", "Long-term Hold", "Family Transfer", "No Plan Yet", "Unknown"], source: "scout", relevantStage: "Discovery" },
  { name: "growth_ambition", label: "Growth Ambition", category: "goals_vision", dataType: "dropdown", options: ["Single Territory", "Multi-Territory", "Multi-Unit", "Regional Developer", "Unknown"], source: "scout", relevantStage: "Discovery" },
  { name: "timeline_to_open", label: "Timeline to Open", category: "goals_vision", dataType: "dropdown", options: ["Immediately", "1-3 months", "3-6 months", "6-12 months", "12+ months"], source: "manual", relevantStage: "Qualified" },
  { name: "spouse_partner_goals", label: "Spouse/Partner Goals", category: "goals_vision", dataType: "text", source: "scout", relevantStage: "Discovery", help: "Are spouse/partner aligned on goals?" },

  // ═══════════════════════════════════════
  // 5. FINANCIAL PROFILE (18 fields) — Manual + AI
  // ═══════════════════════════════════════
  { name: "capital_availability", label: "Capital Status", category: "financial", dataType: "dropdown", options: ["Confirmed", "Needs Verification", "Unknown"], source: "manual", relevantStage: "Qualified" },
  { name: "capital_source", label: "Funding Method", category: "financial", dataType: "dropdown", options: ["Cash", "SBA Loan", "ROBS (Retirement Rollover)", "Home Equity", "Partner/Investor", "Combination", "Undecided"], source: "manual", relevantStage: "Qualified", help: "How do they plan to fund the franchise?" },
  { name: "investment_timeline", label: "Investment Timeline", category: "financial", dataType: "dropdown", options: ["Under 6 months", "6-12 months", "12+ months"], source: "manual", relevantStage: "Qualified" },
  { name: "financing_pre_qualified", label: "Pre-Qualified?", category: "financial", dataType: "dropdown", options: ["Yes", "No", "In Progress", "Not Started"], source: "manual", relevantStage: "Mark Call" },
  { name: "financial_objection", label: "Financial Concern", category: "financial", dataType: "dropdown", options: ["Investment size", "Uncertain ROI", "Wants to compare", "Needs spouse buy-in", "Needs more info", "None"], source: "manual", relevantStage: "Qualified" },
  { name: "net_worth_bucket", label: "Net Worth Bucket", category: "financial", dataType: "dropdown", options: ["Under 100k", "100k-250k", "250k-500k", "500k-1M", "1M+", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "liquid_capital", label: "Liquid Capital ($)", category: "financial", dataType: "number", source: "manual", relevantStage: "Qualified" },
  { name: "illiquid_capital", label: "Illiquid Capital ($)", category: "financial", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "pfs_received", label: "PFS Received", category: "financial", dataType: "boolean", source: "manual", relevantStage: "Compliance" },
  { name: "pfs_uploaded_url", label: "PFS Document URL", category: "financial", dataType: "text", source: "system", relevantStage: "Compliance" },
  { name: "outstanding_liabilities", label: "Outstanding Liabilities", category: "financial", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "financial_red_flags", label: "Financial Red Flags", category: "financial", dataType: "jsonb", source: "scout", relevantStage: "Qualified" },
  { name: "guidant_referral_status", label: "Guidant Referral Status", category: "financial", dataType: "dropdown", options: ["Not Referred", "Referred", "In Progress", "Approved", "Declined"], source: "manual", relevantStage: "Mark Call" },
  { name: "sba_loan_status", label: "SBA Loan Status", category: "financial", dataType: "dropdown", options: ["Not Started", "Applied", "In Underwriting", "Approved", "Declined"], source: "manual", relevantStage: "Mark Call" },
  { name: "robs_rollover_status", label: "ROBS Rollover Status", category: "financial", dataType: "dropdown", options: ["Not Applicable", "Exploring", "In Process", "Complete"], source: "manual", relevantStage: "Mark Call" },
  { name: "credit_score_range", label: "Credit Score Range", category: "financial", dataType: "dropdown", options: ["Below 620", "620-679", "680-739", "740+", "Unknown"], source: "manual", relevantStage: "Mark Call" },
  { name: "real_estate_portfolio", label: "RE Portfolio", category: "financial", dataType: "text", source: "scout", relevantStage: "Discovery", help: "Existing real estate holdings" },
  { name: "financial_verification_complete", label: "Financial Verification Complete", category: "financial", dataType: "boolean", source: "manual", relevantStage: "Compliance" },

  // ═══════════════════════════════════════
  // 6. FRANCHISE FIT (10 fields) — Manual → AI
  // ═══════════════════════════════════════
  { name: "re_experience", label: "Real Estate Experience", category: "franchise_fit", dataType: "dropdown", options: ["None", "Some (1-3 flips)", "Experienced (4-10)", "Expert (10+)"], source: "manual", relevantStage: "Qualified", help: "How much flipping/RE experience do they have?" },
  { name: "construction_knowledge", label: "Construction Knowledge", category: "franchise_fit", dataType: "dropdown", options: ["None", "Basic", "Intermediate", "Advanced"], source: "manual", relevantStage: "Qualified" },
  { name: "business_ownership_experience", label: "Business Owner?", category: "franchise_fit", dataType: "dropdown", options: ["Yes - Current", "Yes - Previous", "No"], source: "manual", relevantStage: "Qualified" },
  { name: "prior_business_type", label: "Prior Business Type", category: "franchise_fit", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "hands_on_vs_oversight", label: "Hands-On vs Oversight", category: "franchise_fit", dataType: "dropdown", options: ["Hands-On", "Oversight Only", "Mix", "Unknown"], source: "scout", relevantStage: "Discovery" },
  { name: "management_capacity", label: "Management Capacity", category: "franchise_fit", dataType: "dropdown", options: ["Solo Operator", "Small Team (1-3)", "Medium Team (4-10)", "Large Team (10+)"], source: "scout", relevantStage: "Discovery" },
  { name: "industry_knowledge_score", label: "Industry Knowledge", category: "franchise_fit", dataType: "number", source: "scout", relevantStage: "Discovery", help: "0-100 assessment of RE/construction/flipping knowledge" },
  { name: "coachability_score", label: "Coachability Score", category: "franchise_fit", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-100 willingness to follow the system" },
  { name: "franchise_system_fit", label: "System Fit Assessment", category: "franchise_fit", dataType: "text", source: "scout", relevantStage: "Discovery" },
  { name: "culture_alignment", label: "Culture Alignment", category: "franchise_fit", dataType: "dropdown", options: ["Strong", "Moderate", "Weak", "Unknown"], source: "scout", relevantStage: "Discovery" },

  // ═══════════════════════════════════════
  // 7. TERRITORY (10 fields) — Manual + AI
  // ═══════════════════════════════════════
  { name: "territory_interest", label: "Desired Territory", category: "territory", dataType: "text", source: "manual", relevantStage: "New Lead", help: "City/state/metro area the prospect wants" },
  { name: "territory_market", label: "Market Area", category: "territory", dataType: "text", source: "manual", relevantStage: "Qualified", help: "Broader market (e.g., DFW Metro, Atlanta North)" },
  { name: "territory_status", label: "Territory Status", category: "territory", dataType: "dropdown", options: ["Available", "Waitlist", "Unavailable", "Confirmed"], source: "manual", relevantStage: "Qualified" },
  { name: "territory_confirmed_date", label: "Confirmed Date", category: "territory", dataType: "date", source: "system", relevantStage: "Awarding" },
  { name: "territory_population", label: "Territory Population", category: "territory", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "territory_median_home_price", label: "Median Home Price", category: "territory", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "territory_flip_volume", label: "Annual Flip Volume", category: "territory", dataType: "number", source: "scout", relevantStage: "Qualified", help: "Estimated flips per year in territory" },
  { name: "territory_competition_level", label: "Competition Level", category: "territory", dataType: "dropdown", options: ["Low", "Moderate", "High", "Very High"], source: "scout", relevantStage: "Qualified" },
  { name: "territory_proximity_to_hq", label: "Proximity to Support Hub", category: "territory", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "territory_notes", label: "Territory Notes", category: "territory", dataType: "text", source: "manual", relevantStage: "Qualified" },

  // ═══════════════════════════════════════
  // 8. SALES JOURNEY (12 fields) — API
  // ═══════════════════════════════════════
  { name: "lead_source", label: "Lead Source", category: "sales_journey", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "lead_source_detail", label: "Lead Source Detail", category: "sales_journey", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "first_contact_date", label: "First Contact Date", category: "sales_journey", dataType: "date", source: "api", relevantStage: "New Lead" },
  { name: "current_pipeline_stage", label: "Current Stage", category: "sales_journey", dataType: "text", source: "system", relevantStage: "All" },
  { name: "days_in_pipeline", label: "Total Days in Pipeline", category: "sales_journey", dataType: "number", source: "system", relevantStage: "All" },
  { name: "stage_enter_date", label: "Stage Enter Date", category: "sales_journey", dataType: "date", source: "system", relevantStage: "All" },
  { name: "assigned_rep", label: "Assigned Rep", category: "sales_journey", dataType: "text", source: "system", relevantStage: "All" },
  { name: "total_calls", label: "Total Calls", category: "sales_journey", dataType: "number", source: "system", relevantStage: "All" },
  { name: "total_emails_sent", label: "Total Emails Sent", category: "sales_journey", dataType: "number", source: "system", relevantStage: "All" },
  { name: "total_sms_sent", label: "Total SMS Sent", category: "sales_journey", dataType: "number", source: "system", relevantStage: "All" },
  { name: "referral_source_name", label: "Referral Source", category: "sales_journey", dataType: "text", source: "manual", relevantStage: "New Lead" },
  { name: "campaign_attribution", label: "Campaign Attribution", category: "sales_journey", dataType: "text", source: "api", relevantStage: "New Lead" },

  // ═══════════════════════════════════════
  // 9. VALIDATION (8 fields) — Manual + AI
  // ═══════════════════════════════════════
  { name: "matt_call_done", label: "Matt Call", category: "validation", dataType: "dropdown", options: ["Yes - Fit Confirmed", "Yes - Concerns Flagged", "No - Not Scheduled", "No - No Show"], source: "manual", relevantStage: "Discovery" },
  { name: "sam_call_done", label: "Sam Call", category: "validation", dataType: "dropdown", options: ["Yes - Positive", "Yes - Concerns", "No - Not Scheduled", "No - No Show"], source: "manual", relevantStage: "Validation" },
  { name: "mark_call_done", label: "Mark Call", category: "validation", dataType: "dropdown", options: ["Yes - Financially Viable", "Yes - Needs More Info", "No - Not Scheduled", "No - No Show"], source: "manual", relevantStage: "Mark Call" },
  { name: "franchisee_validator_name", label: "Validator", category: "validation", dataType: "text", source: "manual", relevantStage: "Validation", help: "Which franchisee did they speak with?" },
  { name: "nda_status", label: "NDA", category: "validation", dataType: "dropdown", options: ["Not Sent", "Sent", "Signed"], source: "manual", relevantStage: "Qualified" },
  { name: "discovery_scorecard_score", label: "Discovery Score", category: "validation", dataType: "number", source: "scout", relevantStage: "Discovery" },
  { name: "background_check_status", label: "Background Check", category: "validation", dataType: "dropdown", options: ["Not Started", "In Progress", "Clear", "Flagged"], source: "manual", relevantStage: "Compliance" },
  { name: "reference_check_status", label: "Reference Check", category: "validation", dataType: "dropdown", options: ["Not Started", "In Progress", "Complete - Positive", "Complete - Concerns"], source: "manual", relevantStage: "Compliance" },

  // ═══════════════════════════════════════
  // 10. TRAINUAL (5 fields) — API
  // ═══════════════════════════════════════
  { name: "framing_call_logged", label: "Framing Call Done?", category: "trainual", dataType: "dropdown", options: ["Yes", "No"], source: "manual", relevantStage: "Contacted", help: "Must be Yes before Trainual invite fires" },
  { name: "trainual_access_sent", label: "Access Sent?", category: "trainual", dataType: "dropdown", options: ["Yes", "No"], source: "system", relevantStage: "New Lead" },
  { name: "trainual_completion_pct", label: "Completion %", category: "trainual", dataType: "number", source: "api", relevantStage: "New Lead" },
  { name: "trainual_last_opened_date", label: "Last Opened", category: "trainual", dataType: "date", source: "api", relevantStage: "New Lead" },
  { name: "trainual_current_section", label: "Current Section", category: "trainual", dataType: "text", source: "api", relevantStage: "New Lead" },

  // ═══════════════════════════════════════
  // 11. COMPLIANCE (6 fields) — Manual
  // ═══════════════════════════════════════
  { name: "spouse_aware", label: "Spouse Aware?", category: "compliance", dataType: "dropdown", options: ["Yes", "No", "N/A (Single)", "Unknown"], source: "manual", relevantStage: "Qualified" },
  { name: "ok_to_sms_confirmed_date", label: "SMS Opt-In", category: "compliance", dataType: "date", source: "manual", relevantStage: "New Lead" },
  { name: "earnings_claims_made", label: "Earnings Claims", category: "compliance", dataType: "dropdown", options: ["No - Confirmed Clean", "Yes - Flagged"], source: "manual", relevantStage: "Compliance" },
  { name: "compliance_checklist_complete", label: "Compliance Complete", category: "compliance", dataType: "dropdown", options: ["Yes", "No"], source: "system", relevantStage: "Compliance" },
  { name: "fdd_receipt_acknowledged", label: "FDD Receipt Acknowledged", category: "compliance", dataType: "boolean", source: "manual", relevantStage: "Compliance" },
  { name: "fdd_14_day_cooling_complete", label: "FDD 14-Day Cooling Complete", category: "compliance", dataType: "boolean", source: "system", relevantStage: "Compliance" },

  // ═══════════════════════════════════════
  // 12. OBJECTIONS & CONCERNS (12 fields) — AI
  // ═══════════════════════════════════════
  { name: "primary_objection", label: "Primary Objection", category: "objections_concerns", dataType: "dropdown", options: ["Capital/Investment", "Franchise Value", "Timing", "Territory", "Going Cold", "Royalty Concerns", "Spouse/Family", "Competition", "None Identified"], source: "scout", relevantStage: "Qualified" },
  { name: "secondary_objection", label: "Secondary Objection", category: "objections_concerns", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "objection_severity", label: "Objection Severity", category: "objections_concerns", dataType: "dropdown", options: ["Deal-Breaking", "Significant", "Moderate", "Minor", "None"], source: "scout", relevantStage: "Qualified" },
  { name: "objection_resolution_status", label: "Resolution Status", category: "objections_concerns", dataType: "dropdown", options: ["Unresolved", "Partially Resolved", "Resolved", "N/A"], source: "scout", relevantStage: "Qualified" },
  { name: "capital_concern_detail", label: "Capital Concern Detail", category: "objections_concerns", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "timing_concern_detail", label: "Timing Concern Detail", category: "objections_concerns", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "spouse_concern_detail", label: "Spouse Concern Detail", category: "objections_concerns", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "competitor_mentioned", label: "Competitor Mentioned", category: "objections_concerns", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "red_flags_count", label: "Red Flags Count", category: "objections_concerns", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "yellow_flags_count", label: "Yellow Flags Count", category: "objections_concerns", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "active_flags", label: "Active Flags", category: "objections_concerns", dataType: "jsonb", source: "scout", relevantStage: "All" },
  { name: "flag_history", label: "Flag History", category: "objections_concerns", dataType: "jsonb", source: "scout", relevantStage: "All" },

  // ═══════════════════════════════════════
  // 13. BEHAVIORAL SIGNALS (12 fields) — AI
  // ═══════════════════════════════════════
  { name: "response_speed_trend", label: "Response Speed Trend", category: "behavioral_signals", dataType: "dropdown", options: ["Getting Faster", "Consistent", "Getting Slower", "Ghosting"], source: "scout", relevantStage: "All" },
  { name: "avg_response_time_hours", label: "Avg Response Time (hrs)", category: "behavioral_signals", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "call_show_rate", label: "Call Show Rate", category: "behavioral_signals", dataType: "number", source: "scout", relevantStage: "All", help: "% of scheduled calls attended" },
  { name: "homework_completion_rate", label: "Homework Completion %", category: "behavioral_signals", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "questions_asked_quality", label: "Question Quality", category: "behavioral_signals", dataType: "dropdown", options: ["Deep/Strategic", "Surface Level", "Minimal", "None"], source: "scout", relevantStage: "All" },
  { name: "engagement_pattern", label: "Engagement Pattern", category: "behavioral_signals", dataType: "dropdown", options: ["Consistently Engaged", "Cyclical", "Front-Loaded", "Back-Loaded", "Declining"], source: "scout", relevantStage: "All" },
  { name: "proactive_vs_reactive", label: "Initiative Level", category: "behavioral_signals", dataType: "dropdown", options: ["Highly Proactive", "Somewhat Proactive", "Reactive Only", "Disengaged"], source: "scout", relevantStage: "All" },
  { name: "sentiment_last_interaction", label: "Last Interaction Sentiment", category: "behavioral_signals", dataType: "dropdown", options: ["Very Positive", "Positive", "Neutral", "Cautious", "Negative"], source: "scout", relevantStage: "All" },
  { name: "commitment_signals", label: "Commitment Signals", category: "behavioral_signals", dataType: "jsonb", source: "scout", relevantStage: "All", help: "Array of observed commitment signals" },
  { name: "hesitation_signals", label: "Hesitation Signals", category: "behavioral_signals", dataType: "jsonb", source: "scout", relevantStage: "All", help: "Array of observed hesitation signals" },
  { name: "ghost_risk_score", label: "Ghost Risk Score", category: "behavioral_signals", dataType: "number", source: "scout", relevantStage: "All", help: "0-100 probability of going cold" },
  { name: "buying_temperature", label: "Buying Temperature", category: "behavioral_signals", dataType: "dropdown", options: ["Hot", "Warm", "Cool", "Cold", "Frozen"], source: "scout", relevantStage: "All" },

  // ═══════════════════════════════════════
  // 14. ENGAGEMENT (8 fields) — Auto
  // ═══════════════════════════════════════
  { name: "sequence_day_number", label: "Sequence Day", category: "engagement", dataType: "number", source: "system", relevantStage: "New Lead" },
  { name: "sequence_status", label: "Sequence", category: "engagement", dataType: "dropdown", options: ["Active", "Paused", "Completed", "Exited Early"], source: "system", relevantStage: "New Lead" },
  { name: "last_touch_date", label: "Last Touch", category: "engagement", dataType: "date", source: "system", relevantStage: "All" },
  { name: "last_touch_channel", label: "Last Channel", category: "engagement", dataType: "dropdown", options: ["Call", "SMS", "Email", "Trainual", "In-Person"], source: "system", relevantStage: "All" },
  { name: "contact_attempt_count", label: "Attempts", category: "engagement", dataType: "number", source: "system", relevantStage: "Contacted" },
  { name: "days_in_current_stage", label: "Days in Stage", category: "engagement", dataType: "number", source: "system", relevantStage: "All" },
  { name: "total_interactions", label: "Total Interactions", category: "engagement", dataType: "number", source: "system", relevantStage: "All" },
  { name: "days_since_last_contact", label: "Days Since Last Contact", category: "engagement", dataType: "number", source: "system", relevantStage: "All" },

  // ═══════════════════════════════════════
  // 15. EXTERNAL RESEARCH (10 fields) — AI
  // ═══════════════════════════════════════
  { name: "linkedin_summary", label: "LinkedIn Summary", category: "external_research", dataType: "text", source: "scout", relevantStage: "New Lead" },
  { name: "company_research", label: "Company Research", category: "external_research", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "local_market_conditions", label: "Local Market Conditions", category: "external_research", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "competitor_activity_in_area", label: "Competitor Activity in Area", category: "external_research", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "public_records_summary", label: "Public Records Summary", category: "external_research", dataType: "text", source: "scout", relevantStage: "Compliance" },
  { name: "news_mentions", label: "News Mentions", category: "external_research", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "social_media_presence", label: "Social Media Presence", category: "external_research", dataType: "dropdown", options: ["Active", "Moderate", "Minimal", "None Found"], source: "scout", relevantStage: "New Lead" },
  { name: "professional_network_strength", label: "Professional Network", category: "external_research", dataType: "dropdown", options: ["Strong (500+)", "Moderate (200-500)", "Light (50-200)", "Minimal (<50)", "Unknown"], source: "scout", relevantStage: "Qualified" },
  { name: "real_estate_licenses", label: "RE Licenses", category: "external_research", dataType: "text", source: "scout", relevantStage: "Qualified" },
  { name: "research_last_updated", label: "Research Last Updated", category: "external_research", dataType: "date", source: "scout", relevantStage: "All" },

  // ═══════════════════════════════════════
  // 16. AI SCOUT INTELLIGENCE (16 fields) — AI
  // ═══════════════════════════════════════
  { name: "scout_lead_score", label: "Lead Score", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "New Lead" },
  { name: "score_breakdown", label: "Score Detail", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "New Lead" },
  { name: "engagement_velocity", label: "Velocity", category: "ai_scout", dataType: "dropdown", options: ["Accelerating", "Steady", "Slowing", "Stalled"], source: "scout", relevantStage: "All" },
  { name: "sentiment_trend", label: "Sentiment Trend", category: "ai_scout", dataType: "dropdown", options: ["Very Positive", "Positive", "Neutral", "Cautious", "Negative"], source: "scout", relevantStage: "All" },
  { name: "predicted_close_probability", label: "Close Probability", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "recommended_next_action", label: "Next Action", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "All" },
  { name: "auto_summary", label: "AI Summary", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "All" },
  { name: "lookalike_score", label: "Lookalike Score", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "New Lead" },
  { name: "scout_confidence_level", label: "Scout Confidence", category: "ai_scout", dataType: "dropdown", options: ["High", "Medium", "Low", "Insufficient Data"], source: "scout", relevantStage: "All" },
  { name: "data_completeness_pct", label: "Data Completeness %", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "last_scout_analysis_date", label: "Last Analysis", category: "ai_scout", dataType: "date", source: "scout", relevantStage: "All" },
  { name: "scout_pending_suggestions", label: "Pending Suggestions", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "scout_accepted_rate", label: "Suggestion Accept Rate", category: "ai_scout", dataType: "number", source: "scout", relevantStage: "All" },
  { name: "key_insight", label: "Key Insight", category: "ai_scout", dataType: "text", source: "scout", relevantStage: "All", help: "Most important thing to know about this contact right now" },
  { name: "risk_factors", label: "Risk Factors", category: "ai_scout", dataType: "jsonb", source: "scout", relevantStage: "All" },
  { name: "opportunity_factors", label: "Opportunity Factors", category: "ai_scout", dataType: "jsonb", source: "scout", relevantStage: "All" },

  // ═══════════════════════════════════════
  // 17. PREDICTIVE SCORES (12 fields) — AI
  // ═══════════════════════════════════════
  { name: "score_financial", label: "Financial Score", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-25 financial readiness" },
  { name: "score_operational", label: "Operational Score", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-25 operational readiness" },
  { name: "score_engagement", label: "Engagement Score", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-25 engagement level" },
  { name: "score_momentum", label: "Momentum Score", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-25 deal momentum" },
  { name: "conversion_probability", label: "Conversion Probability", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-100% likelihood of closing" },
  { name: "days_to_close_estimate", label: "Est. Days to Close", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified" },
  { name: "capital_risk_score", label: "Capital Risk", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Qualified", help: "0-100 risk of capital falling through" },
  { name: "ghost_probability", label: "Ghost Probability", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "All", help: "0-100 probability of going dark" },
  { name: "franchise_success_prediction", label: "Success Prediction", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "Awarding", help: "0-100 predicted franchisee success post-close" },
  { name: "time_sensitivity_score", label: "Time Sensitivity", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "All", help: "0-100 how time-sensitive this deal is right now" },
  { name: "deal_health_score", label: "Deal Health", category: "predictive_scores", dataType: "number", source: "scout", relevantStage: "All", help: "0-100 overall deal health composite" },
  { name: "score_trend", label: "Score Trend", category: "predictive_scores", dataType: "dropdown", options: ["Improving", "Stable", "Declining", "Volatile"], source: "scout", relevantStage: "All" },

  // ═══════════════════════════════════════
  // 18. METADATA & AUDIT (12 fields) — Auto
  // ═══════════════════════════════════════
  { name: "ghl_contact_id", label: "GHL Contact ID", category: "metadata_audit", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "ghl_location_id", label: "GHL Location ID", category: "metadata_audit", dataType: "text", source: "api", relevantStage: "New Lead" },
  { name: "created_date", label: "Created Date", category: "metadata_audit", dataType: "date", source: "system", relevantStage: "New Lead" },
  { name: "last_modified_date", label: "Last Modified", category: "metadata_audit", dataType: "date", source: "system", relevantStage: "All" },
  { name: "last_modified_by", label: "Last Modified By", category: "metadata_audit", dataType: "text", source: "system", relevantStage: "All" },
  { name: "profile_version", label: "Profile Version", category: "metadata_audit", dataType: "number", source: "system", relevantStage: "All" },
  { name: "total_scout_updates", label: "Total Scout Updates", category: "metadata_audit", dataType: "number", source: "system", relevantStage: "All" },
  { name: "total_manual_updates", label: "Total Manual Updates", category: "metadata_audit", dataType: "number", source: "system", relevantStage: "All" },
  { name: "total_api_updates", label: "Total API Updates", category: "metadata_audit", dataType: "number", source: "system", relevantStage: "All" },
  { name: "data_quality_score", label: "Data Quality Score", category: "metadata_audit", dataType: "number", source: "scout", relevantStage: "All", help: "0-100 how complete and reliable the profile data is" },
  { name: "last_data_audit", label: "Last Data Audit", category: "metadata_audit", dataType: "date", source: "system", relevantStage: "All" },
  { name: "import_source", label: "Import Source", category: "metadata_audit", dataType: "text", source: "system", relevantStage: "New Lead", help: "Original import source (GHL sync, CSV, manual, etc.)" },
];

/** Category display metadata — all 18 categories */
export const CATEGORY_META: Record<FieldCategory, { label: string; icon: string; color: string; sortOrder: number }> = {
  identity_contact: { label: "Identity & Contact", icon: "User", color: "text-info", sortOrder: 1 },
  background_demographics: { label: "Background & Demographics", icon: "Briefcase", color: "text-muted", sortOrder: 2 },
  personality_psychology: { label: "Personality & Psychology", icon: "Brain", color: "text-scout-purple", sortOrder: 3 },
  goals_vision: { label: "Goals & Vision", icon: "Target", color: "text-nah-orange", sortOrder: 4 },
  financial: { label: "Financial Profile", icon: "DollarSign", color: "text-success", sortOrder: 5 },
  franchise_fit: { label: "Franchise Fit", icon: "Puzzle", color: "text-nah-orange", sortOrder: 6 },
  territory: { label: "Territory", icon: "MapPin", color: "text-info", sortOrder: 7 },
  sales_journey: { label: "Sales Journey", icon: "TrendingUp", color: "text-warning", sortOrder: 8 },
  validation: { label: "Validation", icon: "CheckCircle2", color: "text-warning", sortOrder: 9 },
  trainual: { label: "Trainual", icon: "BookOpen", color: "text-scout-purple", sortOrder: 10 },
  compliance: { label: "Compliance", icon: "Shield", color: "text-danger", sortOrder: 11 },
  objections_concerns: { label: "Objections & Concerns", icon: "AlertTriangle", color: "text-danger", sortOrder: 12 },
  behavioral_signals: { label: "Behavioral Signals", icon: "Activity", color: "text-info", sortOrder: 13 },
  engagement: { label: "Engagement", icon: "Zap", color: "text-success", sortOrder: 14 },
  external_research: { label: "External Research", icon: "Search", color: "text-muted", sortOrder: 15 },
  ai_scout: { label: "AI Scout Intelligence", icon: "Bot", color: "text-scout-purple", sortOrder: 16 },
  predictive_scores: { label: "Predictive Scores", icon: "BarChart3", color: "text-warning", sortOrder: 17 },
  metadata_audit: { label: "Metadata & Audit", icon: "Database", color: "text-muted", sortOrder: 18 },
};

/** Get fields by category */
export function getFieldsByCategory(category: FieldCategory): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => f.category === category);
}

/** Get all categories sorted by display order */
export function getSortedCategories(): FieldCategory[] {
  return (Object.keys(CATEGORY_META) as FieldCategory[]).sort(
    (a, b) => CATEGORY_META[a].sortOrder - CATEGORY_META[b].sortOrder
  );
}

/** Get only manual fields (what reps fill in) */
export function getManualFields(): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => f.source === "manual");
}

/** Get only auto-filled fields (Scout/system/API) */
export function getAutoFields(): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => f.source !== "manual");
}

/** Get field by name */
export function getFieldByName(name: string): ProfileField | undefined {
  return PROFILE_FIELDS.find((f) => f.name === name);
}

/** Validate that a field name exists in the registry */
export function isValidFieldName(name: string): boolean {
  return PROFILE_FIELDS.some((f) => f.name === name);
}
