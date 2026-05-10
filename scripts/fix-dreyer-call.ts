import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CALL_ID = "f9fd8385-af41-4164-adba-44d4bd920ead";

async function main() {
  // Get all column names to understand schema
  const { data: call } = await supabase.from("calls").select("*").eq("id", CALL_ID).single();

  if (!call) {
    console.log("Call not found");
    return;
  }

  // Show all columns and whether they're null
  console.log("=== Column status ===");
  const cols = Object.keys(call).sort();
  for (const col of cols) {
    const val = call[col];
    const hasVal = val !== null && val !== undefined;
    if (
      col.includes("transcript") ||
      col.includes("grad") ||
      col.includes("coach") ||
      col.includes("extract") ||
      col.includes("process") ||
      col.includes("format") ||
      col.includes("status") ||
      col.includes("action")
    ) {
      console.log(
        `  ${col}: ${hasVal ? (typeof val === "string" ? val.slice(0, 80) : JSON.stringify(val).slice(0, 80)) : "NULL"}`
      );
    }
  }

  // Check the call detail API to see what the UI would show
  console.log("\n=== Checking what the UI expects ===");
  const { data: extractions } = await supabase
    .from("call_data_extractions")
    .select("id, extraction_type, status, created_at")
    .eq("call_id", CALL_ID);

  console.log(`  call_data_extractions rows: ${extractions?.length ?? 0}`);
  for (const e of extractions ?? []) {
    console.log(`    ${e.extraction_type} | status=${e.status} | ${e.created_at}`);
  }

  // Check call_grades
  const { data: grades } = await supabase.from("call_grades").select("id, status, created_at").eq("call_id", CALL_ID);

  console.log(`  call_grades rows: ${grades?.length ?? 0}`);
  for (const g of grades ?? []) {
    console.log(`    status=${g.status} | ${g.created_at}`);
  }
}

main().catch(console.error);
