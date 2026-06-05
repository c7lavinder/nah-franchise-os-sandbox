import { createServerClient } from "@/lib/supabase/server";

type EosFinding = {
  severity: "info" | "warning";
  message: string;
};

const EOS_TABLES = [
  "eos_territory_rocks",
  "eos_territory_todos",
  "eos_territory_issues",
  "eos_territory_scorecard",
  "eos_territory_habits",
  "eos_territory_lead_channels",
] as const;

async function countRows(table: (typeof EOS_TABLES)[number]) {
  const supabase = createServerClient();
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function runEosSyncAgent() {
  const supabase = createServerClient();

  const [territoriesRes, ...counts] = await Promise.all([
    supabase.from("territories").select('"TerritorySlug", status').eq("status", "active").limit(5000),
    ...EOS_TABLES.map((table) => countRows(table)),
  ]);

  if (territoriesRes.error) throw territoriesRes.error;

  const activeTerritories = territoriesRes.data ?? [];
  const tableCounts = Object.fromEntries(EOS_TABLES.map((table, index) => [table, counts[index]]));
  const findings: EosFinding[] = [];

  const missingCoreTables = Object.entries(tableCounts)
    .filter(([, count]) => count === 0)
    .map(([table]) => table);

  if (missingCoreTables.length > 0) {
    findings.push({
      severity: "warning",
      message: `EOS tables with no mirrored rows: ${missingCoreTables.join(", ")}.`,
    });
  }

  if (activeTerritories.length > 0 && (tableCounts.eos_territory_scorecard ?? 0) < activeTerritories.length) {
    findings.push({
      severity: "warning",
      message: `Scorecard coverage is lower than active territory count (${tableCounts.eos_territory_scorecard ?? 0}/${activeTerritories.length}).`,
    });
  }

  if ((tableCounts.eos_territory_lead_channels ?? 0) === 0) {
    findings.push({
      severity: "warning",
      message: "No EOS lead channels are mirrored, so marketing/channel planning cannot be trusted yet.",
    });
  }

  const summary = {
    activeTerritories: activeTerritories.length,
    tableCounts,
    findings,
  };

  await supabase.from("integration_logs").insert({
    integration_name: "eos-sync",
    event_type: "eos_sync_audit",
    status: "success",
    payload_summary: `${activeTerritories.length} active territories checked; ${findings.length} findings.`,
  });

  return { success: true, summary };
}
