export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

/** GET — list all lead sources with their sub-sources */
export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();

  const { data: sources } = await supabase
    .from("lead_sources")
    .select("id, name, sort_order, is_active")
    .order("sort_order");

  const { data: subSources } = await supabase
    .from("lead_sub_sources")
    .select("id, lead_source_id, name, sort_order, is_active")
    .order("sort_order");

  const result = (sources ?? []).map((s) => ({
    ...s,
    subSources: (subSources ?? []).filter((ss) => ss.lead_source_id === s.id),
  }));

  return NextResponse.json({ sources: result });
}

/** POST — create a new lead source or sub-source */
export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();
  const body = await request.json();

  if (body.lead_source_id) {
    // Adding a sub-source
    const { data, error } = await supabase
      .from("lead_sub_sources")
      .insert({ lead_source_id: body.lead_source_id, name: body.name, sort_order: body.sort_order ?? 0 })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, type: "sub_source" });
  }

  // Adding a lead source
  const { data, error } = await supabase
    .from("lead_sources")
    .insert({ name: body.name, sort_order: body.sort_order ?? 0 })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, type: "source" });
}

/** DELETE — remove a lead source or sub-source */
export async function DELETE(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();
  const { id, type } = await request.json();

  const table = type === "sub_source" ? "lead_sub_sources" : "lead_sources";
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
