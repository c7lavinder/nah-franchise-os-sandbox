/**
 * GET /api/settings/integrations
 *
 * Returns connection status for all integrations (GHL, Anthropic).
 * Used by the Settings page to show live status badges.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();

  // Check GHL OAuth status
  let ghlConnected = false;
  let ghlConnectedAt: string | null = null;
  try {
    const { data: tokenRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "ghl_access_token")
      .single();

    if (tokenRow?.setting_value) {
      ghlConnected = true;
      const { data: connRow } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "ghl_oauth_connected_at")
        .single();
      ghlConnectedAt = connRow?.setting_value
        ? JSON.parse(connRow.setting_value)
        : null;
    }
  } catch {
    // Not connected
  }

  // Check if PIT key fallback is available
  const ghlPitKey = !!process.env.GHL_API_KEY;

  // Check Anthropic API key
  const anthropicConnected = !!process.env.ANTHROPIC_API_KEY;

  // Check Whisper (OpenAI) API key
  const whisperConnected = !!process.env.OPENAI_API_KEY;

  return NextResponse.json({
    ghl: {
      connected: ghlConnected || ghlPitKey,
      method: ghlConnected ? "oauth" : ghlPitKey ? "api_key" : "none",
      connectedAt: ghlConnectedAt,
    },
    anthropic: {
      connected: anthropicConnected,
    },
    whisper: {
      connected: whisperConnected,
    },
  });
}
