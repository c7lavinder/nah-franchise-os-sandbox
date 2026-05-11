/**
 * GET /api/territories/:TerritorySlug — Full territory record
 *
 * Owners are now derived from journey_contacts (primary + co_primary on the
 * active journey that holds this territory). This keeps co-owners like
 * "Ryan + Shannon" visible together instead of collapsing to the single
 * territory_owners row. territory_owners is still used for the start_date
 * on the primary row, so the "Since <date>" label stays accurate.
 *
 * currentOwner (singular) is preserved for backward-compat — callers that
 * haven't migrated still see the primary. currentOwners (plural) is the
 * full list, ordered primary first.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface ContactRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  ghl_contact_id: string | null;
}

interface JourneyContactRow {
  contact_id: string;
  role: string;
  joined_at: string | null;
  contacts: ContactRow | ContactRow[] | null;
}

interface OwnerOut {
  ownerName: string | null;
  contactId: string | null;
  ghlContactId: string | null;
  role: string;
  start_date: string | null;
  email: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  const { data: territory, error: tErr } = await supabase
    .from("territories")
    .select("*")
    .eq("TerritorySlug", TerritorySlug)
    .single();

  if (tErr || !territory) {
    return NextResponse.json({ error: "Territory not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("territory_profile")
    .select("*")
    .eq("TerritorySlug", TerritorySlug)
    .single();

  // Active journey(s) for this territory. Usually one (runway or onboarding).
  const { data: jpsRows } = await supabase
    .from("journey_pipeline_state")
    .select("journey_id")
    .eq("TerritorySlug", TerritorySlug)
    .eq("is_active", true);
  const journeyIds = Array.from(new Set((jpsRows ?? []).map((r) => r.journey_id)));

  // Pull core members (primary + co_primary) for those journeys.
  let ownersFromJourney: OwnerOut[] = [];
  if (journeyIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("journey_contacts")
      .select("contact_id, role, joined_at, contacts(first_name, last_name, email, ghl_contact_id)")
      .in("journey_id", journeyIds)
      .is("left_at", null)
      .in("role", ["primary", "co_primary"])
      .order("joined_at", { ascending: true });

    ownersFromJourney = (memberRows ?? []).map((row) => {
      const raw = row as JourneyContactRow;
      const contact = Array.isArray(raw.contacts) ? raw.contacts[0] : raw.contacts;
      const name = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || null : null;
      return {
        ownerName: name,
        contactId: raw.contact_id,
        ghlContactId: contact?.ghl_contact_id ?? raw.contact_id,
        role: raw.role,
        start_date: null,
        email: contact?.email ?? null,
      };
    });
    ownersFromJourney.sort((a, b) => {
      if (a.role === "primary" && b.role !== "primary") return -1;
      if (a.role !== "primary" && b.role === "primary") return 1;
      return 0;
    });
  }

  // Get territory_owners for start_date hydration.
  const { data: territoryOwners } = await supabase
    .from("territory_owners")
    .select("ghl_contact_id, contact_id, start_date, role, contacts(id, first_name, last_name, email, ghl_contact_id)")
    .eq("TerritorySlug", TerritorySlug)
    .is("end_date", null);

  const startDateByContactId = new Map<string, string>();
  for (const r of territoryOwners ?? []) {
    const key = r.contact_id ?? r.ghl_contact_id;
    if (key && r.start_date) startDateByContactId.set(key, r.start_date);
  }
  for (const o of ownersFromJourney) {
    const key = o.contactId ?? o.ghlContactId;
    if (key && startDateByContactId.has(key)) {
      o.start_date = startDateByContactId.get(key) ?? null;
    }
  }

  // Fallback: if there is no journey but territory_owners has a row, show that.
  let currentOwners: OwnerOut[] = ownersFromJourney;
  if (currentOwners.length === 0 && territoryOwners && territoryOwners.length > 0) {
    currentOwners = territoryOwners.map((r) => {
      const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      const contactUuid = r.contact_id ?? (c as any)?.id ?? null;
      const name = c ? `${(c as any).first_name ?? ""} ${(c as any).last_name ?? ""}`.trim() || null : null;
      return {
        ownerName: name,
        contactId: contactUuid,
        ghlContactId: (c as any)?.ghl_contact_id ?? r.ghl_contact_id,
        role: r.role ?? "owner",
        start_date: r.start_date ?? null,
        email: (c as any)?.email ?? null,
      };
    });
  }

  const { data: grades } = await supabase
    .from("territory_grades")
    .select("*")
    .eq("TerritorySlug", TerritorySlug)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  const { data: franchiseOwner } = await supabase
    .from("franchise_owners")
    .select("*")
    .eq("TerritorySlug", TerritorySlug)
    .single();

  // Final fallback for the "pre-award" case: franchise_owners only.
  if (currentOwners.length === 0 && franchiseOwner) {
    currentOwners = [
      {
        ownerName: franchiseOwner.full_name ?? null,
        contactId: null,
        ghlContactId: franchiseOwner.ghl_contact_id ?? null,
        role: "owner",
        start_date: null,
        email: null,
      },
    ];
  }

  const currentOwner = currentOwners[0] ?? null;

  return NextResponse.json({
    territory,
    profile: profile ?? null,
    currentOwner,
    currentOwners,
    grades: grades ?? [],
    franchiseOwner: franchiseOwner ?? null,
  });
}
