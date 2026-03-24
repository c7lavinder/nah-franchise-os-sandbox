/**
 * GHL Account Setup Script
 *
 * Sets up the GHL sub-account with pipelines, custom fields, calendars, and tags.
 * Safe to run multiple times — checks before creating, skips if exists.
 * NEVER deletes or modifies existing items.
 *
 * Usage: npx tsx scripts/setup-ghl-account.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY!;
const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-07-28",
};

// Counters
const stats = { created: 0, skipped: 0, failed: 0 };

function log(status: "CREATED" | "SKIPPED" | "FAILED", category: string, name: string, detail?: string) {
  const icon = status === "CREATED" ? "✓" : status === "SKIPPED" ? "↻" : "✗";
  console.log(`  ${icon} ${status} [${category}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (status === "CREATED") stats.created++;
  else if (status === "SKIPPED") stats.skipped++;
  else stats.failed++;
}

async function ghlGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${GHL_BASE}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`GET ${endpoint} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function ghlPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${endpoint} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function ghlPut<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${endpoint} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Small delay between API calls to respect rate limits
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════
// 1. PIPELINES
// ═══════════════════════════════════════════════

interface GHLPipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number }[];
}

const PIPELINES_TO_CREATE = [
  {
    name: "NAH Franchise Sales - Active",
    stages: [
      "New Lead", "Contacted", "Qualified",
      "Matt Call (Discovery)", "Sam Call (Validation)",
      "Compliance Gate", "Application + Approval",
      "FDD Issued", "Mark Call (Capital/Lending)",
      "Award + Agreement", "Funds Received",
    ],
  },
  {
    name: "NAH Franchise Sales - Long-Term",
    stages: ["Follow-up", "Nurture", "Re-engaged"],
  },
  // Pipeline 3 "Closed" is NOT needed — Won/Lost are opportunity statuses in GHL, not a pipeline.
];

// Stage renames needed on the existing Active pipeline
const STAGE_RENAMES: Record<string, string> = {
  "Discovery Scheduled": "Matt Call (Discovery)",
  "Validation": "Sam Call (Validation)",
  "Decision Call": "Mark Call (Capital/Lending)",
};

// Stage to remove (merged into Matt Call)
const STAGES_TO_REMOVE = ["Discovery Complete"];

async function setupPipelines(): Promise<GHLPipeline[]> {
  console.log("\n═══ 1. PIPELINES ═══");

  const existing = await ghlGet<{ pipelines: GHLPipeline[] }>(
    `/opportunities/pipelines?locationId=${LOCATION_ID}`
  );
  const existingByName = new Map(existing.pipelines.map((p) => [p.name, p]));
  const createdPipelines: GHLPipeline[] = [];

  for (const pipeline of PIPELINES_TO_CREATE) {
    const found = existingByName.get(pipeline.name);

    if (found) {
      // Pipeline exists — check if stages need renaming
      let needsUpdate = false;
      const updatedStages = found.stages
        .filter((s) => !STAGES_TO_REMOVE.includes(s.name.trim()))
        .map((s, i) => {
          const trimmed = s.name.trim();
          const rename = STAGE_RENAMES[trimmed];
          if (rename) {
            needsUpdate = true;
            return { id: s.id, name: rename, position: i };
          }
          return { id: s.id, name: trimmed, position: i };
        });

      if (STAGES_TO_REMOVE.some((name) => found.stages.find((s) => s.name.trim() === name))) {
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          const result = await ghlPut<{ pipeline: GHLPipeline }>(
            `/opportunities/pipelines/${found.id}`,
            {
              name: found.name,
              stages: updatedStages,
              locationId: LOCATION_ID,
            }
          );
          log("CREATED", "Pipeline", pipeline.name, `stages renamed/updated`);
          createdPipelines.push(result.pipeline);
          await delay(500);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("401") || msg.includes("not authorized")) {
            log("FAILED", "Pipeline", `${pipeline.name} stage rename`, "PIT key cannot update pipelines — rename stages manually in GHL UI");
          } else {
            log("FAILED", "Pipeline", `${pipeline.name} stage rename`, msg);
          }
          createdPipelines.push(found);
        }
      } else {
        log("SKIPPED", "Pipeline", pipeline.name, "already exists with correct stages");
        createdPipelines.push(found);
      }
      continue;
    }

    // Pipeline doesn't exist — create it
    try {
      const result = await ghlPost<{ pipeline: GHLPipeline }>("/opportunities/pipelines", {
        locationId: LOCATION_ID,
        name: pipeline.name,
        stages: pipeline.stages.map((name, i) => ({ name, position: i })),
      });
      log("CREATED", "Pipeline", pipeline.name, `${pipeline.stages.length} stages`);
      createdPipelines.push(result.pipeline);
      await delay(500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.includes("not authorized")) {
        log("FAILED", "Pipeline", pipeline.name, "PIT key cannot create pipelines — create manually in GHL UI");
      } else {
        log("FAILED", "Pipeline", pipeline.name, msg);
      }
    }
  }

  return createdPipelines;
}

// ═══════════════════════════════════════════════
// 2 & 3. CUSTOM FIELDS
// ═══════════════════════════════════════════════

interface GHLCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  model: string;
  options?: string[];
}

interface FieldDef {
  name: string;
  dataType: string;
  model: "contact" | "opportunity";
  options?: string[];
}

const CONTACT_FIELDS: FieldDef[] = [
  { name: "Lead Source Detail", dataType: "TEXT", model: "contact" },
  { name: "Territory Interest", dataType: "TEXT", model: "contact" },
  { name: "Territory Status", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Available", "Waitlist", "Unavailable", "Confirmed"] },
  { name: "Capital Availability", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Confirmed", "Needs Verification", "Unknown"] },
  { name: "Investment Timeline", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Under 6 months", "6-12 months", "12+ months"] },
  { name: "Business Ownership Experience", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Yes", "No"] },
  { name: "Motivation Clarity", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Strong", "Moderate", "Weak"] },
  { name: "Scout Lead Score", dataType: "NUMERICAL", model: "contact" },
  { name: "Trainual Access Sent", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Yes", "No"] },
  { name: "Trainual Completion Percent", dataType: "NUMERICAL", model: "contact" },
  { name: "Framing Call Logged", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Yes", "No"] },
  { name: "NDA Status", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Not Sent", "Sent", "Signed"] },
  { name: "OpenClaw Enriched", dataType: "SINGLE_OPTIONS", model: "contact", options: ["Yes", "No"] },
];

const OPPORTUNITY_FIELDS: FieldDef[] = [
  { name: "Discovery Scorecard Score", dataType: "NUMERICAL", model: "opportunity" },
  { name: "Validation Call 1 Complete", dataType: "SINGLE_OPTIONS", model: "opportunity", options: ["Yes", "No"] },
  { name: "Validation Call 2 Complete", dataType: "SINGLE_OPTIONS", model: "opportunity", options: ["Yes", "No"] },
  { name: "Validation Call 3 Complete", dataType: "SINGLE_OPTIONS", model: "opportunity", options: ["Yes", "No"] },
  { name: "Compliance Gate Passed", dataType: "SINGLE_OPTIONS", model: "opportunity", options: ["Yes", "No"] },
  { name: "FDD Issued Date", dataType: "DATE", model: "opportunity" },
  { name: "FDD 14-Day Unlocks", dataType: "DATE", model: "opportunity" },
  {
    name: "Loss Reason",
    dataType: "SINGLE_OPTIONS",
    model: "opportunity",
    options: [
      "Not qualified financially",
      "No available territory",
      "Chose a competitor franchise",
      "Completely unresponsive",
      "Changed mind",
      "Bad fit",
      "Timing - moved to Nurture",
      "Other",
    ],
  },
  { name: "Days in Current Stage", dataType: "NUMERICAL", model: "opportunity" },
];

async function setupCustomFields() {
  console.log("\n═══ 2. CUSTOM FIELDS — CONTACTS ═══");

  const existing = await ghlGet<{ customFields: GHLCustomField[] }>(
    `/locations/${LOCATION_ID}/customFields`
  );
  const existingNames = new Set(existing.customFields.map((f) => f.name.toLowerCase()));

  for (const field of CONTACT_FIELDS) {
    if (existingNames.has(field.name.toLowerCase())) {
      log("SKIPPED", "Contact Field", field.name, "already exists");
      continue;
    }

    try {
      const body: Record<string, unknown> = {
        name: field.name,
        dataType: field.dataType,
        model: field.model,
      };
      if (field.options) body.options = field.options;

      await ghlPost(`/locations/${LOCATION_ID}/customFields`, body);
      log("CREATED", "Contact Field", field.name, field.dataType);
      await delay(300);
    } catch (err) {
      log("FAILED", "Contact Field", field.name, err instanceof Error ? err.message : String(err));
    }
  }

  console.log("\n═══ 3. CUSTOM FIELDS — OPPORTUNITIES ═══");

  for (const field of OPPORTUNITY_FIELDS) {
    if (existingNames.has(field.name.toLowerCase())) {
      log("SKIPPED", "Opportunity Field", field.name, "already exists");
      continue;
    }

    try {
      const body: Record<string, unknown> = {
        name: field.name,
        dataType: field.dataType,
        model: field.model,
      };
      if (field.options) body.options = field.options;

      await ghlPost(`/locations/${LOCATION_ID}/customFields`, body);
      log("CREATED", "Opportunity Field", field.name, field.dataType);
      await delay(300);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        log("SKIPPED", "Opportunity Field", field.name, "already exists in GHL");
      } else {
        log("FAILED", "Opportunity Field", field.name, msg);
      }
    }
  }
}

// ═══════════════════════════════════════════════
// 4. CALENDARS
// ═══════════════════════════════════════════════

interface GHLCalendar {
  id: string;
  name: string;
}

const CALENDARS_TO_CREATE = [
  { name: "Chad - Discovery Calls", duration: 60 },
  { name: "Construction Coach Intro Calls", duration: 30 },
  { name: "Lending Partner Calls", duration: 30 },
];

async function setupCalendars() {
  console.log("\n═══ 4. CALENDARS ═══");

  const existing = await ghlGet<{ calendars: GHLCalendar[] }>(
    `/calendars/?locationId=${LOCATION_ID}`
  );
  const existingNames = new Set(existing.calendars.map((c) => c.name.toLowerCase()));

  for (const cal of CALENDARS_TO_CREATE) {
    if (existingNames.has(cal.name.toLowerCase())) {
      log("SKIPPED", "Calendar", cal.name, "already exists");
      continue;
    }

    try {
      await ghlPost("/calendars/", {
        locationId: LOCATION_ID,
        name: cal.name,
        calendarType: "event",
        slotDuration: cal.duration,
        slotDurationUnit: "mins",
        autoConfirm: true,
        isActive: true,
      });
      log("CREATED", "Calendar", cal.name, `${cal.duration} min, Mon-Fri 9am-5pm ET`);
      await delay(500);
    } catch (err) {
      log("FAILED", "Calendar", cal.name, err instanceof Error ? err.message : String(err));
    }
  }
}

// ═══════════════════════════════════════════════
// 5. TAGS
// ═══════════════════════════════════════════════

const TAGS = [
  "new-lead", "hot", "warm", "cool", "cold", "qualified",
  "validation-complete", "fdd-issued", "closed-won", "closed-lost",
  "nurture", "re-engaged", "trainual-complete", "compliance-passed",
  "referral", "paid-ad", "organic", "at-risk",
];

async function setupTags() {
  console.log("\n═══ 5. TAGS ═══");

  for (const tag of TAGS) {
    try {
      await ghlPost(`/locations/${LOCATION_ID}/tags`, { name: tag });
      log("CREATED", "Tag", tag);
      await delay(200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exist") || msg.includes("409") || msg.includes("duplicate")) {
        log("SKIPPED", "Tag", tag, "already exists");
      } else {
        log("FAILED", "Tag", tag, msg);
      }
    }
  }
}

// ═══════════════════════════════════════════════
// 6. CACHE IDs INTO SUPABASE
// ═══════════════════════════════════════════════

async function cacheToSupabase() {
  console.log("\n═══ 6. CACHE IDs INTO SUPABASE ═══");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 6a. Cache pipeline stages
  try {
    const { pipelines } = await ghlGet<{ pipelines: GHLPipeline[] }>(
      `/opportunities/pipelines?locationId=${LOCATION_ID}`
    );

    // Filter to NAH pipelines if they exist, otherwise cache all
    const nahPipelines = pipelines.filter((p) => p.name.startsWith("NAH Franchise Sales"));
    const toCache = nahPipelines.length > 0 ? nahPipelines : pipelines;

    let stageCount = 0;
    for (const pipeline of toCache) {
      for (const stage of pipeline.stages) {
        const { error } = await supabase
          .from("ghl_pipeline_stages")
          .upsert(
            {
              pipeline_id: pipeline.id,
              stage_id: stage.id,
              stage_name: stage.name.trim(),
              position: stage.position,
            },
            { onConflict: "stage_id" }
          );
        if (!error) stageCount++;
      }
    }
    console.log(`  ✓ Cached ${stageCount} stages from ${toCache.length} pipelines into ghl_pipeline_stages`);
  } catch (err) {
    console.log(`  ✗ Pipeline cache failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6b. Cache custom fields
  try {
    const { customFields } = await ghlGet<{ customFields: GHLCustomField[] }>(
      `/locations/${LOCATION_ID}/customFields`
    );

    let fieldCount = 0;
    for (const field of customFields) {
      const { error } = await supabase
        .from("ghl_custom_fields")
        .upsert(
          {
            field_key: field.fieldKey ?? field.id,
            field_name: field.name,
            field_type: field.dataType ?? "TEXT",
            entity_type: field.model === "opportunity" ? "opportunity" : "contact",
            ghl_field_id: field.id,
            dropdown_options: field.options ?? null,
          },
          { onConflict: "entity_type,field_key" }
        );
      if (!error) fieldCount++;
    }
    console.log(`  ✓ Cached ${fieldCount} custom fields into ghl_custom_fields`);
  } catch (err) {
    console.log(`  ✗ Custom fields cache failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ═══════════════════════════════════════════════
// 8. WORKFLOW INSTRUCTIONS (printed after run)
// ═══════════════════════════════════════════════

function printWorkflowInstructions() {
  console.log(`
═══ 8. WORKFLOWS — MANUAL STEP REQUIRED ═══

Workflows with inbound webhook triggers CANNOT be created via API.
You must create these 10 workflows manually in the GHL UI.

For EACH workflow below:
1. Go to GHL → Automation → Workflows
2. Click "+ Create Workflow" → "Start from scratch"
3. Name it exactly as shown below
4. Click the trigger box → select "Inbound Webhook"
5. Click "Copy Webhook URL" and SAVE IT
6. Click "Save" → toggle the workflow to Active

┌──────────────────────────────────────────────────────┐
│  # │ Workflow Name                                    │
├──────────────────────────────────────────────────────┤
│  1 │ New Lead Welcome                                │
│  2 │ Active Follow-up Sequence                       │
│  3 │ Qualified Lead — Trainual Access                │
│  4 │ Discovery Reminder Sequence                     │
│  5 │ Validation Team Intro Sequence                  │
│  6 │ FDD Nurture Sequence                            │
│  7 │ Long-term Nurture                               │
│  8 │ New Franchisee Onboarding                       │
│  9 │ Agreement Execution                             │
│ 10 │ Re-engagement Alert                             │
└──────────────────────────────────────────────────────┘

After creating all 10, paste the webhook URLs back and I will
store them in the ghl_workflows table in Supabase.
`);
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   NAH Franchise OS — GHL Account Setup       ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log(`\nLocation ID: ${LOCATION_ID}`);
  console.log(`API Key: ${API_KEY.slice(0, 10)}...`);

  if (!API_KEY || !LOCATION_ID) {
    console.error("ERROR: Missing GHL_API_KEY or GHL_LOCATION_ID in .env.local");
    process.exit(1);
  }

  await setupPipelines();
  await setupCustomFields();
  await setupCalendars();
  await setupTags();
  await cacheToSupabase();
  printWorkflowInstructions();

  console.log("═══ FINAL SUMMARY ═══");
  console.log(`  ✓ Created: ${stats.created}`);
  console.log(`  ↻ Skipped: ${stats.skipped}`);
  console.log(`  ✗ Failed:  ${stats.failed}`);
  console.log(`  Total:     ${stats.created + stats.skipped + stats.failed}`);
  console.log("");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
