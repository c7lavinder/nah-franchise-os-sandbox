/**
 * Intelligence Profile Bootstrap
 *
 * Creates candidate_intelligence profiles for all active pipeline leads
 * by reading existing GHL contact data and mapping custom fields to
 * intelligence fields.
 *
 * This is the "cold start" solution — when the Intel tab shows nothing
 * because no profiles exist yet, this service creates them from whatever
 * data GHL already has.
 *
 * Usage:
 * - Single contact: bootstrapContactProfile(contactId)
 * - All active leads: bootstrapAllActiveLeads()
 */

import { createServerClient } from "@/lib/supabase/server";
import { getContact, searchOpportunitiesPaginated } from "@/lib/ghl/client";
import { calculateScore } from "./scoring";
import { generateFlags } from "./flags";
import type { CandidateIntelligence, CandidateIntelligenceInsert, FundingPath, SpouseSupportive } from "./types";
import type { GHLContact, GHLCustomField } from "@/types/ghl";

/** Result from bootstrapping a single contact */
export interface BootstrapContactResult {
  contactId: string;
  contactName: string;
  created: boolean;
  skipped: boolean;
  score: number;
  flagCount: number;
  fieldsPopulated: number;
  error?: string;
}

/** Result from bootstrapping all active leads */
export interface BootstrapAllResult {
  created: number;
  skipped: number;
  errors: string[];
  details: BootstrapContactResult[];
}

/** Delay between GHL API calls to respect rate limits */
const RATE_LIMIT_MS = 200;

/**
 * Build a reverse lookup map: GHL field ID -> human-readable field name.
 * Uses the ghl_custom_fields table cached in Supabase.
 */
async function buildFieldIdToNameMap(): Promise<Map<string, string>> {
  const supabase = createServerClient();
  const { data: fieldMappings } = await supabase
    .from("ghl_custom_fields")
    .select("field_name, ghl_field_id")
    .eq("entity_type", "contact");

  const idToName = new Map<string, string>();
  if (fieldMappings) {
    for (const m of fieldMappings as { field_name: string; ghl_field_id: string }[]) {
      idToName.set(m.ghl_field_id, m.field_name);
    }
  }
  return idToName;
}

/**
 * Extract named custom field values from a GHL contact.
 * Returns a map of field name -> value.
 */
function extractCustomFields(
  contact: GHLContact,
  idToName: Map<string, string>
): Record<string, string> {
  const profile: Record<string, string> = {};
  for (const cf of contact.customFields) {
    const name = idToName.get(cf.id);
    if (name && cf.value) {
      profile[name] = cf.value;
    }
  }
  return profile;
}

/**
 * Map a GHL "Capital Source" / "Funding Source" value to our FundingPath enum.
 */
function mapFundingPath(value: string | undefined): FundingPath | null {
  if (!value) return null;
  const lower = value.toLowerCase();

  if (lower.includes("cash")) return "cash";
  if (lower.includes("robs") || lower.includes("rollover") || lower.includes("guidant")) return "guidant";
  if (lower.includes("sba") || lower.includes("loan")) return "sba";
  if (lower.includes("combination") || lower.includes("combo")) return "combination";
  if (lower.includes("undecided") || lower.includes("unknown")) return "unknown";

  // If they picked something specific but doesn't match above, it's a known path
  return "unknown";
}

/**
 * Map "Spouse Aware" GHL field to our SpouseSupportive enum.
 */
function mapSpouseSupportive(value: string | undefined): SpouseSupportive | null {
  if (!value) return null;
  const lower = value.toLowerCase();

  if (lower === "yes" || lower.includes("yes")) return "yes";
  if (lower === "no" || lower.includes("no")) return "no";
  if (lower.includes("n/a") || lower.includes("single")) return "unknown";
  return "unknown";
}

/**
 * Detect lead source from contact data — source field + tags.
 */
function detectLeadSource(contact: GHLContact, fields: Record<string, string>): string | null {
  // Direct source field
  if (contact.source) return contact.source;

  // Check tags for source hints
  const sourceTags = contact.tags.filter(
    (t) =>
      t.toLowerCase().includes("facebook") ||
      t.toLowerCase().includes("google") ||
      t.toLowerCase().includes("referral") ||
      t.toLowerCase().includes("organic") ||
      t.toLowerCase().includes("webinar") ||
      t.toLowerCase().includes("franchise show")
  );
  if (sourceTags.length > 0) return sourceTags[0];

  return null;
}

/**
 * Map GHL "Capital Availability" to a funding path hint.
 * "Confirmed" implies they have some path. "Unknown" maps to unknown.
 */
