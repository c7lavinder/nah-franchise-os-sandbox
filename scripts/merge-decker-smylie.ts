/**
 * One-off: merge Shannon Smylie (ff11625c) into Ryan Decker's journey
 * (701cd03d) as co_primary, and close her separate journey with the
 * merge reason logged. Ryan's MURFTN territory-level jps rows stay as-is.
 *
 * Run with --live to apply. Dry-run by default.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const RYAN_JOURNEY_ID = "701cd03d-dc82-4224-9ac6-0a5a1b9d6f62";
const SHANNON_CONTACT_ID = "ff11625c-f6ae-4d47-9405-cb75c057f6eb";
const SHANNON_JOURNEY_ID = "18a53986-6498-470b-8ac4-36b212413d8c";

async function main(dryRun: boolean) {
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  // 0. Sanity-read what we're about to mutate.
  const { data: ryanJourney } = await supabase.from("journeys").select("id, name, status, primary_contact_id").eq("id", RYAN_JOURNEY_ID).single();
  const { data: shannonJourney } = await supabase.from("journeys").select("id, name, status").eq("id", SHANNON_JOURNEY_ID).single();
  const { data: shannonContact } = await supabase.from("contacts").select("id, first_name, last_name, ghl_contact_id").eq("id", SHANNON_CONTACT_ID).single();
  console.log("Target journey:", ryanJourney);
  console.log("Source journey (to close):", shannonJourney);
  console.log("Shannon contact:", shannonContact);

  // 1. Add Shannon as co_primary member of Ryan's journey.
  console.log("\n1. Add Shannon → Ryan's journey as co_primary");
  if (!dryRun) {
    const { error } = await supabase.from("journey_contacts").insert({
      journey_id: RYAN_JOURNEY_ID,
      contact_id: SHANNON_CONTACT_ID,
      role: "co_primary",
    });
    if (error && !error.message.includes("uniq_active_journey_contact")) {
      console.error("  FAIL:", error.message);
      return;
    }
    console.log("  done");
  } else {
    console.log("  would insert { journey_id, contact_id, role: 'co_primary' }");
  }

  // 2. Close Shannon's separate journey — mark all active memberships left_at,
  //    close all active jps rows (she has none but defensive), flip the journey
  //    itself to status='closed' with close_reason='split' (re-using the split
  //    enum value; no dedicated "merged" value exists and plan calls for splits
  //    to use close_reason='split'; merges are the inverse so same bucket is ok).
  const now = new Date().toISOString();
  console.log("\n2. Close Shannon's separate journey");
  if (!dryRun) {
    await supabase.from("journey_contacts").update({ left_at: now })
      .eq("journey_id", SHANNON_JOURNEY_ID).is("left_at", null);
    await supabase.from("journey_pipeline_state").update({ is_active: false, closed_reason: "split", closed_at: now })
      .eq("journey_id", SHANNON_JOURNEY_ID).eq("is_active", true);
    await supabase.from("journeys").update({ status: "closed", close_reason: "split" })
      .eq("id", SHANNON_JOURNEY_ID);
    console.log("  done");
  } else {
    console.log("  would mark all members left_at=now(), all active jps rows is_active=false, journey status=closed close_reason=split");
  }

  // 3. Verify.
  console.log("\n3. Verification");
  const { data: finalMembers } = await supabase
    .from("journey_contacts")
    .select("role, contact_id, left_at, contacts(first_name, last_name)")
    .eq("journey_id", RYAN_JOURNEY_ID).is("left_at", null);
  console.log("Ryan's active members:", finalMembers);

  const { data: shannonJourneyAfter } = await supabase.from("journeys").select("status, close_reason").eq("id", SHANNON_JOURNEY_ID).single();
  console.log("Shannon's old journey state:", shannonJourneyAfter);
}

void main(process.argv.includes("--live") ? false : true);
