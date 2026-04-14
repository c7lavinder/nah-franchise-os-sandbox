export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** GET — returns all market data fields for a territory as a keyed object */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("territory_market_data")
    .select("*")
    .eq("territory_slug", msSlug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Convert EAV rows to keyed object for easy frontend consumption
  const fields: Record<string, { value: string | null; source: string; updated_at: string }> = {};
  for (const row of data ?? []) {
    fields[row.field_name] = {
      value: row.field_value,
      source: row.source,
      updated_at: row.updated_at,
    };
  }

  return NextResponse.json({ fields, rows: data ?? [] });
}

/** PUT — upsert a single market data field */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();
  const body = await request.json() as {
    field_name: string;
    field_value: string | null;
    source?: string;
  };

  if (!body.field_name?.trim()) {
    return NextResponse.json({ error: "field_name is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("territory_market_data")
    .upsert(
      {
        territory_slug: msSlug,
        field_name: body.field_name,
        field_value: body.field_value ?? null,
        source: body.source ?? "manual",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "territory_slug,field_name" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** POST — bulk upsert multiple market data fields */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string }> }
) {
  const { msSlug } = await params;
  const supabase = createServerClient();
  const body = await request.json() as {
    fields: Array<{ field_name: string; field_value: string | null; source?: string }>;
  };

  if (!body.fields || !Array.isArray(body.fields) || body.fields.length === 0) {
    return NextResponse.json({ error: "fields array is required" }, { status: 400 });
  }

  const rows = body.fields.map((f) => ({
    territory_slug: msSlug,
    field_name: f.field_name,
    field_value: f.field_value ?? null,
    source: f.source ?? "manual",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("territory_market_data")
    .upsert(rows, { onConflict: "territory_slug,field_name" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: rows.length });
}
