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
  // Check the call
  const { data: call } = await supabase
    .from("calls")
    .select(
      "title, contact_id, raw_transcript, summary, coaching_data, coaching_score, action_items, status, call_type_id"
    )
    .eq("id", CALL_ID)
    .single();
  console.log("=== Call ===");
  console.log(`  title: ${call?.title}`);
  console.log(`  contact_id: ${call?.contact_id}`);
  console.log(`  raw_transcript: ${call?.raw_transcript ? `${call.raw_transcript.length} chars` : "NULL"}`);
  console.log(`  summary: ${call?.summary ? `${call.summary.length} chars` : "NULL"}`);
  console.log(`  coaching_data: ${call?.coaching_data ? "YES" : "NULL"}`);
  console.log(`  coaching_score: ${call?.coaching_score}`);
  console.log(`  action_items: ${call?.action_items ? "YES" : "NULL"}`);

  // Check what the detail API returns
  console.log("\n=== Hitting detail API ===");
  const res = await fetch(`https://nah-franchise-os-sandbox.vercel.app/frandev/api/calls/${CALL_ID}/detail`);
  if (res.ok) {
    const data = await res.json();
    const keys = Object.keys(data);
    console.log(`  Keys: ${keys.join(", ")}`);
    for (const key of keys) {
      const val = data[key];
      if (val === null || val === undefined) {
        console.log(`  ${key}: NULL`);
      } else if (typeof val === "string") {
        console.log(`  ${key}: "${val.slice(0, 80)}${val.length > 80 ? "..." : ""}"`);
      } else if (typeof val === "object") {
        console.log(`  ${key}: ${JSON.stringify(val).slice(0, 100)}`);
      } else {
        console.log(`  ${key}: ${val}`);
      }
    }
  } else {
    console.log(`  Error: ${res.status} ${await res.text()}`);
  }
}

main().catch(console.error);
