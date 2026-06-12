/**
 * Auth session utilities — verifies MasterSuite or Supabase Auth tokens and resolves the app user.
 * Used by API routes and server components to check authentication.
 */

import jwt from "jsonwebtoken";
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

/** Claims in the MasterSuite JWT (PascalCase from the .NET API) */
interface MasterSuiteClaims {
  Username: string; // email address
  Name: string;
  Permissions: Record<string, boolean>;
  Territories: string[];
  Expiration: string;
}

/**
 * Gets the current authenticated user from a MasterSuite JWT or Supabase Auth access token.
 * Verifies the token, then looks up the app user by email.
 * Returns null if not authenticated.
 */
export async function getAuthUser(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;

  let email: string | null = null;
  const secret = process.env.MASTERSUITE_API_JWT_SECRET;

  if (secret) {
    // Verify the MasterSuite JWT signature (HS512).
    let claims: MasterSuiteClaims | null = null;
    try {
      // MasterSuite uses a custom Expiration field, not the standard `exp` claim,
      // so we disable built-in expiration check and handle it ourselves.
      claims = jwt.verify(token, secret, {
        algorithms: ["HS512"],
        ignoreExpiration: true,
      }) as MasterSuiteClaims;
    } catch {
      claims = null;
    }

    if (claims) {
      // Check custom expiration field.
      if (claims.Expiration) {
        const expiresAt = new Date(claims.Expiration).getTime();
        if (Date.now() > expiresAt) {
          return null;
        }
      }

      email = claims.Username ?? null;
    }
  } else {
    console.error("MASTERSUITE_API_JWT_SECRET is not set");
  }

  // Look up the app user record by email
  const supabase = createServerClient();
  if (!email) {
    const { data: supabaseUser, error: supabaseUserError } = await supabase.auth.getUser(token);
    if (supabaseUserError || !supabaseUser.user?.email) {
      return null;
    }
    email = supabaseUser.user.email;
  }

  const { data: appUser, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
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
