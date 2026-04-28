import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  { const _auth = await requireAuth(request); if (_auth instanceof Response) return _auth; }
  const body = await request.json() as { agentName: string; enabled: boolean };
  const supabase = createServerClient();

  // Read current toggles
  const { data: existing } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "agent_toggles")
    .single();

  const toggles: Record<string, boolean> = existing?.setting_value
    ? (typeof existing.setting_value === "string"
        ? JSON.parse(existing.setting_value)
        : existing.setting_value)
    : {};

  toggles[body.agentName] = body.enabled;

  await supabase.from("app_settings").upsert({
    setting_key: "agent_toggles",
    setting_value: JSON.stringify(toggles),
    description: "Agent enable/disable toggles",
  }, { onConflict: "setting_key" });

  return NextResponse.json({ success: true, toggles });
}
