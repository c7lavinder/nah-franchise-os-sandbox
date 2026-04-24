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
  const { data: users } = await sb
    .from("users")
    .select("id, email, full_name, ghl_contact_id, role")
    .order("full_name", { ascending: true });
  console.log("Users in `users` table:");
  for (const u of users ?? []) {
    console.log(`  ${u.full_name?.padEnd(30) ?? "(no name)".padEnd(30)} ${u.email?.padEnd(35) ?? "(no email)".padEnd(35)} role=${u.role ?? "-"}`);
  }
  console.log(`\nTotal: ${users?.length ?? 0}`);

  // Check for existing Ray / Joe entries
  const matches = (users ?? []).filter((u) => {
    const name = (u.full_name ?? "").toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    return name.includes("ray") || name.includes("heath") || name.includes("joe") || name.includes("kraus")
      || email.includes("rheath") || email.includes("ray") || email.includes("jkraus") || email.includes("joe");
  });
  if (matches.length > 0) {
    console.log("\nPossible matches for Ray Heath / Joe Kraus:");
    for (const m of matches) {
      console.log(`  - ${m.full_name} (${m.email})`);
    }
  } else {
    console.log("\nNo existing Ray Heath or Joe Kraus rows found.");
  }
}

main().catch(console.error);
