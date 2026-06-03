import { getServiceSupabase } from "@/lib/mastersuite/supabase";
import { queryMS } from "@/lib/mastersuite/client";
import {
  emptyRunwayFacts,
  runwayTargetForFacts,
  type RunwayFacts,
  type RunwayTarget,
} from "@/lib/mastersuite/runway-target";
import { syncTerritories } from "@/lib/mastersuite/sync-territories";

const RUNWAY_PIPELINE_SLUG = "runway";
const INTEGRATION_NAME = "runway-pipeline-guardian";

type PipelineRow = { id: string; slug: string };
type StageRow = { id: string; pipeline_id: string; slug: string };
type SubTaskRow = { id: string; stage_id: string; slug: string };

type TerritoryRow = {
  TerritorySlug: string;
  status: string | null;
  FirstPurchaseDate: string | null;
};

type OwnerRow = {
  TerritorySlug: string;
  ghl_contact_id: string | null;
};

type ContactRow = {
  id: string;
  ghl_contact_id: string;
};

type JourneyRow = {
  id: string;
  primary_contact_id: string;
};

type RunwayStateRow = {
  id: string;
  journey_id: string;
  TerritorySlug: string | null;
  current_stage_id: string;
  current_sub_task_id: string | null;
  is_active: boolean;
};

type PropertyRow = {
  PropertyId: number;
  TerritorySlug: string | null;
};

type InventoryRow = {
  PropertyId: number;
  Inv_ContractedPurchaseDate: string | null;
  Inv_PurchaseDate: string | null;
  Inv_ConstructionStartDate: string | null;
  Inv_CompletionDate: string | null;
  Inv_SellDate: string | null;
};

export type RunwayGuardianIssue = {
  severity: "critical" | "warning";
  type:
    | "missing_runway_row"
    | "unexpected_runway_row"
    | "runway_stage_mismatch"
    | "running_under_three_purchases"
    | "duplicate_active_runway_rows"
    | "missing_pipeline_definition";
  territorySlug: string;
  message: string;
  expected?: string | null;
  actual?: string | null;
};

export type RunwayGuardianTerritorySummary = {
  territorySlug: string;
  actualStage: string | null;
  actualSubTask: string | null;
  expectedStage: string | null;
  expectedSubTask: string | null;
  bought: number;
  completed: number;
  sold: number;
  stage4PlusAllTime: number;
};

export type RunwayGuardianAudit = {
  activeRunwayRows: number;
  expectedRunwayRows: number;
  runningRows: number;
  inventoryBuildingRows: number;
  firstPurchaseRows: number;
  issues: RunwayGuardianIssue[];
  territories: RunwayGuardianTerritorySummary[];
};

export type RunwayGuardianResult = {
  success: boolean;
  repaired: boolean;
  repairResult: { synced: number; errors: string[] } | null;
  audit: RunwayGuardianAudit;
};

type PropertyFacts = RunwayFacts & {
  soldCount: number;
};

function targetLabel(target: RunwayTarget | null): string | null {
  if (!target) return null;
  return target.subTaskSlug ? `${target.stageSlug}/${target.subTaskSlug}` : target.stageSlug;
}

function factsForTerritory(factsByTerritory: Map<string, PropertyFacts>, slug: string): PropertyFacts {
  const existing = factsByTerritory.get(slug);
  if (existing) return existing;
  const facts = { ...emptyRunwayFacts(), soldCount: 0 };
  factsByTerritory.set(slug, facts);
  return facts;
}

async function getStage4PlusCountsByTerritory(): Promise<Map<string, number>> {
  const rows = await queryMS<{ TerritorySlug: string; count: number | string }>(
    `SELECT ps.TerritorySlug, COUNT(DISTINCT psh.PropertyId) as count
     FROM PropertyStatusHistory psh
     JOIN PropertySummaries ps ON ps.PropertyId = psh.PropertyId
     WHERE psh.NewStatus REGEXP '^[[:space:]]*[4-9]'
     GROUP BY ps.TerritorySlug`
  );

  return new Map(rows.map((row) => [row.TerritorySlug, Number(row.count ?? 0)]));
}

