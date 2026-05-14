/**
 * Import Franchise Tether action plans as NAH workflows.
 *
 * Reads data/generatedBy_react-csv (1).csv and creates 4 draft workflows:
 *   - Generic Franchise Drip Campaign 1 Yr
 *   - 2026 Q2 Cold Lead Drip Campaign
 *   - Intro Call Info Campaign
 *   - Website Form Leads
 *
 * Each workflow is created with status='draft', trigger_type='manual'
 * so Corey can review and switch to live in the UI.
 *
 * Idempotent: skips workflows whose name already exists.
 *
 * Usage:
 *   npx tsx -r dotenv/config scripts/import-franchise-tether-workflows.ts --dry-run dotenv_config_path=.env.local
 *   npx tsx -r dotenv/config scripts/import-franchise-tether-workflows.ts --live    dotenv_config_path=.env.local
 */

import "dotenv/config";
import * as fs from "fs";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const CREATED_BY_EMAIL = "corey@newagainhouses.com";
// CSV pre-converted to JSON via Python (data/franchise-tether-workflows.json)
const JSON_PATH = "data/franchise-tether-workflows.json";

const DRY_RUN = !process.argv.includes("--live");

const KEEP_PLANS = [
  "Generic Franchise Drip Campaign 1 Yr",
  "2026 Q2 Cold Lead Drip Campaign",
  "Intro Call Info Campaign",
  "Website Form Leads",
] as const;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws as never },
});

interface FTRow {
  "Action Plan Name": string;
  "Action Type": string;
  "Action Step Name": string;
  "Action Delay": string;
  Subject: string;
  Body: string;
}

// Map FT action type to NAH step_type
function mapStepType(ft: string): "email" | "sms" | "chad_call_task" | "send_reminder" | null {
  switch (ft.trim()) {
    case "Email":
      return "email";
    case "Text":
      return "sms";
    case "Call":
      return "chad_call_task";
    case "Contact Reminder":
      return "chad_call_task"; // these are all "Call #N" in the data
    default:
      return null;
  }
}

