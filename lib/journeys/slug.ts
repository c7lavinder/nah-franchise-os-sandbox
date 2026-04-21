/**
 * Slug helpers for journeys. Shared between the backfill script and the
 * runtime creation path (ensureJourneyForContact), so we have exactly one
 * definition of "what a journey slug looks like".
 */

/** Base shape: lowercase, hyphenated, ASCII-only. No trailing/leading dashes. */
export function slugifyBase(input: string): string {
  return (input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80); // keep URLs tidy
}

/**
 * Given a base slug and a function that returns whether a candidate is
 * already taken, returns the first non-conflicting candidate. Tries the
 * base itself, then appends -2, -3, … up to -99. The `isTaken` function
 * handles the storage lookup, so this helper is storage-agnostic.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const cleaned = base || "journey";
  if (!(await isTaken(cleaned))) return cleaned;
  for (let i = 2; i < 100; i++) {
    const candidate = `${cleaned}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  // Extremely unlikely fallback — random suffix.
  return `${cleaned}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True if the string looks like a UUID (v4-ish shape). */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Resolve a URL identifier (slug or UUID) to a journey row. Used by the
 * journey server page + API routes so either form resolves cleanly.
 * Returns null if not found.
 */
export async function resolveJourneyByIdentifier<T>(
  identifier: string,
  supabase: {
    from: (t: "journeys") => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: T | null }>;
        };
      };
    };
  },
  columns: string = "*",
): Promise<T | null> {
  const column = isUuid(identifier) ? "id" : "slug";
  const { data } = await supabase.from("journeys").select(columns).eq(column, identifier).maybeSingle();
  return data ?? null;
}
