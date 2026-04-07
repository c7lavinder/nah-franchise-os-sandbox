/**
 * Sprint 2 Verification — Test 2: Webhook endpoint reachable on live deploy
 * POSTs a test contact to the production webhook, verifies DB write, cleans up.
 */

import { createClient } from "@supabase/supabase-js";

const LIVE_URL = "https://nah-franchise-os-sandbox.vercel.app";
const TEST_GHL_ID = "verify-test-contact-DELETEME";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const payload = {
    id: TEST_GHL_ID,
    firstName: "Verify",
    lastName: "Test",
    email: "verify-test+DELETEME@example.com",
    phone: "+15550000000",
    city: "Testville",
    state: "TX",
    source: "verify-script",
  };

  // POST to webhook
  console.log(`POSTing test contact to ${LIVE_URL}/api/webhooks/ghl/contacts ...`);
  const start = Date.now();

  const res = await fetch(`${LIVE_URL}/api/webhooks/ghl/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const elapsed = Date.now() - start;
  const body = await res.json();

  console.log(`Response: HTTP ${res.status} (${elapsed}ms)`);
  console.log(`Body: ${JSON.stringify(body)}`);

  if (!res.ok) {
    console.error(`❌ WEBHOOK ENDPOINT FAILED: HTTP ${res.status}`);
    return;
  }

  // Verify contact was created in Supabase
  console.log("\nVerifying Supabase writes...");

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, first_name, email")
    .eq("ghl_contact_id", TEST_GHL_ID)
    .maybeSingle();

  if (contact) {
    console.log(`✅ Contact created: ${contact.first_name} (${contact.email})`);
  } else {
    console.error("❌ Contact NOT found in contacts table — sync logic may have failed");
  }

  // Verify pipeline state
  if (contact) {
    const { data: state } = await supabase
      .from("contact_pipeline_state")
      .select("id, pipeline_id, current_stage_id, is_active")
      .eq("contact_id", contact.id)
      .maybeSingle();

    if (state) {
      console.log(`✅ Pipeline state created: pipeline=${state.pipeline_id}, stage=${state.current_stage_id}, active=${state.is_active}`);
    } else {
      console.error("❌ Pipeline state NOT found — auto-create may have failed");
    }
  }

  // Clean up
  console.log("\nCleaning up test data...");

  if (contact) {
    const { count: stateCount } = await supabase
      .from("contact_pipeline_state")
      .delete()
      .eq("contact_id", contact.id)
      .select("id", { count: "exact", head: true });
    console.log(`  Deleted ${stateCount ?? 0} pipeline state row(s)`);

    const { count: histCount } = await supabase
      .from("pipeline_stage_history")
      .delete()
      .in("contact_pipeline_state_id", [contact.id]) // won't match but safe
      .select("id", { count: "exact", head: true });

    const { count: contactCount } = await supabase
      .from("contacts")
      .delete()
      .eq("ghl_contact_id", TEST_GHL_ID)
      .select("id", { count: "exact", head: true });
    console.log(`  Deleted ${contactCount ?? 0} contact row(s)`);
  }

  // Verify cleanup
  const { data: verifyGone } = await supabase
    .from("contacts")
    .select("id")
    .eq("ghl_contact_id", TEST_GHL_ID)
    .maybeSingle();

  if (!verifyGone) {
    console.log("  ✅ Cleanup confirmed — test data removed");
  } else {
    console.error("  ❌ Cleanup failed — test contact still exists");
  }
}

main().catch((err) => { console.error("Script error:", err.message); process.exit(1); });
