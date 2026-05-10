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

async function main() {
  // Check how many calls are waiting for processing
  const { data: pending, error } = await supabase
    .from("calls")
    .select("id, title, created_at, raw_transcript, formatted_transcript, grading_output, coaching_output")
    .not("raw_transcript", "is", null)
    .is("formatted_transcript", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log(`=== Calls with transcript but no processing (${pending?.length ?? 0}) ===`);
  for (const c of pending ?? []) {
    console.log(`  ${c.created_at} | ${c.title} | has_grading=${!!c.grading_output}`);
  }

  // Try to manually trigger the process-transcripts cron
  console.log("\n=== Manually triggering process-transcripts ===");
  const cronSecret = env.CRON_SECRET;
  const appUrl = env.NEXT_PUBLIC_APP_URL || "https://nah-franchise-os-sandbox.vercel.app/frandev";

  console.log(`  URL: ${appUrl}/api/cron/process-transcripts`);
  console.log(`  CRON_SECRET present: ${!!cronSecret}`);

  if (cronSecret) {
    try {
      const res = await fetch(`${appUrl}/api/cron/process-transcripts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const text = await res.text();
      console.log(`  Response: ${res.status} ${text.slice(0, 500)}`);
    } catch (err) {
      console.error(`  Fetch error: ${err}`);
    }
  }
}

main().catch(console.error);
