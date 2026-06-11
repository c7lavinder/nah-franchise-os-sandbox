export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 *
 * Authenticates a user via the MasterSuite API.
 * Sets an httpOnly cookie with the MasterSuite JWT.
 * Returns the FranDev user profile from the local users table.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { setAuthCookie } from "@/lib/auth/cookies";
import type { User } from "@/types/database";

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;

    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const requestedEmail = body.email.trim().toLowerCase();
    let authenticatedEmail = requestedEmail;
    let token: string | null = null;

    // Authenticate with MasterSuite API first. If the MasterSuite service is
    // unavailable or the credentials are not present there, fall back to
    // Supabase Auth so temporary app-only passwords still work.
    const apiUrl = process.env.MASTERSUITE_API_URL;
    if (apiUrl) {
      // Be tolerant of private-network service names. Some self-hosted
      // deployments provide `mastersuite-api` or `://mastersuite-api`; normalize
      // both to http:// so login does not crash on URL construction.
      const normalizedApiUrl = apiUrl.startsWith("://")
        ? `http${apiUrl}`
        : /^https?:\/\//i.test(apiUrl)
          ? apiUrl
          : `http://${apiUrl}`;

      try {
        const loginUrl = new URL("/auth/login", normalizedApiUrl).toString();
        const authResponse = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: body.email,
            password: body.password,
          }),
        });

        if (authResponse.ok) {
          const authData = await authResponse.json();
          token = authData.jwt ?? null;
        }
      } catch (err) {
        console.error("MasterSuite login failed, trying Supabase fallback:", err);
      }
    }

    const authSupabase = createServerClient();
    if (!token) {
      const { data: supabaseAuth, error: supabaseAuthError } = await authSupabase.auth.signInWithPassword({
        email: requestedEmail,
        password: body.password,
      });

      token = supabaseAuth.session?.access_token ?? null;
      if (supabaseAuthError || !token) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
      authenticatedEmail = supabaseAuth.user?.email?.trim().toLowerCase() ?? requestedEmail;
    }

    // Look up the app user record with a fresh service-role client. The auth
    // client above may carry the newly signed-in user's session after
    // signInWithPassword, which would make this query subject to RLS.
    const supabase = createServerClient();
    let { data: appUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", authenticatedEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (!appUser && authenticatedEmail !== requestedEmail) {
      const retry = await supabase
        .from("users")
        .select("*")
        .eq("email", requestedEmail)
        .eq("is_active", true)
        .maybeSingle();
      appUser = retry.data;
      userError = retry.error;
    }

    if (userError || !appUser) {
      return NextResponse.json(
        { error: "Account not found or deactivated. Contact your administrator." },
        { status: 403 }
      );
    }

    const user = appUser as User;

    // Update last login timestamp
    await supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        ghlUserId: user.ghl_user_id,
      },
    });

    return setAuthCookie(response, token);
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
