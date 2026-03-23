/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 * Used by the frontend to check if the user is logged in.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const user = await getAuthUser(authHeader);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
