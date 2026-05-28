export type ContactSearchPlan =
  | { kind: "empty" }
  | {
      kind: "search";
      query: string;
      words: string[];
      forwardName?: { first: string; last: string };
      reversedName?: { first: string; last: string };
      fuzzyThreshold: number;
      limit: number;
    };

export function buildContactSearchPlan(rawQuery: string | null | undefined, limit = 20): ContactSearchPlan {
  const query = rawQuery?.trim().toLowerCase() ?? "";
  if (query.length < 2) return { kind: "empty" };

  const words = query.split(/\s+/).filter(Boolean);
  const plan: Extract<ContactSearchPlan, { kind: "search" }> = {
    kind: "search",
    query,
    words,
    fuzzyThreshold: 0.18,
    limit,
  };

  if (words.length >= 2) {
    const [first, ...rest] = words;
    const last = rest.join(" ");
    plan.forwardName = { first, last };
    plan.reversedName = { first: last, last: first };
  }

  return plan;
}

export function mergeLimitedIds(limit: number, ...groups: Array<Array<string | null | undefined>>): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group) {
      if (!id) continue;
      ids.add(id);
      if (ids.size >= limit) return [...ids];
    }
  }
  return [...ids];
}
