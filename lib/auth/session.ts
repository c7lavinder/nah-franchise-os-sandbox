/**
 * Auth session utilities — reads the current user from httpOnly cookies.
 * Used by API routes and server components to check authentication.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getAccessTokenFromCookies } from "@/lib/auth/cookies";
import { hasPermission, type PermissionAction } from "@/lib/auth/permissions";
import type { User, UserRole } from "@/types/database";

/** The authenticated user with app-level fields */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  ghlUserId: string | null;
}

/**
 * Gets the current authenticated user from a Supabase Auth token.
 * Accepts a raw JWT string (from cookie or header).
 * Returns null if not authenticated.
 */
export async function getAuthUser(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;

  const supabase = createServerClient();

  // Verify the JWT and get the Supabase Auth user
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    return null;
  }

  // Look up the app user record by email
  const { data: appUser, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", authUser.email)
    .eq("is_active", true)
    .single();

  if (userError || !appUser) {
    return null;
  }

  const user = appUser as User;

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    ghlUserId: user.ghl_user_id,
  };
}

/**
 * Requires authentication — returns the AuthUser or a 401/403 Response.
 * Reads token from httpOnly cookie first, then falls back to Authorization header.
 * Callers must check: if (user instanceof Response) return user;
 *
 * Optional `action` parameter enforces role-based permission from the centralized map.
 *   const user = await requireAuth(request, "calls:delete");
 */
export async function requireAuth(request: Request, action?: PermissionAction): Promise<AuthUser | Response> {
  // Try httpOnly cookie first
  let token = getAccessTokenFromCookies(request);

  // Fallback to Authorization header (cron jobs, webhooks, backward compat)
  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  const user = await getAuthUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If an action is specified, check role-based permission
  if (action && !hasPermission(user.role, action)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}
