/**
 * GET /api/territories/:msSlug — Full territory record
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  // Territory + profile
  const { data: territory, error: tErr } = await supabase
    .from("territories")
    .select("*")
    .eq("ms_slug", msSlug)
    .single();

  if (tErr || !territory) {
    return NextResponse.json({ error: "Territory not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("territory_profile")
    .select("*")
    .eq("ms_slug", msSlug)
    .single();

  // Current owner
  const { data: currentOwner } = await supabase
    .from("territory_owners")
    .select("*, contacts (first_name, last_name, email, ghl_contact_id)")
    .eq("ms_slug", msSlug)
    .is("end_date", null)
    .limit(1)
    .maybeSingle();

  // Grades
  const { data: grades } = await supabase
    .from("territory_grades")
    .select("*")
    .eq("ms_slug", msSlug)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  // Franchise owner record
  const { data: franchiseOwner } = await supabase
    .from("franchise_owners")
    .select("*")
    .eq("ms_slug", msSlug)
    .single();

  return NextResponse.json({
    territory,
    profile: profile ?? null,
    currentOwner: currentOwner
      ? {
          ...currentOwner,
          ownerName: currentOwner.contacts
            ? `${(currentOwner.contacts as { first_name: string }).first_name ?? ""} ${(currentOwner.contacts as { last_name: string }).last_name ?? ""}`.trim()
            : franchiseOwner?.full_name ?? null,
          ghlContactId: (currentOwner.contacts as { ghl_contact_id: string } | null)?.ghl_contact_id ?? null,
        }
      : franchiseOwner
        ? { ownerName: franchiseOwner.full_name, ghlContactId: franchiseOwner.ghl_contact_id }
        : null,
    grades: grades ?? [],
    franchiseOwner: franchiseOwner ?? null,
  });
}
