/**
 * Domains 5+6 tail (2026-08-10): the old app's write surfaces for contacts,
 * pipeline, and knowledge are RETIRED — those changes happen in MasterSuite
 * now. This matcher lists exactly the routes whose native replacement is
 * live; everything not listed keeps working.
 *
 * Deliberately NOT retired (native replacement doesn't exist yet — the
 * remaining tail): related-people, journey documents (upload/extract),
 * contact notes (native store has no UI), contact emails/team/messages
 * (tables still app-owned — they're in the nightly push), pipeline/stage
 * CONFIG under /api/settings, sub-task-log photo upload, GHL comms
 * (tasks/send/schedule), the calls domain, lead intake, webhooks, crons.
 *
 * Wired into requireAuth, so cron routes and webhook receivers (which gate
 * on secrets, not requireAuth) are exempt by construction.
 */

const RETIRED: Array<{ pattern: RegExp; methods: string[] }> = [
  // ── Contacts (domain 5) ────────────────────────────────────────────────
  { pattern: /^\/api\/contacts\/create$/, methods: ["POST"] },
  { pattern: /^\/api\/contacts\/batch-actions$/, methods: ["POST"] },
  { pattern: /^\/api\/contacts\/[^/]+$/, methods: ["PATCH"] },
  { pattern: /^\/api\/contacts\/[^/]+\/profile$/, methods: ["PUT"] },
  { pattern: /^\/api\/contacts\/[^/]+\/merge$/, methods: ["POST"] },
  { pattern: /^\/api\/contacts\/[^/]+\/score$/, methods: ["POST"] },
  { pattern: /^\/api\/leads\/score-all$/, methods: ["POST"] },
  { pattern: /^\/api\/suggestions\/(push|skip)$/, methods: ["POST"] },
  // ── Pipeline (domain 5) ────────────────────────────────────────────────
  { pattern: /^\/api\/contacts\/[^/]+\/pipelines\/[^/]+\/(advance|drop|revert)$/, methods: ["POST"] },
  { pattern: /^\/api\/contacts\/[^/]+\/pipelines\/resume-sales$/, methods: ["POST"] },
  { pattern: /^\/api\/pipeline\/board\/move$/, methods: ["POST"] },
  { pattern: /^\/api\/pipeline\/move$/, methods: ["PUT"] },
  { pattern: /^\/api\/contacts\/[^/]+\/sub-tasks\/[^/]+\/logs$/, methods: ["POST"] },
  { pattern: /^\/api\/sub-task-logs\/[^/]+$/, methods: ["PATCH", "DELETE"] },
  // ── Journeys (domain 5) ────────────────────────────────────────────────
  { pattern: /^\/api\/journeys\/[^/]+$/, methods: ["PATCH", "DELETE"] },
  { pattern: /^\/api\/journeys\/[^/]+\/(merge|split|members)$/, methods: ["POST"] },
  // ── Knowledge base (domain 6) ──────────────────────────────────────────
  { pattern: /^\/api\/knowledge$/, methods: ["POST", "PUT", "DELETE"] },
  { pattern: /^\/api\/admin\/(backfill|repair)-embeddings$/, methods: ["POST"] },
];

/** Scout DRC action types retired with the same rule (the rest still run). */
export const RETIRED_SCOUT_ACTION_TYPES = new Set(["stage_move", "profile_update", "sub_task_log"]);

export const RETIRED_WRITE_MESSAGE =
  "This surface is read-only now — contact, pipeline, and knowledge changes happen in MasterSuite.";

/** True when this method+path is a retired write surface. */
export function isRetiredWrite(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  const path = pathname.startsWith("/frandev/") ? pathname.slice("/frandev".length) : pathname;
  return RETIRED.some((r) => r.methods.includes(m) && r.pattern.test(path));
}

export function retiredWriteResponse(): Response {
  return new Response(JSON.stringify({ error: RETIRED_WRITE_MESSAGE, code: "moved_to_mastersuite" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
}
