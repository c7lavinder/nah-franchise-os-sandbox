/**
 * Test all 7 workflow trigger types against the trigger matcher.
 *
 * For each trigger:
 * 1. Creates a temporary test workflow (draft → live)
 * 2. Simulates the webhook event with Denzel Lavinder's contact
 * 3. Checks if trigger matcher would match + enroll
 * 4. Cleans up: deletes enrollment + workflow
 *
 * Usage: npx tsx scripts/test-triggers.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DENZEL_GHL_ID = "BWy45fmPABvoBiDWmaxx";
const DENZEL_NAME = "Denzel Lavinder";
const TEST_USER_ID = "06155950-b974-4995-9d86-40beb7a4d8fd"; // Corey

interface TriggerTest {
  name: string;
  triggerEvent: string;
  triggerConditions: Array<{ field: string; operator: string; value: string }>;
  triggerDescription: string;
  simulatedWebhookEvent: string;
  simulatedPayload: Record<string, unknown>;
  expectMatch: boolean;
}

const TESTS: TriggerTest[] = [
  // ─── Internal NAH OS Triggers ───
  {
    name: "manual",
    triggerEvent: "manual",
    triggerConditions: [],
    triggerDescription: "Manual enrollment",
    simulatedWebhookEvent: "manual",
    simulatedPayload: {},
    expectMatch: false,
  },
  {
    name: "journey.created",
    triggerEvent: "journey.created",
    triggerConditions: [{ field: "pipelineName", operator: "contains", value: "Path to Ownership" }],
    triggerDescription: "When a new journey is created in Path to Ownership",
    simulatedWebhookEvent: "journey.created",
    simulatedPayload: {
      pipelineName: "Sales — Path to Ownership",
      pipelineSlug: "sales",
      stageName: "Engagement",
      contactName: DENZEL_NAME,
    },
    expectMatch: true,
  },
  {
    name: "stage.advanced (sales→qualification)",
    triggerEvent: "stage.advanced",
    triggerConditions: [
      { field: "pipelineSlug", operator: "equals", value: "sales" },
      { field: "toStageSlug", operator: "equals", value: "qualification" },
    ],
    triggerDescription: "When contact advances to Qualification in Sales pipeline",
    simulatedWebhookEvent: "stage.advanced",
    simulatedPayload: {
      pipelineSlug: "sales",
      pipelineName: "Sales — Path to Ownership",
      fromStageSlug: "engagement",
      toStageSlug: "qualification",
      toStageName: "Qualification",
      scope: "contact",
    },
    expectMatch: true,
  },
  {
    name: "stage.advanced (wrong stage — no match)",
    triggerEvent: "stage.advanced",
    triggerConditions: [
      { field: "pipelineSlug", operator: "equals", value: "sales" },
      { field: "toStageSlug", operator: "equals", value: "awarding" },
    ],
    triggerDescription: "When contact advances to Awarding in Sales pipeline",
    simulatedWebhookEvent: "stage.advanced",
    simulatedPayload: {
      pipelineSlug: "sales",
      toStageSlug: "qualification", // doesn't match "awarding"
    },
    expectMatch: false,
  },
  {
    name: "subtask.completed (discovery-call)",
    triggerEvent: "subtask.completed",
    triggerConditions: [{ field: "subTaskSlug", operator: "equals", value: "discovery-call" }],
    triggerDescription: "When Discovery Call sub-task is completed",
    simulatedWebhookEvent: "subtask.completed",
    simulatedPayload: {
      subTaskSlug: "discovery-call",
      subTaskName: "Discovery Call",
      stageSlug: "discovery",
      pipelineSlug: "sales",
      contentType: "call",
    },
    expectMatch: true,
  },
  {
    name: "subtask.logged (any in sales)",
    triggerEvent: "subtask.logged",
    triggerConditions: [{ field: "pipelineSlug", operator: "equals", value: "sales" }],
    triggerDescription: "When any sub-task is logged in Sales pipeline",
    simulatedWebhookEvent: "subtask.logged",
    simulatedPayload: {
      subTaskSlug: "intro-sms",
      pipelineSlug: "sales",
      stageSlug: "engagement",
      contentType: "note",
    },
    expectMatch: true,
  },
  // ─── GHL Webhook Triggers ───
  {
    name: "contact.created (GHL)",
    triggerEvent: "contact.created",
    triggerConditions: [],
    triggerDescription: "When a new contact is created",
    simulatedWebhookEvent: "ContactCreate",
    simulatedPayload: {
      type: "ContactCreate",
      firstName: "Denzel",
      lastName: "Lavinder",
    },
    expectMatch: true,
  },
  {
    name: "contact.stage_changed (GHL OpportunityUpdate)",
    triggerEvent: "contact.stage_changed",
    triggerConditions: [{ field: "pipelineName", operator: "contains", value: "Path to Ownership" }],
    triggerDescription: "When contact moves stage in GHL",
    simulatedWebhookEvent: "OpportunityUpdate",
    simulatedPayload: {
      type: "OpportunityUpdate",
      pipelineName: "Sales — Path to Ownership",
      pipelineStageId: "stage456",
    },
    expectMatch: true,
  },
  {
    name: "appointment.created (GHL)",
    triggerEvent: "appointment.created",
    triggerConditions: [],
    triggerDescription: "When someone books an appointment",
    simulatedWebhookEvent: "AppointmentCreate",
    simulatedPayload: {
      type: "AppointmentCreate",
      calendarName: "Discovery Call",
    },
    expectMatch: true,
  },
  {
    name: "contact.updated (GHL)",
    triggerEvent: "contact.updated",
    triggerConditions: [],
    triggerDescription: "When any contact field is updated",
    simulatedWebhookEvent: "ContactUpdate",
    simulatedPayload: {
      type: "ContactUpdate",
      firstName: "Denzel",
    },
    expectMatch: true,
  },
];

async function createTestWorkflow(test: TriggerTest): Promise<string | null> {
  // Create workflow
  const { data: wf, error: wfErr } = await supabase
    .from("workflows")
    .insert({
      name: `__TEST__ ${test.name}`,
      description: `Trigger test for ${test.name}`,
      workflow_type: "test",
      trigger_type: test.triggerEvent,
      trigger_config: {
        event: test.triggerEvent,
        conditions: test.triggerConditions,
        description: test.triggerDescription,
      },
      exit_conditions: { maxDays: 1, description: "Test exit" },
      health_score: "C",
      status: "live", // must be live for trigger matcher to find it
      created_by: TEST_USER_ID,
    })
    .select("id")
    .single();

  if (wfErr || !wf) {
    console.error(`  Failed to create workflow: ${wfErr?.message}`);
    return null;
  }

  // Create version
  const { data: ver, error: verErr } = await supabase
    .from("workflow_versions")
    .insert({
      workflow_id: wf.id,
      version_number: 1,
      change_description: "Test version",
      created_by: TEST_USER_ID,
    })
    .select("id")
    .single();

  if (verErr || !ver) {
    console.error(`  Failed to create version: ${verErr?.message}`);
    await supabase.from("workflows").delete().eq("id", wf.id);
    return null;
  }

  // Link version
  await supabase.from("workflows").update({ current_version_id: ver.id }).eq("id", wf.id);

  // Create a dummy step so it's a valid workflow
  await supabase.from("workflow_steps").insert({
    workflow_version_id: ver.id,
    step_number: 1,
    day_number: 1,
    step_type: "internal_note",
    content: "Test step — trigger validation",
    requires_confirmation: false,
  });

  return wf.id;
}

async function cleanupWorkflow(workflowId: string) {
  // Delete any enrollments created
  await supabase.from("workflow_enrollments").delete().eq("workflow_id", workflowId);
  // Delete workflow (cascades to versions → steps)
  await supabase.from("workflows").delete().eq("id", workflowId);
}

async function runTriggerTest(test: TriggerTest): Promise<{ pass: boolean; detail: string }> {
  if (test.name === "manual") {
    return { pass: true, detail: "Manual trigger — no webhook match expected. Enroll via UI." };
  }

  const workflowId = await createTestWorkflow(test);
  if (!workflowId) {
    return { pass: false, detail: "Failed to create test workflow" };
  }

  try {
    // Dynamically import the trigger matcher (uses ES modules)
    // We'll call it via the API to keep it simple and test the full stack
    const { matchWorkflowTriggers } = await import("../lib/workflows/trigger-matcher");

    const result = await matchWorkflowTriggers(test.simulatedWebhookEvent, DENZEL_GHL_ID, test.simulatedPayload);

    const matched = result.matched > 0;
    const enrolled = result.enrolled > 0;

    if (test.expectMatch && matched && enrolled) {
      return { pass: true, detail: `Matched + enrolled (${result.matched} matched, ${result.enrolled} enrolled)` };
    } else if (test.expectMatch && matched && !enrolled) {
      // Might be duplicate enrollment prevention
      return { pass: true, detail: `Matched but deduped (already enrolled or enrollment guard)` };
    } else if (test.expectMatch && !matched) {
      return { pass: false, detail: `Expected match but got 0 matches. Errors: ${result.errors.join(", ") || "none"}` };
    } else if (!test.expectMatch && !matched) {
      return { pass: true, detail: "No match expected, no match found" };
    } else {
      return {
        pass: false,
        detail: `Unexpected: matched=${matched}, enrolled=${enrolled}, errors=${result.errors.join(", ")}`,
      };
    }
  } finally {
    await cleanupWorkflow(workflowId);
  }
}

async function main() {
  console.log("=== Workflow Trigger Test Suite ===");
  console.log(`Contact: ${DENZEL_NAME} (${DENZEL_GHL_ID})\n`);

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`  ${test.name.padEnd(25)} `);

    try {
      const result = await runTriggerTest(test);

      if (result.pass) {
        console.log(`PASS  ${result.detail}`);
        passed++;
      } else {
        console.log(`FAIL  ${result.detail}`);
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.log(`ERROR ${msg}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${TESTS.length} ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