// Parse FT delay format → { dayNumber, sendTime }.
// Examples:
//   "Immediate"            → { 0, null }
//   "5 minutes"            → { 0, null }
//   "7 hours"              → { 0, null }
//   "1 days 9:00 AM"       → { 1, "09:00:00" }
//   "12 days 10:15 AM"     → { 12, "10:15:00" }
//   "1 weeks 7:30 AM"      → { 7, "07:30:00" }
//   "1 months 10:00 AM"    → { 30, "10:00:00" }
//   "1 years 12:00 PM"     → { 365, "12:00:00" }
function parseDelay(raw: string): { dayNumber: number; sendTime: string | null } {
  const s = raw.trim();
  if (!s || s.toLowerCase() === "immediate") return { dayNumber: 0, sendTime: null };

  // Sub-day delays collapse to day 0 with no scheduled time
  if (/^\d+\s*(minutes?|hours?)$/i.test(s)) return { dayNumber: 0, sendTime: null };

  // Parse "N <unit> [HH:MM AM/PM]"
  // Longest alternatives first — "days" before "day" so we don't half-match
  const m = s.match(/^(\d+)\s*(days|day|weeks|week|months|month|years|year)(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
  if (!m) return { dayNumber: 0, sendTime: null };

  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  let days = 0;
  if (unit.startsWith("day")) days = n;
  else if (unit.startsWith("week")) days = n * 7;
  else if (unit.startsWith("month")) days = n * 30;
  else if (unit.startsWith("year")) days = n * 365;

  let sendTime: string | null = null;
  if (m[3] && m[4] && m[5]) {
    let hour = parseInt(m[3], 10);
    const minute = parseInt(m[4], 10);
    const ampm = m[5].toUpperCase();
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    sendTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  }

  return { dayNumber: days, sendTime };
}

// Convert FT template variables to GHL syntax
function rewriteTemplateVars(text: string): string {
  return text
    .replace(/\{\{client\.firstName\}\}/g, "{{contact.first_name}}")
    .replace(/\{\{client\.lastName\}\}/g, "{{contact.last_name}}")
    .replace(/\{\{client\.email\}\}/g, "{{contact.email}}")
    .replace(/\{\{user\.userFirstName\}\}/g, "{{user.first_name}}")
    .replace(/\{\{user\.userLastName\}\}/g, "{{user.last_name}}");
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const rows = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8")) as FTRow[];

  // Look up creator user
  const { data: creator, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", CREATED_BY_EMAIL)
    .single();

  if (userErr || !creator) {
    console.error(`Could not find user with email ${CREATED_BY_EMAIL}: ${userErr?.message ?? "not found"}`);
    process.exit(1);
  }
  const createdBy = creator.id;
  console.log(`Creator user_id: ${createdBy}\n`);

  let workflowsCreated = 0;
  let workflowsSkipped = 0;
  let stepsCreated = 0;

  for (const planName of KEEP_PLANS) {
    const planSteps = rows.filter((r) => r["Action Plan Name"] === planName);
    if (planSteps.length === 0) {
      console.warn(`  No rows found for "${planName}", skipping`);
      continue;
    }

    // Check for existing workflow
    const { data: existing } = await supabase.from("workflows").select("id, status").eq("name", planName).maybeSingle();

    if (existing) {
      console.log(`  SKIP "${planName}" — already exists (id=${existing.id}, status=${existing.status})`);
      workflowsSkipped++;
      continue;
    }

    // Build step rows
    const steps = planSteps
      .map((r) => {
        const stepType = mapStepType(r["Action Type"]);
        if (!stepType) return null;
        const { dayNumber, sendTime } = parseDelay(r["Action Delay"]);
        return {
          stepType,
          dayNumber,
          sendTime,
          subject: rewriteTemplateVars(r["Subject"] || ""),
          content: rewriteTemplateVars(r["Body"] || r["Action Step Name"] || ""),
          stepName: r["Action Step Name"],
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        // Sort by chronological order: day, then send_time
        if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
        return (a.sendTime ?? "").localeCompare(b.sendTime ?? "");
      });

    console.log(`\n  CREATE "${planName}" (${steps.length} steps)`);
    for (const s of steps) {
      console.log(
        `    [d${s.dayNumber}${s.sendTime ? ` @ ${s.sendTime}` : ""}] ${s.stepType.padEnd(15)} ${s.stepName}`
      );
    }

    if (DRY_RUN) {
      workflowsCreated++;
      stepsCreated += steps.length;
      continue;
    }

    // Insert workflow (draft, manual trigger)
    const { data: workflow, error: wfErr } = await supabase
      .from("workflows")
      .insert({
        name: planName,
        description: `Imported from Franchise Tether (${steps.length} steps).`,
        workflow_type: "drip",
        trigger_type: "manual",
        trigger_config: {},
        exit_conditions: {},
        pause_conditions: {},
        status: "draft",
        created_by: createdBy,
      })
      .select("id")
      .single();

    if (wfErr || !workflow) {
      console.error(`    ERROR creating workflow: ${wfErr?.message}`);
      continue;
    }

    // Insert version 1
    const { data: version, error: verErr } = await supabase
      .from("workflow_versions")
      .insert({
        workflow_id: workflow.id,
        version_number: 1,
        change_description: "Imported from Franchise Tether",
        created_by: createdBy,
      })
      .select("id")
      .single();

    if (verErr || !version) {
      console.error(`    ERROR creating version: ${verErr?.message}`);
      continue;
    }

    // Link version back to workflow
    await supabase.from("workflows").update({ current_version_id: version.id }).eq("id", workflow.id);

    // Insert steps
    const stepRows = steps.map((s, idx) => ({
      workflow_version_id: version.id,
      step_number: idx + 1,
      day_number: s.dayNumber,
      step_type: s.stepType,
      content: s.content,
      subject: s.stepType === "email" ? s.subject : null,
      send_time: s.sendTime,
      requires_confirmation: true,
    }));

    const { error: stepErr } = await supabase.from("workflow_steps").insert(stepRows);
    if (stepErr) {
      console.error(`    ERROR inserting steps: ${stepErr.message}`);
      continue;
    }

    workflowsCreated++;
    stepsCreated += steps.length;
    console.log(`    ✓ workflow_id=${workflow.id}, ${steps.length} steps`);
  }

  console.log(`\nDone. Workflows: ${workflowsCreated} created, ${workflowsSkipped} skipped. Steps: ${stepsCreated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
