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
  const { data: call } = await supabase.from("calls").select("raw_transcript").eq("id", CALL_ID).single();

  if (!call?.raw_transcript) {
    console.log("No raw_transcript");
    return;
  }

  const wordCount = call.raw_transcript.split(/\s+/).length;
  console.log(`Inserting transcript: ${wordCount} words`);

  // Use 'upload' source to pass the check constraint
  const { data: inserted, error } = await supabase
    .from("call_transcripts")
    .insert({
      call_id: CALL_ID,
      source: "upload",
      full_text: call.raw_transcript,
      word_count: wordCount,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Insert failed:", error.message);
    return;
  }
  console.log(`Inserted: ${inserted.id}`);

  // Trigger review-package
  console.log("\nTriggering review-package...");
  const appUrl = "https://nah-franchise-os-sandbox.vercel.app/frandev";
  const res = await fetch(`${appUrl}/api/calls/${CALL_ID}/review-package`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  console.log(`  review-package: ${res.status} ${(await res.text()).slice(0, 300)}`);

  // Trigger generate
  console.log("\nTriggering generate...");
  const genRes = await fetch(`${appUrl}/api/calls/${CALL_ID}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  console.log(`  generate: ${genRes.status} ${(await genRes.text()).slice(0, 300)}`);
}

main().catch(console.error);
