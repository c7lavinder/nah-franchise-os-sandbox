/**
 * Bootstrap Intelligence Profiles — CLI Script
 *
 * Creates candidate_intelligence profiles for all active pipeline leads.
 * Calls GHL and Supabase directly (not through the API) to avoid Vercel timeouts.
 *
 * Usage: npx tsx scripts/bootstrap-intelligence.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GHL_API_KEY = process.env.GHL_API_KEY!;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GHL_BASE = "https://services.leadconnectorhq.com";
const ghlHeaders = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
};

async function ghlGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${GHL_BASE}${endpoint}`, { headers: ghlHeaders });
  if (!res.ok) throw new Error(`GHL ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface GHLOpp {
  id: string;
  contactId: string;
  name: string;
  status: string;
}

interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  tags: string[];
  customFields: { id: string; value: string }[];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("=== Intelligence Profile Bootstrap ===\n");

  // Get all pipelines and open opportunities
  console.log("Fetching pipelines from GHL...");
  const { pipelines } = await ghlGet<{ pipelines: { id: string; name: string }[] }>(
    `/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`
  );

  const allOpps: GHLOpp[] = [];
  for (const pipeline of pipelines) {
    console.log(`  Pipeline: ${pipeline.name}`);
    const { opportunities } = await ghlGet<{ opportunities: GHLOpp[] }>(
      `/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${pipeline.id}&status=open&limit=100`
    );
    allOpps.push(...(opportunities ?? []));
    await delay(200);
  }

  console.log(`\nFound ${allOpps.length} open opportunities\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const opp of allOpps) {
    const { data: existing } = await supabase
      .from("candidate_intelligence")
      .select("id")
      .eq("contact_id", opp.contactId)
      .single();

    if (existing) {
      console.log(`  ↻ SKIP: ${opp.name}`);
      skipped++;
      continue;
    }

    try {
      const { contact } = await ghlGet<{ contact: GHLContact }>(
        `/contacts/${opp.contactId}`
      );

      const { error } = await supabase
        .from("candidate_intelligence")
        .insert({
          contact_id: opp.contactId,
          ghl_location_id: GHL_LOCATION_ID,
          current_score: 0,
          score_financial: 0,
          score_operational: 0,
          score_engagement: 0,
          score_momentum: 0,
          spouse_supportive: "unknown",
          funding_path: "unknown",
          urgency: "exploring",
        });

      if (error) {
        console.log(`  ✗ ${opp.name} — ${error.message}`);
        errors++;
      } else {
        console.log(`  ✓ ${opp.name} (${contact.firstName} ${contact.lastName})`);
        created++;
      }
    } catch (err) {
      console.log(`  ✗ ${opp.name} — ${err instanceof Error ? err.message : "unknown"}`);
      errors++;
    }

    await delay(200);
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors`);

  const { count } = await supabase
    .from("candidate_intelligence")
    .select("id", { count: "exact", head: true });
  console.log(`Total profiles in database: ${count ?? 0}`);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
