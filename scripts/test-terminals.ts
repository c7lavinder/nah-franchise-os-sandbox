/**
 * Test all workflow terminal/exit condition types.
 *
 * For each terminal type:
 * 1. Creates a test workflow with specific exit conditions
 * 2. Enrolls Denzel Lavinder
 * 3. Simulates the exit event via checkExitConditions()
 * 4. Verifies enrollment was exited (or not, for negative tests)
 * 5. Cleans up
 *
 * Usage: npx tsx scripts/test-terminals.ts
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
const TEST_USER_ID = "06155950-b974-4995-9d86-40beb7a4d8fd";

interface TerminalTest {
  name: string;
  exitConditions: Record<string, unknown>;
  simulatedEvent: string;
  simulatedPayload: Record<string, unknown>;
  expectExit: boolean;
}

const TESTS: TerminalTest[] = [
  {
    name: "subtask.completed (discovery-call)",
    exitConditions: {
      maxDays: 30,
      goalEvent: "subtask.completed",
      goalConditions: [{ field: "subTaskSlug", operator: "equals", value: "discovery-call" }],
      description: "When Discovery Call sub-task is completed",
    },
    simulatedEvent: "subtask.completed",
    simulatedPayload: {
      subTaskSlug: "discovery-call",
      subTaskName: "Discovery Call",
      stageSlug: "discovery",
      pipelineSlug: "sales",
    },
    expectExit: true,
  },
  {
    name: "subtask.completed (wrong sub-task — no exit)",
    exitConditions: {
      maxDays: 30,
      goalEvent: "subtask.completed",
      goalConditions: [{ field: "subTaskSlug", operator: "equals", value: "fdd-delivered" }],
      description: "When FDD Delivered sub-task is completed",
    },
    simulatedEvent: "subtask.completed",
    simulatedPayload: {
      subTaskSlug: "discovery-call", // doesn't match fdd-delivered
      pipelineSlug: "sales",
    },
    expectExit: false,
  },
  {
    name: "stage.advanced (to compliance)",
    exitConditions: {
      maxDays: 30,
      goalEvent: "stage.advanced",
      goalConditions: [{ field: "toStageSlug", operator: "equals", value: "compliance" }],
      description: "When contact reaches Compliance stage",
    },
    simulatedEvent: "stage.advanced",
    simulatedPayload: {
      pipelineSlug: "sales",
      toStageSlug: "compliance",
      toStageName: "Compliance",
      fromStageSlug: "discovery",
    },
    expectExit: true,
  },
  {
    name: "stage.advanced (wrong stage — no exit)",
    exitConditions: {
      maxDays: 30,
      goalEvent: "stage.advanced",
      goalConditions: [{ field: "toStageSlug", operator: "equals", value: "awarding" }],
      description: "When contact reaches Awarding stage",
    },
    simulatedEvent: "stage.advanced",
    simulatedPayload: {
      pipelineSlug: "sales",
      toStageSlug: "compliance", // doesn't match "awarding"
    },
    expectExit: false,
  },
  {
    name: "subtask.completed (any in sales pipeline)",
    exitConditions: {
      maxDays: 14,
      goalEvent: "subtask.completed",
      goalConditions: [{ field: "pipelineSlug", operator: "equals", value: "sales" }],
      description: "When any sub-task in Sales pipeline is completed",
    },
    simulatedEvent: "subtask.completed",
    simulatedPayload: {
      subTaskSlug: "intro-sms",
      pipelineSlug: "sales",
      stageSlug: "engagement",
    },
    expectExit: true,
  },
  {
    name: "wrong event type — no exit",
    exitConditions: {
      maxDays: 30,
      goalEvent: "subtask.completed",
      goalConditions: [{ field: "subTaskSlug", operator: "equals", value: "discovery-call" }],
      description: "When Discovery Call sub-task is completed",
    },
    simulatedEvent: "stage.advanced", // wrong event type
    simulatedPayload: {
      subTaskSlug: "discovery-call",
      pipelineSlug: "sales",
    },
    expectExit: false,
  },
  {
    name: "maxDays only (no goalEvent) — no exit on event",
    exitConditions: {
      maxDays: 30,
      description: "After 30 days",
    },
    simulatedEvent: "subtask.completed",
    simulatedPayload: { subTaskSlug: "anything" },
    expectExit: false, // maxDays is handled by scheduler, not event-based
  },
];

async function createTestWorkflowAndEnroll(
  test: TerminalTest
): Promise<{ workflowId: string; enrollmentId: string } | null> {
  // Create workflow
  const { data: wf, error: wfErr } = await supabase
    .from("workflows")
    .insert({
      name: `__TERM_TEST__ ${test.name}`,
      description: `Terminal test: ${test.name}`,
      workflow_type: "test",
      trigger_type: "manual",
      trigger_config: { event: "manual", conditions: [], description: "Manual" },
      exit_conditions: test.exitConditions,
      health_score: "C",
      status: "live",
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
    await supabase.from("workflows").delete().eq("id", wf.id);
    return null;
  }

  await supabase.from("workflows").update({ current_version_id: ver.id }).eq("id", wf.id);

  // Create dummy step
  await supabase.from("workflow_steps").insert({
    workflow_version_id: ver.id,
    step_number: 1,
    day_number: 1,
    step_type: "internal_note",
    content: "Terminal test step",
    requires_confirmation: false,
  });

  // Enroll Denzel
  const { data: enrollment, error: enrollErr } = await supabase
    .from("workflow_enrollments")
    .insert({
      workflow_id: wf.id,
      workflow_version_id: ver.id,
      ghl_contact_id: DENZEL_GHL_ID,
      contact_name: DENZEL_NAME,
      status: "active",
    })
    .select("id")
    .single();

  if (enrollErr || !enrollment) {
    await supabase.from("workflows").delete().eq("id", wf.id);
    return null;
  }

  return { workflowId: wf.id, enrollmentId: enrollment.id };
}

async function cleanup(workflowId: string) {
  await supabase.from("workflow_enrollments").delete().eq("workflow_id", workflowId);
  await supabase.from("workflows").delete().eq("id", workflowId);
}

async function runTerminalTest(test: TerminalTest): Promise<{ pass: boolean; detail: string }> {
  const setup = await createTestWorkflowAndEnroll(test);
  if (!setup) return { pass: false, detail: "Failed to create test workflow + enrollment" };

  try {
    const { checkExitConditions } = await import("../lib/workflows/enrollment");

    const result = await checkExitConditions(DENZEL_GHL_ID, test.simulatedEvent, test.simulatedPayload);

    // Check enrollment status
    const { data: enrollment } = await supabase
      .from("workflow_enrollments")
      .select("status, exit_reason, goal_achieved")
      .eq("id", setup.enrollmentId)
      .single();

    const wasExited = enrollment?.status === "completed" || enrollment?.status === "exited";

    if (test.expectExit && wasExited) {
      return { pass: true, detail: `Exited (${result.exited} exits, reason: "${enrollment?.exit_reason}")` };
    } else if (test.expectExit && !wasExited) {
      return { pass: false, detail: `Expected exit but enrollment still ${enrollment?.status}` };
    } else if (!test.expectExit && !wasExited) {
      return { pass: true, detail: `No exit (enrollment still ${enrollment?.status}) — correct` };
    } else {
      return { pass: false, detail: `Unexpected exit: ${enrollment?.status}, reason: "${enrollment?.exit_reason}"` };
    }
  } finally {
    await cleanup(setup.workflowId);
  }
}

async function main() {
  console.log("=== Workflow Terminal/Exit Condition Test Suite ===");
  console.log(`Contact: ${DENZEL_NAME} (${DENZEL_GHL_ID})\n`);

  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`  ${test.name.padEnd(45)} `);

    try {
      const result = await runTerminalTest(test);
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
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
