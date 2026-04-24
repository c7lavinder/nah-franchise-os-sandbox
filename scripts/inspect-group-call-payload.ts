import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envRaw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!);

async function main() {
  const { data: calls } = await sb
    .from("calls")
    .select("id, title, started_at, read_ai_session_id")
    .eq("id", "acd83288-d1cf-4edd-b038-3631a97a644c");
  console.log("Group calls in window:");
  for (const c of calls ?? []) console.log(`  ${c.id} — ${c.title}`);
  if (!calls || calls.length === 0) return;

  const call = calls[0];
  console.log(`\nInspecting: ${call.title}\n`);

  // Pull the raw Read.ai payload
  if (call.read_ai_session_id) {
    const { data: sess } = await sb
      .from("read_ai_sessions")
      .select("raw_payload, participant_emails")
      .eq("session_id", call.read_ai_session_id)
      .maybeSingle();
    if (sess?.raw_payload) {
      const payload = sess.raw_payload as Record<string, unknown>;
      const participants = payload.participants as Array<Record<string, unknown>> | undefined;
      console.log(`Raw Read.ai participants (${participants?.length ?? 0}):`);
      for (const p of participants ?? []) {
        console.log(`  name="${p.name ?? "(none)"}" email="${p.email ?? "(NONE)"}" role="${p.role ?? "-"}"`);
      }
    }
  }

  // Pull the call_participants rows we stored
  const { data: cps } = await sb
    .from("call_participants")
    .select("display_name, email, role, contact_id")
    .eq("call_id", call.id);
  console.log(`\ncall_participants rows (${cps?.length ?? 0}):`);
  for (const p of cps ?? []) {
    console.log(`  display_name="${p.display_name ?? "(none)"}" email="${p.email ?? "(NONE)"}" role="${p.role}" contact=${p.contact_id?.slice(0, 8) ?? "-"}`);
  }
}

main().catch(console.error);
