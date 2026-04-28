export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/search?q=<term>
 *
 * Lightweight contact search — returns { id, name, email, phone } for dropdowns.
 * Searches first_name, last_name, email, phone. Max 20 results.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const supabase = createServerClient();

  const words = q.split(/\s+/).filter(Boolean);
  let ids: string[] = [];

  if (words.length >= 2) {
    const [first, ...rest] = words;
    const last = rest.join(" ");
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .ilike("first_name", `%${first}%`)
      .ilike("last_name", `%${last}%`)
      .limit(20);
    ids = (data ?? []).map((c) => c.id);
  }

  if (ids.length < 20) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(20);
    const idSet = new Set([...ids, ...(data ?? []).map((c) => c.id)]);
    ids = [...idSet].slice(0, 20);
  }

  if (ids.length === 0) {
    return NextResponse.json({ contacts: [] });
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id, first_name, last_name, email, phone")
    .in("id", ids);

  const results = (contacts ?? []).map((c) => ({
    id: c.id,
    ghl_contact_id: c.ghl_contact_id ?? null,
    first_name: c.first_name ?? null,
    last_name: c.last_name ?? null,
    name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unknown",
    email: c.email ?? null,
    phone: c.phone ?? null,
  }));

  return NextResponse.json({ contacts: results });
}
