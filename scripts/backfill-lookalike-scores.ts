/**
 * Backfill Lookalike Scores — Phase 10
 *
 * Computes rule-based lookalike scores for all contacts and stores
 * them in contact_profile_fields (field_name: "Lookalike Score" — the registry name;
 * the legacy "lookalike_score" spelling was renamed away in the G3 pass, 2026-08-09).
 *
 * Run: source .env.local && npx tsx scripts/backfill-lookalike-scores.ts [--dry-run]
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { calculateLookalikeScore, type LookalikeInput } from "../lib/intelligence/lookalike-scoring";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: ws as any },
});

const DRY_RUN = process.argv.includes("--dry-run");

/** Paginate through all rows matching a query to avoid 1000-row limit */
async function fetchAll<T>(table: string, select: string, filters?: (q: any) => any): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let offset = 0;

  while (true) {
    let q = supabase
      .from(table)
      .select(select)
      .range(offset, offset + PAGE - 1);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) {
      console.error(`fetchAll(${table}) error at offset ${offset}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  console.log(`\n=== Backfill Lookalike Scores${DRY_RUN ? " (DRY RUN)" : ""} ===\n`);

  // Fetch all contacts (paginated)
  const contacts = await fetchAll<{
    id: string;
    ghl_contact_id: string | null;
    opportunity_source: string | null;
    state: string | null;
    is_converted_franchisee: boolean;
  }>("contacts", "id, ghl_contact_id, opportunity_source, state, is_converted_franchisee");

  console.log(`Total contacts: ${contacts.length}`);

  // Profile field counts per contact (paginated — can be 100K+ rows)
  const pfRows = await fetchAll<{ contact_id: string }>("contact_profile_fields", "contact_id");
  console.log(`Profile field rows fetched: ${pfRows.length}`);

  const profileCountByContact = new Map<string, number>();
  for (const row of pfRows) {
    profileCountByContact.set(row.contact_id, (profileCountByContact.get(row.contact_id) ?? 0) + 1);
  }

  // Call counts per contact (paginated)
  const callRows = await fetchAll<{ contact_id: string }>("call_participants", "contact_id");
  console.log(`Call participant rows fetched: ${callRows.length}`);

  const callCountByContact = new Map<string, number>();
  for (const row of callRows) {
    callCountByContact.set(row.contact_id, (callCountByContact.get(row.contact_id) ?? 0) + 1);
  }

  // Commitment counts + fulfilled per contact (paginated)
  const commitRows = await fetchAll<{ contact_id: string; status: string }>("commitments", "contact_id, status");
  console.log(`Commitment rows fetched: ${commitRows.length}`);

  const commitCountByContact = new Map<string, number>();
  const fulfilledCountByContact = new Map<string, number>();
  for (const row of commitRows) {
    commitCountByContact.set(row.contact_id, (commitCountByContact.get(row.contact_id) ?? 0) + 1);
    if (row.status === "fulfilled") {
      fulfilledCountByContact.set(row.contact_id, (fulfilledCountByContact.get(row.contact_id) ?? 0) + 1);
    }
  }

  // GHL ID mapping
  const uuidToGhl = new Map<string, string>();
  for (const c of contacts) {
    if (c.ghl_contact_id) {
      uuidToGhl.set(c.id, c.ghl_contact_id);
    }
  }

  // Candidate intelligence (paginated)
  const ciRows = await fetchAll<{
    contact_id: string;
    current_score: number;
    funding_path: string | null;
    pfs_received: boolean;
    prior_business_owner: boolean | null;
    construction_comfort: string | null;
    spouse_supportive: string | null;
    trainual_completion_pct: number | null;
    avg_response_time_hours: number | null;
    urgency: string | null;
  }>(
    "candidate_intelligence",
    "contact_id, current_score, funding_path, pfs_received, prior_business_owner, construction_comfort, spouse_supportive, trainual_completion_pct, avg_response_time_hours, urgency"
  );
  console.log(`Candidate intelligence rows fetched: ${ciRows.length}`);

  const intelByGhl = new Map<string, (typeof ciRows)[0]>();
  for (const ci of ciRows) {
    intelByGhl.set(ci.contact_id, ci);
  }

  // Capital availability from profile fields
  const capitalFields = await fetchAll<{ contact_id: string; field_value: any }>(
    "contact_profile_fields",
    "contact_id, field_value",
    (q: any) => q.eq("field_name", "NonRetirementCapitalAvailable")
  );

  const capitalByContact = new Map<string, string>();
  for (const row of capitalFields) {
    capitalByContact.set(row.contact_id, String(row.field_value ?? ""));
  }

  // Compute scores
  const results: Array<{ contactId: string; score: number; tier: string }> = [];
  const tierCounts = new Map<string, number>();

  for (const contact of contacts) {
    const ghlId = uuidToGhl.get(contact.id);
    const intel = ghlId ? intelByGhl.get(ghlId) : null;
    const commitTotal = commitCountByContact.get(contact.id) ?? 0;
    const fulfilledTotal = fulfilledCountByContact.get(contact.id) ?? 0;

    const input: LookalikeInput = {
      profileFieldCount: profileCountByContact.get(contact.id) ?? 0,
      opportunitySource: contact.opportunity_source ?? null,
      state: contact.state ?? null,
      callCount: callCountByContact.get(contact.id) ?? 0,
      commitmentCount: commitTotal,
      commitmentFulfillmentRate: commitTotal > 0 ? fulfilledTotal / commitTotal : null,
      capitalAvailability: capitalByContact.get(contact.id) ?? null,
      fundingPath: intel?.funding_path ?? null,
      hasPfs: intel?.pfs_received ?? false,
      intelligenceScore: intel?.current_score ?? null,
      priorBusinessOwner: intel?.prior_business_owner ?? null,
      constructionComfort: intel?.construction_comfort ?? null,
      spouseSupportive: intel?.spouse_supportive ?? null,
      trainualCompletionPct: intel?.trainual_completion_pct ?? null,
      avgResponseTimeHours: intel?.avg_response_time_hours ?? null,
      urgency: intel?.urgency ?? null,
    };

    const result = calculateLookalikeScore(input);
    results.push({ contactId: contact.id, score: result.score, tier: result.tier });
    tierCounts.set(result.tier, (tierCounts.get(result.tier) ?? 0) + 1);
  }

  // Print distribution
  console.log("\nTier distribution:");
  for (const [tier, count] of [...tierCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count} (${Math.round((count / results.length) * 100)}%)`);
  }

  const scores = results.map((r) => r.score).sort((a, b) => a - b);
  console.log(`\nScore distribution:`);
  console.log(`  Min: ${scores[0]}, Max: ${scores[scores.length - 1]}`);
  console.log(`  Median: ${scores[Math.floor(scores.length / 2)]}`);
  console.log(`  Mean: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}`);

  // Top 20
  const top20 = [...results].sort((a, b) => b.score - a.score).slice(0, 20);
  console.log(`\nTop 20 lookalike scores:`);
  for (const r of top20) {
    const c = contacts.find((c) => c.id === r.contactId);
    const converted = c?.is_converted_franchisee ? " (CONVERTED)" : "";
    console.log(`  ${r.score} (${r.tier}) — ${r.contactId.slice(0, 8)}${converted}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No writes performed.");
    return;
  }

  // Write scores to contact_profile_fields
  console.log(`\nWriting ${results.length} scores to contact_profile_fields...`);

  const BATCH_SIZE = 50;
  let written = 0;

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const rows = batch.map((r) => ({
      contact_id: r.contactId,
      field_name: "Lookalike Score",
      field_value: { score: r.score, tier: r.tier },
      last_updated_by: "system" as const,
      last_updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("contact_profile_fields")
      .upsert(rows, { onConflict: "contact_id,field_name" });

    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
    } else {
      written += batch.length;
    }
  }

  console.log(`Done. ${written}/${results.length} scores written.`);
}

main().catch(console.error);
