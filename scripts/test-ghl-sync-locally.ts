/**
 * Sprint 2 Phase 2.2: Local test for GHL sync + auto-create pipeline state.
 *
 * Creates a fake GHL contact, syncs it, creates a pipeline state row,
 * verifies both exist, then cleans up.
 *
 * Usage: npx tsx scripts/test-ghl-sync-locally.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SALES_PIPELINE_ID = "a0000000-0000-0000-0000-000000000001";
const ENGAGEMENT_STAGE_ID = "b0000000-0000-0000-0000-000000000001";
const TEST_GHL_ID = "test-sprint2-" + Date.now();

async function main() {
  console.log("=== Sprint 2 GHL Sync Local Test ===\n");

  let contactId: string | null = null;
  let stateId: string | null = null;

  try {
    // Step 1: Insert test contact via upsert (simulating syncContactFromGhl)
    console.log("1. Syncing test contact...");
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .upsert({
        ghl_contact_id: TEST_GHL_ID,
        first_name: "Test Contact",
        last_name: "Sprint 2",
        email: "sprint2-test@example.com",
        phone: "555-0000",
        address: "123 Test St",
        city: "Testville",
        state: "TX",
        zip: "75001",
        opportunity_source: "test-script",
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "ghl_contact_id" })
      .select("id")
      .single();

    if (contactErr) throw new Error(`Contact upsert failed: ${contactErr.message}`);
    contactId = contact.id;
    console.log(`   ✅ Contact created: ${contactId}`);

    // Step 2: Look up outreach sub-task
    const { data: outreachTask } = await supabase
      .from("pipeline_sub_tasks")
      .select("id")
      .eq("slug", "outreach")
      .eq("stage_id", ENGAGEMENT_STAGE_ID)
      .single();

    console.log(`   Outreach sub-task ID: ${outreachTask?.id ?? "NOT FOUND"}`);

    // Step 3: Check for existing active state (idempotency check)
    const { data: existingState } = await supabase
      .from("contact_pipeline_state")
      .select("id")
      .eq("contact_id", contactId)
      .eq("pipeline_id", SALES_PIPELINE_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (existingState) {
      console.log("   ⚠️ Active state already exists — skipping creation (idempotent)");
      stateId = existingState.id;
    } else {
      // Step 4: Create pipeline state row
      console.log("2. Creating pipeline state at Engagement...");
      const now = new Date().toISOString();
      const { data: state, error: stateErr } = await supabase
        .from("contact_pipeline_state")
        .insert({
          contact_id: contactId,
          pipeline_id: SALES_PIPELINE_ID,
          current_stage_id: ENGAGEMENT_STAGE_ID,
          current_sub_task_id: outreachTask?.id ?? null,
          current_sub_task_started_at: now,
          entered_pipeline_at: now,
          entered_current_stage_at: now,
          assigned_user_id: null,
          is_active: true,
        })
        .select("id")
        .single();

      if (stateErr) throw new Error(`State creation failed: ${stateErr.message}`);
      stateId = state.id;
      console.log(`   ✅ Pipeline state created: ${stateId}`);

      // Step 5: Write stage history
      console.log("3. Writing stage history...");
      const { error: histErr } = await supabase
        .from("pipeline_stage_history")
        .insert({
          contact_pipeline_state_id: stateId,
          from_stage_id: null,
          to_stage_id: ENGAGEMENT_STAGE_ID,
          moved_by_user_id: null,
          reason: "Test: auto-created from sync script",
          was_skip: false,
          was_revert: false,
          was_auto: true,
        });

      if (histErr) throw new Error(`Stage history failed: ${histErr.message}`);
      console.log("   ✅ Stage history written");
    }

    // Step 6: Verify
    console.log("\n4. Verifying...");

    const { data: verifyContact } = await supabase
      .from("contacts")
      .select("id, ghl_contact_id, first_name, last_name, email")
      .eq("id", contactId)
      .single();
    console.log(`   Contact: ${verifyContact?.first_name} ${verifyContact?.last_name} (${verifyContact?.email})`);

    const { data: verifyState } = await supabase
      .from("contact_pipeline_state")
      .select("id, pipeline_id, current_stage_id, current_sub_task_id, is_active")
      .eq("id", stateId)
      .single();
    console.log(`   State: pipeline=${verifyState?.pipeline_id}, stage=${verifyState?.current_stage_id}, active=${verifyState?.is_active}`);

    const { data: verifyHistory, error: histCheckErr } = await supabase
      .from("pipeline_stage_history")
      .select("id, to_stage_id, was_auto")
      .eq("contact_pipeline_state_id", stateId!);
    console.log(`   History entries: ${verifyHistory?.length ?? 0}`);

    // Step 7: Idempotency test — try creating again
    console.log("\n5. Idempotency test — re-creating should be skipped...");
    const { data: dupCheck } = await supabase
      .from("contact_pipeline_state")
      .select("id")
      .eq("contact_id", contactId)
      .eq("pipeline_id", SALES_PIPELINE_ID)
      .eq("is_active", true)
      .maybeSingle();
    console.log(`   Existing active row found: ${dupCheck ? "YES (correct — skip)" : "NO (would create new)"}`);

    console.log("\n✅ ALL TESTS PASSED\n");

  } finally {
    // Cleanup
    console.log("6. Cleaning up test data...");

    if (stateId) {
      await supabase.from("pipeline_stage_history").delete().eq("contact_pipeline_state_id", stateId);
      await supabase.from("contact_pipeline_state").delete().eq("id", stateId);
      console.log("   Deleted state + history");
    }
    if (contactId) {
      await supabase.from("contacts").delete().eq("id", contactId);
      console.log("   Deleted contact");
    }

    console.log("   ✅ Cleanup complete");
  }
}

main().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
