import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";

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
}) {
  if (territory.TrainingCompleteDate) return "onboarded";
  if (territory.FranchiseAgreementDate) return "training";
  return "setup";
}

function runwayStageSlug(territory: { FirstPurchaseDate: string | null }) {
  return territory.FirstPurchaseDate ? "running" : "first-offer";
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

  const [pipelines, stages, subTasks, territories, owners] = await Promise.all([
    fetchAll<{ id: string; slug: string }>("pipelines", "id, slug"),
    fetchAll<{ id: string; pipeline_id: string; slug: string }>("pipeline_stages", "id, pipeline_id, slug"),
    fetchAll<{ id: string; stage_id: string; sort_order: number | null }>(
      "pipeline_sub_tasks",
      "id, stage_id, sort_order"
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
  ]);

  const onboardingPipeline = pipelines.find((pipeline) => pipeline.slug === ONBOARDING_PIPELINE_SLUG);
  const runwayPipeline = pipelines.find((pipeline) => pipeline.slug === RUNWAY_PIPELINE_SLUG);
  if (!onboardingPipeline || !runwayPipeline) {
    return { inserted: 0, deactivated: 0, errors: ["Missing onboarding or runway pipeline"] };
  }

  const activeTerritorySlugs = new Set(territories.map((territory) => territory.TerritorySlug));
  const activePipelineIds = [onboardingPipeline.id, runwayPipeline.id];
  const activeRows = await fetchAll<{ id: string; TerritorySlug: string | null }>(
    "journey_pipeline_state",
    "id, TerritorySlug",
    (query) =>
      query
        .eq("is_active", true)
        .in("pipeline_id", activePipelineIds)
        .not("TerritorySlug", "is", null)
  );
  const rowsToDeactivate = activeRows.filter(
    (row) => row.TerritorySlug && !activeTerritorySlugs.has(row.TerritorySlug)
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

  const existingRows = await fetchAll<{ journey_id: string; TerritorySlug: string | null; pipeline_id: string }>(
    "journey_pipeline_state",
    "journey_id, TerritorySlug, pipeline_id",
    (query) =>
      query
        .eq("is_active", true)
        .in("pipeline_id", activePipelineIds)
        .not("TerritorySlug", "is", null)
  );
  const existingKeys = new Set(
    existingRows.map((row) => `${row.journey_id}:${row.TerritorySlug ?? ""}:${row.pipeline_id}`)
  );

  const records: Record<string, unknown>[] = [];
  for (const owner of activeOwners) {
    const contact = owner.ghl_contact_id ? contactByGhl.get(owner.ghl_contact_id) : null;
    const journey = contact ? journeyByContact.get(contact.id) : null;
    const territory = activeTerritoryBySlug.get(owner.TerritorySlug);
    if (!journey || !territory) continue;

    const onboardingStage = stageByPipelineAndSlug.get(`${onboardingPipeline.id}:${onboardingStageSlug(territory)}`);
    const runwayStage = stageByPipelineAndSlug.get(`${runwayPipeline.id}:${runwayStageSlug(territory)}`);
    for (const [pipeline, stage] of [
      [onboardingPipeline, onboardingStage],
      [runwayPipeline, runwayStage],
    ] as const) {
      if (!stage) {
        errors.push(`${owner.TerritorySlug}: missing stage for ${pipeline.slug}`);
        continue;
      }
      const key = `${journey.id}:${owner.TerritorySlug}:${pipeline.id}`;
      if (existingKeys.has(key)) continue;
      records.push({
        journey_id: journey.id,
        TerritorySlug: owner.TerritorySlug,
        pipeline_id: pipeline.id,
        current_stage_id: stage.id,
        current_sub_task_id: firstSubTaskByStage.get(stage.id) ?? null,
        current_sub_task_started_at: owner.start_date ?? now,
        entered_pipeline_at: owner.start_date ?? now,
        entered_current_stage_at: owner.start_date ?? now,
        is_active: true,
      });
      existingKeys.add(key);
    }
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
