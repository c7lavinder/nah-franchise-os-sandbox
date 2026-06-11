import { queryMS } from "./client";
import { getServiceSupabase } from "./supabase";

function supabase() {
  return getServiceSupabase();
}
const BATCH_SIZE = 500;

// ─── Helpers ──────────────────────────────────────────────────

function toBool(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  // MySQL bit(1) comes as Buffer, tinyint(1) as number
  if (Buffer.isBuffer(val)) return val[0] === 1;
  return val === 1 || val === true;
}

function toISOOrNull(val: unknown): string | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Row-for-row syncs ───────────────────────────────────────

interface MSRock {
  Id: number;
  TerritorySlug: string;
  Rock: string | null;
  Status: string | null;
}

export async function syncRocks(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<MSRock>("SELECT * FROM Eos_Rocks ORDER BY Id");
  const now = new Date().toISOString();

  const records = rows.map((row) => ({
    ms_id: row.Id,
    TerritorySlug: row.TerritorySlug,
    Rock: row.Rock ?? "",
    status: mapRockStatus(row.Status),
    updated_at: now,
  }));

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("eos_territory_rocks").upsert(batch, { onConflict: "ms_id" });
    if (error) errors.push(`rocks batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

function mapRockStatus(ms: string | null): string {
  if (!ms) return "not_done";
  const lower = ms.toLowerCase();
  if (lower === "complete" || lower === "done") return "complete";
  if (lower === "on track" || lower === "on_track") return "on_track";
  if (lower === "off track" || lower === "off_track") return "off_track";
  return "not_done";
}

interface MSTodo {
  Id: number;
  TerritorySlug: string;
  Todo: string | null;
  Done: unknown; // bit(1) → Buffer
}

export async function syncTodos(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<MSTodo>("SELECT * FROM Eos_Todos ORDER BY Id");
  const now = new Date().toISOString();

  const records = rows.map((row) => ({
    ms_id: row.Id,
    TerritorySlug: row.TerritorySlug,
    Todo: row.Todo ?? "",
    is_done: toBool(row.Done),
    source: "mastersuite",
    updated_at: now,
  }));

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("eos_territory_todos").upsert(batch, { onConflict: "ms_id" });
    if (error) errors.push(`todos batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

interface MSIssue {
  Id: number;
  TerritorySlug: string;
  Issue: string;
  Done: unknown;
}

export async function syncIssues(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<MSIssue>("SELECT * FROM Eos_Issues ORDER BY Id");
  const now = new Date().toISOString();

  const records = rows.map((row) => ({
    ms_id: row.Id,
    TerritorySlug: row.TerritorySlug,
    Issue: row.Issue,
    is_done: toBool(row.Done),
    source: "mastersuite",
    updated_at: now,
  }));

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("eos_territory_issues").upsert(batch, { onConflict: "ms_id" });
    if (error) errors.push(`issues batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

interface MSBudget {
  Id: number;
  TerritorySlug: string;
  Description: string | null;
  Amount: number | null;
}

export async function syncBudgets(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<MSBudget>("SELECT * FROM Eos_Budgets ORDER BY Id");
  const now = new Date().toISOString();

  const records = rows.map((row) => ({
    ms_id: row.Id,
    TerritorySlug: row.TerritorySlug,
    description: row.Description ?? "",
    amount: row.Amount ?? 0,
    updated_at: now,
  }));

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("eos_territory_budgets").upsert(batch, { onConflict: "ms_id" });
    if (error) errors.push(`budgets batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

// ─── Wide → EAV syncs ────────────────────────────────────────

// Eos_Goals → eos_territory_scorecard (goal_value)
// MS stores goal targets for scorecard KPIs as wide columns

const GOAL_TO_SCORECARD: Record<string, { key: string; label: string; sort: number }> = {
  EosGoals_T3LeadsEntered: { key: "t3_leads_entered", label: "T3 Leads Entered", sort: 1 },
  EosGoals_T3IncomingLeadForms: { key: "t3_incoming_lead_forms", label: "T3 Incoming Lead Forms", sort: 8 },
  EosGoals_T3OutboundQty: { key: "t3_outbound_qty", label: "T3 Outbound Qty", sort: 9 },
  EosGoals_PercentUniqueContent: { key: "percent_unique_content", label: "% Unique Content", sort: 10 },
  EosGoals_T3S1toS4Percent: { key: "t3_s1_to_s4_pct", label: "T3 S1 to S4 %", sort: 2 },
  EosGoals_T3Purchased: { key: "t3_purchased", label: "T3 Purchased", sort: 3 },
  EosGoals_T12AvgCycleDays: { key: "t12_median_cycle_days", label: "T12 Median Cycle Days", sort: 5 },
  EosGoals_T3GrossProfit: { key: "t3_gross_profit", label: "T3 Gross Profit", sort: 6 },
  EosGoals_T3AvgInventory: { key: "t3_avg_inventory", label: "T3 AVG Inventory", sort: 4 },
  EosGoals_T3ComplianceScore: { key: "t3_compliance_score", label: "T3 Compliance Score", sort: 7 },
};

export async function syncGoals(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<Record<string, unknown>>("SELECT * FROM Eos_Goals");
  const now = new Date().toISOString();

  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const slug = row.TerritorySlug as string;
    for (const [msCol, metric] of Object.entries(GOAL_TO_SCORECARD)) {
      const val = row[msCol];
      if (val === null || val === undefined) continue;
      records.push({
        TerritorySlug: slug,
        metric_key: metric.key,
        metric_label: metric.label,
        goal_value: String(val),
        sort_order: metric.sort,
        updated_at: now,
      });
    }
  }

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase()
      .from("eos_territory_scorecard")
      .upsert(batch, { onConflict: "TerritorySlug,metric_key", ignoreDuplicates: false });
    if (error) errors.push(`goals batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

// Eos_GoalCheckpoints → eos_territory_goals
// MS stores the three high-level territory goals separately from scorecard KPI targets.

function cleanGoalValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

export async function syncGoalCheckpoints(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<Record<string, unknown>>("SELECT * FROM Eos_GoalCheckpoints");
  const currentYear = new Date().getFullYear();
  const kpiRows = await queryMS<Record<string, unknown>>(
    "SELECT TerritorySlug, GrossProfit FROM TerritoryScorecardKPIs WHERE Type = 'Year' AND Scope = ?",
    [currentYear]
  );
  const grossProfitActualBySlug = new Map(
    kpiRows.map((row) => [String(row.TerritorySlug).toUpperCase(), cleanGoalValue(row.GrossProfit)])
  );
  const now = new Date().toISOString();

  const records = rows.flatMap((row) => {
    const slug = row.TerritorySlug as string;
    const grossProfitActual = grossProfitActualBySlug.get(slug.toUpperCase()) ?? null;

    return [
      {
        TerritorySlug: slug,
        goal_type: "houses_purchased",
        actual: cleanGoalValue(row.EosGoalCheckpoint_RentalActual),
        current_year_goal: cleanGoalValue(row.EosGoalCheckpoint_RentalCurrentYear),
        year_5_goal: cleanGoalValue(row.EosGoalCheckpoint_RentalYear5),
        year_25_goal: cleanGoalValue(row.EosGoalCheckpoint_RentalYear25),
        updated_at: now,
      },
      {
        TerritorySlug: slug,
        goal_type: "gross_profit",
        actual: grossProfitActual,
        current_year_goal: cleanGoalValue(row.EosGoalCheckpoint_GrossProfitCurrentYear),
        year_5_goal: cleanGoalValue(row.EosGoalCheckpoint_GrossProfitYear5),
        year_25_goal: cleanGoalValue(row.EosGoalCheckpoint_GrossProfitYear25),
        updated_at: now,
      },
      {
        TerritorySlug: slug,
        goal_type: "quality_of_life",
        actual: cleanGoalValue(row.EosGoalCheckpoint_QualityOfLifeActual),
        current_year_goal: cleanGoalValue(row.EosGoalCheckpoint_QualityOfLifeCurrentYear),
        year_5_goal: cleanGoalValue(row.EosGoalCheckpoint_QualityOfLifeYear5),
        year_25_goal: cleanGoalValue(row.EosGoalCheckpoint_QualityOfLifeYear25),
        updated_at: now,
      },
    ];
  });

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase()
      .from("eos_territory_goals")
      .upsert(batch, { onConflict: "TerritorySlug,goal_type", ignoreDuplicates: false });
    if (error) errors.push(`goal_checkpoints batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

// Eos_Habits → eos_territory_habits (grade)

const HABIT_MAP: Record<string, { key: string; label: string; sort: number }> = {
  DailyTasks: { key: "daily_tasks", label: "Daily Tasks", sort: 1 },
  WeeklyContractorMeeting: { key: "weekly_contractor_meeting", label: "Weekly Contractor Meeting", sort: 2 },
  BiweeklyAgentMeeting: { key: "biweekly_agent_meeting", label: "Bi-weekly Agent Meeting", sort: 3 },
  WeeklyAccounting: { key: "weekly_accounting", label: "Weekly Accounting", sort: 4 },
  MonthlyLeadManager: { key: "monthly_lead_manager", label: "Monthly Lead Manager", sort: 5 },
};

export async function syncHabits(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<Record<string, unknown>>("SELECT * FROM Eos_Habits");
  const now = new Date().toISOString();

  const records: Record<string, unknown>[] = [];
  for (const row of rows) {
    const slug = row.TerritorySlug as string;
    for (const [msCol, habit] of Object.entries(HABIT_MAP)) {
      const grade = row[msCol] as string | null;
      if (!grade) continue;
      const validGrade = ["A", "B", "C", "D", "F"].includes(grade.toUpperCase()) ? grade.toUpperCase() : null;
      records.push({
        TerritorySlug: slug,
        habit_key: habit.key,
        habit_label: habit.label,
        grade: validGrade,
        sort_order: habit.sort,
        updated_at: now,
      });
    }
  }

  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase()
      .from("eos_territory_habits")
      .upsert(batch, { onConflict: "TerritorySlug,habit_key", ignoreDuplicates: false });
    if (error) errors.push(`habits batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

// Eos_MarketingChannels → eos_territory_lead_channels (is_active)

const CHANNEL_MAP: Record<string, string> = {
  ProspectNow: "Digital Prospect Now",
  Vacants: "Vacants",
  HighEquity: "High Equity",
  AbsenteeOwners: "Absentee Owners",
  Probates: "Probates",
  Evictions: "Evictions",
  CityCitations: "City Citations",
  DistressedRentals: "Distressed Rentals",
  Divorces: "Divorces",
  SocialPlatforms: "Social Platforms",
  Birddogs: "Birddogs",
  AgentListed: "Agent Listed",
  FSBO: "FSBO",
  Foreclosures: "Foreclosures",
  BrokeredAuctions: "Brokered Auctions",
  Wholesalers: "Wholesalers",
  Agents: "Agents Industry Network",
  IndustryNetwork: "Agents Industry Network", // MS splits this; we merge
  Homelight: "Homelight",
  AssetManagers: "Asset Managers",
  FacebookAds: "Facebook Ads",
  GoogleAds: "Google Ads",
  GoogleRetargeting: "Google Retargeting",
  OrganicSearch: "Organic Search",
  GoogleMapPack: "Google Map Pack",
  GoogleBusiness: "Google Business",
  Facebook: "Facebook",
  Instagram: "Instagram",
  TikTok: "TikTok",
  YouTube: "YouTube",
  GoogleBusinessProfile: "Google Business Profile",
  OtherSocialMedia: "Other Social Media",
};

export async function syncLeadChannels(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const rows = await queryMS<Record<string, unknown>>("SELECT * FROM Eos_MarketingChannels");
  const now = new Date().toISOString();

  // Build all records in memory first, then batch upsert
  const records: { TerritorySlug: string; channel_name: string; is_active: boolean; updated_at: string }[] = [];

  for (const row of rows) {
    const slug = row.TerritorySlug as string;
    // Track merged channels (Agents + IndustryNetwork → OR together)
    const channelValues: Record<string, boolean> = {};

    for (const [msCol, channelName] of Object.entries(CHANNEL_MAP)) {
      const isActive = toBool(row[msCol]);
      channelValues[channelName] = channelValues[channelName] || isActive;
    }

    for (const [channelName, isActive] of Object.entries(channelValues)) {
      records.push({ TerritorySlug: slug, channel_name: channelName, is_active: isActive, updated_at: now });
    }
  }

  // Batch upsert
  let synced = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase()
      .from("eos_territory_lead_channels")
      .upsert(batch, { onConflict: "TerritorySlug,channel_name", ignoreDuplicates: false });
    if (error) errors.push(`lead_channels batch ${i}: ${error.message}`);
    else synced += batch.length;
  }

  return { synced, errors };
}

// ─── Construction EOS (direct sync into ms_* tables) ─────────

export async function syncConstructionEos(): Promise<{
  synced: Record<string, number>;
  errors: string[];
}> {
  const errors: string[] = [];
  const synced: Record<string, number> = {};

  // Master statuses (5 rows)
  const statuses = await queryMS<{ StatusName: string; StatusColor: string | null; SortOrder: number }>(
    "SELECT * FROM Eos_Construction_MasterStatuses"
  );
  const statusRecords = statuses.map((r) => ({
    StatusName: r.StatusName,
    StatusColor: r.StatusColor,
    SortOrder: r.SortOrder,
  }));
  const { error: e1 } = await supabase().from("ms_eos_construction_master_statuses").upsert(statusRecords, {
    onConflict: "StatusName",
  });
  if (e1) errors.push(`master_statuses: ${e1.message}`);
  else synced.master_statuses = statusRecords.length;

  // Master tasks (16 rows)
  const tasks = await queryMS<{
    TaskId: number;
    TaskName: string;
    Enabled: number;
    Color: string | null;
    SortOrder: number | null;
  }>("SELECT * FROM Eos_Construction_MasterTasks");
  const taskRecords = tasks.map((r) => ({
    TaskId: r.TaskId,
    TaskName: r.TaskName,
    Enabled: r.Enabled === 1,
    Color: r.Color,
    SortOrder: r.SortOrder,
  }));
  const { error: e2 } = await supabase().from("ms_eos_construction_master_tasks").upsert(taskRecords, {
    onConflict: "TaskId",
  });
  if (e2) errors.push(`master_tasks: ${e2.message}`);
  else synced.master_tasks = taskRecords.length;

  // Habits (26 rows, wide table keyed by TerritorySlug)
  const habits = await queryMS<Record<string, unknown>>("SELECT * FROM Eos_Construction_Habits");
  const habitRecords = habits.map((r) => ({
    TerritorySlug: r.TerritorySlug as string,
    WeeklyBudgetMeeting: r.WeeklyBudgetMeeting as string | null,
    AltaWeeklyVideoUpdates: r.AltaWeeklyVideoUpdates as string | null,
    Phase1Walkthroughs: r.Phase1Walkthroughs as string | null,
    PropertyAutopsies: r.PropertyAutopsies as string | null,
    QuarterlyIndexUpdate: r.QuarterlyIndexUpdate as string | null,
  }));
  const { error: e3 } = await supabase().from("ms_eos_construction_habits").upsert(habitRecords, {
    onConflict: "TerritorySlug",
  });
  if (e3) errors.push(`construction_habits: ${e3.message}`);
  else synced.construction_habits = habitRecords.length;

  // Issues (20 rows)
  const issues = await queryMS<{ Id: number; TerritorySlug: string; Issue: string; Done: unknown }>(
    "SELECT * FROM Eos_Construction_Issues"
  );
  const issueRecords = issues.map((r) => ({
    Id: r.Id,
    TerritorySlug: r.TerritorySlug,
    Issue: r.Issue,
    Done: toBool(r.Done),
  }));
  const { error: e4 } = await supabase().from("ms_eos_construction_issues").upsert(issueRecords, {
    onConflict: "Id",
  });
  if (e4) errors.push(`construction_issues: ${e4.message}`);
  else synced.construction_issues = issueRecords.length;

  // Rocks (21 rows)
  const rocks = await queryMS<{ Id: number; TerritorySlug: string; Rock: string | null; Status: string | null }>(
    "SELECT * FROM Eos_Construction_Rocks"
  );
  const rockRecords = rocks.map((r) => ({
    Id: r.Id,
    TerritorySlug: r.TerritorySlug,
    Rock: r.Rock,
    Status: r.Status,
  }));
  const { error: e5 } = await supabase().from("ms_eos_construction_rocks").upsert(rockRecords, {
    onConflict: "Id",
  });
  if (e5) errors.push(`construction_rocks: ${e5.message}`);
  else synced.construction_rocks = rockRecords.length;

  // Todos (29 rows)
  const todos = await queryMS<{ Id: number; TerritorySlug: string; Todo: string | null; Done: unknown }>(
    "SELECT * FROM Eos_Construction_Todos"
  );
  const todoRecords = todos.map((r) => ({
    Id: r.Id,
    TerritorySlug: r.TerritorySlug,
    Todo: r.Todo,
    Done: toBool(r.Done),
  }));
  const { error: e6 } = await supabase().from("ms_eos_construction_todos").upsert(todoRecords, {
    onConflict: "Id",
  });
  if (e6) errors.push(`construction_todos: ${e6.message}`);
  else synced.construction_todos = todoRecords.length;

  // Tasks (1826 rows) — batch upsert
  const ctasks = await queryMS<{
    PropertyId: number;
    MasterTask: string;
    Status: string;
    UpdatedTime: string | null;
    UpdatedBy: string | null;
  }>("SELECT * FROM Eos_Construction_Tasks");
  const ctaskRecords = ctasks.map((r) => ({
    PropertyId: r.PropertyId,
    MasterTask: r.MasterTask,
    Status: r.Status,
    UpdatedTime: toISOOrNull(r.UpdatedTime),
    UpdatedBy: r.UpdatedBy,
  }));
  for (let i = 0; i < ctaskRecords.length; i += BATCH_SIZE) {
    const batch = ctaskRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("ms_eos_construction_tasks").upsert(batch, {
      onConflict: "PropertyId,MasterTask",
    });
    if (error) errors.push(`construction_tasks batch ${i}: ${error.message}`);
  }
  synced.construction_tasks = ctaskRecords.length;

  // Task history (2010 rows) — batch upsert
  const history = await queryMS<{
    Id: number;
    InsertedTime: string | null;
    InsertedBy: string | null;
    PropertyId: number;
    MasterTask: string;
    Status: string;
  }>("SELECT * FROM Eos_Construction_TaskHistory");
  const historyRecords = history.map((r) => ({
    Id: r.Id,
    InsertedTime: toISOOrNull(r.InsertedTime),
    InsertedBy: r.InsertedBy,
    PropertyId: r.PropertyId,
    MasterTask: r.MasterTask,
    Status: r.Status,
  }));
  for (let i = 0; i < historyRecords.length; i += BATCH_SIZE) {
    const batch = historyRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("ms_eos_construction_task_history").upsert(batch, {
      onConflict: "Id",
    });
    if (error) errors.push(`construction_task_history batch ${i}: ${error.message}`);
  }
  synced.construction_task_history = historyRecords.length;

  // Task notes (110 rows) — delete + insert (no PK)
  const notes = await queryMS<{
    PropertyId: number;
    MasterTask: string | null;
    Note: string | null;
    UpdatedTime: string | null;
    UpdatedBy: string | null;
  }>("SELECT * FROM Eos_Construction_TaskNotes");
  await supabase().from("ms_eos_construction_task_notes").delete().neq("PropertyId", -1);
  const noteRecords = notes.map((r) => ({
    PropertyId: r.PropertyId,
    MasterTask: r.MasterTask,
    Note: r.Note,
    UpdatedTime: toISOOrNull(r.UpdatedTime),
    UpdatedBy: r.UpdatedBy,
  }));
  for (let i = 0; i < noteRecords.length; i += BATCH_SIZE) {
    const batch = noteRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("ms_eos_construction_task_notes").insert(batch);
    if (error) errors.push(`construction_task_notes batch ${i}: ${error.message}`);
  }
  synced.construction_task_notes = noteRecords.length;

  return { synced, errors };
}

// ─── Project Management (direct sync into ms_* tables) ───────

export async function syncProjectManagement(): Promise<{
  synced: Record<string, number>;
  errors: string[];
}> {
  const errors: string[] = [];
  const synced: Record<string, number> = {};

  // Master statuses (5 rows)
  const statuses = await queryMS<{ StatusName: string; StatusColor: string | null }>(
    "SELECT * FROM ProjectManagement_Config_MasterStatuses"
  );
  const { error: e1 } = await supabase()
    .from("ms_project_management_master_statuses")
    .upsert(
      statuses.map((r) => ({ StatusName: r.StatusName, StatusColor: r.StatusColor })),
      { onConflict: "StatusName" }
    );
  if (e1) errors.push(`pm_master_statuses: ${e1.message}`);
  else synced.pm_master_statuses = statuses.length;

  // Master tasks (2223 rows) — batch
  const tasks = await queryMS<{
    TaskId: number;
    TaskName: string;
    TerritoryId: number;
    Enabled: number;
    Color: string | null;
    SortOrder: number | null;
  }>("SELECT * FROM ProjectManagement_Config_MasterTasks");
  const taskRecords = tasks.map((r) => ({
    TaskId: r.TaskId,
    TaskName: r.TaskName,
    TerritoryId: r.TerritoryId,
    Enabled: r.Enabled === 1,
    Color: r.Color,
    SortOrder: r.SortOrder,
  }));
  for (let i = 0; i < taskRecords.length; i += BATCH_SIZE) {
    const batch = taskRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("ms_project_management_master_tasks").upsert(batch, {
      onConflict: "TaskId",
    });
    if (error) errors.push(`pm_master_tasks batch ${i}: ${error.message}`);
  }
  synced.pm_master_tasks = taskRecords.length;

  // Tasks (16013 rows) — batch
  const pmTasks = await queryMS<{
    PropertyId: number;
    MasterTask: string;
    Status: string;
    UpdatedTime: string | null;
    UpdatedBy: string | null;
  }>("SELECT * FROM ProjectManagement_Tasks");
  const pmRecords = pmTasks.map((r) => ({
    PropertyId: r.PropertyId,
    MasterTask: r.MasterTask,
    Status: r.Status,
    UpdatedTime: toISOOrNull(r.UpdatedTime),
    UpdatedBy: r.UpdatedBy,
  }));
  for (let i = 0; i < pmRecords.length; i += BATCH_SIZE) {
    const batch = pmRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("ms_project_management_tasks").upsert(batch, {
      onConflict: "PropertyId,MasterTask",
    });
    if (error) errors.push(`pm_tasks batch ${i}: ${error.message}`);
  }
  synced.pm_tasks = pmRecords.length;

  // Task notes (509 rows) — delete + insert (no PK)
  const notes = await queryMS<{
    PropertyId: number;
    MasterTask: string | null;
    Note: string | null;
    UpdatedTime: string | null;
    UpdatedBy: string | null;
  }>("SELECT * FROM ProjectManagement_TaskNotes");
  await supabase().from("ms_project_management_task_notes").delete().neq("PropertyId", -1);
  const noteRecords = notes.map((r) => ({
    PropertyId: r.PropertyId,
    MasterTask: r.MasterTask,
    Note: r.Note,
    UpdatedTime: toISOOrNull(r.UpdatedTime),
    UpdatedBy: r.UpdatedBy,
  }));
  for (let i = 0; i < noteRecords.length; i += BATCH_SIZE) {
    const batch = noteRecords.slice(i, i + BATCH_SIZE);
    const { error } = await supabase().from("ms_project_management_task_notes").insert(batch);
    if (error) errors.push(`pm_task_notes batch ${i}: ${error.message}`);
  }
  synced.pm_task_notes = noteRecords.length;

  return { synced, errors };
}

// ─── Master orchestrator ─────────────────────────────────────

export async function syncAllEos(): Promise<{
  results: Record<string, { synced: number | Record<string, number>; errors: string[] }>;
  totalErrors: number;
}> {
  const results: Record<string, { synced: number | Record<string, number>; errors: string[] }> = {};

  // Territory EOS (row-for-row)
  results.rocks = await syncRocks();
  results.todos = await syncTodos();
  results.issues = await syncIssues();
  results.budgets = await syncBudgets();

  // Territory EOS (wide → EAV)
  results.goals = await syncGoals();
  results.goalCheckpoints = await syncGoalCheckpoints();
  results.habits = await syncHabits();
  results.leadChannels = await syncLeadChannels();

  // Construction EOS
  const construction = await syncConstructionEos();
  results.construction = { synced: construction.synced, errors: construction.errors };

  // Project Management
  const pm = await syncProjectManagement();
  results.projectManagement = { synced: pm.synced, errors: pm.errors };

  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

  return { results, totalErrors };
}
