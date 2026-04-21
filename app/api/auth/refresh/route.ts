export const dynamic = "force-dynamic";

/**
 * POST /api/auth/refresh
 *
 * Swaps a Supabase refresh_token for a fresh access_token. Called by the
 * AuthContext on mount (and on a timer) so that a user who logged in
 * yesterday doesn't hit 401s on every protected endpoint today.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface RefreshRequestBody {
  refreshToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RefreshRequestBody;

    if (!body.refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: body.refreshToken,
    });

    if (error || !data.session) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    return NextResponse.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch {
    return NextResponse.json({ error: "Failed to refresh session" }, { status: 500 });
  }
}
