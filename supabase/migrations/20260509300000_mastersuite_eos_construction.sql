-- ============================================================
-- MasterSuite Integration — Phase 4: EOS Construction + Project Management
-- ============================================================

-- Construction EOS
CREATE TABLE IF NOT EXISTS ms_eos_construction_master_statuses (
  "StatusName" text PRIMARY KEY,
  "StatusColor" text,
  "SortOrder" int NOT NULL
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_master_tasks (
  "TaskId" int PRIMARY KEY,
  "TaskName" text NOT NULL,
  "Enabled" boolean NOT NULL DEFAULT false,
  "Color" text,
  "SortOrder" smallint
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_habits (
  "TerritorySlug" text PRIMARY KEY REFERENCES territories("TerritorySlug"),
  "WeeklyBudgetMeeting" text,
  "AltaWeeklyVideoUpdates" text,
  "Phase1Walkthroughs" text,
  "PropertyAutopsies" text,
  "QuarterlyIndexUpdate" text
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_issues (
  "Id" int PRIMARY KEY,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  "Issue" text NOT NULL,
  "Done" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_rocks (
  "Id" int PRIMARY KEY,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  "Rock" text,
  "Status" text
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_todos (
  "Id" int PRIMARY KEY,
  "TerritorySlug" text NOT NULL REFERENCES territories("TerritorySlug"),
  "Todo" text,
  "Done" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_tasks (
  "PropertyId" int NOT NULL,
  "MasterTask" text NOT NULL,
  "Status" text NOT NULL,
  "UpdatedTime" timestamptz,
  "UpdatedBy" text,
  PRIMARY KEY ("PropertyId", "MasterTask")
);

CREATE TABLE IF NOT EXISTS ms_eos_construction_task_history (
  "Id" int PRIMARY KEY,
  "InsertedTime" timestamptz,
  "InsertedBy" text,
  "PropertyId" int NOT NULL,
  "MasterTask" text NOT NULL,
  "Status" text NOT NULL
);

CREATE INDEX idx_ms_ecth_property ON ms_eos_construction_task_history("PropertyId");

CREATE TABLE IF NOT EXISTS ms_eos_construction_task_notes (
  "PropertyId" int NOT NULL,
  "MasterTask" text,
  "Note" text,
  "UpdatedTime" timestamptz,
  "UpdatedBy" text
);

CREATE INDEX idx_ms_ectn_property ON ms_eos_construction_task_notes("PropertyId");

-- Project Management
CREATE TABLE IF NOT EXISTS ms_project_management_master_statuses (
  "StatusName" text PRIMARY KEY,
  "StatusColor" text
);

CREATE TABLE IF NOT EXISTS ms_project_management_master_tasks (
  "TaskId" int PRIMARY KEY,
  "TaskName" text NOT NULL,
  "TerritoryId" int NOT NULL,
  "Enabled" boolean NOT NULL DEFAULT false,
  "Color" text,
  "SortOrder" smallint
);

CREATE TABLE IF NOT EXISTS ms_project_management_tasks (
  "PropertyId" int NOT NULL,
  "MasterTask" text NOT NULL,
  "Status" text NOT NULL,
  "UpdatedTime" timestamptz,
  "UpdatedBy" text,
  PRIMARY KEY ("PropertyId", "MasterTask")
);

CREATE TABLE IF NOT EXISTS ms_project_management_task_notes (
  "PropertyId" int NOT NULL,
  "MasterTask" text,
  "Note" text,
  "UpdatedTime" timestamptz,
  "UpdatedBy" text
);

CREATE INDEX idx_ms_pmtn_property ON ms_project_management_task_notes("PropertyId");

-- RLS
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ms_eos_construction_master_statuses', 'ms_eos_construction_master_tasks',
    'ms_eos_construction_habits', 'ms_eos_construction_issues',
    'ms_eos_construction_rocks', 'ms_eos_construction_todos',
    'ms_eos_construction_tasks', 'ms_eos_construction_task_history',
    'ms_eos_construction_task_notes',
    'ms_project_management_master_statuses', 'ms_project_management_master_tasks',
    'ms_project_management_tasks', 'ms_project_management_task_notes'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      'read_' || tbl, tbl);
  END LOOP;
END $$;
