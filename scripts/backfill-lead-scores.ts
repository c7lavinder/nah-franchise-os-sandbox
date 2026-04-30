/**
 * Backfill lead scores for all contacts missing scout_lead_score.
 * Runs directly against Supabase — no server needed.
 *
 * Run: source .env.local && npx tsx scripts/backfill-lead-scores.ts
 */

import { createClient } from "@supabase/supabase-js";
import { calculateLeadScore, buildScoringInputFromContact } from "../lib/profile/lead-scoring";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env vars required");

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all contacts without a score
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(
      "id, source, opportunity_source, capital_availability, territory_status, business_ownership_experience, investment_timeline, motivation_clarity, trainual_completion_pct, created_at, scout_lead_score"
    )
    .is("scout_lead_score", null)
    .eq("is_converted_franchisee", false)
    .is("merged_into_contact_id", null);

  if (error) throw new Error(`Fetch failed: ${error.message}`);

  console.log(`Found ${contacts.length} contacts without scores.\n`);

  const tiers: Record<string, number> = { Hot: 0, Warm: 0, Cool: 0, Cold: 0 };
  let updated = 0;
  let failed = 0;

  for (const contact of contacts) {
    try {
      const input = buildScoringInputFromContact(contact);
      const result = calculateLeadScore(input);
      tiers[result.tier]++;

      const { error: updateErr } = await supabase
        .from("contacts")
        .update({ scout_lead_score: result.total })
        .eq("id", contact.id);

      if (updateErr) {
        failed++;
      } else {
        updated++;
      }
    } catch {
      failed++;
    }
  }

  console.log(`Done: ${updated} scored, ${failed} failed`);
  console.log(`Tiers: Hot=${tiers.Hot} Warm=${tiers.Warm} Cool=${tiers.Cool} Cold=${tiers.Cold}`);
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
