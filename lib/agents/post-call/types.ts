/** A pipeline the contact is currently active in */
export interface PipelinePosition {
  pipelineName: string;
  pipelineSlug: string;
  currentStage: string;
  /** Sub-tasks in current stage with their completion status */
  subTasks: { name: string; completed: boolean }[];
  /** All stages in order for context */
  allStages: string[];
}

/** Lightweight roster entry for team/group call context */
export interface RosterEntry {
  name: string;
  role: "prospect" | "franchisee";
  pipelineStage: string | null;
  territory: string | null;
}

/** Shared context passed to all post-call prompt sections */
export interface CallContext {
  callId: string;
  transcript: string;
  callType: string | null;
  callTypeSlug: string | null;
  contactName: string | null;
  contactId: string | null;
  teamMembers: string[];
  callDate: string | null;
  durationSeconds: number | null;
  /** Contact's active pipeline positions — may be in multiple pipelines */
  pipelinePositions: PipelinePosition[];
  /** RAG feedback block — patterns from past push/skip/edit behavior */
  feedbackBlock: string;
  /** All external contacts on the call (for multi-contact extraction) */
  contactNames: string[];
  /** Territories linked to the contact(s) */
  territoryNames: string[];
  /** Territories explicitly attached to this call via call_territories (authoritative for per-call extraction routing) */
  callTerritories: Array<{ ms_slug: string; territory_name: string; is_primary: boolean }>;
  /** For team/group calls: full roster of contacts + territories so LLM can match names from transcript */
  roster: RosterEntry[];
  /** Whether this is a team/group/internal call (no specific contact focus) */
  isTeamCall: boolean;
}

/** Result types for each section */

export interface SummaryResult {
  summary: string;
  bullets: string[];
}

export interface CoachingResult {
  score: number;
  label: string;
  went_well: string[];
  watch_out: string[];
  next_call_prep: string;
  dimension_scores?: {
    discovery: number;
    capital: number;
    relationship: number;
    process_clarity: number;
    objection_surfacing: number;
    momentum: number;
  };
}

export interface ActionItem {
  category: string;
  title: string;
  description: string;
  why: string;
  contact_name: string;
  assigned_to_name: string;
  ghl_action: boolean;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface NextStepsResult {
  actions: ActionItem[];
}

export interface ExtractionField {
  field_key: string;
  field_category: string;
  extracted_value: string | null;
  confidence: string;
  /** For multi-contact calls: which contact this applies to (name) */
  target_contact_name?: string;
  /** For territory data: which territory this applies to (name or slug) */
  target_territory?: string;
}

export interface ExtractionResult {
  extractions: ExtractionField[];
}
