export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** POST — toggle is_active on a lead channel */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ msSlug: string; channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = createServerClient();

  // Fetch current state
  const { data: current, error: fetchErr } = await supabase
    .from("eos_territory_lead_channels")
    .select("is_active")
    .eq("id", channelId)
    .single();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const { error } = await supabase
    .from("eos_territory_lead_channels")
    .update({
      is_active: !current.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, is_active: !current.is_active });
}
