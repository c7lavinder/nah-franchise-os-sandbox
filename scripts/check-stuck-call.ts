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
  // Get the call
  const { data: call, error } = await supabase.from("calls").select("*").eq("id", CALL_ID).single();

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log("=== Call Record ===");
  console.log(`  Title: ${call.title}`);
  console.log(`  Created: ${call.created_at}`);
  console.log(`  Status: ${call.status}`);
  console.log(`  Processing: ${call.processing_status}`);
  console.log(`  Has transcript: ${!!call.raw_transcript}`);
  console.log(`  Has formatted transcript: ${!!call.formatted_transcript}`);
  console.log(`  Has grading: ${!!call.grading_output}`);
  console.log(`  Has coaching: ${!!call.coaching_output}`);
  console.log(`  Has extraction: ${!!call.extracted_data}`);
  console.log(`  Call type: ${call.call_type_id}`);
  console.log(`  Hosted by: ${call.hosted_by_user_id}`);
  console.log(`  Deleted: ${call.deleted_at}`);

  // Check read_ai_sessions
  if (call.read_ai_session_id) {
    const { data: session } = await supabase
      .from("read_ai_sessions")
      .select("*")
      .eq("session_id", call.read_ai_session_id)
      .single();

    if (session) {
      console.log("\n=== Read.ai Session ===");
      console.log(`  Session ID: ${session.session_id}`);
      console.log(`  Processing: ${session.processing_status}`);
      console.log(`  Error: ${session.error_message ?? "none"}`);
    }
  }

  // Check all columns
  console.log("\n=== All non-null fields ===");
  for (const [key, val] of Object.entries(call)) {
    if (val !== null && val !== undefined) {
      const display = typeof val === "string" && val.length > 100 ? val.slice(0, 100) + "..." : val;
      console.log(`  ${key}: ${display}`);
    }
  }
}

main().catch(console.error);
