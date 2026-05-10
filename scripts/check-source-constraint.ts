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
  // Check current constraint
  const { data, error } = await supabase.rpc("exec_sql", {
    sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'call_transcripts'::regclass AND contype = 'c'",
  });

  if (error) {
    // Try direct query on information_schema
    const { data: cols } = await supabase.from("call_transcripts").select("source").limit(1);
    console.log("Sample:", cols);

    // Try inserting with different sources to see what works
    for (const src of ["whisper", "manual_paste", "upload", "file_upload", "read_ai"]) {
      const { error: testErr } = await supabase
        .from("call_transcripts")
        .insert({ call_id: "00000000-0000-0000-0000-000000000000", source: src, full_text: "test", word_count: 1 });
      console.log(`  source="${src}": ${testErr ? testErr.message.slice(0, 80) : "OK"}`);
    }
  } else {
    console.log("Constraints:", data);
  }
}

main().catch(console.error);
