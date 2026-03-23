/**
 * GET /api/health
 *
 * Health check endpoint — verifies connectivity to all external services.
 * Used by deployment platforms for health monitoring.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const services: Record<string, { status: string; error?: string }> = {};

  // Check Supabase
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("app_settings").select("id").limit(1);
    services.database = error ? { status: "error", error: error.message } : { status: "connected" };
  } catch (err) {
    services.database = { status: "error", error: err instanceof Error ? err.message : "Unknown" };
  }

  // Check Anthropic API key is configured
  services.claude = process.env.ANTHROPIC_API_KEY
    ? { status: "configured" }
    : { status: "not_configured", error: "Missing ANTHROPIC_API_KEY" };

  // Check GHL API key is configured
  services.ghl = process.env.GHL_API_KEY
    ? { status: "configured" }
    : { status: "not_configured", error: "Missing GHL_API_KEY" };

  // Check Whisper API key is configured
  services.whisper = process.env.OPENAI_API_KEY
    ? { status: "configured" }
    : { status: "not_configured", error: "Missing OPENAI_API_KEY" };

  const allHealthy = Object.values(services).every(
    (s) => s.status === "connected" || s.status === "configured"
  );

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
