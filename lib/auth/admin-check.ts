// TODO: DELETE THIS FILE — broken admin check, falls back to body-supplied userId
// All callers being migrated to requireAuth + role check in Tier 0b Phase 2d
// See docs/AUTH_AUDIT.md

/**
 * Reusable admin check for settings API routes.
 * Tries Bearer auth first, falls back to userId in body.
 */

import { createServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";

export async function requireAdmin(
  authHeader: string | null,
  bodyUserId?: string
): Promise<{ userId: string } | { error: string; status: number }> {
  const authUser = await getAuthUser(authHeader);
  const userId = authUser?.id ?? bodyUserId;

  if (!userId) return { error: "Unauthorized", status: 401 };

  const supabase = createServerClient();
  const { data } = await supabase.from("users").select("role").eq("id", userId).single();
  if (data?.role !== "admin") return { error: "Admin access required", status: 403 };

  return { userId };
}
