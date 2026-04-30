export const dynamic = "force-dynamic";

/**
 * POST /api/auth/refresh
 *
 * Swaps a Supabase refresh_token for a fresh access_token.
 * Reads refresh token from httpOnly cookie, sets new cookies in response.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRefreshTokenFromCookies, setAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = getRefreshTokenFromCookies(request);

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    return setAuthCookies(response, data.session.access_token, data.session.refresh_token);
  } catch {
    return NextResponse.json({ error: "Failed to refresh session" }, { status: 500 });
  }
}
