export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/territories/:TerritorySlug/construction-eos
 *
 * Returns construction EOS data (habits, rocks, todos, issues) from MasterSuite tables.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ TerritorySlug: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { TerritorySlug } = await params;
  const supabase = createServerClient();

  const [{ data: rocks }, { data: todos }, { data: issues }, { data: habits }] = await Promise.all([
    supabase.from("ms_eos_construction_rocks").select("Id, Rock, Status").eq("TerritorySlug", TerritorySlug),
    supabase.from("ms_eos_construction_todos").select("Id, Todo, Done").eq("TerritorySlug", TerritorySlug),
    supabase.from("ms_eos_construction_issues").select("Id, Issue, Done").eq("TerritorySlug", TerritorySlug),
    supabase.from("ms_eos_construction_habits").select("*").eq("TerritorySlug", TerritorySlug).maybeSingle(),
  ]);

  return NextResponse.json({
    rocks: rocks ?? [],
    todos: todos ?? [],
    issues: issues ?? [],
    habits: habits ?? null,
  });
}
