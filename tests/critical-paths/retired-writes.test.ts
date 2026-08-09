import { describe, expect, it } from "vitest";
import { isRetiredWrite, RETIRED_SCOUT_ACTION_TYPES } from "@/lib/auth/retired-writes";

// Domains 5+6 tail (2026-08-10): the old app's contact/pipeline/KB write
// surfaces are retired — MasterSuite owns those changes. These pins keep the
// retired list from silently shrinking, and keep the deliberate carve-outs
// (surfaces whose native replacement doesn't exist yet) writable.
describe("retired write surfaces", () => {
  it("blocks the retired contact writes", () => {
    expect(isRetiredWrite("POST", "/api/contacts/create")).toBe(true);
    expect(isRetiredWrite("PATCH", "/api/contacts/abc-123")).toBe(true);
    expect(isRetiredWrite("PUT", "/api/contacts/abc-123/profile")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/abc-123/merge")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/batch-actions")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/abc-123/score")).toBe(true);
    expect(isRetiredWrite("POST", "/api/leads/score-all")).toBe(true);
    expect(isRetiredWrite("POST", "/api/suggestions/push")).toBe(true);
    expect(isRetiredWrite("POST", "/api/suggestions/skip")).toBe(true);
  });

  it("blocks the retired pipeline and journey writes", () => {
    expect(isRetiredWrite("POST", "/api/contacts/a/pipelines/b/advance")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/a/pipelines/b/drop")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/a/pipelines/b/revert")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/a/pipelines/resume-sales")).toBe(true);
    expect(isRetiredWrite("POST", "/api/pipeline/board/move")).toBe(true);
    expect(isRetiredWrite("PUT", "/api/pipeline/move")).toBe(true);
    expect(isRetiredWrite("POST", "/api/contacts/a/sub-tasks/b/logs")).toBe(true);
    expect(isRetiredWrite("PATCH", "/api/sub-task-logs/log-1")).toBe(true);
    expect(isRetiredWrite("DELETE", "/api/sub-task-logs/log-1")).toBe(true);
    expect(isRetiredWrite("PATCH", "/api/journeys/j-1")).toBe(true);
    expect(isRetiredWrite("DELETE", "/api/journeys/j-1")).toBe(true);
    expect(isRetiredWrite("POST", "/api/journeys/j-1/merge")).toBe(true);
    expect(isRetiredWrite("POST", "/api/journeys/j-1/split")).toBe(true);
    expect(isRetiredWrite("POST", "/api/journeys/j-1/members")).toBe(true);
  });

  it("blocks the retired knowledge-base writes", () => {
    expect(isRetiredWrite("POST", "/api/knowledge")).toBe(true);
    expect(isRetiredWrite("PUT", "/api/knowledge")).toBe(true);
    expect(isRetiredWrite("DELETE", "/api/knowledge")).toBe(true);
    expect(isRetiredWrite("POST", "/api/admin/backfill-embeddings")).toBe(true);
    expect(isRetiredWrite("POST", "/api/admin/repair-embeddings")).toBe(true);
  });

  it("matches with the /frandev basePath prefix too", () => {
    expect(isRetiredWrite("POST", "/frandev/api/contacts/create")).toBe(true);
    expect(isRetiredWrite("POST", "/frandev/api/knowledge")).toBe(true);
  });

  it("never blocks reads", () => {
    expect(isRetiredWrite("GET", "/api/contacts/abc-123")).toBe(false);
    expect(isRetiredWrite("GET", "/api/knowledge")).toBe(false);
    expect(isRetiredWrite("GET", "/api/journeys/j-1")).toBe(false);
  });

  it("keeps the deliberate carve-outs writable (native replacement not built)", () => {
    // Related-people panel, journey documents, notes: still-open tail items.
    expect(isRetiredWrite("POST", "/api/contacts/a/related-people")).toBe(false);
    expect(isRetiredWrite("PATCH", "/api/contacts/a/related-people/p-1")).toBe(false);
    expect(isRetiredWrite("POST", "/api/journeys/j-1/documents")).toBe(false);
    expect(isRetiredWrite("DELETE", "/api/journeys/j-1/documents/d-1")).toBe(false);
    expect(isRetiredWrite("POST", "/api/contacts/a/notes")).toBe(false);
    // App-owned satellite tables (still in the nightly push).
    expect(isRetiredWrite("POST", "/api/contacts/a/emails")).toBe(false);
    expect(isRetiredWrite("POST", "/api/contacts/a/team")).toBe(false);
    expect(isRetiredWrite("POST", "/api/contacts/a/messages")).toBe(false);
    // Pipeline CONFIG stays app-side for now (only stage STATE went native).
    expect(isRetiredWrite("PATCH", "/api/settings/pipelines/p-1")).toBe(false);
    expect(isRetiredWrite("POST", "/api/settings/pipelines/p-1/stages")).toBe(false);
    // Photo upload for sub-task logs is storage-only.
    expect(isRetiredWrite("POST", "/api/sub-task-logs/upload")).toBe(false);
    // GHL comms and MasterSuite-triggered syncs keep working.
    expect(isRetiredWrite("POST", "/api/contacts/a/send")).toBe(false);
    expect(isRetiredWrite("POST", "/api/contacts/a/tasks")).toBe(false);
    expect(isRetiredWrite("POST", "/api/contacts/a/schedule")).toBe(false);
    expect(isRetiredWrite("POST", "/api/mastersuite/sync/properties")).toBe(false);
    expect(isRetiredWrite("POST", "/api/leads/intake")).toBe(false);
  });

  it("retires exactly the three Scout DRC action types", () => {
    expect([...RETIRED_SCOUT_ACTION_TYPES].sort()).toEqual(["profile_update", "stage_move", "sub_task_log"]);
  });
});
