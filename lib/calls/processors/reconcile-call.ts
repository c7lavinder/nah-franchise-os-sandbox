/**
 * Lightweight single-call reconciliation — runs immediately after insertCallParticipants.
 *
 * Matches unlinked participant emails → contacts → territory_owners.
 * Sets contact_id and territory_ms_slug on the call record.
 * Updates participant rows with contact_id, user_id, role, and display_name.
 *
 * This runs at webhook time so calls arrive fully linked.
 * The /api/calls/reconcile cron remains as a safety net.
 */

import { createServerClient } from "@/lib/supabase/server";

export async function reconcileCall(callId: string): Promise<void> {
  const supabase = createServerClient();

  // 1. Get unlinked participants for this call (no contact_id AND no user_id)
  const { data: orphans } = await supabase
    .from("call_participants")
    .select("id, email, display_name, contact_id, user_id, role")
    .eq("call_id", callId)
    .is("contact_id", null)
    .is("user_id", null);

  if (!orphans || orphans.length === 0) return;

  // 2. Build email → user map
  const { data: users } = await supabase
    .from("users")
    .select("id, email, full_name")
    .not("email", "is", null);

  const emailToUser = new Map<string, { id: string; name: string }>();
  for (const u of users ?? []) {
    if (u.email) emailToUser.set(u.email.toLowerCase(), { id: u.id, name: u.full_name });
  }

  // 3. Build email → contact map (paginated to handle 2000+ contacts)
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

  const emailToContact = new Map<string, { id: string; ghl_contact_id: string; name: string }>();
  for (const c of allContacts) {
    if (c.email) {
      emailToContact.set(c.email.toLowerCase(), {
        id: c.id,
        ghl_contact_id: c.ghl_contact_id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      });
    }
  }

  // 4. Build ghl_contact_id → territory map
  const { data: owners } = await supabase
    .from("territory_owners")
    .select("ms_slug, ghl_contact_id")
    .is("end_date", null);

  const ghlToTerritory = new Map<string, string>();
  for (const o of owners ?? []) {
    ghlToTerritory.set(o.ghl_contact_id, o.ms_slug);
  }

  // 5. Reconcile each orphan participant
  let bestContactId: string | null = null;
  let bestTerritorySlug: string | null = null;

  for (const p of orphans) {
    const email = p.email?.toLowerCase();
    if (!email) continue;

    const updates: Record<string, unknown> = {};

    // Try user match first (team member)
    const user = emailToUser.get(email);
    if (user) {
      updates.user_id = user.id;
      updates.role = "nah_team";
      if (!p.display_name || p.display_name.includes("@")) {
        updates.display_name = user.name;
      }
    }

    // Try contact match (not a team member)
    if (!user) {
      const contact = emailToContact.get(email);
      if (contact) {
        updates.contact_id = contact.id;
        if (!p.display_name || p.display_name.includes("@")) {
          updates.display_name = contact.name;
        }

        const territorySlug = ghlToTerritory.get(contact.ghl_contact_id);
        if (territorySlug) {
          updates.role = "franchisee";
          bestContactId = contact.id;
          bestTerritorySlug = territorySlug;
        } else {
          updates.role = "prospect";
          if (!bestContactId) bestContactId = contact.id;
        }
      }
    }

    // Fix display name if still an email
    if (!updates.display_name && p.display_name?.includes("@")) {
      updates.display_name = email.split("@")[0]
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (ch: string) => ch.toUpperCase());
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("call_participants").update(updates).eq("id", p.id);
    }
  }

  // 6. Update call record if we found a contact/territory and call is missing them
  if (bestContactId || bestTerritorySlug) {
    const { data: call } = await supabase
      .from("calls")
      .select("contact_id, territory_ms_slug")
      .eq("id", callId)
      .single();

    if (call) {
      const callUpdates: Record<string, unknown> = {};
      if (!call.contact_id && bestContactId) callUpdates.contact_id = bestContactId;
      if (!call.territory_ms_slug && bestTerritorySlug) callUpdates.territory_ms_slug = bestTerritorySlug;

      if (Object.keys(callUpdates).length > 0) {
        await supabase.from("calls").update(callUpdates).eq("id", callId);
      }
    }
  }
}
