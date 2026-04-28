export const dynamic = "force-dynamic";

/**
 * GET  /api/intelligence/market-signals?type=X&key=X — list market signals
 * POST /api/intelligence/market-signals — log a new market signal
 *
 * Per intelligence plan: "Log now, query later."
 * These signals feed the future prediction engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const { searchParams } = new URL(request.url);
    const signalType = searchParams.get("type");
    const signalKey = searchParams.get("key");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const supabase = createServerClient();

    let query = supabase
      .from("market_signals")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(limit);

    if (signalType) query = query.eq("signal_type", signalType);
    if (signalKey) query = query.eq("signal_key", signalKey);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signals: data ?? [] });
  } catch (err) {
    console.error("GET market-signals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const { signalType, signalKey, signalValue, source } = body;

    if (!signalType || !signalKey || !signalValue) {
      return NextResponse.json(
        { error: "signalType, signalKey, and signalValue are required" },
        { status: 400 }
      );
    }

    const { data: signal, error } = await supabase
      .from("market_signals")
      .insert({
        signal_type: signalType,
        signal_key: signalKey,
        signal_value: signalValue,
        source: source ?? "manual",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signal }, { status: 201 });
  } catch (err) {
    console.error("POST market-signals error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
