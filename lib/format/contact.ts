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

/** Title-case a general string: "send nda" → "Send NDA", "first call scheduled" → "First Call Scheduled". */
export function titleCase(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(/(\s+)/)
    .map((word) => {
      if (!word.trim()) return word;
      const upper = word.toUpperCase();
      // Keep common abbreviations fully uppercased
      if (["NDA", "FDD", "SBA", "LLC", "FAQ", "API", "AI", "SMS", "URL", "ID"].includes(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

/** Format phone to (XXX) XXX-XXXX. No country code. Returns raw if invalid. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}
