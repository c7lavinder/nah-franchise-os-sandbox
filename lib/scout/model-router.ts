/**
 * Scout model router — picks Haiku / Sonnet / Opus per turn.
 *
 * Tier strategy:
 *   Haiku  4.5 — simple lookups, single-tool drafts, status questions.
 *                Default. Cheapest, fastest.
 *   Sonnet 4.6 — multi-tool reasoning, contact deep-dives, journey
 *                inspection, aggregate marketing/pipeline questions.
 *   Opus   4.7 — strategic planning, campaign design, multi-entity
 *                synthesis, "what should we do about X" at scale.
 *
 * The router classifies on the LATEST user message only (Claude can keep
 * the same tier across the tool-use loop) and falls back to Haiku for
 * anything ambiguous. Role bumps the floor for leadership/admin.
 */

import type { UserRole } from "@/types/database";
import type Anthropic from "@anthropic-ai/sdk";

export type ScoutModelTier = "haiku" | "sonnet" | "opus";

export const SCOUT_MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6-20250514",
  opus: "claude-opus-4-6-20250514",
} as const;

/** Patterns that escalate a turn to Opus — strategic, multi-entity, planning */
const OPUS_PATTERNS: RegExp[] = [
  /\b(plan|design|build|draft)\s+(a|the|our)?\s*(campaign|strategy|playbook|roadmap|sequence|outreach\s+plan)/i,
  /\bmarketing\s+(plan|campaign|strategy|playbook)/i,
  /\bcross[- ]territory/i,
  /\bcompare\s+(reps|territories|months|quarters|cohorts)/i,
  /\b(rewrite|overhaul|redesign|restructure)\s+(our|the|my)/i,
  /\bquarterly\s+(plan|review|outlook)/i,
  /\b(forecast|model)\s+(revenue|pipeline|conversion)/i,
  /\bgo[- ]to[- ]market/i,
  /\bwhat\s+should\s+we\s+(do|change|focus\s+on|prioritize)/i,
  /\b(synthes[ie]ze|consolidate)\s+(across|all|every)/i,
];

/** Patterns that escalate a turn to Sonnet — multi-tool reasoning */
const SONNET_PATTERNS: RegExp[] = [
  /\b(analyze|deep[- ]dive|break\s+down|diagnose)/i,
  /\bwhy\s+(is|are|did|isn'?t|aren'?t)/i,
  /\bcompare\s+(this|these|two|those)/i,
  /\bhow\s+is\s+(the\s+team|everyone|we)\s+doing/i,
  /\b(pipeline|marketing|conversion)\s+(health|performance|trends?)/i,
  /\b(top|worst|best)\s+(performing|objection|reason|source|stage)/i,
  /\bcost\s+per\s+(lead|acquisition)/i,
  /\bconversion\s+rate/i,
  /\baverage\s+(time|days)\s+(in|to|between)/i,
  /\bjourney\s+(status|state|history|across)/i,
  /\bterritory\s+(overview|status|breakdown|profile)/i,
  /\b(stalled|stuck|cold|cooling)\s+(deals|leads|prospects)/i,
  /\bwhat'?s\s+(driving|behind|causing)/i,
  /\b(everything|all|full)\s+(about|on|for)\s+\w+/i,
  /\bbrief\s+me/i,
  /\bpre[- ]?call\s+brief/i,
];

/**
 * Classify a single user message into a model tier.
 * Returns the highest tier whose patterns match.
 */
function classifyMessage(message: string): ScoutModelTier {
  if (OPUS_PATTERNS.some((p) => p.test(message))) return "opus";
  if (SONNET_PATTERNS.some((p) => p.test(message))) return "sonnet";
  return "haiku";
}

/**
 * Apply a role-based floor — admins/leadership skew toward heavier models
 * because they ask aggregate / strategic questions more often, and the
 * cost of a missed insight is higher than the few extra cents.
 */
function applyRoleFloor(tier: ScoutModelTier, role: UserRole): ScoutModelTier {
  const order: ScoutModelTier[] = ["haiku", "sonnet", "opus"];
  const tierIdx = order.indexOf(tier);

  if (role === "admin" || role === "leadership") {
    // Floor at sonnet for leadership — never use haiku for them
    return order[Math.max(tierIdx, 1)];
  }
  return tier;
}

/**
 * Apply a length-based escalation — long conversations or messages with
 * lots of context need stronger models to track everything.
 */
function applyLengthEscalation(tier: ScoutModelTier, messageLen: number, historyLen: number): ScoutModelTier {
  // Very long single messages (>800 chars) → at least Sonnet
  if (messageLen > 800 && tier === "haiku") return "sonnet";
  // Deep conversations (>15 turns) → at least Sonnet
  if (historyLen > 15 && tier === "haiku") return "sonnet";
  // Very deep conversations (>30 turns) → at least Opus
  if (historyLen > 30) return "opus";
  return tier;
}

export interface RouteInput {
  messages: Anthropic.Messages.MessageParam[];
  userRole: UserRole;
}

export interface RouteResult {
  tier: ScoutModelTier;
  model: string;
  reason: string;
}

/**
 * Pick the model for this turn based on the latest user message,
 * conversation depth, and the user's role.
 */
export function routeModel({ messages, userRole }: RouteInput): RouteResult {
  // Find the latest user message text — skip tool_result-only turns
  const latest = [...messages].reverse().find((m) => {
    if (m.role !== "user") return false;
    if (typeof m.content === "string") return m.content.trim().length > 0;
    return m.content.some((b) => b.type === "text" && b.text.trim().length > 0);
  });

  const text = !latest
    ? ""
    : typeof latest.content === "string"
      ? latest.content
      : latest.content
          .filter((b): b is Anthropic.Messages.TextBlockParam => b.type === "text")
          .map((b) => b.text)
          .join(" ");

  const baseTier = classifyMessage(text);
  const withRole = applyRoleFloor(baseTier, userRole);
  const final = applyLengthEscalation(withRole, text.length, messages.length);

  const reasonBits: string[] = [`pattern→${baseTier}`];
  if (withRole !== baseTier) reasonBits.push(`role(${userRole})→${withRole}`);
  if (final !== withRole) reasonBits.push(`length(msg=${text.length},hist=${messages.length})→${final}`);

  return {
    tier: final,
    model: SCOUT_MODELS[final],
    reason: reasonBits.join(", "),
  };
}
