/**
 * Deterministic avatar helpers for the Messaging Hub.
 * Colors are derived from a stable seed (contact id or name) so the same
 * contact always gets the same color — no data is fabricated, only assigned.
 */

// Design palette (see docs/design_handoff_messaging_hub)
const AVATAR_PALETTE = ["#0E96D8", "#7C5CFC", "#1FB6A8", "#F5A623", "#EB5757"];

/** Pick a stable color from the palette for a given seed. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/** Up-to-two-letter initials from a name (falls back to "?"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
