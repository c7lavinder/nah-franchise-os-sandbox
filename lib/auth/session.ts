/**
 * Auth session utilities — reads the current user from Supabase Auth cookies.
 * Used by API routes and server components to check authentication.
 */

import { createServerClient } from "@/lib/supabase/server";
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
 * Gets the current authenticated user from a Supabase Auth session token.
 * Pass the Authorization header value from the request.
 * Returns null if not authenticated.
 */
export async function getAuthUser(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createServerClient();

  // Verify the JWT and get the Supabase Auth user
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

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
 * Requires authentication — returns the AuthUser or a 401 Response.
 * Callers must check: if (user instanceof Response) return user;
 */
export async function requireAuth(request: Request): Promise<AuthUser | Response> {
  const authHeader = request.headers.get("Authorization");
  const user = await getAuthUser(authHeader);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}
