/**
 * Global contact formatting helpers — name casing + phone formatting.
 */

/** Capitalize each word, handling hyphens and apostrophes. */
export function capitalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) =>
      part
        .split("-")
        .map((seg) =>
          seg
            .split("'")
            .map((s) => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s))
            .join("'")
        )
        .join("-")
    )
    .join("");
}

/** Format phone to +1 (XXX) XXX-XXXX. Returns raw if invalid. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw; // Return raw if non-standard
}
