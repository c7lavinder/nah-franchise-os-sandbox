export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * Clears httpOnly auth cookies.
 */

import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/cookies";

export async function POST() {
  const response = NextResponse.json({ success: true });
  return clearAuthCookies(response);
}
