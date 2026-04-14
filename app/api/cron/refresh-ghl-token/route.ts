export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh-ghl-token
 *
 * Proactively refreshes the GHL OAuth token every 12 hours via Vercel cron.
 * GHL access tokens expire in 24h and refresh tokens are single-use,
 * so we refresh proactively to avoid stale tokens when no one uses the app.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

export async function GET() {
  const supabase = createServerClient();

  // Get current refresh token
  const { data: refreshRow } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "ghl_refresh_token")
    .single();

  if (!refreshRow?.setting_value) {
    return NextResponse.json({ error: "No refresh token stored" }, { status: 500 });
  }

  const refreshToken = JSON.parse(refreshRow.setting_value) as string;
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "GHL_CLIENT_ID or GHL_CLIENT_SECRET not configured" }, { status: 500 });
  }

  // Check if token is still fresh (more than 6 hours remaining)
  const { data: expiresRow } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "ghl_token_expires_at")
    .single();

  if (expiresRow?.setting_value) {
    const expiresAt = new Date(JSON.parse(expiresRow.setting_value) as string);
    const hoursRemaining = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining > 6) {
      return NextResponse.json({ status: "fresh", hoursRemaining: Math.round(hoursRemaining) });
    }
  }

  // Refresh the token
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[cron/refresh-ghl-token] Failed:", response.status, body);
    return NextResponse.json({ error: "Token refresh failed", status: response.status }, { status: 500 });
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString();

  // Store new tokens
  await supabase.from("app_settings").upsert(
    { setting_key: "ghl_access_token", setting_value: JSON.stringify(data.access_token) },
    { onConflict: "setting_key" }
  );
  await supabase.from("app_settings").upsert(
    { setting_key: "ghl_refresh_token", setting_value: JSON.stringify(data.refresh_token) },
    { onConflict: "setting_key" }
  );
  await supabase.from("app_settings").upsert(
    { setting_key: "ghl_token_expires_at", setting_value: JSON.stringify(expiresAt) },
    { onConflict: "setting_key" }
  );

  console.log("[cron/refresh-ghl-token] Refreshed, expires at:", expiresAt);
  return NextResponse.json({ status: "refreshed", expiresAt });
}
