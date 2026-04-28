/**
 * Tier 1 #2 — Apply GHL user ID mapping + user fixes.
 *
 * Approved by Corey 2026-04-28. Changes:
 *   1. Set ghl_user_id for 8 users (5 new + 3 already correct)
 *   2. Fix Jessica Odle's name (was "Jessida Odle")
 *   3. Update Mark Pate's primary email to mpate@newagainhouses.com
 *   4. Add Will Riddle as new user
 *   5. Seed email aliases for Mark (2 alt emails) and Ray (1 alt email)
 *
 * Usage: npx tsx scripts/apply-ghl-user-mapping.ts
 */

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  async function patch(table: string, filter: string, body: Record<string, unknown>) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PATCH ${table}?${filter} failed: ${res.status} ${text}`);
    }
  }

  async function insert(table: string, body: Record<string, unknown> | Record<string, unknown>[]) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`INSERT ${table} failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  // === 1. Set ghl_user_id for users that need it ===
  const ghlMappings = [
    { email: "corey@newagainhouses.com", ghl_user_id: "i4SkusEsfpLEb62YirUD" },
    { email: "sam@newagainhouses.com", ghl_user_id: "ep0mnZpR58makJYakcHU" },
    { email: "rylyn@newagainhouses.com", ghl_user_id: "HmKlVuztEQ4VjEPNUkk0" },
    { email: "amber@newagainhouses.com", ghl_user_id: "DFOEAzt7uEnoaBZz1QfA" },
    { email: "erin@newagainhouses.com", ghl_user_id: "Fu2wbUu218vY3W1C401q" },
    { email: "jess@newagainhouses.com", ghl_user_id: "9DoN5ap8JN8aq2shMlCw" },
    { email: "ray@newagainhouses.com", ghl_user_id: "JoJ02FnKCgaeFfxQjPCe" },
  ];

  console.log("=== Setting ghl_user_id ===\n");
  for (const m of ghlMappings) {
    await patch("users", `email=eq.${encodeURIComponent(m.email)}`, { ghl_user_id: m.ghl_user_id });
    console.log(`  ${m.email} → ${m.ghl_user_id}`);
  }

  // Mark Pate: update email to newagainhouses AND set ghl_user_id
  await patch("users", `email=eq.${encodeURIComponent("mark@altacapitalmanagement.com")}`, {
    email: "mpate@newagainhouses.com",
    ghl_user_id: "rphGTzN1VsHBrSZ38gRB",
  });
  console.log("  mark@altacapitalmanagement.com → mpate@newagainhouses.com + ghl_user_id set");

  // === 2. Fix Jessica Odle's name ===
  console.log("\n=== Fixing user records ===\n");
  await patch("users", `email=eq.${encodeURIComponent("jess@newagainhouses.com")}`, {
    full_name: "Jessica Odle",
  });
  console.log("  Jessica Odle: name fixed (was 'Jessida Odle')");

  // === 3. Add Will Riddle ===
  console.log("\n=== Adding new user ===\n");
  try {
    const result = await insert("users", {
      email: "will@newagainhouses.com",
      full_name: "Will Riddle",
      role: "member",
      ghl_user_id: "ffEAx2XDkyAZS3Ddlonn",
      is_active: true,
    });
    console.log("  Will Riddle added:", JSON.stringify(result[0]?.id ?? "ok"));
  } catch (err) {
    // May already exist
    console.log("  Will Riddle:", err instanceof Error ? err.message : String(err));
  }

  // === 4. Seed email aliases ===
  console.log("\n=== Seeding email aliases ===\n");

  // Get user IDs for Mark and Ray
  const markRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.mpate@newagainhouses.com&select=id`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const markData = await markRes.json();
  const markId = markData[0]?.id;

  const rayRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.ray@newagainhouses.com&select=id`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const rayData = await rayRes.json();
  const rayId = rayData[0]?.id;

  const jessRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.jess@newagainhouses.com&select=id`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  const jessData = await jessRes.json();
  const jessId = jessData[0]?.id;

  const aliases: { user_id: string; email: string }[] = [];

  if (markId) {
    aliases.push(
      { user_id: markId, email: "mark@altacapitalmanagement.com" },
      { user_id: markId, email: "markjpate@gmail.com" }
    );
    console.log(`  Mark Pate (${markId}): 2 aliases`);
  }

  if (rayId) {
    aliases.push({ user_id: rayId, email: "ray@hirambuild.com" });
    console.log(`  Ray Heath (${rayId}): 1 alias`);
  }

  if (jessId) {
    aliases.push({ user_id: jessId, email: "jessica@newagainhouses.com" });
    console.log(`  Jessica Odle (${jessId}): 1 alias (jessica@ → jess@)`);
  }

  if (aliases.length > 0) {
    try {
      await insert("user_email_aliases", aliases);
      console.log(`  Inserted ${aliases.length} aliases`);
    } catch (err) {
      console.log("  Alias insert:", err instanceof Error ? err.message : String(err));
    }
  }

  // === 5. Verify ===
  console.log("\n=== Verification ===\n");
  const verifyRes = await fetch(
    `${supabaseUrl}/rest/v1/users?select=full_name,email,ghl_user_id,is_active&order=full_name&is_active=eq.true`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const allUsers = await verifyRes.json();
  console.log("  Name                    | Email                          | ghl_user_id");
  console.log("  " + "-".repeat(90));
  for (const u of allUsers) {
    const name = (u.full_name ?? "").padEnd(24);
    const email = (u.email ?? "").padEnd(30);
    const ghl = u.ghl_user_id ?? "(null)";
    console.log(`  ${name} | ${email} | ${ghl}`);
  }

  console.log("\nDone. All changes applied.");
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