function mapCapitalAvailability(value: string | undefined): FundingPath | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "confirmed") return "cash"; // best guess — they confirmed capital
  if (lower === "unknown" || lower === "needs verification") return "unknown";
  return null;
}

/**
 * Map GHL "Business Ownership Experience" to boolean.
 */
function mapPriorBusinessOwner(value: string | undefined): boolean | null {
  if (!value) return null;
  return value.toLowerCase() === "yes";
}

/**
 * Map "Construction Knowledge" to our ConstructionComfort enum.
 */
function mapConstructionComfort(value: string | undefined): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "advanced" || lower === "intermediate") return "hands_on";
  if (lower === "basic") return "oversight_only";
  if (lower === "none") return "no_experience";
  return null;
}

/**
 * Map "Timeline to Open" to our Urgency enum.
 */
function mapUrgency(value: string | undefined): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "immediately" || lower === "1-3 months") return "ready_now";
  if (lower === "3-6 months") return "3_6_months";
  if (lower.includes("6-12") || lower.includes("12+") || lower === "exploring") return "exploring";
  return null;
}

/**
 * Map "Primary Goal" to our StatedMotivation enum.
 */
function mapMotivation(value: string | undefined): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("career change") || lower.includes("escape")) return "escape_corporate";
  if (lower.includes("wealth") || lower.includes("portfolio") || lower.includes("legacy")) return "wealth";
  if (lower.includes("full-time") || lower.includes("side income")) return "buy_job";
  return "other";
}

/**
 * Bootstrap a single contact's intelligence profile.
 * Fetches GHL contact data, maps custom fields, and creates the profile in Supabase.
 */
