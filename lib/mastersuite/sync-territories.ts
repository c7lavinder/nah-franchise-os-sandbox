import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";
import { emptyRunwayFacts, runwayTargetForFacts, type RunwayFacts } from "./runway-target";

const supabase = getServiceSupabase();
const ONBOARDING_PIPELINE_SLUG = "onboarding";
const RUNWAY_PIPELINE_SLUG = "runway";

interface MSTerritoryRow {
  TerritoryId: number;
  TerritorySlug: string;
  Broker: string | null;
  IsFranchise: number;
  IsFullTime: number;
  Active: number;
  FullTimeOperator: number;
  ExcludeFromGlobalCalculations: number;
  PrimaryCoach: string | null;
  Nickname: string;
  PersonalName: string | null;
  Owner2: string | null;
  Owner3: string | null;
  EmergencyContact: string | null;
  FranchiseEmail: string | null;
  PersonalPhoneNumber: string | null;
  StreetAddress: string | null;
  NahCity: string | null;
  NahState: string | null;
  NahZip: string | null;
  RealEstateLicensee: string | null;
  LicenseeBroker: string | null;
  LicenseeBrokerNumber: string | null;
  MarketingName: string | null;
  MarketingPhoneNumber: string | null;
  MarketingReturnAddress: string | null;
  MarketingLeadGenPhoneNumber: string | null;
  MarketingCallCenterForwardingNumber: string | null;
  MarketingEmailAddress: string | null;
  MarketingInstagramProfile: string | null;
  MarketingFacebookPage: string | null;
  DocumentUrlFranchiseAgreement: string | null;
  DocumentUrlCOILiabilityInsurance: string | null;
  DocumentUrlCOIProfessionalLiability: string | null;
  DocumentUrlCOIOther: string | null;
  DocumentUrlBusinessLicense: string | null;
  DocumentUrlRealEstateLicense: string | null;
  DocumentUrlOther: string | null;
  DocumentUrlOther2: string | null;
  ComplianceScore: number | null;
  ComplianceScoreManualDescription: string | null;
  LegalEntityName: string | null;
  InitialApplicationDate: string | null;
  FranchiseAgreementDate: string | null;
  TrainingCompleteDate: string | null;
  FirstPurchaseDate: string | null;
  FranchiseClosedDate: string | null;
  GoHighLevelLocationId: string | null;
  NexaActive: number;
  NexaAccount: string | null;
  Vonage1Active: number;
  Vonage1Account: string | null;
  Vonage2Active: number;
  Vonage2Account: string | null;
  GoogleLicense1Active: number;
  GoogleLicense1Account: string | null;
  GoogleLicense2Active: number;
  GoogleLicense2Account: string | null;
  GoogleLicense3Active: number;
  GoogleLicense3Account: string | null;
  GoogleLicense4Active: number;
  GoogleLicense4Account: string | null;
  Notes: string | null;
}

function toBool(val: number): boolean {
  return val === 1;
}

function toStatus(active: number, closedDate: string | null): string {
  if (closedDate) return "inactive";
  return active === 1 ? "active" : "inactive";
}

