export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const supabase = createServerClient();

  const [contacts, territories, users, kbDocs, suggestions] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("territories").select("ms_slug", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("data_update_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return NextResponse.json({
    totalContacts: contacts.count ?? 0,
    totalTerritories: territories.count ?? 0,
    activeUsers: users.count ?? 0,
    kbDocuments: kbDocs.count ?? 0,
    pendingSuggestions: suggestions.count ?? 0,
  });
}
