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

const CALL_ID = "de3bf1e3-646d-41e3-a467-a316555c1a32";

async function main() {
  const { data: call } = await supabase.from("calls").select("*").eq("id", CALL_ID).single();
  if (!call) {
    console.log("Call not found");
    return;
  }

  console.log("=== Call Record ===");
  console.log(`  Title: ${call.title}`);
  console.log(`  Status: ${call.status}`);
  console.log(`  Source: ${call.source}`);
  console.log(`  Call type: ${call.call_type_id}`);
  console.log(`  Contact: ${call.contact_id}`);
  console.log(`  Has raw_transcript: ${!!call.raw_transcript} (${call.raw_transcript?.length ?? 0} chars)`);
  console.log(`  Has recording_url: ${!!call.recording_url}`);
  console.log(`  Started at: ${call.started_at}`);
  console.log(`  Created at: ${call.created_at}`);
  console.log(`  Hosted by: ${call.hosted_by_user_id}`);

  // Check call_transcripts
  const { data: transcripts } = await supabase
    .from("call_transcripts")
    .select("id, source, word_count, created_at")
    .eq("call_id", CALL_ID);
  console.log(`\n  call_transcripts rows: ${transcripts?.length ?? 0}`);
  for (const t of transcripts ?? []) {
    console.log(`    source=${t.source} words=${t.word_count} created=${t.created_at}`);
  }

  // Check review package
  const { data: pkg } = await supabase
    .from("call_review_packages")
    .select("id, created_at")
    .eq("call_id", CALL_ID)
    .maybeSingle();
  console.log(`  review_package: ${pkg ? "YES" : "NO"}`);

  // Check grades
  const { data: grades } = await supabase.from("call_grades").select("id, status").eq("call_id", CALL_ID);
  console.log(`  grades: ${grades?.length ?? 0}`);

  // Check extractions
  const { data: extractions } = await supabase
    .from("call_data_extractions")
    .select("id, extraction_type, status")
    .eq("call_id", CALL_ID);
  console.log(`  extractions: ${extractions?.length ?? 0}`);
  for (const e of extractions ?? []) {
    console.log(`    ${e.extraction_type} status=${e.status}`);
  }
}

main().catch(console.error);
