export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const AGENT_DEFS = [
  { name: "post-call", label: "Post-Call Agent", trigger: "Read.ai webhook (auto), Generate button (manual)" },
  { name: "contact-research", label: "Contact Research", trigger: "New contact, Research button, 30-day cron" },
  { name: "territory-market", label: "Territory Market", trigger: "Territory presented, Research button, 30-day cron" },
  { name: "pre-call-brief", label: "Pre-Call Brief", trigger: "Call scheduled, daily 7am cron" },
  { name: "reengagement-signal", label: "Re-engagement Signal", trigger: "Monthly cron (1st of month)" },
];

export async function GET() {
  const supabase = createServerClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  // Get agent toggles from app_settings
  const { data: toggleSetting } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", "agent_toggles")
    .single();

  const toggles: Record<string, boolean> = toggleSetting?.setting_value
    ? (typeof toggleSetting.setting_value === "string"
        ? JSON.parse(toggleSetting.setting_value)
        : toggleSetting.setting_value)
    : {};

  const agents = [];

  for (const def of AGENT_DEFS) {
    // Count runs MTD
    const { count: runsMTD } = await supabase
      .from("integration_logs")
      .select("id", { count: "exact", head: true })
      .eq("integration_name", def.name)
      .gte("created_at", monthStart);

    // Count suggestions MTD
    const { count: suggestionsMTD } = await supabase
      .from("data_update_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("source", "agent_research")
      .ilike("source_id", `${def.name}%`)
      .gte("created_at", monthStart);

    const costEst = ((runsMTD ?? 0) * 0.002).toFixed(2);

    agents.push({
      ...def,
      enabled: toggles[def.name] !== false,
      runsMTD: runsMTD ?? 0,
      suggestionsMTD: suggestionsMTD ?? 0,
      costEstMTD: `$${costEst}`,
    });
  }

  return NextResponse.json({ agents });
}