async function fetchAll<T>(table: string, select: string, build: (query: any) => any = (query) => query): Promise<T[]> {
  const supabase = getServiceSupabase();
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(
      supabase
        .from(table)
        .select(select)
        .range(from, from + 999)
    );
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function getPropertyFactsByTerritory(): Promise<Map<string, PropertyFacts>> {
  const [properties, inventory, stage4PlusCountsByTerritory] = await Promise.all([
    fetchAll<PropertyRow>("ms_properties", "PropertyId, TerritorySlug"),
    fetchAll<InventoryRow>(
      "ms_property_inventory",
      "PropertyId, Inv_ContractedPurchaseDate, Inv_PurchaseDate, Inv_ConstructionStartDate, Inv_CompletionDate, Inv_SellDate"
    ),
    getStage4PlusCountsByTerritory(),
  ]);

  const territoryByPropertyId = new Map(
    properties
      .filter((property) => property.TerritorySlug)
      .map((property) => [property.PropertyId, property.TerritorySlug as string])
  );
  const factsByTerritory = new Map<string, PropertyFacts>();

  for (const row of inventory) {
    const slug = territoryByPropertyId.get(row.PropertyId);
    if (!slug) continue;
    const facts = factsForTerritory(factsByTerritory, slug);
    if (row.Inv_ContractedPurchaseDate) facts.contractCount++;
    if (row.Inv_PurchaseDate) facts.purchaseCount++;
    if (row.Inv_ConstructionStartDate) facts.constructionStartCount++;
    if (row.Inv_CompletionDate) facts.completionCount++;
    if (row.Inv_SellDate) facts.soldCount++;
  }

  for (const [slug, count] of stage4PlusCountsByTerritory) {
    factsForTerritory(factsByTerritory, slug).offerCount = count;
  }

  return factsByTerritory;
}

function addIssue(issues: RunwayGuardianIssue[], issue: RunwayGuardianIssue) {
  issues.push(issue);
}

export async function auditRunwayPipeline(): Promise<RunwayGuardianAudit> {
  const pipelines = await fetchAll<PipelineRow>("pipelines", "id, slug");
  const runwayPipeline = pipelines.find((pipeline) => pipeline.slug === RUNWAY_PIPELINE_SLUG);
  if (!runwayPipeline) {
    return {
      activeRunwayRows: 0,
      expectedRunwayRows: 0,
      runningRows: 0,
      inventoryBuildingRows: 0,
      firstPurchaseRows: 0,
      issues: [
        {
          severity: "critical",
          type: "missing_pipeline_definition",
          territorySlug: "*",
          message: "Missing runway pipeline definition.",
        },
      ],
      territories: [],
    };
  }

  const [stages, subTasks, activeTerritories, owners, activeRunwayRows, factsByTerritory] = await Promise.all([
    fetchAll<StageRow>("pipeline_stages", "id, pipeline_id, slug"),
    fetchAll<SubTaskRow>("pipeline_sub_tasks", "id, stage_id, slug"),
    fetchAll<TerritoryRow>("territories", "TerritorySlug, status, FirstPurchaseDate", (query) =>
      query.eq("status", "active")
    ),
    fetchAll<OwnerRow>("territory_owners", "TerritorySlug, ghl_contact_id", (query) => query.is("end_date", null)),
    fetchAll<RunwayStateRow>(
      "journey_pipeline_state",
      "id, journey_id, TerritorySlug, current_stage_id, current_sub_task_id, is_active",
      (query) => query.eq("is_active", true).eq("pipeline_id", runwayPipeline.id).not("TerritorySlug", "is", null)
    ),
    getPropertyFactsByTerritory(),
  ]);
  const activeTerritorySlugs = new Set(activeTerritories.map((territory) => territory.TerritorySlug));
  const activeOwners = owners.filter((owner) => owner.ghl_contact_id && activeTerritorySlugs.has(owner.TerritorySlug));
  const ghlIds = [...new Set(activeOwners.map((owner) => owner.ghl_contact_id).filter(Boolean) as string[])];
  const contacts = await fetchAll<ContactRow>("contacts", "id, ghl_contact_id", (query) =>
    query.in("ghl_contact_id", ghlIds.length > 0 ? ghlIds : ["__none__"])
  );
  const contactByGhl = new Map(contacts.map((contact) => [contact.ghl_contact_id, contact]));
  const contactIds = contacts.map((contact) => contact.id);
  const journeys = await fetchAll<JourneyRow>("journeys", "id, primary_contact_id", (query) =>
    query.in("primary_contact_id", contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"])
  );
  const journeyByContact = new Map(journeys.map((journey) => [journey.primary_contact_id, journey]));
  const syncManagedTerritorySlugs = new Set(
    activeOwners
      .filter((owner) => {
        const contact = owner.ghl_contact_id ? contactByGhl.get(owner.ghl_contact_id) : null;
        return contact ? !!journeyByContact.get(contact.id) : false;
      })
      .map((owner) => owner.TerritorySlug)
  );

  const issues: RunwayGuardianIssue[] = [];
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const subTaskById = new Map(subTasks.map((subTask) => [subTask.id, subTask]));
  const stageBySlug = new Map(
    stages.filter((stage) => stage.pipeline_id === runwayPipeline.id).map((stage) => [stage.slug, stage])
  );
  const subTaskByStageAndSlug = new Map(subTasks.map((subTask) => [`${subTask.stage_id}:${subTask.slug}`, subTask]));
  const rowsByTerritory = new Map<string, RunwayStateRow[]>();

  for (const row of activeRunwayRows) {
    if (!row.TerritorySlug) continue;
    const rows = rowsByTerritory.get(row.TerritorySlug) ?? [];
    rows.push(row);
    rowsByTerritory.set(row.TerritorySlug, rows);
  }

  const activeTerritoryBySlug = new Map(activeTerritories.map((territory) => [territory.TerritorySlug, territory]));
  const summaries: RunwayGuardianTerritorySummary[] = [];
  let expectedRunwayRows = 0;
  let runningRows = 0;
  let inventoryBuildingRows = 0;
  let firstPurchaseRows = 0;

  for (const territory of activeTerritories.filter((row) => syncManagedTerritorySlugs.has(row.TerritorySlug))) {
    const facts = factsByTerritory.get(territory.TerritorySlug) ?? { ...emptyRunwayFacts(), soldCount: 0 };
    const hasRunwayEvidence = !!territory.FirstPurchaseDate || facts.purchaseCount > 0;
    const expectedTarget = hasRunwayEvidence ? runwayTargetForFacts(facts, !!territory.FirstPurchaseDate) : null;
    const expectedStage = expectedTarget ? stageBySlug.get(expectedTarget.stageSlug) : null;
    const expectedSubTask =
      expectedStage && expectedTarget?.subTaskSlug
        ? subTaskByStageAndSlug.get(`${expectedStage.id}:${expectedTarget.subTaskSlug}`)
        : null;
    const rows = rowsByTerritory.get(territory.TerritorySlug) ?? [];
    const row = rows[0] ?? null;
    const actualStage = row ? stageById.get(row.current_stage_id) : null;
    const actualSubTask = row?.current_sub_task_id ? subTaskById.get(row.current_sub_task_id) : null;

    if (expectedTarget) expectedRunwayRows++;
    if (actualStage?.slug === "running") runningRows++;
    if (actualStage?.slug === "inventory-building") inventoryBuildingRows++;
    if (actualStage?.slug === "first-purchase") firstPurchaseRows++;

    if (rows.length > 1) {
      addIssue(issues, {
        severity: "critical",
        type: "duplicate_active_runway_rows",
        territorySlug: territory.TerritorySlug,
        message: `${territory.TerritorySlug} has ${rows.length} active runway rows.`,
      });
    }

    if (expectedTarget && !row) {
      addIssue(issues, {
        severity: "critical",
        type: "missing_runway_row",
        territorySlug: territory.TerritorySlug,
        message: `${territory.TerritorySlug} should be in runway but has no active runway row.`,
        expected: targetLabel(expectedTarget),
        actual: null,
      });
    }

    if (!expectedTarget && row) {
      addIssue(issues, {
        severity: "critical",
        type: "unexpected_runway_row",
        territorySlug: territory.TerritorySlug,
        message: `${territory.TerritorySlug} is in runway without purchase evidence.`,
        expected: null,
        actual: actualStage?.slug ?? "unknown",
      });
    }

    if (row && actualStage?.slug === "running" && facts.purchaseCount < 3) {
      addIssue(issues, {
        severity: "critical",
        type: "running_under_three_purchases",
        territorySlug: territory.TerritorySlug,
        message: `${territory.TerritorySlug} is Running with ${facts.purchaseCount} bought properties.`,
        expected: "bought >= 3",
        actual: `bought ${facts.purchaseCount}`,
      });
    }

    if (
      row &&
      expectedStage &&
      (row.current_stage_id !== expectedStage.id || row.current_sub_task_id !== (expectedSubTask?.id ?? null))
    ) {
      addIssue(issues, {
        severity: "critical",
        type: "runway_stage_mismatch",
        territorySlug: territory.TerritorySlug,
        message: `${territory.TerritorySlug} runway placement does not match MasterSuite evidence.`,
        expected: targetLabel(expectedTarget),
        actual: actualSubTask ? `${actualStage?.slug}/${actualSubTask.slug}` : (actualStage?.slug ?? "unknown"),
      });
    }

    if (row || expectedTarget) {
      summaries.push({
        territorySlug: territory.TerritorySlug,
        actualStage: actualStage?.slug ?? null,
        actualSubTask: actualSubTask?.slug ?? null,
        expectedStage: expectedTarget?.stageSlug ?? null,
        expectedSubTask: expectedTarget?.subTaskSlug ?? null,
        bought: facts.purchaseCount,
        completed: facts.completionCount,
        sold: facts.soldCount,
        stage4PlusAllTime: facts.offerCount,
      });
    }
  }

  for (const [slug, rows] of rowsByTerritory) {
    if (activeTerritoryBySlug.has(slug)) continue;
    addIssue(issues, {
      severity: "critical",
      type: "unexpected_runway_row",
      territorySlug: slug,
      message: `${slug} has an active runway row but is not an active territory.`,
      actual: `${rows.length} active rows`,
    });
  }

  return {
    activeRunwayRows: activeRunwayRows.length,
    expectedRunwayRows,
    runningRows,
    inventoryBuildingRows,
    firstPurchaseRows,
    issues,
    territories: summaries.sort((a, b) => a.territorySlug.localeCompare(b.territorySlug)),
  };
}

async function logGuardianRun(result: RunwayGuardianResult) {
  const supabase = getServiceSupabase();
  const criticalIssues = result.audit.issues.filter((issue) => issue.severity === "critical");
  const status = criticalIssues.length === 0 && (result.repairResult?.errors.length ?? 0) === 0 ? "success" : "failed";
  const summary = [
    `${result.audit.activeRunwayRows} active runway rows`,
    `${result.audit.expectedRunwayRows} expected runway rows`,
    `${result.audit.runningRows} running`,
    `${result.audit.inventoryBuildingRows} inventory building`,
    `${result.audit.firstPurchaseRows} first purchase`,
    `${criticalIssues.length} critical issues`,
    result.repaired ? "repair attempted" : "audit only",
  ].join("; ");

  await supabase.from("integration_logs").insert({
    integration_name: INTEGRATION_NAME,
    event_type: result.repaired ? "runway_audit_repair" : "runway_audit",
    status,
    payload_summary: summary,
    error_message:
      criticalIssues
        .slice(0, 5)
        .map((issue) => issue.message)
        .join(" | ") || null,
  });
}

export async function runRunwayPipelineGuardian(options: { repair?: boolean } = {}): Promise<RunwayGuardianResult> {
  let audit = await auditRunwayPipeline();
  let repairResult: RunwayGuardianResult["repairResult"] = null;
  let repaired = false;

  if (options.repair && audit.issues.some((issue) => issue.severity === "critical")) {
    repaired = true;
    repairResult = await syncTerritories();
    audit = await auditRunwayPipeline();
  }

  const result: RunwayGuardianResult = {
    success: audit.issues.every((issue) => issue.severity !== "critical") && (repairResult?.errors.length ?? 0) === 0,
    repaired,
    repairResult,
    audit,
  };

  await logGuardianRun(result);
  return result;
}
