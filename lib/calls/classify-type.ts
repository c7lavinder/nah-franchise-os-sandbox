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

export interface ClassifyInput {
  title: string | null;
  /** All NAH host emails on the call (lowercased is fine; we normalize). */
  nah_emails: string[];
  /** Read.ai flag — true when every participant is an NAH teammate. */
  is_internal: boolean;
  has_external_participant: boolean;
  /** True when a participant is a current franchisee (territory owner). */
  has_territory_owner: boolean;
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

  // 1. Internal-only team sync.
  if (input.is_internal && !input.has_external_participant) {
    return { slug: "team_call", reason: "internal NAH-only meeting" };
  }

  // 2. Franchisee coaching — territory owner on the call.
  if (input.has_territory_owner) {
    return { slug: "coaching_call", reason: "participant is a territory owner" };
  }

  // 3. Matt final (must precede matt_call).
  if (hasEmailMatch(emails, "matt") && /final|award/i.test(title)) {
    return { slug: "matt_final_call", reason: "matt host + title matches final/award" };
  }

  // 4. Matt.
  if (hasEmailMatch(emails, "matt")) {
    return { slug: "matt_call", reason: "matched by host email: matt" };
  }

  // 5. Sam.
  if (hasEmailMatch(emails, "sam")) {
    return { slug: "sam_call", reason: "matched by host email: sam" };
  }

  // 6. Mark.
  if (hasEmailMatch(emails, "mark") || hasEmailMatch(emails, "altacapital")) {
    return { slug: "mark_call", reason: "matched by host email: mark/altacapital" };
  }

  // 7. Intro (Chad or Nora).
  if (hasEmailMatch(emails, "chad") || hasEmailMatch(emails, "nora")) {
    return { slug: "intro_call", reason: "matched by host email: chad/nora" };
  }

  // 8. GHL calendar title-regex fallback.
  if (input.source === "ghl_calendar") {
    for (const [pattern, slug] of GHL_TITLE_TABLE) {
      if (pattern.test(title)) {
        return { slug, reason: `title regex: ${slug}` };
      }
    }
  }

  // 9. No signals matched.
  return { slug: "unclassified", reason: "no signals matched" };
}
