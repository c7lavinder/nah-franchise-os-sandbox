export const dynamic = "force-dynamic";

/**
 * GET  /api/zoning/jurisdictions — list jurisdictions (optional ?territory=<ms_slug>)
 * POST /api/zoning/jurisdictions — create a jurisdiction (admin)
 *
 * See docs/landportal-zoning-integration.md.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

const KINDS = ["city", "town", "county", "unincorporated"];

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const territory = request.nextUrl.searchParams.get("territory");

  const supabase = createServerClient();
  let query = supabase
    .from("jurisdictions")
    .select("*, zoning_districts(count), zoning_documents(count)")
    .order("name");
  if (territory) query = query.eq("ms_slug", territory);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jurisdictions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const msSlug = typeof body?.ms_slug === "string" ? body.ms_slug.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!msSlug || !name) {
    return NextResponse.json({ error: "ms_slug and name are required" }, { status: 400 });
  }
  const kind = KINDS.includes(body?.kind) ? body.kind : "city";

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("jurisdictions")
    .insert({
      ms_slug: msSlug,
      name,
      kind,
      state: typeof body?.state === "string" ? body.state.trim().toUpperCase() || null : null,
      fips_code: typeof body?.fips_code === "string" ? body.fips_code.trim() || null : null,
      notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
    })
    .select("*")
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : error.code === "23503" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ jurisdiction: data }, { status: 201 });
}
