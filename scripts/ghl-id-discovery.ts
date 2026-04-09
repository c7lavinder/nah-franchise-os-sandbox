/**
 * GHL ID Discovery Script
 *
 * Pulls and stores all GHL IDs needed for NAH OS:
 * - 7 calendar IDs (Intro, Discovery, Validation, Capital, FDD Review, Territory, Awarding)
 * - Custom field IDs (nah_sales_stage_id, nah_onboarding_stage_id, nah_followup_stage_id)
 * - User IDs (Chad, Matt, Sam, Mark, Ryland, John, Corey)
 * - Active campaign IDs
 *
 * Stores everything in app_settings as structured JSON.
 *
 * Usage: npx tsx scripts/ghl-id-discovery.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, GHL_API_KEY, GHL_LOCATION_ID
 */

import "dotenv/config";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

async function ghlGet<T>(endpoint: string): Promise<T> {
  const token = process.env.GHL_API_KEY;
  if (!token) throw new Error("Missing GHL_API_KEY");

  const response = await fetch(`${GHL_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GHL ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

async function main() {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    console.error("Missing GHL_LOCATION_ID");
    process.exit(1);
  }

  console.log("=== GHL ID Discovery ===\n");

  const results: Record<string, unknown> = {};

  // 1. Discover calendars
  console.log("1. Discovering calendars...");
  try {
    const { calendars } = await ghlGet<{ calendars: { id: string; name: string }[] }>(
      `/calendars/?locationId=${locationId}`
    );

    const calendarMap: Record<string, string> = {};
    const calendarNames = ["Intro", "Discovery", "Validation", "Capital", "FDD Review", "Territory", "Awarding"];

    for (const name of calendarNames) {
      const match = calendars.find(
        (c) => c.name.toLowerCase().includes(name.toLowerCase())
      );
      if (match) {
        const key = name.toLowerCase().replace(/\s+/g, "_");
        calendarMap[key] = match.id;
        console.log(`  ✅ ${name}: ${match.id}`);
      } else {
        console.log(`  ❌ ${name}: NOT FOUND`);
      }
    }

    results.ghl_calendars = calendarMap;
    console.log(`  Found ${Object.keys(calendarMap).length}/${calendarNames.length} calendars\n`);
  } catch (err) {
    console.error("  Calendar discovery failed:", err);
  }

  // 2. Discover custom fields
  console.log("2. Discovering custom fields...");
  try {
    const { customFields } = await ghlGet<{
      customFields: { id: string; name: string; fieldKey?: string }[];
    }>(`/locations/${locationId}/customFields`);

    const fieldMap: Record<string, string> = {};
    const targetFields = ["nah_sales_stage_id", "nah_onboarding_stage_id", "nah_follow_up_stage_id", "nah_coaching_stage_id"];

    for (const target of targetFields) {
      const match = customFields.find(
        (f) => f.fieldKey === `contact.${target}` || f.name === target
      );
      if (match) {
        fieldMap[target] = match.id;
        console.log(`  ✅ ${target}: ${match.id}`);
      } else {
        console.log(`  ❌ ${target}: NOT FOUND`);
      }
    }

    results.ghl_custom_fields = fieldMap;
    console.log(`  Found ${Object.keys(fieldMap).length}/${targetFields.length} fields\n`);
  } catch (err) {
    console.error("  Custom field discovery failed:", err);
  }

  // 3. Discover users
  console.log("3. Discovering users...");
  try {
    const { users } = await ghlGet<{
      users: { id: string; name: string; firstName?: string; lastName?: string; email?: string }[];
    }>(`/users/?locationId=${locationId}`);

    const userMap: Record<string, string> = {};
    const targetUsers = ["Chad", "Matt", "Sam", "Mark", "Ryland", "John", "Corey"];

    for (const name of targetUsers) {
      const match = users.find(
        (u) =>
          u.name?.toLowerCase().includes(name.toLowerCase()) ||
          u.firstName?.toLowerCase() === name.toLowerCase()
      );
      if (match) {
        userMap[name.toLowerCase()] = match.id;
        console.log(`  ✅ ${name}: ${match.id}`);
      } else {
        console.log(`  ❌ ${name}: NOT FOUND`);
      }
    }

    results.ghl_users = userMap;
    console.log(`  Found ${Object.keys(userMap).length}/${targetUsers.length} users\n`);
  } catch (err) {
    console.error("  User discovery failed:", err);
  }

  // 4. Store calendar → sub-task mapping
  results.subtask_to_calendar = {
    intro_call: "intro",
    matt_call: "discovery",
    sam_call: "validation",
    mark_call: "capital",
    fdd_review_call: "fdd_review",
    territory_call: "territory",
    matt_final_call: "awarding",
  };

  results.calendar_to_default_rep = {
    intro: "chad",
    discovery: "matt",
    validation: "sam",
    capital: "mark",
    fdd_review: "chad",
    territory: "chad",
    awarding: "matt",
  };

  // Save to Supabase app_settings
  console.log("4. Saving to app_settings...");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  for (const [key, value] of Object.entries(results)) {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          setting_key: key,
          setting_value: JSON.stringify(value),
          description: `GHL ID discovery: ${key}`,
        },
        { onConflict: "setting_key" }
      );

    if (error) {
      console.error(`  ❌ Failed to save ${key}: ${error.message}`);
    } else {
      console.log(`  ✅ Saved ${key}`);
    }
  }

  console.log("\n=== Discovery complete ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
