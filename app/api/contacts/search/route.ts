export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/search?q=<term>
 *
 * Lightweight contact search — returns { id, name, email, phone } for dropdowns.
 * Searches first_name, last_name, email, phone. Max 20 results.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { buildContactSearchPlan, mergeLimitedIds } from "@/lib/contacts/search-planner";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const plan = buildContactSearchPlan(request.nextUrl.searchParams.get("q"));
  if (plan.kind === "empty") {
    return NextResponse.json({ contacts: [] });
  }

  const supabase = createServerClient();

  let ids: string[] = [];

  if (plan.forwardName) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .ilike("first_name", `%${plan.forwardName.first}%`)
      .ilike("last_name", `%${plan.forwardName.last}%`)
      .limit(plan.limit);
    ids = (data ?? []).map((c) => c.id);
  }

  if (ids.length === 0 && plan.reversedName) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .ilike("first_name", `%${plan.reversedName.first}%`)
      .ilike("last_name", `%${plan.reversedName.last}%`)
      .limit(plan.limit);
    ids = (data ?? []).map((c) => c.id);
  }

  if (ids.length < plan.limit) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .or(`first_name.ilike.%${plan.query}%,last_name.ilike.%${plan.query}%,email.ilike.%${plan.query}%,phone.ilike.%${plan.query}%`)
      .limit(plan.limit);
    ids = mergeLimitedIds(plan.limit, ids, (data ?? []).map((c) => c.id));
  }

  if (ids.length === 0) {
    const { data: fuzzy } = await supabase.rpc("search_contacts_fuzzy", {
      search_query: plan.query,
      max_results: plan.limit,
      similarity_threshold: plan.fuzzyThreshold,
    });
    ids = (fuzzy ?? []).map((c: { id: string }) => c.id);
  }

  if (ids.length === 0) {
    return NextResponse.json({ contacts: [] });
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, first_name, last_name, email, phone, is_converted_franchisee")
    .in("id", ids);

  // Enrich with contact type: territory ownership + journey role
  const ghlIds = (contacts ?? []).map((c) => c.ghl_contact_id).filter(Boolean) as string[];
  const contactIds = (contacts ?? []).map((c) => c.id);

  const [ownerRes, journeyRes, stakeholderRes] = await Promise.all([
    ghlIds.length > 0
      ? supabase
          .from("territory_owners")
          .select("ghl_contact_id, TerritorySlug, territories(Nickname)")
          .in("ghl_contact_id", ghlIds)
          .is("end_date", null)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? supabase
          .from("journey_contacts")
          .select("contact_id, role, journeys(name)")
          .in("contact_id", contactIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? supabase
          .from("territory_stakeholders")
          .select("contact_id, role, TerritorySlug, territories(Nickname)")
          .in("contact_id", contactIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] }),
  ]);

  const ownerMap = new Map<string, string>(); // ghl_contact_id → territory name
  for (const o of (ownerRes.data ?? []) as unknown as {
    ghl_contact_id: string;
    TerritorySlug: string;
    territories: { Nickname: string } | { Nickname: string }[] | null;
  }[]) {
    const t = Array.isArray(o.territories) ? o.territories[0] : o.territories;
    ownerMap.set(o.ghl_contact_id, t?.Nickname ?? o.TerritorySlug);
  }

  const journeyMap = new Map<string, { role: string; name: string }>(); // contact_id → journey info
  for (const j of (journeyRes.data ?? []) as unknown as {
    contact_id: string;
    role: string;
    journeys: { name: string } | { name: string }[] | null;
  }[]) {
    if (journeyMap.has(j.contact_id)) continue; // first journey wins
    const jn = Array.isArray(j.journeys) ? j.journeys[0] : j.journeys;
    journeyMap.set(j.contact_id, { role: j.role, name: jn?.name ?? "Journey" });
  }

  const stakeholderMap = new Map<string, { role: string; territory: string }>(); // contact_id → stakeholder info
  for (const s of (stakeholderRes.data ?? []) as unknown as {
    contact_id: string;
    role: string;
    TerritorySlug: string;
    territories: { Nickname: string } | { Nickname: string }[] | null;
  }[]) {
    if (stakeholderMap.has(s.contact_id)) continue;
    const t = Array.isArray(s.territories) ? s.territories[0] : s.territories;
    stakeholderMap.set(s.contact_id, { role: s.role, territory: t?.Nickname ?? s.TerritorySlug });
  }

  const results = (contacts ?? []).map((c) => {
    const owner = c.ghl_contact_id ? ownerMap.get(c.ghl_contact_id) : null;
    const journey = journeyMap.get(c.id);
    const stakeholder = stakeholderMap.get(c.id);

    // Derive a human-readable contact type label
    let contactType: string;
    if (owner) {
      contactType = `Franchisee — ${owner}`;
    } else if (journey && (journey.role === "primary" || journey.role === "co_primary")) {
      contactType = `Prospect — ${journey.name}`;
    } else if (journey) {
      contactType = `${journey.role.replace(/_/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase())} — ${journey.name}`;
    } else if (stakeholder) {
      contactType = `${stakeholder.role.replace(/_/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase())} — ${stakeholder.territory}`;
    } else if (c.is_converted_franchisee) {
      contactType = "Converted Franchisee";
    } else {
      contactType = "Prospect";
    }

    return {
      id: c.id,
      ghl_contact_id: c.ghl_contact_id ?? null,
      first_name: c.first_name ?? null,
      last_name: c.last_name ?? null,
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unknown",
      email: c.email ?? null,
      phone: c.phone ?? null,
      contactType,
    };
  });

  return NextResponse.json({ contacts: results });
}
