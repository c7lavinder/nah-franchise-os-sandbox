import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the five native-write replay handlers added to
 * lib/mastersuite/apply-native-writes.ts: toggle_task, sub_task_log,
 * workflow_status, create_contact, update_contact.
 *
 * The module only exports applyNativeWrites(), so tests drive it through the
 * public dispatcher — feeding journal rows via a mocked MySQL pool — and
 * assert against an in-memory Supabase fake plus mocked GHL/side-effect
 * calls. This mirrors the chain-call mocking pattern used in
 * tests/api/calls-list-route.test.ts, generalized into a small fake
 * postgrest-style query builder since these handlers touch many tables.
 */

// ---- In-memory "Supabase" ---------------------------------------------

type Row = Record<string, unknown>;

class TableStore {
  rows: Row[] = [];
}

class FakeSupabase {
  tables = new Map<string, TableStore>();

  private store(table: string): TableStore {
    if (!this.tables.has(table)) this.tables.set(table, new TableStore());
    return this.tables.get(table)!;
  }

  seed(table: string, rows: Row[]) {
    this.store(table).rows.push(...rows.map((r) => ({ ...r })));
  }

  get(table: string): Row[] {
    return this.store(table).rows;
  }

  from(table: string) {
    return new Builder(this.store(table));
  }
}

type Filter = (row: Row) => boolean;

class Builder implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filters: Filter[] = [];
  private mode: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private opts: { onConflict?: string; ignoreDuplicates?: boolean } | null = null;
  private terminal: "single" | "maybeSingle" | null = null;
  private returning = false;
  private limitN: number | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;

  constructor(private store: TableStore) {}

  select(_cols?: string) {
    if (this.mode !== "select") this.returning = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((row) => row[col] === val);
    return this;
  }
  ilike(col: string, val: unknown) {
    // No %-pattern support — the handlers only pass exact (case-insensitive) values
    this.filters.push(
      (row) => typeof row[col] === "string" && (row[col] as string).toLowerCase() === String(val).toLowerCase()
    );
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((row) => (row[col] ?? null) === val);
    return this;
  }
  not(col: string, _op: string, val: unknown) {
    this.filters.push((row) => row[col] !== val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }
  contains(col: string, vals: unknown[]) {
    this.filters.push((row) => Array.isArray(row[col]) && (row[col] as unknown[]).some((v) => vals.includes(v)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.terminal = "maybeSingle";
    return this;
  }
  single() {
    this.terminal = "single";
    return this;
  }
  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Row) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert";
    this.payload = payload;
    this.opts = opts ?? null;
    return this;
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    let rows = this.store.rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private execute(): { data: unknown; error: { message: string } | null } {
    if (this.mode === "insert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const obj of incoming) {
        if (obj.id !== undefined && this.store.rows.some((r) => r.id === obj.id)) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        this.store.rows.push({ ...obj });
      }
      return this.finish(incoming);
    }

    if (this.mode === "update") {
      const rows = this.matched();
      for (const row of rows) Object.assign(row, this.payload);
      return this.finish(rows);
    }

    if (this.mode === "upsert") {
      const conflictCols = (this.opts?.onConflict ?? "id").split(",");
      const obj = this.payload as Row;
      const existing = this.store.rows.find((r) => conflictCols.every((c) => r[c] === obj[c]));
      if (existing) {
        if (!this.opts?.ignoreDuplicates) Object.assign(existing, obj);
        return this.finish([existing]);
      }
      const created = { ...obj };
      this.store.rows.push(created);
      return this.finish([created]);
    }

    // select
    const rows = this.matched();
    return this.finish(rows);
  }

  private finish(rows: Row[]): { data: unknown; error: { message: string } | null } {
    if (this.terminal === "maybeSingle") return { data: rows[0] ?? null, error: null };
    if (this.terminal === "single") {
      return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "not found" } };
    }
    return { data: rows, error: null };
  }
}

const fakeSupabase = new FakeSupabase();

vi.mock("@/lib/mastersuite/supabase", () => ({
  getServiceSupabase: () => fakeSupabase,
}));

// ---- MySQL journal pool -------------------------------------------------

let pendingRows: Array<{ Id: number; WriteType: string; PayloadJson: string }> = [];
const statusUpdates: Array<{ id: number; status: string; error: string | null }> = [];

let claimAffectedRows = 1; // send-type claim UPDATE result; set 0 to simulate a lost claim

const poolQuery = vi.fn(async (sql: string, params: unknown[]) => {
  if (sql.includes("SELECT Id, WriteType")) {
    return [pendingRows];
  }
  if (sql.includes("Status = 'sending'")) {
    statusUpdates.push({ id: params[0] as number, status: "sending", error: null });
    return [{ affectedRows: claimAffectedRows }];
  }
  if (sql.includes("UPDATE frandev_native_write")) {
    if (sql.includes("Status = 'applied'")) {
      statusUpdates.push({ id: params[0] as number, status: "applied", error: null });
    } else {
      statusUpdates.push({ id: params[1] as number, status: "failed", error: params[0] as string });
    }
    return [{}];
  }
  return [[]];
});

vi.mock("@/lib/mastersuite/write-client", () => ({
  isWriteConfigured: () => true,
  getMasterSuiteWritePool: () => ({ query: poolQuery }),
}));

// ---- GHL + side-effect mocks --------------------------------------------

const ghlMocks = {
  upsertContact: vi.fn(async () => ({ contact: { id: "ghl-new-1" }, new: true })),
  updateContact: vi.fn(async () => ({ id: "ghl-new-1" })),
  updateTask: vi.fn(async () => ({ id: "ghl-task-1" })),
  createTask: vi.fn(async () => ({ id: "ghl-task-1" })),
  sendMessage: vi.fn(async () => ({ id: "ghl-msg-1" })),
};

