export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { queryMS } from "@/lib/mastersuite/client";

const SUPABASE_TABLES = [
  "contacts",
  "journeys",
  "territories",
  "calls",
  "call_transcripts",
  "call_action_items",
  "call_data_extractions",
  "contact_profile_fields",
  "knowledge_documents",
  "embeddings",
  "contact_briefs",
  "territory_briefs",
  "scout_retrieval_logs",
  "ms_properties",
  "ms_property_inventory",
  "ms_property_calculations",
] as const;

const MASTERSUITE_TABLES = [
  "Territories",
  "TerritoryScorecardKPIs",
  "TerritoryMetrics",
  "TerritoryMetricsDailyStats",
  "PathToOwnershipEntries",
  "PropertyInventory",
  "PropertyCalculations",
  "PropertyStage0",
  "PropertyStage1",
  "Eos_Goals",
  "Eos_Rocks",
  "Eos_Todos",
  "Eos_Issues",
] as const;

type CountMap = Record<string, number | null>;

async function countSupabaseTables(): Promise<CountMap> {
  const supabase = createServerClient();
  const counts: CountMap = {};

  for (const table of SUPABASE_TABLES) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    counts[table] = error ? null : (count ?? 0);
  }

  return counts;
}

async function countMasterSuiteTables(): Promise<CountMap> {
  const counts: CountMap = {};

  for (const table of MASTERSUITE_TABLES) {
    try {
      const rows = await queryMS<{ count: number }>(`select count(*) as count from \`${table}\``);
      counts[table] = Number(rows[0]?.count ?? 0);
    } catch {
      counts[table] = null;
    }
  }

  return counts;
}

function buildFindings(supabaseCounts: CountMap, masterSuiteCounts: CountMap): string[] {
  const findings: string[] = [];
  const contactBriefs = supabaseCounts.contact_briefs ?? 0;
  const territoryBriefs = supabaseCounts.territory_briefs ?? 0;
  const transcripts = supabaseCounts.call_transcripts ?? 0;
  const embeddings = supabaseCounts.embeddings ?? 0;
  const msProperties = masterSuiteCounts.PropertyInventory ?? 0;
  const mirroredProperties = supabaseCounts.ms_property_inventory ?? 0;

  if (contactBriefs === 0) findings.push("contact_briefs is empty; Scout cannot use precomputed contact summaries yet.");
  if (territoryBriefs === 0) findings.push("territory_briefs is empty; territory retrieval is slower and less consistent.");
  if (transcripts > 0 && embeddings === 0) findings.push("transcripts exist but embeddings are empty.");
  if (msProperties > 0 && mirroredProperties > 0) {
    const mirroredPct = Math.round((mirroredProperties / msProperties) * 100);
    findings.push(`Supabase mirrors about ${mirroredPct}% of MasterSuite property inventory rows.`);
  }

  return findings;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();

  try {
    const [supabaseCounts, masterSuiteCounts] = await Promise.all([
      countSupabaseTables(),
      countMasterSuiteTables(),
    ]);
    const findings = buildFindings(supabaseCounts, masterSuiteCounts);

    await supabase.from("integration_logs").insert({
      integration_name: "data-intelligence",
      event_type: "data_coverage_audit",
      status: "success",
      payload_summary: `${findings.length} findings; ${SUPABASE_TABLES.length} Supabase tables checked; ${MASTERSUITE_TABLES.length} MasterSuite tables checked; ${findings.join(" ")}`,
    });

    return NextResponse.json({
      success: true,
      supabaseCounts,
      masterSuiteCounts,
      findings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown data intelligence error";
    await supabase.from("integration_logs").insert({
      integration_name: "data-intelligence",
      event_type: "data_coverage_audit",
      status: "failed",
      payload_summary: "Data Intelligence audit failed",
      error_message: message,
    });

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
