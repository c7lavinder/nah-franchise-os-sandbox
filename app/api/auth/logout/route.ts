export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Signs out the current user. The frontend should clear the stored token.
 */

import { NextResponse } from "next/server";

export async function POST() {
  // Supabase Auth tokens are stateless JWTs — there's no server-side session to invalidate.
  // The frontend clears the token from localStorage.
  // In the future, we can add token blacklisting if needed.
  return NextResponse.json({ success: true });
}
