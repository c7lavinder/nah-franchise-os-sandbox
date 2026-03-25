export const dynamic = "force-dynamic";

/**
 * GET /api/auth/crm/callback
 *
 * GHL OAuth callback — receives the authorization code,
 * exchanges it for access + refresh tokens, and stores
 * both in the app_settings table in Supabase.
 *
 * Per ghl-masterclass/knowledge/oauth-flow.md:
 * - Code expires in 10 minutes — exchange immediately
 * - Access token expires in 24 hours
 * - Refresh token is single-use — store the new one on every refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/crm/callback`;

  // Handle OAuth errors
  if (error) {
    console.error("GHL OAuth error:", error);
    return NextResponse.redirect(
      `${appUrl}/settings?error=crm_auth_failed&detail=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/settings?error=crm_auth_failed&detail=no_code`
    );
  }

  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${appUrl}/settings?error=crm_auth_failed&detail=missing_credentials`
    );
  }

  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("GHL token exchange failed:", tokenResponse.status, errorBody);
      return NextResponse.redirect(
        `${appUrl}/settings?error=crm_auth_failed&detail=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();

    // Store tokens in Supabase app_settings
    const supabase = createServerClient();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 86400) * 1000).toISOString();

    // Upsert each token value
    const settings = [
      {
        setting_key: "ghl_access_token",
        setting_value: JSON.stringify(tokenData.access_token),
        description: "GHL OAuth access token — expires every 24h",
      },
      {
        setting_key: "ghl_refresh_token",
        setting_value: JSON.stringify(tokenData.refresh_token),
        description: "GHL OAuth refresh token — single-use, replaced on every refresh",
      },
      {
        setting_key: "ghl_token_expires_at",
        setting_value: JSON.stringify(expiresAt),
        description: "When the current GHL access token expires",
      },
      {
        setting_key: "ghl_location_id",
        setting_value: JSON.stringify(tokenData.locationId ?? process.env.GHL_LOCATION_ID),
        description: "GHL location ID from OAuth",
      },
      {
        setting_key: "ghl_user_id",
        setting_value: JSON.stringify(tokenData.userId ?? null),
        description: "GHL user ID from OAuth",
      },
      {
        setting_key: "ghl_oauth_connected_at",
        setting_value: JSON.stringify(now),
        description: "When GHL OAuth was last connected",
      },
    ];

    for (const setting of settings) {
      await supabase
        .from("app_settings")
        .upsert(setting, { onConflict: "setting_key" });
    }

    console.log("GHL OAuth connected successfully:", {
      locationId: tokenData.locationId,
      userId: tokenData.userId,
      expiresAt,
    });

    // Redirect to settings page with success
    return NextResponse.redirect(`${appUrl}/settings?crm=connected`);
  } catch (err) {
    console.error("GHL OAuth callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=crm_auth_failed&detail=unexpected_error`
    );
  }
}
