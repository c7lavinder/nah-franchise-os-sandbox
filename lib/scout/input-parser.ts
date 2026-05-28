/** Parse query / aggregate input — Claude sometimes passes JSON strings for nested args. */
export function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
