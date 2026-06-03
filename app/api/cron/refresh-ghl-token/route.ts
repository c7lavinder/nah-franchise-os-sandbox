export const dynamic = "force-dynamic";

/**
 * GET /api/cron/refresh-ghl-token
 *
 * Proactively refreshes the GHL OAuth token every 12 hours via Vercel cron.
 * GHL access tokens expire in 24h and refresh tokens are single-use,
 * so we refresh proactively to avoid stale tokens when no one uses the app.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

export async function GET(request: NextRequest) {
  const startedAt = new Date().toISOString();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      await supabase.from("cron_job_log").insert({
        job_name: "refresh-ghl-token",
        status: "success",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        result: {
          status: "fresh",
          hours_remaining: Math.round(hoursRemaining),
          expires_at: expiresAt.toISOString(),
        },
      });
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
    await supabase.from("cron_job_log").insert({
      job_name: "refresh-ghl-token",
      status: "failed",
      error: `HTTP ${response.status}: ${body.slice(0, 500)}`,
    });
    return NextResponse.json({ error: "Token refresh failed", status: response.status }, { status: 500 });
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000).toISOString();

  // Store new tokens
  await supabase
    .from("app_settings")
    .upsert(
      { setting_key: "ghl_access_token", setting_value: JSON.stringify(data.access_token) },
      { onConflict: "setting_key" }
    );
  await supabase
    .from("app_settings")
    .upsert(
      { setting_key: "ghl_refresh_token", setting_value: JSON.stringify(data.refresh_token) },
      { onConflict: "setting_key" }
    );
  await supabase
    .from("app_settings")
    .upsert(
      { setting_key: "ghl_token_expires_at", setting_value: JSON.stringify(expiresAt) },
      { onConflict: "setting_key" }
    );

  await supabase.from("cron_job_log").insert({
    job_name: "refresh-ghl-token",
    status: "success",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    result: { expires_at: expiresAt },
  });

  console.log("[cron/refresh-ghl-token] Refreshed, expires at:", expiresAt);
  return NextResponse.json({ status: "refreshed", expiresAt });
}