export async function bootstrapContactProfile(
  contactId: string,
  options?: {
    /** Pre-fetched field ID map (avoids re-fetching for batch) */
    fieldIdToName?: Map<string, string>;
    /** Pre-fetched contact (avoids re-fetching for batch) */
    contact?: GHLContact;
  }
): Promise<BootstrapContactResult> {
  const supabase = createServerClient();
  const locationId = process.env.GHL_LOCATION_ID ?? "";

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("candidate_intelligence")
    .select("id")
    .eq("contact_id", contactId)
    .single();

  if (existing) {
    return {
      contactId,
      contactName: "—",
      created: false,
      skipped: true,
      score: 0,
      flagCount: 0,
      fieldsPopulated: 0,
    };
  }

  // Fetch contact from GHL
  let contact: GHLContact;
  try {
    contact = options?.contact ?? await getContact(contactId);
  } catch (err) {
    return {
      contactId,
      contactName: "—",
      created: false,
      skipped: false,
      score: 0,
      flagCount: 0,
      fieldsPopulated: 0,
      error: `GHL fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const contactName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Unknown";

  // Resolve custom field IDs to names
  const idToName = options?.fieldIdToName ?? await buildFieldIdToNameMap();
  const fields = extractCustomFields(contact, idToName);

  // ─── Map GHL fields to intelligence profile ───

  // Funding path: prefer "Capital Source" > "Funding Source" > "Capital Availability" hint
  const fundingPath =
    mapFundingPath(fields["Capital Source"]) ??
    mapFundingPath(fields["Funding Source"]) ??
    mapCapitalAvailability(fields["Capital Availability"]);

  // Spouse supportive
  const spouseSupportive = mapSpouseSupportive(fields["Spouse Aware"]);

  // Operational fit
  const priorBusinessOwner = mapPriorBusinessOwner(fields["Business Ownership Experience"]);
  const constructionComfort = mapConstructionComfort(fields["Construction Knowledge"]);

  // Candidate profile
  const urgency = mapUrgency(fields["Timeline to Open"]);
  const statedMotivation = mapMotivation(fields["Primary Goal"]);

  // Trainual
  const trainualPct = fields["Trainual Completion Percent"]
    ? parseInt(fields["Trainual Completion Percent"], 10) || 0
    : 0;
  const trainualLastActivity = fields["Trainual Last Opened Date"] ?? null;

  // Lead source (from contact.source or tags)
  const leadSource = detectLeadSource(contact, fields);

  // Count how many fields we actually populated
  let fieldsPopulated = 0;
  if (fundingPath) fieldsPopulated++;
  if (spouseSupportive) fieldsPopulated++;
  if (priorBusinessOwner !== null) fieldsPopulated++;
  if (constructionComfort) fieldsPopulated++;
  if (urgency) fieldsPopulated++;
  if (statedMotivation) fieldsPopulated++;
  if (trainualPct > 0) fieldsPopulated++;
  if (trainualLastActivity) fieldsPopulated++;
  if (leadSource) fieldsPopulated++;

  // Build the insert record
  const insertRecord: CandidateIntelligenceInsert = {
    contact_id: contactId,
    ghl_location_id: locationId,

    // Financial
    net_worth_bucket: null,
    liquid_capital: null,
    illiquid_capital: null,
    funding_path: fundingPath,
    pfs_received: false,
    pfs_uploaded_url: null,
    outstanding_liabilities: null,
    financial_red_flags: null,

    // Personality
    zorakle_completed: false,
    zorakle_results: null,
    disc_profile: null,
    risk_tolerance_score: null,
    personality_flags: null,

    // Candidate profile
    stated_motivation: statedMotivation,
    prior_business_owner: priorBusinessOwner,
    prior_business_type: null,
    construction_comfort: constructionComfort,
    spouse_supportive: spouseSupportive,
    urgency,

    // Engagement
    trainual_completion_pct: trainualPct,
    trainual_last_activity: trainualLastActivity,
    avg_response_time_hours: null,
    homework_completion_rate: null,

    // Computed — will be recalculated
    current_score: 0,
    score_financial: 0,
    score_operational: 0,
    score_engagement: 0,
    score_momentum: 0,
    active_flags: null,
  };

  // Insert the profile
  const { error: insertError } = await supabase
    .from("candidate_intelligence")
    .insert(insertRecord);

  if (insertError) {
    return {
      contactId,
      contactName,
      created: false,
      skipped: false,
      score: 0,
      flagCount: 0,
      fieldsPopulated,
      error: `Supabase insert failed: ${insertError.message}`,
    };
  }

  // Now fetch the full profile to calculate score and flags
  const { data: profile } = await supabase
    .from("candidate_intelligence")
    .select("*")
    .eq("contact_id", contactId)
    .single();

  if (!profile) {
    return {
      contactId,
      contactName,
      created: true,
      skipped: false,
      score: 0,
      flagCount: 0,
      fieldsPopulated,
    };
  }

  const typedProfile = profile as CandidateIntelligence;

  // Calculate score
  const scoreResult = calculateScore(typedProfile);

  // Generate flags
  const flags = generateFlags(typedProfile);

  // Update with computed score and flags
  await supabase
    .from("candidate_intelligence")
    .update({
      current_score: scoreResult.total,
      score_financial: scoreResult.financial,
      score_operational: scoreResult.operational,
      score_engagement: scoreResult.engagement,
      score_momentum: scoreResult.momentum,
      active_flags: flags,
      updated_at: new Date().toISOString(),
    })
    .eq("contact_id", contactId);

  // Log the initial score to history
  await supabase.from("candidate_score_history").insert({
    contact_id: contactId,
    triggered_by: "bootstrap",
    trigger_id: null,
    score_before: 0,
    score_after: scoreResult.total,
    financial_before: 0,
    financial_after: scoreResult.financial,
    operational_before: 0,
    operational_after: scoreResult.operational,
    engagement_before: 0,
    engagement_after: scoreResult.engagement,
    momentum_before: 0,
    momentum_after: scoreResult.momentum,
    changes_explained: scoreResult.changes,
  });

  return {
    contactId,
    contactName,
    created: true,
    skipped: false,
    score: scoreResult.total,
    flagCount: flags.length,
    fieldsPopulated,
  };
}

/**
 * Bootstrap intelligence profiles for ALL active pipeline leads.
 * Fetches all open opportunities from GHL, then creates profiles for each.
 * Rate-limited at 200ms between GHL contact fetches.
 */
export async function bootstrapAllActiveLeads(): Promise<BootstrapAllResult> {
  const result: BootstrapAllResult = {
    created: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  // Fetch all open opportunities (paginated, up to 2000)
  let opportunities;
  try {
    opportunities = await searchOpportunitiesPaginated({ status: "open" });
  } catch (err) {
    result.errors.push(`Failed to fetch opportunities: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (!opportunities || opportunities.length === 0) {
    return result;
  }

  // Pre-fetch the field ID map once (instead of once per contact)
  const fieldIdToName = await buildFieldIdToNameMap();

  // Deduplicate by contactId (a contact could be in multiple pipelines)
  const uniqueContactIds = [...new Set(opportunities.map((o) => o.contactId))];

  // Process each contact with rate limiting
  for (let i = 0; i < uniqueContactIds.length; i++) {
    const contactId = uniqueContactIds[i];

    const contactResult = await bootstrapContactProfile(contactId, {
      fieldIdToName,
    });

    result.details.push(contactResult);

    if (contactResult.created) {
      result.created++;
    } else if (contactResult.skipped) {
      result.skipped++;
    }

    if (contactResult.error) {
      result.errors.push(`${contactId}: ${contactResult.error}`);
    }

    // Rate limit between GHL API calls (skip delay on last item)
    if (i < uniqueContactIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }
  }

  return result;
}
