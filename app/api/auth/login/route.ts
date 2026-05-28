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

    // Authenticate with MasterSuite API
    const apiUrl = process.env.MASTERSUITE_API_URL;
    if (!apiUrl) {
      return NextResponse.json({ error: "Authentication service is not configured" }, { status: 500 });
    }

    let loginUrl: string;
    try {
      loginUrl = new URL("/auth/login", apiUrl).toString();
    } catch {
      console.error("Invalid MASTERSUITE_API_URL", { apiUrl });
      return NextResponse.json({ error: "Authentication service URL is invalid" }, { status: 500 });
    }
    const authResponse = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: body.email,
        password: body.password,
      }),
    });

    if (!authResponse.ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const authData = await authResponse.json();
    const token = authData.jwt;

    if (!token) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Look up the app user record
    const supabase = createServerClient();
    const { data: appUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", body.email)
      .eq("is_active", true)
      .single();

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
