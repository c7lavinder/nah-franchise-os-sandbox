export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** PUT — toggle is_done on a territory issue */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; issueId: string }> }
) {
  const { issueId } = await params;
  const supabase = createServerClient();
  const body = await request.json() as { is_done?: boolean };

  const { error } = await supabase
    .from("eos_territory_issues")
    .update({ is_done: body.is_done ?? false, updated_at: new Date().toISOString() })
    .eq("id", issueId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE — remove a territory issue */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; issueId: string }> }
) {
  const { issueId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("eos_territory_issues")
    .delete()
    .eq("id", issueId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
