/**
 * Register GHL webhook subscriptions via the API.
 *
 * Uses OAuth token from Supabase app_settings (same as lib/ghl/client.ts).
 *
 * Events to subscribe:
 * - ContactCreate    → /api/webhooks/ghl/contacts (new leads)
 * - InboundMessage   → /api/webhooks/ghl (prospect replies)
 * - OutboundMessage  → /api/webhooks/ghl (delivery confirmations)
 * - OpportunityStageUpdate → /api/webhooks/ghl (pipeline moves)
 *
 * Run: source .env.local && npx tsx scripts/register-ghl-webhooks.ts
 */

import { createClient } from "@supabase/supabase-js";

const GHL = "https://services.leadconnectorhq.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nah-franchise-os-sandbox.vercel.app";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/frandev";

interface WebhookConfig {
  name: string;
  url: string;
  events: string[];
}

const WEBHOOKS: WebhookConfig[] = [
  {
    name: "NAH OS — Messages",
    url: `${APP_URL}${BASE_PATH}/api/webhooks/ghl`,
    events: ["InboundMessage", "OutboundMessage"],
  },
];

async function getOAuthToken(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env vars required");

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "ghl_access_token")
    .single();

  if (!data?.setting_value) throw new Error("No GHL OAuth token in app_settings. Connect OAuth at /settings first.");
  return JSON.parse(data.setting_value as string) as string;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

async function listWebhooks(token: string): Promise<Array<{ id: string; url: string; events: string[] }>> {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error("GHL_LOCATION_ID is required");

  const res = await fetch(`${GHL}/webhooks/?locationId=${locationId}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    console.log(`List webhooks: HTTP ${res.status} — ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return (data.webhooks ?? []) as Array<{ id: string; url: string; events: string[] }>;
}

async function createWebhook(token: string, config: WebhookConfig): Promise<boolean> {
  const locationId = process.env.GHL_LOCATION_ID;

  console.log(`\nRegistering: ${config.name}`);
  console.log(`  URL: ${config.url}`);
  console.log(`  Events: ${config.events.join(", ")}`);

  const res = await fetch(`${GHL}/webhooks/`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      url: config.url,
      events: config.events,
      name: config.name,
      locationId,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`  Result: REGISTERED (id: ${data.id ?? data.webhook?.id ?? "unknown"})`);
    return true;
  } else {
    const body = await res.text();
    console.log(`  Result: FAILED (HTTP ${res.status})`);
    if (body) console.log(`  Body: ${body}`);
    return false;
  }
}

async function main() {
  console.log("=== GHL Webhook Registration ===\n");
  console.log(`App URL: ${APP_URL}${BASE_PATH}`);

  const token = await getOAuthToken();
  console.log("OAuth token loaded from Supabase.\n");

  // List existing webhooks
  console.log("Checking existing webhooks...");
  const existing = await listWebhooks(token);
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing webhook(s):`);
    for (const wh of existing) {
      console.log(`  [${wh.id}] ${wh.url} → ${(wh.events ?? []).join(", ")}`);
    }
  } else {
    console.log("No existing webhooks found.");
  }

  // Register missing webhooks
  const missing = WEBHOOKS.filter((w) => !existing.some((e) => e.url === w.url));
  if (missing.length === 0) {
    console.log("\nAll webhooks are already registered. Nothing to do.");
    return;
  }

  console.log(`\nRegistering ${missing.length} webhook(s)...`);
  let success = 0;
  for (const wh of missing) {
    if (await createWebhook(token, wh)) success++;
  }

  console.log(`\n=== Done: ${success}/${missing.length} registered ===`);
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});