vi.mock("@/lib/ghl", () => ghlMocks);

let sendsEnabled = true;
vi.mock("@/lib/ghl/action-safety", () => ({
  customerFacingSendsEnabled: () => sendsEnabled,
  customerFacingSendsDisabledReason: () => "Customer-facing sends are disabled.",
}));
const touchFieldsMock = vi.fn(async () => {});
vi.mock("@/lib/ghl/touch-fields", () => ({ updateTouchFields: touchFieldsMock }));
const sendSmsProviderMock = vi.fn(async () => ({ id: "prov-msg-1" }));
vi.mock("@/lib/sms/contact-sms", () => ({ sendContactSmsViaActiveProvider: sendSmsProviderMock }));
vi.mock("@/lib/ghl/stage-sync", () => ({ syncStageToGHL: vi.fn(async () => {}) }));
vi.mock("@/lib/eos/carry-forward", () => ({ carryForwardContactEos: vi.fn(async () => {}) }));
vi.mock("@/lib/briefs/mark-journey-brief-stale", () => ({ markJourneyBriefStale: vi.fn(async () => {}) }));
vi.mock("@/lib/workflows/trigger-matcher", () => ({ matchWorkflowTriggers: vi.fn(async () => {}) }));
vi.mock("@/lib/agents/contact-research", () => ({ runContactResearch: vi.fn(async () => {}) }));

const executeGHLActionMock = vi.fn(
  async (): Promise<{ success: boolean; actionCode: string; data?: unknown; error?: string }> => ({
    success: true,
    actionCode: "C1",
    data: { id: "ghl-msg-9" },
  })
);
vi.mock("@/lib/ghl/actions/executor", () => ({
  executeGHLAction: (...args: unknown[]) => executeGHLActionMock(...(args as [])),
}));
vi.mock("@/lib/workflows/tracking", () => ({
  prepareEmailForTracking: (html: string) => `${html}<!--tracked-->`,
}));
const advanceDayMock = vi.fn(async () => {});
vi.mock("@/lib/workflows/enrollment", () => ({ advanceDay: advanceDayMock }));
vi.mock("@/lib/workflows/personalization", () => ({
  personalizeWorkflowText: vi.fn(async ({ text }: { text: string | null }) => text ?? ""),
}));

// ---- Helpers --------------------------------------------------------------

function journalRow(id: number, writeType: string, payload: Record<string, unknown>) {
  return { Id: id, WriteType: writeType, PayloadJson: JSON.stringify(payload) };
}

