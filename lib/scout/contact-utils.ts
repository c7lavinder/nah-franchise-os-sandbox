import { optionalEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";

export type ScoutContactInfo = { name: string; phone: string | null; email: string | null };

/** Build a Supabase .or() filter that safely matches both ghl_contact_id and id.
 * Non-UUID strings must not be compared against the UUID id column.
 */
export function contactIdFilter(contactId: string): string {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId);
  return isUUID ? `ghl_contact_id.eq.${contactId},id.eq.${contactId}` : `ghl_contact_id.eq.${contactId}`;
}

/** Look up a contact name from Supabase by GHL ID or UUID. Avoids GHL API calls. */
export async function getContactName(contactId: string): Promise<string> {
  const info = await getContactInfo(contactId);
  return info.name;
}

/** Look up contact name + phone + email from Supabase. */
export async function getContactInfo(contactId: string): Promise<ScoutContactInfo> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, phone, email")
      .or(contactIdFilter(contactId))
      .limit(1)
      .single();
    if (data) {
      return {
        name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Unknown Contact",
        phone: data.phone ?? null,
        email: data.email ?? null,
      };
    }
  } catch {
    /* fall through */
  }
  return { name: "Unknown Contact", phone: null, email: null };
}

/** Look up current user's name from their GHL ID. */
export async function getUserName(ghlUserId: string | null): Promise<string | null> {
  if (!ghlUserId) return null;
  try {
    const supabase = createServerClient();
    const { data } = await supabase.from("users").select("full_name").eq("ghl_user_id", ghlUserId).single();
    return data?.full_name ?? null;
  } catch {
    return null;
  }
}

/** Resolve the current user's email and name for message drafts. */
export async function resolveCurrentUserEmail(
  userId: string | null,
  ghlUserId: string | null
): Promise<{ email: string; name: string | null }> {
  const fallbackEmail = optionalEnv("GHL_SENDING_EMAIL", "notifications@newagainhouses.com");
  if (!userId && !ghlUserId) return { email: fallbackEmail, name: null };
  try {
    const supabase = createServerClient();
    const query = userId
      ? supabase.from("users").select("email, full_name").eq("id", userId).single()
      : supabase.from("users").select("email, full_name").eq("ghl_user_id", ghlUserId!).single();
    const { data } = await query;
    return {
      email: data?.email ?? fallbackEmail,
      name: data?.full_name ?? null,
    };
  } catch {
    return { email: fallbackEmail, name: null };
  }
}

/** Look up a team member by name, returning their GHL user id and display name. */
export async function resolveUserByName(name: string): Promise<{ ghlUserId: string; fullName: string } | null> {
  if (!name) return null;
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("users")
      .select("ghl_user_id, full_name")
      .ilike("full_name", `%${name}%`)
      .limit(1)
      .single();
    if (data?.ghl_user_id) return { ghlUserId: data.ghl_user_id, fullName: data.full_name };
    return null;
  } catch {
    return null;
  }
}
