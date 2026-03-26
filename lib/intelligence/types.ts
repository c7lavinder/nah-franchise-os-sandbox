/**
 * Candidate Intelligence Engine — TypeScript Types
 *
 * Matches the 6 database tables defined in schema.sql.
 * Used across API routes, components, and Scout tools.
 */

// ═══════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════

/** Net worth bracket for financial profiling */
export type NetWorthBucket = "under_100k" | "100_250k" | "250_500k" | "500k_plus";

/** How the candidate plans to fund the franchise */
export type FundingPath = "cash" | "guidant" | "sba" | "combination" | "unknown";

/** DISC personality profile type */
export type DiscProfile = "D" | "I" | "S" | "C";

/** What drives the candidate to pursue a franchise */
export type StatedMotivation = "buy_job" | "wealth" | "escape_corporate" | "other";

/** Candidate's comfort level with construction */
export type ConstructionComfort = "hands_on" | "oversight_only" | "no_experience";

/** Whether the candidate's spouse supports the decision */
export type SpouseSupportive = "yes" | "no" | "unknown";

/** How urgently the candidate wants to move forward */
export type Urgency = "ready_now" | "3_6_months" | "exploring";

/** Type of call logged */
export type CallType = "intro" | "matt" | "sam" | "mark";

/** Rep's gut confidence level after a call */
export type RepConfidence = "high" | "medium" | "low";

/** What triggered a score change */
export type ScoreTriggeredBy = "call_log" | "stage_move" | "trainual" | "manual";

/** Category of objection raised by a candidate */
export type ObjectionType = "capital" | "value" | "timing" | "territory" | "going_cold" | "royalty" | "other";

/** Active status of a franchisee post-close */
export type FranchiseeActiveStatus = "active" | "churned" | "paused";

/** Source of franchisee performance data */
export type FranchiseeDataSource = "automated" | "manual" | "partial";

/** Type of market signal being tracked */
export type MarketSignalType = "territory" | "lead_source" | "objection_trend" | "industry";

/** Source of a market signal */
export type MarketSignalSource = "manual" | "automated" | "api";

// ═══════════════════════════════════════════════════════
// Table interfaces
// ═══════════════════════════════════════════════════════

/** Growing intelligence profile per candidate — one row per contact */
export interface CandidateIntelligence {
  id: string;
  contact_id: string;
  ghl_location_id: string;

  // Financial profile
  net_worth_bucket: string | null;
  liquid_capital: number | null;
  illiquid_capital: number | null;
  funding_path: string | null;
  pfs_received: boolean;
  pfs_uploaded_url: string | null;
  outstanding_liabilities: string | null;
  financial_red_flags: Record<string, unknown>[] | null;

  // Personality profile
  zorakle_completed: boolean;
  zorakle_results: Record<string, unknown> | null;
  disc_profile: string | null;
  risk_tolerance_score: number | null;
  personality_flags: Record<string, unknown>[] | null;

  // Candidate profile
  stated_motivation: string | null;
  prior_business_owner: boolean | null;
  prior_business_type: string | null;
  construction_comfort: string | null;
  spouse_supportive: string | null;
  urgency: string | null;

  // Engagement signals
  trainual_completion_pct: number;
  trainual_last_activity: string | null;
  avg_response_time_hours: number | null;
  homework_completion_rate: number | null;

  // Computed
  current_score: number;
  score_financial: number;
  score_operational: number;
  score_engagement: number;
  score_momentum: number;
  active_flags: Record<string, unknown>[] | null;

  // Meta
  created_at: string;
  updated_at: string;
}

/** Structured post-call data — one row per call, never edited */
export interface CallLog {
  id: string;
  contact_id: string;
  call_type: string;
  logged_by: string;
  called_at: string | null;
  logged_at: string;

  // Structured fields
  fields: Record<string, unknown>;

  // AI assist
  transcript_url: string | null;
  ai_prefilled: boolean;
  human_confirmed: boolean;

