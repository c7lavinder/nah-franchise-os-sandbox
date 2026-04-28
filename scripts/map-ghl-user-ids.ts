/**
 * Tier 1 #2 — Map GHL user IDs to NAH OS users.
 *
 * Reads:
 *   1. NAH OS users table (via Supabase service key)
 *   2. GHL users list (via GHL API)
 *
 * Outputs a proposed mapping for Corey to approve.
 *
 * Usage: npx tsx scripts/map-ghl-user-ids.ts
 * Requires: .env.local with SUPABASE_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL, GHL_API_KEY, GHL_LOCATION_ID
 */

const GHL = "https://services.leadconnectorhq.com";

interface NahUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  ghl_user_id: string | null;
  is_active: boolean;
}

interface GhlUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

async function main() {
  // --- 1. Fetch NAH OS users from Supabase ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in env");
    process.exit(1);
  }

  console.log("=== NAH OS Users (Supabase) ===\n");

  const sbRes = await fetch(
    `${supabaseUrl}/rest/v1/users?select=id,email,full_name,role,ghl_user_id,is_active&order=full_name`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );

  if (!sbRes.ok) {
    console.error("Supabase query failed:", sbRes.status, await sbRes.text());
    process.exit(1);
  }

  const nahUsers = (await sbRes.json()) as NahUser[];

  console.log(`Found ${nahUsers.length} users:\n`);
  console.log(
    "  Name                    | Email                          | Role       | ghl_user_id          | Active"
  );
  console.log("  " + "-".repeat(110));
  for (const u of nahUsers) {
    const name = (u.full_name ?? "").padEnd(24);
    const email = (u.email ?? "").padEnd(30);
    const role = (u.role ?? "").padEnd(10);
    const ghlId = (u.ghl_user_id ?? "(null)").padEnd(20);
    const active = u.is_active ? "yes" : "no";
    console.log(`  ${name} | ${email} | ${role} | ${ghlId} | ${active}`);
  }

  // --- 2. Fetch GHL users ---
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    console.error("\nMissing GHL_API_KEY or GHL_LOCATION_ID in env");
    console.log("\nSkipping GHL lookup. Set these env vars and re-run.");
    return;
  }

  console.log("\n\n=== GHL Users (API) ===\n");

  const ghlRes = await fetch(`${GHL}/users/?locationId=${locationId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!ghlRes.ok) {
    console.error("GHL API failed:", ghlRes.status, await ghlRes.text());
    console.log("\nIf 401: GHL_API_KEY may be expired. Try refreshing OAuth token.");
    return;
  }

  const ghlData = (await ghlRes.json()) as { users?: GhlUser[] };
  const ghlUsers = ghlData.users ?? [];

  console.log(`Found ${ghlUsers.length} GHL users:\n`);
  console.log("  Name                    | Email                          | GHL User ID                    | GHL Role");
  console.log("  " + "-".repeat(110));
  for (const u of ghlUsers) {
    const name = (u.name ?? `${u.firstName} ${u.lastName}`).padEnd(24);
    const email = (u.email ?? "").padEnd(30);
    const id = (u.id ?? "").padEnd(30);
    const role = (u.role ?? "").padEnd(10);
    console.log(`  ${name} | ${email} | ${id} | ${role}`);
  }

  // --- 3. Auto-match by email ---
  console.log("\n\n=== Proposed Mapping ===\n");

  let matchCount = 0;
  let unmatchedNah: NahUser[] = [];
  let unmatchedGhl: GhlUser[] = [...ghlUsers];

  for (const nah of nahUsers) {
    const ghlMatch = ghlUsers.find((g) => g.email?.toLowerCase() === nah.email?.toLowerCase());

    if (ghlMatch) {
      const status =
        nah.ghl_user_id === ghlMatch.id ? "ALREADY SET" : nah.ghl_user_id ? "WRONG — needs update" : "NEEDS SET";
      console.log(`  ${nah.full_name} (${nah.email})`);
      console.log(`    NAH OS id:      ${nah.id}`);
      console.log(`    Current ghl_id: ${nah.ghl_user_id ?? "(null)"}`);
      console.log(`    Correct ghl_id: ${ghlMatch.id}`);
      console.log(`    Status:         ${status}`);
      console.log();
      matchCount++;
      unmatchedGhl = unmatchedGhl.filter((g) => g.id !== ghlMatch.id);
    } else {
      unmatchedNah.push(nah);
    }
  }

  if (unmatchedNah.length > 0) {
    console.log("  --- NAH OS users with NO GHL match (by email) ---");
    for (const u of unmatchedNah) {
      console.log(`  ${u.full_name} (${u.email}) — no matching GHL user`);
    }
    console.log();
  }

  if (unmatchedGhl.length > 0) {
    console.log("  --- GHL users with NO NAH OS match ---");
    for (const u of unmatchedGhl) {
      console.log(`  ${u.name ?? `${u.firstName} ${u.lastName}`} (${u.email}) — GHL ID: ${u.id}`);
    }
    console.log();
  }

  console.log(
    `\nMatched: ${matchCount} | Unmatched NAH: ${unmatchedNah.length} | Unmatched GHL: ${unmatchedGhl.length}`
  );
  console.log("\nReview the mapping above. If correct, run the update script to write ghl_user_id values.");
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