describe("applyNativeWrites — toggle_task", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
    Object.values(ghlMocks).forEach((m) => m.mockClear());
  });

  it("flips completed + completed_at and pushes to GHL when not already at the target state", async () => {
    fakeSupabase.seed("tasks", [
      { id: "task-1", completed: false, ghl_task_id: "ghl-task-1", ghl_contact_id: "ghl-contact-1" },
    ]);
    pendingRows = [
      journalRow(1, "toggle_task", {
        task_id: "task-1",
        contact_id: "contact-1",
        ghl_contact_id: "ghl-contact-1",
        completed: true,
        toggled_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
    const task = fakeSupabase.get("tasks")[0];
    expect(task.completed).toBe(true);
    expect(task.completed_at).not.toBeNull();
    expect(ghlMocks.updateTask).toHaveBeenCalledWith("ghl-contact-1", "ghl-task-1", { completed: true });
    expect(statusUpdates).toEqual([{ id: 1, status: "applied", error: null }]);
  });

  it("is idempotent — replaying the same toggle again is a no-op Supabase write", async () => {
    fakeSupabase.seed("tasks", [
      {
        id: "task-1",
        completed: true,
        completed_at: "2026-01-01T00:00:00.000Z",
        ghl_task_id: "ghl-task-1",
        ghl_contact_id: "ghl-contact-1",
      },
    ]);
    pendingRows = [
      journalRow(1, "toggle_task", {
        task_id: "task-1",
        contact_id: "contact-1",
        ghl_contact_id: "ghl-contact-1",
        completed: true,
        toggled_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const task = fakeSupabase.get("tasks")[0];
    expect(task.completed_at).toBe("2026-01-01T00:00:00.000Z"); // untouched — no write happened
  });

  it("fails the journal row when the task doesn't exist in Supabase", async () => {
    pendingRows = [
      journalRow(1, "toggle_task", {
        task_id: "missing-task",
        contact_id: "contact-1",
        ghl_contact_id: "ghl-contact-1",
        completed: true,
        toggled_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/not found in Supabase/);
  });

  it("skips the GHL push for placeholder pto_ contacts", async () => {
    fakeSupabase.seed("tasks", [
      { id: "task-1", completed: false, ghl_task_id: "ghl-task-1", ghl_contact_id: "pto_placeholder" },
    ]);
    pendingRows = [
      journalRow(1, "toggle_task", {
        task_id: "task-1",
        contact_id: "contact-1",
        ghl_contact_id: null,
        completed: true,
        toggled_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(ghlMocks.updateTask).not.toHaveBeenCalled();
  });
});

describe("applyNativeWrites — sub_task_log", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
  });

  it("inserts a completed log with MasterSuite's minted id for a two_state sub-task", async () => {
    fakeSupabase.seed("pipeline_sub_tasks", [{ id: "sub-1", state_type: "two_state" }]);
    pendingRows = [
      journalRow(1, "sub_task_log", {
        log_id: "log-1",
        state_id: "state-1",
        journey_id: "journey-1",
        sub_task_id: "sub-1",
        contact_id: "contact-1",
        territory_slug: null,
        completed: true,
        note: "Done on site",
        logged_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const logs = fakeSupabase.get("contact_sub_task_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: "log-1",
      journey_pipeline_state_id: "state-1",
      sub_task_id: "sub-1",
      source: "manual",
      state_advance: "second",
      content_type: "note",
      logger_user_id: null,
    });
    expect(logs[0].content_text).toContain("Done on site");
    expect(logs[0].content_text).toContain("via MasterSuite by chad");
  });

  it("is idempotent on re-insert by log_id — does not duplicate the row", async () => {
    fakeSupabase.seed("pipeline_sub_tasks", [{ id: "sub-1", state_type: "single" }]);
    fakeSupabase.seed("contact_sub_task_logs", [
      { id: "log-1", journey_pipeline_state_id: "state-1", sub_task_id: "sub-1", deleted_at: null },
    ]);
    pendingRows = [
      journalRow(1, "sub_task_log", {
        log_id: "log-1",
        state_id: "state-1",
        journey_id: "journey-1",
        sub_task_id: "sub-1",
        contact_id: "contact-1",
        territory_slug: null,
        completed: true,
        note: null,
        logged_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("contact_sub_task_logs")).toHaveLength(1);
  });

  it("un-completing (completed=false) soft-deletes by log_id first", async () => {
    fakeSupabase.seed("contact_sub_task_logs", [
      { id: "log-1", journey_pipeline_state_id: "state-1", sub_task_id: "sub-1", deleted_at: null },
      { id: "log-2", journey_pipeline_state_id: "state-1", sub_task_id: "sub-1", deleted_at: null },
    ]);
    pendingRows = [
      journalRow(1, "sub_task_log", {
        log_id: "log-1",
        state_id: "state-1",
        journey_id: "journey-1",
        sub_task_id: "sub-1",
        contact_id: "contact-1",
        territory_slug: null,
        completed: false,
        note: null,
        logged_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const logs = fakeSupabase.get("contact_sub_task_logs");
    // Only the targeted log_id was deleted; the sister log for the same
    // sub-task was left alone because the id-preferred delete matched.
    expect(logs.find((l) => l.id === "log-1")?.deleted_at).not.toBeNull();
    expect(logs.find((l) => l.id === "log-2")?.deleted_at).toBeNull();
  });

  it("un-completing falls back to (state_id, sub_task_id) when the log_id row is already gone", async () => {
    fakeSupabase.seed("contact_sub_task_logs", [
      { id: "log-2", journey_pipeline_state_id: "state-1", sub_task_id: "sub-1", deleted_at: null },
    ]);
    pendingRows = [
      journalRow(1, "sub_task_log", {
        log_id: "log-missing",
        state_id: "state-1",
        journey_id: "journey-1",
        sub_task_id: "sub-1",
        contact_id: "contact-1",
        territory_slug: null,
        completed: false,
        note: null,
        logged_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const logs = fakeSupabase.get("contact_sub_task_logs");
    expect(logs.find((l) => l.id === "log-2")?.deleted_at).not.toBeNull();
  });

  it("un-completing an already-deleted / absent log matches zero rows (idempotent no-op)", async () => {
    pendingRows = [
      journalRow(1, "sub_task_log", {
        log_id: "log-gone",
        state_id: "state-1",
        journey_id: "journey-1",
        sub_task_id: "sub-1",
        contact_id: "contact-1",
        territory_slug: null,
        completed: false,
        note: null,
        logged_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
  });
});

describe("applyNativeWrites — workflow_status", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
  });

  it("updates status when the optimistic from_status guard matches", async () => {
    fakeSupabase.seed("workflows", [{ id: "wf-1", status: "draft" }]);
    pendingRows = [
      journalRow(1, "workflow_status", {
        workflow_id: "wf-1",
        from_status: "draft",
        to_status: "active",
        changed_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("workflows")[0].status).toBe("active");
  });

  it("is idempotent when already at to_status", async () => {
    fakeSupabase.seed("workflows", [{ id: "wf-1", status: "active" }]);
    pendingRows = [
      journalRow(1, "workflow_status", {
        workflow_id: "wf-1",
        from_status: "draft",
        to_status: "active",
        changed_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("workflows")[0].status).toBe("active");
  });

  it("fails the journal row on conflict — status changed in the app since", async () => {
    fakeSupabase.seed("workflows", [{ id: "wf-1", status: "paused" }]);
    pendingRows = [
      journalRow(1, "workflow_status", {
        workflow_id: "wf-1",
        from_status: "draft",
        to_status: "active",
        changed_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/conflict/);
    expect(fakeSupabase.get("workflows")[0].status).toBe("paused"); // untouched
  });
});

describe("applyNativeWrites — update_contact", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
    Object.values(ghlMocks).forEach((m) => m.mockClear());
  });

  it("patches phone directly and routes email through contact_emails, then syncs GHL", async () => {
    fakeSupabase.seed("contacts", [{ id: "contact-1", phone: "555-0000", ghl_contact_id: "ghl-contact-1" }]);
    pendingRows = [
      journalRow(1, "update_contact", {
        contact_id: "contact-1",
        ghl_contact_id: "ghl-contact-1",
        phone: "555-1111",
        email: "new@example.com",
        updated_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("contacts")[0].phone).toBe("555-1111");
    const emailRow = fakeSupabase.get("contact_emails").find((e) => e.email === "new@example.com");
    expect(emailRow).toMatchObject({ contact_id: "contact-1", is_primary: true, source: "manual" });
    expect(ghlMocks.updateContact).toHaveBeenCalledWith("ghl-contact-1", {
      phone: "555-1111",
      email: "new@example.com",
    });
  });

  it("skips GHL sync for placeholder pto_ contacts", async () => {
    fakeSupabase.seed("contacts", [{ id: "contact-1", phone: "555-0000", ghl_contact_id: "pto_placeholder" }]);
    pendingRows = [
      journalRow(1, "update_contact", {
        contact_id: "contact-1",
        ghl_contact_id: "pto_placeholder",
        phone: "555-1111",
        email: null,
        updated_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(ghlMocks.updateContact).not.toHaveBeenCalled();
  });

  it("is a no-op when both phone and email are blank", async () => {
    fakeSupabase.seed("contacts", [{ id: "contact-1", phone: "555-0000", ghl_contact_id: "ghl-contact-1" }]);
    pendingRows = [
      journalRow(1, "update_contact", {
        contact_id: "contact-1",
        ghl_contact_id: "ghl-contact-1",
        phone: null,
        email: null,
        updated_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("contacts")[0].phone).toBe("555-0000");
    expect(ghlMocks.updateContact).not.toHaveBeenCalled();
  });
});

describe("applyNativeWrites — create_contact", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
    Object.values(ghlMocks).forEach((m) => m.mockClear());
  });

  function seedPipelineFixtures() {
    fakeSupabase.seed("pipelines", [{ id: "pipeline-sales", slug: "sales" }]);
    fakeSupabase.seed("pipeline_stages", [{ id: "stage-engagement", pipeline_id: "pipeline-sales", sort_order: 1 }]);
    fakeSupabase.seed("pipeline_sub_tasks", [{ id: "sub-outreach", stage_id: "stage-engagement", sort_order: 1 }]);
    fakeSupabase.seed("users", [{ id: "user-chad", email: "chad@newagainhouses.com" }]);
  }

  it("replays the full create flow with minted ids on a fresh contact", async () => {
    seedPipelineFixtures();
    pendingRows = [
      journalRow(1, "create_contact", {
        contact_id: "contact-minted-1",
        journey_id: "journey-minted-1",
        journey_contact_id: "jc-minted-1",
        state_id: "state-minted-1",
        first_name: "Pat",
        last_name: "Prospect",
        email: "pat@example.com",
        phone: "555-2222",
        city: "Austin",
        state: "TX",
        source: "web",
        sub_source: "form",
        journey_slug: "sales",
        journey_name: "Pat Prospect",
        created_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);

    expect(ghlMocks.upsertContact).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Pat", lastName: "Prospect", email: "pat@example.com", phone: "555-2222" })
    );

    const contact = fakeSupabase.get("contacts").find((c) => c.id === "contact-minted-1");
    expect(contact).toMatchObject({ id: "contact-minted-1", ghl_contact_id: "ghl-new-1", first_name: "Pat" });

    const journey = fakeSupabase.get("journeys").find((j) => j.id === "journey-minted-1");
    expect(journey).toMatchObject({ id: "journey-minted-1", primary_contact_id: "contact-minted-1", slug: "sales" });

    const membership = fakeSupabase.get("journey_contacts").find((m) => m.id === "jc-minted-1");
    expect(membership).toMatchObject({
      journey_id: "journey-minted-1",
      contact_id: "contact-minted-1",
      role: "primary",
    });

    const state = fakeSupabase.get("journey_pipeline_state").find((s) => s.id === "state-minted-1");
    expect(state).toMatchObject({
      journey_id: "journey-minted-1",
      pipeline_id: "pipeline-sales",
      current_stage_id: "stage-engagement",
      current_sub_task_id: "sub-outreach",
      assigned_user_id: "user-chad",
      is_active: true,
    });

    expect(fakeSupabase.get("eos_contact_goals")).toHaveLength(1);
  });

  it("is idempotent — a second replay against an existing contact does not duplicate rows or re-fire GHL create", async () => {
    seedPipelineFixtures();
    fakeSupabase.seed("contacts", [{ id: "contact-minted-1", ghl_contact_id: "ghl-existing-1" }]);
    fakeSupabase.seed("journeys", [{ id: "journey-minted-1", primary_contact_id: "contact-minted-1", slug: "sales" }]);
    fakeSupabase.seed("journey_contacts", [
      { id: "jc-minted-1", journey_id: "journey-minted-1", contact_id: "contact-minted-1", role: "primary" },
    ]);
    fakeSupabase.seed("journey_pipeline_state", [
      { id: "state-minted-1", journey_id: "journey-minted-1", pipeline_id: "pipeline-sales" },
    ]);

    pendingRows = [
      journalRow(1, "create_contact", {
        contact_id: "contact-minted-1",
        journey_id: "journey-minted-1",
        journey_contact_id: "jc-minted-1",
        state_id: "state-minted-1",
        first_name: "Pat",
        last_name: "Prospect",
        email: "pat@example.com",
        phone: "555-2222",
        city: "Austin",
        state: "TX",
        source: "web",
        sub_source: "form",
        journey_slug: "sales",
        journey_name: "Pat Prospect",
        created_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(ghlMocks.upsertContact).not.toHaveBeenCalled(); // existing contact — GHL create skipped
    expect(fakeSupabase.get("contacts")).toHaveLength(1);
    expect(fakeSupabase.get("journeys")).toHaveLength(1);
    expect(fakeSupabase.get("journey_contacts")).toHaveLength(1);
    expect(fakeSupabase.get("journey_pipeline_state")).toHaveLength(1);
  });
});

describe("applyNativeWrites — board_move", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
    Object.values(ghlMocks).forEach((m) => m.mockClear());
  });

  it("moves stage + sub-task, updating jps and inserting history + a move note with the minted ids", async () => {
    fakeSupabase.seed("journey_pipeline_state", [
      { id: "state-1", current_stage_id: "stage-a", current_sub_task_id: "sub-a1" },
    ]);
    pendingRows = [
      journalRow(1, "board_move", {
        state_id: "state-1",
        journey_id: "journey-1",
        contact_id: "contact-1",
        pipeline_slug: "sales",
        target_type: "subtask",
        target_stage_id: "stage-b",
        target_sub_task_id: "sub-b1",
        to_stage_slug: "qualification",
        from_stage_id: "stage-a",
        from_sub_task_id: "sub-a1",
        stage_changed: true,
        sub_task_changed: true,
        history_id: "hist-1",
        sub_task_log_id: "log-1",
        sub_task_name: "NDA",
        moved_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const jps = fakeSupabase.get("journey_pipeline_state")[0];
    expect(jps.current_stage_id).toBe("stage-b");
    expect(jps.current_sub_task_id).toBe("sub-b1");
    const hist = fakeSupabase.get("pipeline_stage_history");
    expect(hist).toHaveLength(1);
    expect(hist[0].id).toBe("hist-1");
    expect(hist[0].from_stage_id).toBe("stage-a");
    expect(hist[0].to_stage_id).toBe("stage-b");
    const logs = fakeSupabase.get("contact_sub_task_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe("log-1");
    expect((logs[0].metadata as { kind: string }).kind).toBe("sub_stage_move");
  });

  it("is idempotent — replaying when already at the target stage + sub-task is a no-op", async () => {
    fakeSupabase.seed("journey_pipeline_state", [
      { id: "state-1", current_stage_id: "stage-b", current_sub_task_id: "sub-b1" },
    ]);
    pendingRows = [
      journalRow(1, "board_move", {
        state_id: "state-1",
        journey_id: "journey-1",
        contact_id: "contact-1",
        pipeline_slug: "sales",
        target_type: "subtask",
        target_stage_id: "stage-b",
        target_sub_task_id: "sub-b1",
        to_stage_slug: "qualification",
        from_stage_id: "stage-a",
        from_sub_task_id: "sub-a1",
        stage_changed: true,
        sub_task_changed: true,
        history_id: "hist-1",
        sub_task_log_id: "log-1",
        sub_task_name: "NDA",
        moved_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("pipeline_stage_history")).toHaveLength(0);
    expect(fakeSupabase.get("contact_sub_task_logs")).toHaveLength(0);
  });

  it("fails on a stage-change conflict when the row moved in the app since", async () => {
    fakeSupabase.seed("journey_pipeline_state", [
      { id: "state-1", current_stage_id: "stage-c", current_sub_task_id: null },
    ]);
    pendingRows = [
      journalRow(1, "board_move", {
        state_id: "state-1",
        journey_id: "journey-1",
        contact_id: "contact-1",
        pipeline_slug: "sales",
        target_type: "subtask",
        target_stage_id: "stage-b",
        target_sub_task_id: "sub-b1",
        to_stage_slug: "qualification",
        from_stage_id: "stage-a",
        from_sub_task_id: "sub-a1",
        stage_changed: true,
        sub_task_changed: true,
        history_id: "hist-1",
        sub_task_log_id: "log-1",
        sub_task_name: "NDA",
        moved_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/conflict/);
  });

  it("moves sub-task only within the same stage — no history row, just the move note", async () => {
    fakeSupabase.seed("journey_pipeline_state", [
      { id: "state-1", current_stage_id: "stage-a", current_sub_task_id: "sub-a1" },
    ]);
    pendingRows = [
      journalRow(1, "board_move", {
        state_id: "state-1",
        journey_id: "journey-1",
        contact_id: "contact-1",
        pipeline_slug: "sales",
        target_type: "subtask",
        target_stage_id: "stage-a",
        target_sub_task_id: "sub-a2",
        to_stage_slug: "engagement",
        from_stage_id: "stage-a",
        from_sub_task_id: "sub-a1",
        stage_changed: false,
        sub_task_changed: true,
        history_id: null,
        sub_task_log_id: "log-2",
        sub_task_name: "Intro Call",
        moved_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const jps = fakeSupabase.get("journey_pipeline_state")[0];
    expect(jps.current_sub_task_id).toBe("sub-a2");
    expect(jps.current_stage_id).toBe("stage-a");
    expect(fakeSupabase.get("pipeline_stage_history")).toHaveLength(0);
    expect(fakeSupabase.get("contact_sub_task_logs")).toHaveLength(1);
  });
});

describe("applyNativeWrites — send_sms / send_email", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    claimAffectedRows = 1;
    sendsEnabled = true;
    poolQuery.mockClear();
    touchFieldsMock.mockClear();
    sendSmsProviderMock.mockClear();
    Object.values(ghlMocks).forEach((m) => m.mockClear());
  });

  const smsPayload = {
    send_id: "send-1",
    contact_id: "contact-1",
    ghl_contact_id: "ghl-contact-1",
    from_number: "+16155550100",
    body: "Hi Denzel — following up on the territory call.",
    requested_by: "chad",
  };

  it("send_sms: claims the row, sends via the active-provider dispatcher, then updates touch fields", async () => {
    pendingRows = [journalRow(1, "send_sms", smsPayload)];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
    expect(sendSmsProviderMock).toHaveBeenCalledWith("contact-1", smsPayload.body, {
      fromNumber: "+16155550100",
    });
    expect(touchFieldsMock).toHaveBeenCalledWith("ghl-contact-1", "SMS");
    expect(statusUpdates).toEqual([
      { id: 1, status: "sending", error: null },
      { id: 1, status: "applied", error: null },
    ]);
  });

  it("send_sms: a lost claim (row not pending anymore) never reaches the provider", async () => {
    claimAffectedRows = 0;
    pendingRows = [journalRow(2, "send_sms", smsPayload)];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(sendSmsProviderMock).not.toHaveBeenCalled();
    expect(touchFieldsMock).not.toHaveBeenCalled();
    const failed = statusUpdates.find((u) => u.status === "failed");
    expect(failed?.error).toContain("could not be claimed");
  });

  it("send_sms: kill-switch off fails the row before any claim or send", async () => {
    sendsEnabled = false;
    pendingRows = [journalRow(3, "send_sms", smsPayload)];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(sendSmsProviderMock).not.toHaveBeenCalled();
    expect(statusUpdates).toEqual([{ id: 3, status: "failed", error: "Customer-facing sends are disabled." }]);
  });

  it("send_sms: empty body fails without claiming or sending", async () => {
    pendingRows = [journalRow(4, "send_sms", { ...smsPayload, body: "   " })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(sendSmsProviderMock).not.toHaveBeenCalled();
    expect(statusUpdates.some((u) => u.status === "sending")).toBe(false);
  });

  it("send_sms: falls back to a real ghl_contact_id when contact_id is missing, but refuses placeholders", async () => {
    pendingRows = [
      journalRow(5, "send_sms", { ...smsPayload, contact_id: null }),
      journalRow(6, "send_sms", { ...smsPayload, contact_id: null, ghl_contact_id: "ms_native_abc" }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(1);
    expect(sendSmsProviderMock).toHaveBeenCalledTimes(1);
    expect(sendSmsProviderMock).toHaveBeenCalledWith("ghl-contact-1", smsPayload.body, {
      fromNumber: "+16155550100",
    });
  });

  it("send_email: sends through GHL with the route's default from address and stamps touch fields", async () => {
    pendingRows = [
      journalRow(7, "send_email", {
        send_id: "send-2",
        contact_id: "contact-1",
        ghl_contact_id: "ghl-contact-1",
        subject: "Discovery day details",
        html: "<p>See you Thursday.</p>",
        email_from: null,
        requested_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(ghlMocks.sendMessage).toHaveBeenCalledWith({
      type: "Email",
      contactId: "ghl-contact-1",
      html: "<p>See you Thursday.</p>",
      subject: "Discovery day details",
      emailFrom: "chad@newagainhouses.com",
    });
    expect(touchFieldsMock).toHaveBeenCalledWith("ghl-contact-1", "Email");
    expect(statusUpdates).toEqual([
      { id: 7, status: "sending", error: null },
      { id: 7, status: "applied", error: null },
    ]);
  });

  it("send_email: refuses a contact that has never synced to GHL (placeholder id)", async () => {
    pendingRows = [
      journalRow(8, "send_email", {
        send_id: "send-3",
        contact_id: "contact-1",
        ghl_contact_id: "pto_placeholder",
        subject: "Hello",
        html: "<p>Hi</p>",
        email_from: null,
        requested_by: "chad",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(ghlMocks.sendMessage).not.toHaveBeenCalled();
    const failed = statusUpdates.find((u) => u.status === "failed");
    expect(failed?.error).toContain("no synced ghl_contact_id");
  });
});

describe("applyNativeWrites — approve_workflow_step / reject_workflow_step", () => {
  function seedPendingLog(overrides: Record<string, unknown> = {}) {
    fakeSupabase.seed("workflow_step_logs", [
      {
        id: "log-1",
        enrollment_id: "enr-1",
        step_id: "step-1",
        confirmed_at: null,
        executed_at: null,
        delivery_data: { queued: true },
        workflow_enrollments: { id: "enr-1", ghl_contact_id: "ghl-contact-1", contact_name: "Pat Prospect" },
        workflow_steps: {
          id: "step-1",
          step_type: "sms",
          content: "Hi {{name}}, quick check-in.",
          subject: null,
          condition_config: { fromNumber: "+15550001111" },
        },
        ...overrides,
      },
    ]);
  }

  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
    Object.values(ghlMocks).forEach((m) => m.mockClear());
    executeGHLActionMock.mockClear();
    advanceDayMock.mockClear();
    sendsEnabled = true;
    claimAffectedRows = 1;
    executeGHLActionMock.mockResolvedValue({ success: true, actionCode: "C1", data: { id: "ghl-msg-9" } });
  });

  it("approve sms: claims the row, sends via executeGHLAction, stamps the log, and advances the day", async () => {
    seedPendingLog();
    fakeSupabase.seed("users", [{ id: "user-uuid-1", email: "chad@newagainhouses.com" }]);
    fakeSupabase.seed("workflow_enrollments", [
      { id: "enr-1", workflow_version_id: "wfv-1", current_day: 1, status: "active" },
    ]);
    fakeSupabase.seed("workflow_steps", [{ id: "step-1", workflow_version_id: "wfv-1", day_number: 1 }]);
    pendingRows = [
      journalRow(11, "approve_workflow_step", { log_id: "log-1", approved_by: "chad@newagainhouses.com" }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0);
    expect(executeGHLActionMock).toHaveBeenCalledTimes(1);
    const [actionCode, params] = executeGHLActionMock.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(actionCode).toBe("C1");
    expect(params.message).toBe("Hi {{name}}, quick check-in.");
    expect(params.fromNumber).toBe("+15550001111");

    const log = fakeSupabase.get("workflow_step_logs")[0];
    expect(log.executed_at).not.toBeNull();
    expect(log.confirmed_by).toBe("user-uuid-1");
    expect(log.ghl_message_id).toBe("ghl-msg-9");
    expect((log.delivery_data as Record<string, unknown>).providerAccepted).toBe(true);
    expect((log.delivery_data as Record<string, unknown>).queued).toBe(false);

    expect(advanceDayMock).toHaveBeenCalledWith("enr-1");
    expect(statusUpdates).toEqual([
      { id: 11, status: "sending", error: null },
      { id: 11, status: "applied", error: null },
    ]);
  });

  it("approve email: routes through C2 with tracked html and the default from address", async () => {
    seedPendingLog({
      workflow_steps: {
        id: "step-1",
        step_type: "email",
        content: "<p>Details inside.</p>",
        subject: "Discovery day",
        condition_config: {},
      },
    });
    pendingRows = [journalRow(12, "approve_workflow_step", { log_id: "log-1", approved_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const [actionCode, params] = executeGHLActionMock.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(actionCode).toBe("C2");
    expect(params.html).toBe("<p>Details inside.</p><!--tracked-->");
    expect(params.subject).toBe("Discovery day");
    expect(params.emailFrom).toBe("franchise@newagainhouses.com");
  });

  it("approve: already-executed log is an idempotent no-op — no claim, no send", async () => {
    seedPendingLog({ executed_at: "2026-07-01T00:00:00.000Z", confirmed_at: "2026-07-01T00:00:00.000Z" });
    pendingRows = [journalRow(13, "approve_workflow_step", { log_id: "log-1", approved_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(executeGHLActionMock).not.toHaveBeenCalled();
    expect(statusUpdates).toEqual([{ id: 13, status: "applied", error: null }]);
  });

  it("approve: log rejected in the app since is a conflict — fails without sending", async () => {
    seedPendingLog({
      confirmed_at: "2026-07-01T00:00:00.000Z",
      delivery_data: { queued: false, rejected: true },
    });
    pendingRows = [journalRow(14, "approve_workflow_step", { log_id: "log-1", approved_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/already resolved in the app \(rejected\)/);
    expect(executeGHLActionMock).not.toHaveBeenCalled();
  });

  it("approve: kill-switch off fails the row before any claim or send", async () => {
    seedPendingLog();
    sendsEnabled = false;
    pendingRows = [journalRow(15, "approve_workflow_step", { log_id: "log-1", approved_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(executeGHLActionMock).not.toHaveBeenCalled();
    expect(statusUpdates).toEqual([{ id: 15, status: "failed", error: "Customer-facing sends are disabled." }]);
  });

  it("approve: a failed GHL action records the error on the log and fails the row (no executed_at)", async () => {
    seedPendingLog();
    executeGHLActionMock.mockResolvedValue({ success: false, actionCode: "C1", error: "provider down" });
    pendingRows = [journalRow(16, "approve_workflow_step", { log_id: "log-1", approved_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/provider down/);
    const log = fakeSupabase.get("workflow_step_logs")[0];
    expect(log.executed_at).toBeNull();
    expect(log.confirmed_at).not.toBeNull();
    expect((log.delivery_data as Record<string, unknown>).error).toBe("provider down");
    expect(advanceDayMock).not.toHaveBeenCalled();
  });

  it("approve: a non-sendable step type fails without claiming", async () => {
    seedPendingLog({
      workflow_steps: {
        id: "step-1",
        step_type: "stage_move_suggestion",
        content: null,
        subject: null,
        condition_config: {},
      },
    });
    pendingRows = [journalRow(17, "approve_workflow_step", { log_id: "log-1", approved_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/not a sendable action/);
    expect(statusUpdates).toEqual([
      { id: 17, status: "failed", error: expect.stringContaining("not a sendable action") },
    ]);
  });

  it("reject: resolves the queue row with rejected delivery_data and no send", async () => {
    seedPendingLog();
    fakeSupabase.seed("users", [{ id: "user-uuid-1", email: "chad@newagainhouses.com" }]);
    pendingRows = [journalRow(18, "reject_workflow_step", { log_id: "log-1", rejected_by: "chad@newagainhouses.com" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(executeGHLActionMock).not.toHaveBeenCalled();
    const log = fakeSupabase.get("workflow_step_logs")[0];
    expect(log.confirmed_at).not.toBeNull();
    expect(log.executed_at).toBeNull();
    expect(log.confirmed_by).toBe("user-uuid-1");
    expect((log.delivery_data as Record<string, unknown>).rejected).toBe(true);
  });

  it("reject: already rejected is an idempotent no-op", async () => {
    seedPendingLog({
      confirmed_at: "2026-07-01T00:00:00.000Z",
      delivery_data: { queued: false, rejected: true, rejectedBy: "app user" },
    });
    pendingRows = [journalRow(19, "reject_workflow_step", { log_id: "log-1", rejected_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const log = fakeSupabase.get("workflow_step_logs")[0];
    expect((log.delivery_data as Record<string, unknown>).rejectedBy).toBe("app user"); // untouched
  });

  it("reject: log already sent in the app is a conflict", async () => {
    seedPendingLog({
      confirmed_at: "2026-07-01T00:00:00.000Z",
      executed_at: "2026-07-01T00:00:01.000Z",
      delivery_data: { queued: false, providerAccepted: true },
    });
    pendingRows = [journalRow(20, "reject_workflow_step", { log_id: "log-1", rejected_by: "chad" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/already sent\/confirmed in the app/);
  });
});

/**
 * ⚠ The three handlers below were MISSING until 2026-08-08, months after MasterSuite
 * started journaling them. `update_profile_field` (its #686), `rename_journey` (its #678)
 * and `set_call_type` all hit the dispatcher's final `else`, were marked `failed`, and
 * would then have been overwritten by the nightly push — `journeys` and
 * `contact_profile_fields` are both on its table list, so the push writes the stale
 * Supabase value back over the native edit. That is the exact clobber the journal exists
 * to prevent.
 *
 * Nothing was actually lost: `frandev_native_write` on production still held zero rows
 * when the gap was found. The dispatch-coverage test at the bottom of this file is the
 * guard so the next one is caught by CI instead of by hand.
 */
describe("applyNativeWrites — update_profile_field", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
  });

  it("upserts the field with last_updated_by 'manual' and a JSON-encoded value", async () => {
    pendingRows = [
      journalRow(30, "update_profile_field", {
        contact_id: "contact-1",
        ghl_contact_id: "ghl-1",
        field_name: "full_name",
        field_label: "Full Name",
        field_value: "Jon Dreyer",
        previous_value: "Jonathan Dreyer",
        source: "manual",
        updated_by: "corey",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const row = fakeSupabase.get("contact_profile_fields")[0];
    expect(row.contact_id).toBe("contact-1");
    expect(row.field_name).toBe("full_name");
    // JSON-encoded, matching setContactProfileField — the column is jsonb.
    expect(row.field_value).toBe(JSON.stringify("Jon Dreyer"));
    expect(row.last_updated_by).toBe("manual");
  });

  it("clears the field to a real null rather than the JSON string 'null'", async () => {
    // MasterSuite stores SQL NULL on a clear so its "n of m filled" count falls; reads
    // here filter on `field_value is not null`, so the two must agree.
    fakeSupabase.seed("contact_profile_fields", [
      { contact_id: "contact-1", field_name: "full_name", field_value: JSON.stringify("Jon"), last_updated_by: "ai" },
    ]);
    pendingRows = [
      journalRow(31, "update_profile_field", {
        contact_id: "contact-1",
        ghl_contact_id: null,
        field_name: "full_name",
        field_label: "Full Name",
        field_value: null,
        previous_value: "Jon",
        source: "manual",
        updated_by: "corey",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    const row = fakeSupabase.get("contact_profile_fields")[0];
    expect(row.field_value).toBeNull();
    expect(row.field_value).not.toBe("null");
  });

  it("fails the journal row when the two catalogs have drifted on a field name", async () => {
    // MasterSuite's catalog is case-INSENSITIVE; this registry compares with ===. A name
    // that resolved there but not here must fail loudly, not land an unreadable EAV row.
    pendingRows = [
      journalRow(32, "update_profile_field", {
        contact_id: "contact-1",
        ghl_contact_id: null,
        field_name: "Full_Name",
        field_label: "Full Name",
        field_value: "Jon",
        previous_value: null,
        source: "manual",
        updated_by: "corey",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/drifted/);
    expect(fakeSupabase.get("contact_profile_fields")).toHaveLength(0);
  });
});

describe("applyNativeWrites — rename_journey", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
  });

  it("writes the new name onto the journey", async () => {
    fakeSupabase.seed("journeys", [{ id: "journey-1", name: "Jonathan Dreyer" }]);
    pendingRows = [
      journalRow(33, "rename_journey", {
        journey_id: "journey-1",
        journey_slug: "jonathan-dreyer",
        previous_name: "Jonathan Dreyer",
        name: "Jon Dreyer",
        updated_by: "corey",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("journeys")[0].name).toBe("Jon Dreyer");
  });

  it("fails rather than blanking the name when the payload carries an empty one", async () => {
    fakeSupabase.seed("journeys", [{ id: "journey-1", name: "Jonathan Dreyer" }]);
    pendingRows = [
      journalRow(34, "rename_journey", {
        journey_id: "journey-1",
        journey_slug: "jonathan-dreyer",
        previous_name: "Jonathan Dreyer",
        name: "   ",
        updated_by: "corey",
      }),
    ];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(fakeSupabase.get("journeys")[0].name).toBe("Jonathan Dreyer");
  });
});

describe("applyNativeWrites — set_call_type", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
  });

  it("resolves the slug to an id and repoints the call", async () => {
    fakeSupabase.seed("call_types", [{ id: "type-2", slug: "discovery", name: "Discovery" }]);
    fakeSupabase.seed("calls", [{ id: "call-1", call_type_id: "type-1" }]);
    pendingRows = [journalRow(35, "set_call_type", { call_id: "call-1", type_slug: "discovery", changed_by: "corey" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.applied).toBe(1);
    expect(fakeSupabase.get("calls")[0].call_type_id).toBe("type-2");
  });

  it("fails on an unknown slug instead of nulling a NOT NULL column", async () => {
    fakeSupabase.seed("call_types", [{ id: "type-2", slug: "discovery", name: "Discovery" }]);
    fakeSupabase.seed("calls", [{ id: "call-1", call_type_id: "type-1" }]);
    pendingRows = [journalRow(36, "set_call_type", { call_id: "call-1", type_slug: "nope", changed_by: "corey" })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/Unknown call type slug/);
    expect(fakeSupabase.get("calls")[0].call_type_id).toBe("type-1"); // untouched
  });
});

describe("applyNativeWrites — dispatch coverage", () => {
  beforeEach(() => {
    fakeSupabase.tables.clear();
    pendingRows = [];
    statusUpdates.length = 0;
    poolQuery.mockClear();
  });

  /**
   * The guard for the bug that produced the three handlers above.
   *
   * HANDLED_WRITE_TYPES is documentation — an exported list of what this app can replay,
   * meant to be diffed against MasterSuite's emitters. Documentation that can be wrong is
   * worse than none, so this feeds one journal row per listed type and asserts the
   * dispatcher recognises every one. The payloads are empty, so most handlers fail on
   * their own data; what matters is that NOTHING reports 'Unknown WriteType' and
   * `unhandledTypes` stays absent.
   */
  it("dispatches every type in HANDLED_WRITE_TYPES — the list cannot claim more than the code does", async () => {
    const { applyNativeWrites, HANDLED_WRITE_TYPES } = await import("@/lib/mastersuite/apply-native-writes");
    pendingRows = HANDLED_WRITE_TYPES.map((t, i) => journalRow(100 + i, t, {}));

    const result = await applyNativeWrites(HANDLED_WRITE_TYPES.length);

    expect(result.pending).toBe(HANDLED_WRITE_TYPES.length);
    expect(result.errors.filter((e) => e.includes("Unknown WriteType"))).toEqual([]);
    expect(result.unhandledTypes).toBeUndefined();
  });

  it("reports a type MasterSuite journals but this app cannot replay, separately from a failed apply", async () => {
    pendingRows = [journalRow(200, "some_future_write", { anything: true })];

    const { applyNativeWrites } = await import("@/lib/mastersuite/apply-native-writes");
    const result = await applyNativeWrites();

    expect(result.failed).toBe(1);
    expect(result.unhandledTypes).toEqual(["some_future_write"]);
    expect(result.errors[0]).toMatch(/nightly push will otherwise overwrite it/);
  });
});
