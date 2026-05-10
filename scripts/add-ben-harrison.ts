/**
 * One-off: add Ben Harrison as admin team member.
 *
 * Usage: npx tsx scripts/add-ben-harrison.ts
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

const EMAIL = "ben@newagainhouses.com";
const FULL_NAME = "Ben Harrison";
const ROLE = "admin";
const PASSWORD = "Demo123";

async function main() {
  console.log(`\n→ Adding ${FULL_NAME} (${EMAIL}) as ${ROLE}`);

  // 1. Auth account (create or reset password)
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users?.find((au) => au.email?.toLowerCase() === EMAIL.toLowerCase());

  let authId: string;
  if (existing) {
    authId = existing.id;
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: PASSWORD });
    if (error) {
      console.error(`   auth update failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`   auth: existing — password reset to ${PASSWORD}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    });
    if (error || !data.user) {
      console.error(`   auth create failed: ${error?.message}`);
      process.exit(1);
    }
    authId = data.user.id;
    console.log(`   auth: created (id=${authId.slice(0, 8)})`);
  }

  // 2. users table row
  const { data: existingRow } = await supabase
    .from("users")
    .select("id, email, full_name, role, is_active, is_real_user")
    .eq("email", EMAIL)
    .maybeSingle();

  if (existingRow) {
    const { error } = await supabase
      .from("users")
      .update({ full_name: FULL_NAME, role: ROLE, is_active: true, is_real_user: true })
      .eq("id", existingRow.id);
    if (error) console.error(`   users update failed: ${error.message}`);
    else console.log(`   users: updated existing row (${existingRow.id.slice(0, 8)})`);
  } else {
    const { error } = await supabase.from("users").insert({
      id: authId,
      email: EMAIL,
      full_name: FULL_NAME,
      role: ROLE,
      is_active: true,
      is_real_user: true,
    });
    if (error) console.error(`   users insert failed: ${error.message}`);
    else console.log(`   users: inserted`);
  }

  // 3. Verify
  const { data: final } = await supabase
    .from("users")
    .select("email, full_name, role, is_active, is_real_user")
    .eq("email", EMAIL)
    .single();

  if (final) {
    console.log(`\n--- Verified ---`);
    console.log(`  ${final.full_name}  ${final.email}  role=${final.role}  active=${final.is_active}`);
  }

  console.log(`\nLogin: ${EMAIL} / ${PASSWORD}`);
  console.log("Have him change password after first login.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
