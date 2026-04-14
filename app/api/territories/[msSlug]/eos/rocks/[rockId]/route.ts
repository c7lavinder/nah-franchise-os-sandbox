export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** PUT — update rock status */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; rockId: string }> }
) {
  const { rockId } = await params;
  const supabase = createServerClient();
  const body = await request.json() as { status?: string; rock_text?: string };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) updates.status = body.status;
  if (body.rock_text !== undefined) updates.rock_text = body.rock_text;

  const { error } = await supabase
    .from("eos_territory_rocks")
    .update(updates)
    .eq("id", rockId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — remove a rock */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; rockId: string }> }
) {
  const { rockId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("eos_territory_rocks")
    .delete()
    .eq("id", rockId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
