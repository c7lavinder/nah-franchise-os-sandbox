export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password via Supabase Auth.
 * Sets httpOnly cookies for access + refresh tokens.
 * Returns the user profile in the JSON body.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { setAuthCookies } from "@/lib/auth/cookies";
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

    // Sign in with Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Authentication service is not configured" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError || !authData.session) {
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

    return setAuthCookies(response, authData.session.access_token, authData.session.refresh_token);
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
