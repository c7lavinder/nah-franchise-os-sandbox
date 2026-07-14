/**
 * Merge policy for AI-extracted districts vs what's already stored.
 *
 * Pure function. The rule: extraction may create new rows and refresh rows
 * that are still ai_extracted, but must NEVER touch verified or manually
 * entered districts — those represent human judgment.
 */

import type { ExtractionStatus, ZoningDistrictRules } from "./types";

export interface ExistingDistrict {
  id: string;
  code: string;
  extraction_status: ExtractionStatus;
}

export interface DistrictMergePlan {
  toInsert: ZoningDistrictRules[];
  toUpdate: { id: string; rules: ZoningDistrictRules }[];
  /** codes skipped because a verified/manual row already exists */
  skipped: string[];
}

export function planDistrictMerge(existing: ExistingDistrict[], extracted: ZoningDistrictRules[]): DistrictMergePlan {
  const byCode = new Map(existing.map((d) => [normalizeCode(d.code), d]));
  const plan: DistrictMergePlan = { toInsert: [], toUpdate: [], skipped: [] };
  const seen = new Set<string>();

  for (const rules of extracted) {
    const key = normalizeCode(rules.code);
    if (seen.has(key)) continue; // dedupe within one extraction run
    seen.add(key);

    const current = byCode.get(key);
    if (!current) {
      plan.toInsert.push(rules);
    } else if (current.extraction_status === "ai_extracted") {
      plan.toUpdate.push({ id: current.id, rules });
    } else {
      plan.skipped.push(rules.code);
    }
  }

  return plan;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
