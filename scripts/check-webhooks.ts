import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envRaw = fs.readFileSync(path.resolve("/Users/coreylavinder/nah-franchise-os-sandbox", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Check recent webhook logs
  console.log("=== Recent Read.ai webhook logs (last 7 days) ===");
  const { data: logs, error: logErr } = await supabase
    .from("integration_logs")
    .select("status, payload_summary, error_message, metadata, created_at")
    .eq("integration_name", "read_ai")
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (logErr) console.error("Log query error:", logErr.message);
  for (const l of logs ?? []) {
    console.log(`  ${l.created_at} | ${l.status} | ${l.payload_summary} | ${l.error_message ?? ""}`);
  }

  // Check recent read_ai_sessions
  console.log("\n=== Recent Read.ai sessions (last 7 days) ===");
  const { data: sessions, error: sessErr } = await supabase
    .from("read_ai_sessions")
    .select("session_id, title, owner_email, processing_status, error_message, created_at, start_time")
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (sessErr) console.error("Session query error:", sessErr.message);
  for (const s of sessions ?? []) {
    console.log(
      `  ${s.created_at} | ${s.processing_status} | ${s.title} | owner=${s.owner_email} | ${s.error_message ?? ""}`
    );
  }

  // Check recent calls for today
  console.log("\n=== Calls from today ===");
  const today = new Date().toISOString().slice(0, 10);
  const { data: calls, error: callErr } = await supabase
    .from("calls")
    .select("id, title, call_date, hosted_by_user_id, deleted_at, created_at")
    .gte("call_date", today)
    .order("call_date", { ascending: false })
    .limit(10);

  if (callErr) console.error("Call query error:", callErr.message);
  for (const c of calls ?? []) {
    console.log(`  ${c.call_date} | ${c.title} | deleted=${c.deleted_at ? "YES" : "no"} | created=${c.created_at}`);
  }

  // Search for Dreyer
  console.log("\n=== Searching for 'dreyer' in contacts ===");
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .or("last_name.ilike.%dreyer%,first_name.ilike.%jonathon%,email.ilike.%dreyer%")
    .limit(5);

  for (const c of contacts ?? []) {
    console.log(`  ${c.first_name} ${c.last_name} | ${c.email}`);
  }

  // Search recent sessions for dreyer
  console.log("\n=== Searching read_ai_sessions for 'dreyer' ===");
  const { data: dreyerSessions } = await supabase
    .from("read_ai_sessions")
    .select("session_id, title, processing_status, error_message, created_at")
    .ilike("title", "%dreyer%")
    .order("created_at", { ascending: false })
    .limit(5);

  for (const s of dreyerSessions ?? []) {
    console.log(`  ${s.created_at} | ${s.processing_status} | ${s.title} | ${s.error_message ?? ""}`);
  }
}

main().catch(console.error);
