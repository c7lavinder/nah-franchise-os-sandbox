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
  // Drop old constraint and add new one with all valid sources
  const { error: dropErr } = await supabase.rpc("exec_sql", {
    sql: `ALTER TABLE call_transcripts DROP CONSTRAINT IF EXISTS call_transcripts_source_check`,
  });

  if (dropErr) {
    console.log("RPC not available, trying direct...");
    // Use raw SQL via postgrest
    // Actually we can't run DDL through postgrest. Let me just fix the code to use 'upload' which works.
    console.log("Cannot alter constraint via API. Fixing code to use allowed source values instead.");
    return;
  }

  const { error: addErr } = await supabase.rpc("exec_sql", {
    sql: `ALTER TABLE call_transcripts ADD CONSTRAINT call_transcripts_source_check CHECK (source IN ('whisper', 'manual_paste', 'upload', 'read_ai', 'file_upload'))`,
  });

  if (addErr) console.error("Add constraint error:", addErr.message);
  else console.log("Constraint updated successfully");
}

main().catch(console.error);
