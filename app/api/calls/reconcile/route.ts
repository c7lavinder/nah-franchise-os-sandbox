export const dynamic = "force-dynamic";

/**
 * POST /api/calls/reconcile — re-link all call participants to contacts and territories.
 *
 * Fixes calls where participants weren't matched at classification time
 * (contact didn't exist yet, or wasn't in the DB when webhook arrived).
 *
 * Safe to run repeatedly — only updates null contact_id/user_id fields.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createServerClient();

  // 1. Build email → contact map (fetch all — may be 2000+)
  let allContacts: { id: string; email: string; ghl_contact_id: string; first_name: string | null; last_name: string | null }[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("contacts")
      .select("id, email, ghl_contact_id, first_name, last_name")
      .not("email", "is", null)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    allContacts = allContacts.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  const contacts = allContacts;

  const emailToContact = new Map<string, { id: string; ghl_contact_id: string; name: string }>();
  for (const c of contacts ?? []) {
    if (c.email) {
      emailToContact.set(c.email.toLowerCase(), {
        id: c.id,
        ghl_contact_id: c.ghl_contact_id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      });
    }
  }

  // 2. Build email → user map
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name")
    .eq("is_active", true)
    .not("email", "is", null);

  const emailToUser = new Map<string, { id: string; name: string }>();
  for (const u of users ?? []) {
    if (u.email) emailToUser.set(u.email.toLowerCase(), { id: u.id, name: u.full_name });
  }

  // 3. Build ghl_contact_id → territory map
  const { data: owners } = await supabase
    .from("territory_owners")
    .select("ms_slug, ghl_contact_id")
    .is("end_date", null);

  const ghlToTerritory = new Map<string, string>();
  for (const o of owners ?? []) {
    ghlToTerritory.set(o.ghl_contact_id, o.ms_slug);
  }

  // 4. Find all participants needing fixes:
  //    - No contact_id AND no user_id (completely unlinked)
  //    - OR has email display name that needs cleaning
  const { data: orphans } = await supabase
    .from("call_participants")
    .select("id, call_id, email, display_name, contact_id, user_id, role")
    .is("contact_id", null)
    .is("user_id", null);

  let participantsFixed = 0;
  let callsFixed = 0;
  const callUpdates = new Map<string, { contact_id: string; territory_ms_slug: string | null }>();

  for (const p of orphans ?? []) {
    const email = p.email?.toLowerCase();
    if (!email) continue;

    const updates: Record<string, unknown> = {};

    // Try user match first
    if (!p.user_id && emailToUser.has(email)) {
      const user = emailToUser.get(email)!;
      updates.user_id = user.id;
      updates.role = "nah_team";
      if (!p.display_name || p.display_name.includes("@")) {
        updates.display_name = user.name;
      }
    }

    // Try contact match
    if (!p.contact_id && !emailToUser.has(email) && emailToContact.has(email)) {
      const contact = emailToContact.get(email)!;
      updates.contact_id = contact.id;
      if (!p.display_name || p.display_name.includes("@")) {
        updates.display_name = contact.name;
      }

      // Determine role
      const territorySlug = ghlToTerritory.get(contact.ghl_contact_id);
      if (territorySlug) {
        updates.role = "franchisee";
        // Queue call-level update
        callUpdates.set(p.call_id, {
          contact_id: contact.id,
          territory_ms_slug: territorySlug,
        });
      } else {
        updates.role = "prospect";
        // Still link to call if no other contact assigned
        if (!callUpdates.has(p.call_id)) {
          callUpdates.set(p.call_id, { contact_id: contact.id, territory_ms_slug: null });
        }
      }
    }

    // Fix display name if still an email
    if (!updates.display_name && p.display_name?.includes("@")) {
      updates.display_name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase());
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("call_participants").update(updates).eq("id", p.id);
      participantsFixed++;
    }
  }

  // 5. Update calls with null contact_id
  const { data: unlinkedCalls } = await supabase
    .from("calls")
    .select("id")
    .is("contact_id", null);

  for (const call of unlinkedCalls ?? []) {
    const update = callUpdates.get(call.id);
    if (update) {
      await supabase.from("calls").update({
        contact_id: update.contact_id,
        ...(update.territory_ms_slug ? { territory_ms_slug: update.territory_ms_slug } : {}),
      }).eq("id", call.id);
      callsFixed++;
    }
  }

  return NextResponse.json({
    success: true,
    participantsFixed,
    callsFixed,
    totalOrphans: (orphans ?? []).length,
  });
}
