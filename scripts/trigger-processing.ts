import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

// Set env vars so the app code works
for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CALL_ID = "f9fd8385-af41-4164-adba-44d4bd920ead";

async function main() {
  // Try hitting the cron endpoint directly (GET, no auth in dev)
  const appUrl = "https://nah-franchise-os-sandbox.vercel.app/frandev";

  console.log("Triggering process-transcripts cron via GET...");
  try {
    const res = await fetch(`${appUrl}/api/cron/process-transcripts`);
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2).slice(0, 500));
  } catch (err) {
    console.error(`  Error: ${err}`);
  }

  // Also try the call-specific grade/coach endpoints
  console.log("\nTriggering grade for call...");
  try {
    const res = await fetch(`${appUrl}/api/calls/${CALL_ID}/grade`, {
      method: "POST",
    });
    console.log(`  Grade status: ${res.status}`);
    const text = await res.text();
    console.log(`  Response: ${text.slice(0, 300)}`);
  } catch (err) {
    console.error(`  Error: ${err}`);
  }
}

main().catch(console.error);
