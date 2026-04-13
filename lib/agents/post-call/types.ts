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
}

export interface ExtractionResult {
  extractions: ExtractionField[];
}
