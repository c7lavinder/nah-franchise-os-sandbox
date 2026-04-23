/**
 * Shared call-type classifier.
 *
 * Every entry point that inserts a `calls` row routes through this helper so
 * that classification logic lives in exactly one place. See
 * docs/call-classification-audit.md for the consolidation rationale.
 *
 * The helper returns a slug (never null). When no signals match, the slug is
 * `unclassified` — rows with that slug should be reviewed by a human.
 */

export type ClassifySource = "read_ai" | "ghl_calendar" | "manual";

/**
 * Layer-1 category picked by the upstream classifier (see
 * classifier.ts#classifyCall). Category drives which call_types.slug bucket
 * we pick from — only `sales` and `unknown` subdivide further via title /
 * host-email heuristics below.
 */
export type ClassifyCategory =
  | "sales"
  | "onboarding"
  | "coaching"
  | "group"
  | "internal"
  | "unknown";

export interface ClassifyInput {
  title: string | null;
  /** All NAH host emails on the call (lowercased is fine; we normalize). */
  nah_emails: string[];
  /** Read.ai flag — true when every participant is an NAH teammate. */
  is_internal: boolean;
  has_external_participant: boolean;
  /** True when a participant is a current franchisee (territory owner). */
  has_territory_owner: boolean;
  /** Router category from the journey-based classifier. When absent we fall
   *  back to legacy signal-based classification for backwards compat. */
  category?: ClassifyCategory;
  source: ClassifySource;
}

export interface ClassifyResult {
  slug: string;
  reason: string;
}

/** Title-keyword fallback used only for ghl_calendar source. Copied verbatim
 *  from the old sync-ghl-calendar route so behavior is preserved. */
const GHL_TITLE_TABLE: [RegExp, string][] = [
  [/matt.*final|final.*matt/i, "matt_final_call"],
  [/matt/i, "matt_call"],
  [/sam/i, "sam_call"],
  [/mark/i, "mark_call"],
  [/intro|initial|discovery|outreach/i, "intro_call"],
];

function hasEmailMatch(emails: string[], needle: string): boolean {
  return emails.some((e) => e.toLowerCase().includes(needle));
}

export function classifyCallType(input: ClassifyInput): ClassifyResult {
  const emails = input.nah_emails.map((e) => e.toLowerCase());
  const title = input.title ?? "";

  // ── Layer 1: route by category when the upstream classifier set one.
  //    Non-sales categories are single-slug — the classify_types row IS the
  //    category marker. Sales still subdivides below by title/host email.
  if (input.category) {
    switch (input.category) {
      case "internal":
        return { slug: "team_call", reason: "internal NAH-only meeting" };
      case "coaching":
        return { slug: "coaching_call", reason: "journey has reached onboarded" };
      case "onboarding":
        return { slug: "onboarding_call", reason: "journey has territory, not yet onboarded" };
      case "group":
        return { slug: "group_call", reason: "2+ distinct journeys on the call" };
      case "sales":
        return pickSalesSubtype(emails, title, input.source);
      case "unknown":
        return { slug: "unclassified", reason: "no signals matched" };
    }
  }

  // ── Legacy path (no category provided) — kept for callers that haven't
  //    been migrated yet. Matches the previous behavior exactly.
  if (input.is_internal && !input.has_external_participant) {
    return { slug: "team_call", reason: "internal NAH-only meeting" };
  }
  if (input.has_territory_owner) {
    return { slug: "coaching_call", reason: "participant is a territory owner" };
  }
  return pickSalesSubtype(emails, title, input.source);
}

function pickSalesSubtype(emails: string[], title: string, source: ClassifySource): ClassifyResult {
  // matt_final must precede matt_call.
  if (hasEmailMatch(emails, "matt") && /final|award/i.test(title)) {
    return { slug: "matt_final_call", reason: "matt host + title matches final/award" };
  }
  if (hasEmailMatch(emails, "matt")) {
    return { slug: "matt_call", reason: "matched by host email: matt" };
  }
  if (hasEmailMatch(emails, "sam")) {
    return { slug: "sam_call", reason: "matched by host email: sam" };
  }
  if (hasEmailMatch(emails, "mark") || hasEmailMatch(emails, "altacapital")) {
    return { slug: "mark_call", reason: "matched by host email: mark/altacapital" };
  }
  if (hasEmailMatch(emails, "chad") || hasEmailMatch(emails, "nora")) {
    return { slug: "intro_call", reason: "matched by host email: chad/nora" };
  }
  if (source === "ghl_calendar") {
    for (const [pattern, slug] of GHL_TITLE_TABLE) {
      if (pattern.test(title)) {
        return { slug, reason: `title regex: ${slug}` };
      }
    }
  }
  return { slug: "unclassified", reason: "no signals matched" };
}