  // Rep gut read
  rep_confidence: string | null;
  red_flags_raised: string | null;
  notes: string | null;

  created_at: string;
}

/** Score change history — every change timestamped with reason */
export interface CandidateScoreHistory {
  id: string;
  contact_id: string;
  triggered_by: string;
  trigger_id: string | null;

  score_before: number | null;
  score_after: number | null;
  financial_before: number | null;
  financial_after: number | null;
  operational_before: number | null;
  operational_after: number | null;
  engagement_before: number | null;
  engagement_after: number | null;
  momentum_before: number | null;
  momentum_after: number | null;

  changes_explained: Record<string, unknown>[] | null;
  created_at: string;
}

/** Objection raised per candidate per stage — the learning layer */
export interface ObjectionRegistry {
  id: string;
  contact_id: string;
  stage_at_time: string;
  call_log_id: string | null;

  objection_type: string;
  objection_detail: string | null;
  resolved: boolean;
  resolution_notes: string | null;
  resolved_at: string | null;

  score_impact: number | null;
  created_at: string;
}

/** Post-close franchisee performance data — updated quarterly */
export interface FranchiseePerformance {
  id: string;
  contact_id: string;
  franchisee_name: string;
  territory: string | null;

  // Deal close data
  signed_at: string | null;
  funds_received_at: string | null;
  franchise_agreement_signed: boolean;

  // Performance metrics
  houses_purchased_year1: number | null;
  houses_purchased_year2: number | null;
  houses_purchased_year3: number | null;
  houses_purchased_total: number | null;
  revenue_year1: number | null;
  revenue_year2: number | null;
  revenue_year3: number | null;
  time_to_first_flip_days: number | null;
  staff_hired: number | null;
  royalty_payment_consistent: boolean | null;
  territory_utilization_pct: number | null;
  nps_score: number | null;
  support_calls_year1: number | null;
  active_status: string | null;

  // Source of data
  franchise_software_id: string | null;
  last_synced_at: string | null;
  data_source: string | null;

  // Meta
  created_at: string;
  updated_at: string;
}

/** Industry and territory market signals — log now, query later */
export interface MarketSignal {
  id: string;
  signal_type: string;
  signal_key: string;
  signal_value: Record<string, unknown>;
  observed_at: string;
  source: string | null;
}

// ═══════════════════════════════════════════════════════
// Insert types (omit server-generated fields)
// ═══════════════════════════════════════════════════════

export type CandidateIntelligenceInsert = Omit<CandidateIntelligence, "id" | "created_at" | "updated_at" | "current_score" | "score_financial" | "score_operational" | "score_engagement" | "score_momentum" | "trainual_completion_pct" | "pfs_received" | "zorakle_completed"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  current_score?: number;
  score_financial?: number;
  score_operational?: number;
  score_engagement?: number;
  score_momentum?: number;
  trainual_completion_pct?: number;
  pfs_received?: boolean;
  zorakle_completed?: boolean;
};

export type CallLogInsert = Omit<CallLog, "id" | "created_at" | "logged_at" | "ai_prefilled" | "human_confirmed"> & {
  id?: string;
  created_at?: string;
  logged_at?: string;
  ai_prefilled?: boolean;
  human_confirmed?: boolean;
};

export type CandidateScoreHistoryInsert = Omit<CandidateScoreHistory, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type ObjectionRegistryInsert = Omit<ObjectionRegistry, "id" | "created_at" | "resolved"> & {
  id?: string;
  created_at?: string;
  resolved?: boolean;
};

export type FranchiseePerformanceInsert = Omit<FranchiseePerformance, "id" | "created_at" | "updated_at" | "franchise_agreement_signed"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  franchise_agreement_signed?: boolean;
};

export type MarketSignalInsert = Omit<MarketSignal, "id" | "observed_at"> & {
  id?: string;
  observed_at?: string;
};
