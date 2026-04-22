export const dynamic = "force-dynamic";

/**
 * PATCH /api/journeys/:journeyId — update mutable journey fields.
 *
 * Currently accepts `{ name }` only. The slug is intentionally NOT regenerated
 * on rename — slugs are permalinks and existing bookmarks / deep links
 * (e.g. /journeys/ryan-shannon-partnership) must continue to resolve.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface PatchBody {
  name?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> },
) {
  const { journeyId } = await params;
  const body = (await request.json()) as PatchBody;
  const supabase = createServerClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 200) {
      return NextResponse.json({ error: "Name too long (200 char max)" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("journeys")
    .update(updates)
    .eq("id", journeyId)
    .select("id, name, slug")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  return NextResponse.json({ journey: data });
}