function toDate(val: string | null): string | null {
  if (!val) return null;
  // MySQL returns dates as strings — ensure ISO format
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function onboardingStageSlug(territory: {
  FranchiseAgreementDate: string | null;
  TrainingCompleteDate: string | null;
  hasPurchasedProperty: boolean;
}) {
  if (territory.hasPurchasedProperty) return "onboarded";
  if (territory.TrainingCompleteDate) return "launch-prep";
  if (territory.FranchiseAgreementDate) return "training";
  return "setup";
}

function propertyStageNumber(status: string | null): number | null {
  const match = (status ?? "").trim().match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

async function getRunwayFactsByTerritory(): Promise<Map<string, RunwayFacts>> {
  const [properties, inventory, statusHistory] = await Promise.all([
    fetchAll<{ PropertyId: number; TerritorySlug: string | null }>("ms_properties", "PropertyId, TerritorySlug"),
    fetchAll<{
      PropertyId: number;
      Inv_ContractedPurchaseDate: string | null;
      Inv_PurchaseDate: string | null;
      Inv_ConstructionStartDate: string | null;
      Inv_CompletionDate: string | null;
    }>(
      "ms_property_inventory",
      "PropertyId, Inv_ContractedPurchaseDate, Inv_PurchaseDate, Inv_ConstructionStartDate, Inv_CompletionDate"
    ),
    fetchAll<{ PropertyId: number; NewStatus: string | null }>("ms_property_status_history", "PropertyId, NewStatus"),
  ]);

  const territoryByPropertyId = new Map(
    properties
      .filter((property) => property.TerritorySlug)
      .map((property) => [property.PropertyId, property.TerritorySlug as string])
  );
  const factsByTerritory = new Map<string, RunwayFacts>();
  const offerPropertyIdsByTerritory = new Map<string, Set<number>>();

  function factsForTerritory(slug: string): RunwayFacts {
    const existing = factsByTerritory.get(slug);
    if (existing) return existing;
    const facts = emptyRunwayFacts();
    factsByTerritory.set(slug, facts);
    return facts;
  }

  for (const row of inventory) {
    const slug = territoryByPropertyId.get(row.PropertyId);
    if (!slug) continue;
    const facts = factsForTerritory(slug);
    if (row.Inv_ContractedPurchaseDate) facts.contractCount++;
    if (row.Inv_PurchaseDate) facts.purchaseCount++;
    if (row.Inv_ConstructionStartDate) facts.constructionStartCount++;
    if (row.Inv_CompletionDate) facts.completionCount++;
  }

  for (const row of statusHistory) {
    const stageNumber = propertyStageNumber(row.NewStatus);
    if (stageNumber === null || stageNumber < 4) continue;
    const slug = territoryByPropertyId.get(row.PropertyId);
    if (!slug) continue;
    const ids = offerPropertyIdsByTerritory.get(slug) ?? new Set<number>();
    ids.add(row.PropertyId);
    offerPropertyIdsByTerritory.set(slug, ids);
  }

  for (const [slug, propertyIds] of offerPropertyIdsByTerritory) {
    factsForTerritory(slug).offerCount = propertyIds.size;
  }

  return factsByTerritory;
}

async function fetchAll<T>(table: string, select: string, build: (query: any) => any = (query) => query): Promise<T[]> {
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

async function syncTerritoryPipelineRowsToActiveStatus(): Promise<{
  inserted: number;
  deactivated: number;
  errors: string[];
}> {
  const errors: string[] = [];

  const [pipelines, stages, subTasks, territories, owners, runwayFactsByTerritory] = await Promise.all([
    fetchAll<{ id: string; slug: string }>("pipelines", "id, slug"),
    fetchAll<{ id: string; pipeline_id: string; slug: string }>("pipeline_stages", "id, pipeline_id, slug"),
    fetchAll<{ id: string; stage_id: string; slug: string; sort_order: number | null }>(
      "pipeline_sub_tasks",
      "id, stage_id, slug, sort_order"
    ),
    fetchAll<{
      TerritorySlug: string;
      status: string | null;
      FranchiseAgreementDate: string | null;
      TrainingCompleteDate: string | null;
      FirstPurchaseDate: string | null;
    }>(
      "territories",
      "TerritorySlug, status, FranchiseAgreementDate, TrainingCompleteDate, FirstPurchaseDate",
      (query) => query.eq("status", "active")
    ),
    fetchAll<{ TerritorySlug: string; ghl_contact_id: string | null; start_date: string | null }>(
      "territory_owners",
      "TerritorySlug, ghl_contact_id, start_date",
      (query) => query.is("end_date", null)
    ),
    getRunwayFactsByTerritory(),
  ]);

  const onboardingPipeline = pipelines.find((pipeline) => pipeline.slug === ONBOARDING_PIPELINE_SLUG);
  const runwayPipeline = pipelines.find((pipeline) => pipeline.slug === RUNWAY_PIPELINE_SLUG);
  if (!onboardingPipeline || !runwayPipeline) {
    return { inserted: 0, deactivated: 0, errors: ["Missing onboarding or runway pipeline"] };
  }

  const activeTerritorySlugs = new Set(territories.map((territory) => territory.TerritorySlug));
  const runwayEligibleTerritorySlugs = new Set(
    territories
      .filter((territory) => {
        const facts = runwayFactsByTerritory.get(territory.TerritorySlug) ?? emptyRunwayFacts();
        return territory.FirstPurchaseDate || facts.purchaseCount > 0;
      })
      .map((territory) => territory.TerritorySlug)
  );
  const activePipelineIds = [onboardingPipeline.id, runwayPipeline.id];
  const activeRows = await fetchAll<{ id: string; pipeline_id: string; TerritorySlug: string | null }>(
    "journey_pipeline_state",
    "id, pipeline_id, TerritorySlug",
    (query) => query.eq("is_active", true).in("pipeline_id", activePipelineIds).not("TerritorySlug", "is", null)
  );
  const rowsToDeactivate = activeRows.filter(
    (row) =>
      row.TerritorySlug &&
      (!activeTerritorySlugs.has(row.TerritorySlug) ||
        (row.pipeline_id === runwayPipeline.id && !runwayEligibleTerritorySlugs.has(row.TerritorySlug)))
  );

  let deactivated = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < rowsToDeactivate.length; i += 500) {
    const batch = rowsToDeactivate.slice(i, i + 500);
    const { error } = await supabase
      .from("journey_pipeline_state")
      .update({ is_active: false, closed_at: now, updated_at: now })
      .in(
        "id",
        batch.map((row) => row.id)
      );
    if (error) errors.push(`deactivate journey_pipeline_state batch ${i}: ${error.message}`);
    else deactivated += batch.length;
  }

  const stageByPipelineAndSlug = new Map<string, { id: string; pipeline_id: string; slug: string }>();
  for (const stage of stages) {
    stageByPipelineAndSlug.set(`${stage.pipeline_id}:${stage.slug}`, stage);
  }
  const firstSubTaskByStage = new Map<string, string>();
  for (const task of [...subTasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (!firstSubTaskByStage.has(task.stage_id)) firstSubTaskByStage.set(task.stage_id, task.id);
  }
  const subTaskByStageAndSlug = new Map(subTasks.map((task) => [`${task.stage_id}:${task.slug}`, task.id]));

  const activeTerritoryBySlug = new Map(territories.map((territory) => [territory.TerritorySlug, territory]));
  const activeOwners = owners.filter((owner) => owner.ghl_contact_id && activeTerritoryBySlug.has(owner.TerritorySlug));
  const ghlIds = [...new Set(activeOwners.map((owner) => owner.ghl_contact_id).filter(Boolean) as string[])];
  const contacts = await fetchAll<{ id: string; ghl_contact_id: string }>("contacts", "id, ghl_contact_id", (query) =>
    query.in("ghl_contact_id", ghlIds.length > 0 ? ghlIds : ["__none__"])
  );
  const contactByGhl = new Map(contacts.map((contact) => [contact.ghl_contact_id, contact]));
  const contactIds = contacts.map((contact) => contact.id);
  const journeys = await fetchAll<{ id: string; primary_contact_id: string }>(
    "journeys",
    "id, primary_contact_id",
    (query) =>
      query.in("primary_contact_id", contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"])
  );
  const journeyByContact = new Map(journeys.map((journey) => [journey.primary_contact_id, journey]));

  const existingRows = await fetchAll<{
    id: string;
    journey_id: string;
    TerritorySlug: string | null;
    pipeline_id: string;
    current_stage_id: string;
    current_sub_task_id: string | null;
    is_active: boolean;
  }>(
    "journey_pipeline_state",
    "id, journey_id, TerritorySlug, pipeline_id, current_stage_id, current_sub_task_id, is_active",
    (query) => query.in("pipeline_id", activePipelineIds).not("TerritorySlug", "is", null)
  );
  const existingByKey = new Map<string, (typeof existingRows)[number]>();
  for (const row of existingRows) {
    const key = `${row.journey_id}:${row.TerritorySlug ?? ""}:${row.pipeline_id}`;
    const existing = existingByKey.get(key);
    if (!existing || (row.is_active && !existing.is_active)) {
      existingByKey.set(key, row);
    }
  }

  const records: Record<string, unknown>[] = [];
  const rowsToUpdate: Array<{
    id: string;
    current_stage_id: string;
    current_sub_task_id: string | null;
    is_active: boolean;
  }> = [];
  for (const owner of activeOwners) {
    const contact = owner.ghl_contact_id ? contactByGhl.get(owner.ghl_contact_id) : null;
    const journey = contact ? journeyByContact.get(contact.id) : null;
    const territory = activeTerritoryBySlug.get(owner.TerritorySlug);
    if (!journey || !territory) continue;

    const runwayFacts = runwayFactsByTerritory.get(territory.TerritorySlug) ?? emptyRunwayFacts();
    const hasPurchasedProperty = !!territory.FirstPurchaseDate || runwayFacts.purchaseCount > 0;
    const runwayTarget = runwayTargetForFacts(runwayFacts, !!territory.FirstPurchaseDate);
    const onboardingStage = stageByPipelineAndSlug.get(
      `${onboardingPipeline.id}:${onboardingStageSlug({ ...territory, hasPurchasedProperty })}`
    );
    const pipelineStages = [[onboardingPipeline, onboardingStage]] as const;
    const stagesToSeed = runwayTarget
      ? [
          ...pipelineStages,
          [runwayPipeline, stageByPipelineAndSlug.get(`${runwayPipeline.id}:${runwayTarget.stageSlug}`)] as const,
        ]
      : pipelineStages;

    for (const [pipeline, stage] of stagesToSeed) {
      if (!stage) {
        errors.push(`${owner.TerritorySlug}: missing stage for ${pipeline.slug}`);
        continue;
      }
      const key = `${journey.id}:${owner.TerritorySlug}:${pipeline.id}`;
      const targetSubTaskId =
        pipeline.id === runwayPipeline.id && runwayTarget?.subTaskSlug
          ? (subTaskByStageAndSlug.get(`${stage.id}:${runwayTarget.subTaskSlug}`) ?? firstSubTaskByStage.get(stage.id))
          : firstSubTaskByStage.get(stage.id);
      const existing = existingByKey.get(key);
      if (existing) {
        const nextSubTaskId = targetSubTaskId ?? null;
        if (
          existing.current_stage_id !== stage.id ||
          existing.current_sub_task_id !== nextSubTaskId ||
          existing.is_active !== true
        ) {
          rowsToUpdate.push({
            id: existing.id,
            current_stage_id: stage.id,
            current_sub_task_id: nextSubTaskId,
            is_active: true,
          });
        }
        continue;
      }
      records.push({
        journey_id: journey.id,
        TerritorySlug: owner.TerritorySlug,
        pipeline_id: pipeline.id,
        current_stage_id: stage.id,
        current_sub_task_id: targetSubTaskId ?? null,
        current_sub_task_started_at: owner.start_date ?? now,
        entered_pipeline_at: owner.start_date ?? now,
        entered_current_stage_at: owner.start_date ?? now,
        is_active: true,
      });
      existingByKey.set(key, {
        id: "",
        journey_id: journey.id,
        TerritorySlug: owner.TerritorySlug,
        pipeline_id: pipeline.id,
        current_stage_id: stage.id,
        current_sub_task_id: targetSubTaskId ?? null,
        is_active: true,
      });
    }
  }

  for (const row of rowsToUpdate) {
    const { error } = await supabase
      .from("journey_pipeline_state")
      .update({
        current_stage_id: row.current_stage_id,
        current_sub_task_id: row.current_sub_task_id,
        entered_current_stage_at: now,
        current_sub_task_started_at: now,
        is_active: row.is_active,
        closed_at: null,
        closed_reason: null,
        updated_at: now,
      })
      .eq("id", row.id);
    if (error) errors.push(`journey_pipeline_state update ${row.id}: ${error.message}`);
  }

  let inserted = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const { error } = await supabase.from("journey_pipeline_state").insert(batch);
    if (error) errors.push(`journey_pipeline_state batch ${i}: ${error.message}`);
    else inserted += batch.length;
  }

  return { inserted, deactivated, errors };
}

export async function syncTerritories(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];

  const rows = await queryMS<MSTerritoryRow>(`SELECT * FROM Territories ORDER BY TerritorySlug`);

  let synced = 0;

  for (const row of rows) {
    const record = {
      TerritorySlug: row.TerritorySlug,
      Nickname: row.Nickname,
      status: toStatus(row.Active, row.FranchiseClosedDate),
      region: null as string | null,
      FranchiseAgreementDate: toDate(row.FranchiseAgreementDate),
      TerritoryId: row.TerritoryId,
      Broker: row.Broker,
      IsFranchise: toBool(row.IsFranchise),
      IsFullTime: toBool(row.IsFullTime),
      FullTimeOperator: toBool(row.FullTimeOperator),
      ExcludeFromGlobalCalculations: toBool(row.ExcludeFromGlobalCalculations),
      PrimaryCoach: row.PrimaryCoach,
      PersonalName: row.PersonalName,
      Owner2: row.Owner2,
      Owner3: row.Owner3,
      EmergencyContact: row.EmergencyContact,
      FranchiseEmail: row.FranchiseEmail,
      PersonalPhoneNumber: row.PersonalPhoneNumber,
      StreetAddress: row.StreetAddress,
      NahCity: row.NahCity,
      NahState: row.NahState,
      NahZip: row.NahZip,
      RealEstateLicensee: row.RealEstateLicensee,
      LicenseeBroker: row.LicenseeBroker,
      LicenseeBrokerNumber: row.LicenseeBrokerNumber,
      MarketingName: row.MarketingName,
      MarketingPhoneNumber: row.MarketingPhoneNumber,
      MarketingReturnAddress: row.MarketingReturnAddress,
      MarketingLeadGenPhoneNumber: row.MarketingLeadGenPhoneNumber,
      MarketingCallCenterForwardingNumber: row.MarketingCallCenterForwardingNumber,
      MarketingEmailAddress: row.MarketingEmailAddress,
      MarketingInstagramProfile: row.MarketingInstagramProfile,
      MarketingFacebookPage: row.MarketingFacebookPage,
      DocumentUrlFranchiseAgreement: row.DocumentUrlFranchiseAgreement,
      DocumentUrlCOILiabilityInsurance: row.DocumentUrlCOILiabilityInsurance,
      DocumentUrlCOIProfessionalLiability: row.DocumentUrlCOIProfessionalLiability,
      DocumentUrlCOIOther: row.DocumentUrlCOIOther,
      DocumentUrlBusinessLicense: row.DocumentUrlBusinessLicense,
      DocumentUrlRealEstateLicense: row.DocumentUrlRealEstateLicense,
      DocumentUrlOther: row.DocumentUrlOther,
      DocumentUrlOther2: row.DocumentUrlOther2,
      ComplianceScore: row.ComplianceScore,
      ComplianceScoreManualDescription: row.ComplianceScoreManualDescription,
      LegalEntityName: row.LegalEntityName,
      InitialApplicationDate: toDate(row.InitialApplicationDate),
      TrainingCompleteDate: toDate(row.TrainingCompleteDate),
      FirstPurchaseDate: toDate(row.FirstPurchaseDate),
      FranchiseClosedDate: toDate(row.FranchiseClosedDate),
      GoHighLevelLocationId: row.GoHighLevelLocationId,
      NexaActive: toBool(row.NexaActive),
      NexaAccount: row.NexaAccount,
      Vonage1Active: toBool(row.Vonage1Active),
      Vonage1Account: row.Vonage1Account,
      Vonage2Active: toBool(row.Vonage2Active),
      Vonage2Account: row.Vonage2Account,
      GoogleLicense1Active: toBool(row.GoogleLicense1Active),
      GoogleLicense1Account: row.GoogleLicense1Account,
      GoogleLicense2Active: toBool(row.GoogleLicense2Active),
      GoogleLicense2Account: row.GoogleLicense2Account,
      GoogleLicense3Active: toBool(row.GoogleLicense3Active),
      GoogleLicense3Account: row.GoogleLicense3Account,
      GoogleLicense4Active: toBool(row.GoogleLicense4Active),
      GoogleLicense4Account: row.GoogleLicense4Account,
      Notes: row.Notes,
      ms_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("territories").upsert(record, { onConflict: "TerritorySlug" });

    if (error) {
      errors.push(`${row.TerritorySlug}: ${error.message}`);
    } else {
      synced++;
    }
  }

  const pipelineStateResult = await syncTerritoryPipelineRowsToActiveStatus();
  errors.push(...pipelineStateResult.errors);

  return { synced, errors };
}
