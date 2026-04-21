/**
 * Resolve a call-type slug to its row id + display name.
 * Small wrapper used by every code path that inserts a `calls` row so the
 * slug→id lookup is centralized.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedCallType {
  id: string | null;
  name: string | null;
}

export async function resolveCallTypeBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ResolvedCallType> {
  const { data } = await supabase
    .from("call_types")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  return { id: data?.id ?? null, name: data?.name ?? null };
}
