export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("call_types")
    .select("id, slug, name, description")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ callTypes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; slug?: string; description?: string; userId?: string };
  const admin = await requireAdmin(request.headers.get("Authorization"), body.userId);
  if ("error" in admin) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = createServerClient();
  const slug = body.slug ?? body.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const { data: ct, error } = await supabase
    .from("call_types")
    .insert({ name: body.name, slug, description: body.description ?? null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-create blank rubric
  await supabase.from("rubrics").insert({
    call_type_id: ct.id,
    name: `${body.name} — Default Rubric`,
    description: `Admin-configured rubric for ${body.name}`,
    is_active: true,
  });

  return NextResponse.json({ id: ct.id, success: true });
}
