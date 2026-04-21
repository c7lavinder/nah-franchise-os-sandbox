/**
 * /journeys/[journeyId] — canonical journey URL.
 *
 * Phase 3C: renders the shared LeadDetailView directly (no redirect). The
 * server resolves the journey's active members so the Profile tab can show
 * a per-contact sub-tab strip when the journey has 2+ members.
 *
 * Query params:
 *   territory — focus the Territories tab on a specific ms_slug (forwarded
 *               to the client component).
 *   message   — open the Messages tab and highlight a specific message.
 */

import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import LeadDetailView, { type JourneyMember } from "@/components/leads/LeadDetailView";

export const dynamic = "force-dynamic";

interface JourneyMemberRow {
  contact_id: string;
  role: string;
  joined_at: string;
  contacts: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
}

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ journeyId: string }>;
  searchParams: Promise<{ territory?: string; message?: string }>;
}) {
  const { journeyId } = await params;
  const { territory, message } = await searchParams;

  const supabase = createServerClient();
  const { data: journey } = await supabase
    .from("journeys")
    .select("id, primary_contact_id, status")
    .eq("id", journeyId)
    .maybeSingle();

  if (!journey) notFound();

  // LeadDetailView's GHL-facing fetches (/api/contacts/[id] → GHL, GHL
  // profile/messages) expect the ghl_contact_id, not the local UUID.
  // Resolve here so the header + profile/messages/tasks load instead of
  // staying stuck on "Loading...".
  const { data: primaryContact } = await supabase
    .from("contacts")
    .select("ghl_contact_id")
    .eq("id", journey.primary_contact_id)
    .maybeSingle();
  const ghlContactId = primaryContact?.ghl_contact_id ?? journey.primary_contact_id;

  const { data: memberRows } = await supabase
    .from("journey_contacts")
    .select("contact_id, role, joined_at, contacts(first_name, last_name)")
    .eq("journey_id", journey.id)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  const members: JourneyMember[] = (memberRows ?? []).map((row) => {
    const raw = row as JourneyMemberRow;
    const contact = Array.isArray(raw.contacts) ? raw.contacts[0] : raw.contacts;
    return {
      contact_id: raw.contact_id,
      role: raw.role,
      first_name: contact?.first_name ?? null,
      last_name: contact?.last_name ?? null,
      is_primary: raw.contact_id === journey.primary_contact_id,
    };
  });

  // Sort: primary first, then by original join order.
  members.sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return 0;
  });

  return (
    <LeadDetailView
      contactId={ghlContactId}
      journeyId={journey.id}
      initialTerritorySlug={territory ?? null}
      highlightMessageId={message ?? null}
      members={members}
    />
  );
}
