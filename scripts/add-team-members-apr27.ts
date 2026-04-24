/**
 * One-off: add Ray Heath, Joe Kraus, and Jessida Odle as NAH team members.
 *
 *   1. Creates (or resets password on) Supabase Auth account for each.
 *   2. Upserts a row in the `users` table with role=member, is_active=true.
 *   3. Logs final state for verification.
 *
 * Ray has a second email (ray@hirambuild.com) used for some external calls;
 * that alias is added to the classifier fallback list separately so Read.ai
 * webhooks routed through it still get tagged as NAH team.
 *
 * Usage: npx tsx scripts/add-team-members-apr27.ts
 */

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

const PASSWORD = "Demo123";

const NEW_USERS = [
  { email: "ray@newagainhouses.com",  fullName: "Ray Heath",     role: "member" as const },
  { email: "joekraus@newagainhouses.com", fullName: "Joe Kraus",  role: "member" as const },
  { email: "jess@newagainhouses.com", fullName: "Jessida Odle",   role: "member" as const },
];

async function main() {
  for (const u of NEW_USERS) {
    console.log(`\n→ ${u.email} (${u.fullName})`);

    // 1. Auth account (create or reset password)
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((au) => au.email?.toLowerCase() === u.email.toLowerCase());

    let authId: string;
    if (existing) {
      authId = existing.id;
      const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: PASSWORD });
      if (error) { console.error(`   auth update failed: ${error.message}`); continue; }
      console.log(`   auth: existing — password reset to ${PASSWORD}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      if (error || !data.user) { console.error(`   auth create failed: ${error?.message}`); continue; }
      authId = data.user.id;
      console.log(`   auth: created (id=${authId.slice(0, 8)})`);
    }

    // 2. users table row — keep auth.users id and public.users id aligned so
    //    downstream FKs (calls.hosted_by_user_id, etc) work consistently.
    const { data: existingRow } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_active, is_real_user")
      .eq("email", u.email)
      .maybeSingle();

    if (existingRow) {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: u.fullName,
          role: u.role,
          is_active: true,
          is_real_user: true,
        })
        .eq("id", existingRow.id);
      if (error) console.error(`   users update failed: ${error.message}`);
      else console.log(`   users: updated existing row (${existingRow.id.slice(0, 8)})`);
    } else {
      const { error } = await supabase.from("users").insert({
        id: authId,
        email: u.email,
        full_name: u.fullName,
        role: u.role,
        is_active: true,
        is_real_user: true,
      });
      if (error) console.error(`   users insert failed: ${error.message}`);
      else console.log(`   users: inserted`);
    }
  }

  console.log("\n--- Final state ---");
  const { data: final } = await supabase
    .from("users")
    .select("email, full_name, role, is_active, is_real_user")
    .in("email", NEW_USERS.map((u) => u.email))
    .order("full_name");
  for (const r of final ?? []) {
    console.log(`  ${r.full_name?.padEnd(20)} ${r.email?.padEnd(35)} role=${r.role} active=${r.is_active} real=${r.is_real_user}`);
  }
  console.log(`\nLogin password for all three: ${PASSWORD}`);
  console.log("Have them rotate after first login.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
