export const dynamic = "force-dynamic";

/**
 * GET /api/auth/debug — checks auth configuration (no secrets exposed)
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Try a simple auth call
  let authStatus = "unknown";
  let authError: string | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await client.auth.signInWithPassword({
        email: "test@nonexistent.com",
        password: "test",
      });
      // We expect "Invalid login credentials" — that means auth is working
      authStatus = error ? "reachable" : "unexpected_success";
      authError = error?.message ?? null;
    } catch (err) {
      authStatus = "unreachable";
      authError = err instanceof Error ? err.message : "Unknown error";
    }
  } else {
    authStatus = "not_configured";
  }

  return NextResponse.json({
    supabaseUrl: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : "MISSING",
    anonKeySet: !!supabaseAnonKey,
    anonKeyLength: supabaseAnonKey?.length ?? 0,
    authStatus,
    authError,
  });
}
