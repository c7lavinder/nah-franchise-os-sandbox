/**
 * Sprint 2 Verification — Test 1: GHL API auth check
 * Calls GET /locations/{locationId} to verify PIT key works.
 */

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;

  const res = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
  });

  if (!res.ok) {
    console.error(`AUTH FAILED: HTTP ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(`Response: ${body.slice(0, 200)}`);
    process.exit(1);
  }

  const data = await res.json() as { location?: { id: string; name: string } };
  console.log(`✅ AUTH SUCCESS`);
  console.log(`Location: ${data.location?.name} (ID: ${data.location?.id})`);
}

main().catch((err) => { console.error("Script error:", err.message); process.exit(1); });
