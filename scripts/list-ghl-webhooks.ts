/**
 * Sprint 2 Verification — Test 3: List GHL webhooks
 * Checks if our webhook URL is registered in GHL.
 */

const GHL = "https://services.leadconnectorhq.com";

async function tryEndpoint(url: string, apiKey: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
    });
    if (!res.ok) {
      console.log(`  ${url} → HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.log(`  ${url} → error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main() {
  const apiKey = process.env.GHL_API_KEY!;
  const locationId = process.env.GHL_LOCATION_ID!;

  console.log("Checking GHL for registered webhooks...\n");

  // Try the webhooks endpoints
  const endpoints = [
    `${GHL}/locations/${locationId}/webhooks`,
    `${GHL}/hooks/?locationId=${locationId}`,
    `${GHL}/webhooks/?locationId=${locationId}`,
  ];

  let foundAny = false;
  const allUrls: string[] = [];

  for (const url of endpoints) {
    console.log(`Trying: ${url}`);
    const data = await tryEndpoint(url, apiKey) as Record<string, unknown> | null;
    if (!data) continue;

    // Try to extract webhook URLs from various response shapes
    const webhooks = (data.webhooks ?? data.hooks ?? data.data ?? []) as Array<Record<string, unknown>>;
    if (Array.isArray(webhooks) && webhooks.length > 0) {
      foundAny = true;
      for (const wh of webhooks) {
        const whUrl = (wh.url ?? wh.targetUrl ?? wh.webhookUrl ?? "") as string;
        const event = (wh.event ?? wh.events ?? wh.type ?? "") as string;
        console.log(`  → ${whUrl} (event: ${JSON.stringify(event)})`);
        if (whUrl) allUrls.push(whUrl);
      }
    } else {
      console.log("  → no webhooks returned");
    }
  }

  // Check for our URL
  console.log("\n=== Result ===");
  const ourUrls = allUrls.filter((u) =>
    u.includes("nah-franchise-os-sandbox") || u.includes("/api/webhooks/ghl")
  );

  if (ourUrls.length > 0) {
    console.log("✅ Our webhook is registered:");
    for (const u of ourUrls) console.log(`  ${u}`);
  } else if (foundAny) {
    console.log("⚠️ Webhooks exist but NONE point to our endpoint");
    console.log("HUMAN ACTION NEEDED: Register webhook in GHL → /api/webhooks/ghl/contacts");
  } else {
    console.log("⚠️ No webhooks found in any checked endpoint");
    console.log("HUMAN ACTION NEEDED: Register webhook in GHL → /api/webhooks/ghl/contacts");
  }
}

main().catch((err) => { console.error("Script error:", err.message); process.exit(1); });
