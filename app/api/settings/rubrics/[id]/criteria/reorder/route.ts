export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

export async function POST(request: NextRequest) {
  const body = await request.json() as { criterionIds: string[]; userId?: string };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });
  if (!body.criterionIds?.length) return NextResponse.json({ error: "criterionIds required" }, { status: 400 });

  const supabase = createServerClient();
  for (let i = 0; i < body.criterionIds.length; i++) {
    await supabase.from("rubric_criteria").update({ sort_order: i }).eq("id", body.criterionIds[i]);
  }
  return NextResponse.json({ success: true });
}
