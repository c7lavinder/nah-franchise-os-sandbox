export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** PUT — update the grade on a habit */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; habitId: string }> }
) {
  const { habitId } = await params;
  const supabase = createServerClient();
  const body = await request.json() as { grade?: string | null };

  const validGrades = ["A", "B", "C", "D", "F", null];
  if (!validGrades.includes(body.grade ?? null)) {
    return NextResponse.json({ error: "grade must be A, B, C, D, F, or null" }, { status: 400 });
  }

  const { error } = await supabase
    .from("eos_territory_habits")
    .update({ grade: body.grade ?? null, updated_at: new Date().toISOString() })
    .eq("id", habitId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
