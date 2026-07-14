/**
 * AI extraction of zoning district rule tables from ordinance text.
 *
 * Follows the lib/documents/extract.ts pattern (extractText → Claude →
 * validated JSON). Extracted rows are NOT trusted for pre-screening until a
 * human verifies them — persist with extraction_status = 'ai_extracted' and
 * flip to 'verified' only through the review workflow (DRC pattern).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { DistrictCategory, ZoningDistrictRules } from "./types";

const CATEGORIES: DistrictCategory[] = [
  "residential",
  "commercial",
  "industrial",
  "agricultural",
  "mixed",
  "overlay",
  "other",
];

// Ordinance dimensional tables are dense (footnotes, overlay exceptions,
// mixed units) — this needs the strongest extraction model, and it only runs
// once per document, not per request.
const EXTRACTION_MODEL = "claude-opus-4-8";

/**
 * Extract per-district dimensional rules from zoning ordinance text.
 * Returns [] when nothing could be extracted (missing key, empty text,
 * unparseable response) — callers treat that as "extract manually".
 */
export async function extractZoningDistricts(
  ordinanceText: string,
  jurisdictionName: string
): Promise<ZoningDistrictRules[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !ordinanceText.trim()) return [];

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are extracting the dimensional standards table from the zoning ordinance of ${jurisdictionName}. Read the ordinance text below and extract one object per zoning district.

Return ONLY a JSON array. Each element:
{
  "code": string,                     // district code exactly as written, e.g. "R-1"
  "name": string | null,              // district name, e.g. "Low Density Residential"
  "category": ${JSON.stringify(CATEGORIES)} — pick one,
  "minLotAcres": number | null,       // convert sqft to acres (43560 sqft = 1 acre)
  "minLotWidthFt": number | null,
  "minRoadFrontageFt": number | null,
  "frontSetbackFt": number | null,
  "sideSetbackFt": number | null,     // per-side value, not combined
  "rearSetbackFt": number | null,
  "maxHeightFt": number | null,
  "maxLotCoveragePercent": number | null,
  "minDwellingSqft": number | null,
  "aduAllowed": boolean | null,       // accessory dwelling units
  "septicAllowed": boolean | null,
  "notes": string | null              // footnotes/exceptions that change the numbers, briefly
}

RULES:
- Set a field to null when the ordinance does not state it. Never guess a number.
- If a value varies (e.g. "25 ft, or 35 ft on arterials"), use the base value and explain in notes.
- Convert units: all distances in feet, lot sizes in acres.
- Skip overlay districts unless they carry their own dimensional table (then category "overlay").
- Return ONLY valid JSON. No commentary, no markdown fences.

ORDINANCE TEXT:
${ordinanceText.slice(0, 100000)}`,
      },
    ],
  });

  try {
    const content = response.content[0];
    if (content.type !== "text") return [];
    const jsonStr = content.text
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((row) => cleanDistrict(row as Record<string, unknown>))
      .filter((d): d is ZoningDistrictRules => d !== null);
  } catch (err) {
    console.error("[zoning-extract] Failed to parse AI response:", err);
    return [];
  }
}

function cleanDistrict(row: Record<string, unknown>): ZoningDistrictRules | null {
  const code = typeof row.code === "string" ? row.code.trim() : "";
  if (!code) return null;

  const category = CATEGORIES.includes(row.category as DistrictCategory) ? (row.category as DistrictCategory) : "other";

  return {
    code,
    name: cleanString(row.name),
    category,
    minLotAcres: cleanNumber(row.minLotAcres),
    minLotWidthFt: cleanNumber(row.minLotWidthFt),
    minRoadFrontageFt: cleanNumber(row.minRoadFrontageFt),
    frontSetbackFt: cleanNumber(row.frontSetbackFt),
    sideSetbackFt: cleanNumber(row.sideSetbackFt),
    rearSetbackFt: cleanNumber(row.rearSetbackFt),
    maxHeightFt: cleanNumber(row.maxHeightFt),
    maxLotCoveragePercent: cleanNumber(row.maxLotCoveragePercent),
    minDwellingSqft: cleanNumber(row.minDwellingSqft),
    aduAllowed: cleanBoolean(row.aduAllowed),
    septicAllowed: cleanBoolean(row.septicAllowed),
    notes: cleanString(row.notes),
  };
}

function cleanString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function cleanNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function cleanBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
