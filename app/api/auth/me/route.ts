export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 * Used by the frontend to check if the user is logged in.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  return NextResponse.json({ user });
}
