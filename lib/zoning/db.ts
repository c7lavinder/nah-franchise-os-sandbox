/**
 * Row mapping between lib/zoning types (camelCase) and the
 * zoning_districts table (snake_case). Shared by the API routes.
 */

import type { DistrictCategory, ExtractionStatus, ZoningDistrictRules } from "./types";

export interface ZoningDistrictRow {
  id?: string;
  jurisdiction_id: string;
  code: string;
  name: string | null;
  category: DistrictCategory;
  min_lot_acres: number | null;
  min_lot_width_ft: number | null;
  min_road_frontage_ft: number | null;
  front_setback_ft: number | null;
  side_setback_ft: number | null;
  rear_setback_ft: number | null;
  max_height_ft: number | null;
  max_lot_coverage_percent: number | null;
  min_dwelling_sqft: number | null;
  adu_allowed: boolean | null;
  septic_allowed: boolean | null;
  notes: string | null;
  source_document_id?: string | null;
  extraction_status?: ExtractionStatus;
}

export function rulesToRow(
  rules: ZoningDistrictRules,
  jurisdictionId: string,
  extra: { sourceDocumentId?: string | null; extractionStatus?: ExtractionStatus } = {}
): ZoningDistrictRow {
  return {
    jurisdiction_id: jurisdictionId,
    code: rules.code,
    name: rules.name,
    category: rules.category,
    min_lot_acres: rules.minLotAcres,
    min_lot_width_ft: rules.minLotWidthFt,
    min_road_frontage_ft: rules.minRoadFrontageFt,
    front_setback_ft: rules.frontSetbackFt,
    side_setback_ft: rules.sideSetbackFt,
    rear_setback_ft: rules.rearSetbackFt,
    max_height_ft: rules.maxHeightFt,
    max_lot_coverage_percent: rules.maxLotCoveragePercent,
    min_dwelling_sqft: rules.minDwellingSqft,
    adu_allowed: rules.aduAllowed,
    septic_allowed: rules.septicAllowed,
    notes: rules.notes,
    ...(extra.sourceDocumentId !== undefined && { source_document_id: extra.sourceDocumentId }),
    ...(extra.extractionStatus !== undefined && { extraction_status: extra.extractionStatus }),
  };
}

export function rowToRules(row: Record<string, unknown>): ZoningDistrictRules {
  return {
    code: String(row.code ?? ""),
    name: (row.name as string | null) ?? null,
    category: (row.category as DistrictCategory) ?? "other",
    minLotAcres: toNum(row.min_lot_acres),
    minLotWidthFt: toNum(row.min_lot_width_ft),
    minRoadFrontageFt: toNum(row.min_road_frontage_ft),
    frontSetbackFt: toNum(row.front_setback_ft),
    sideSetbackFt: toNum(row.side_setback_ft),
    rearSetbackFt: toNum(row.rear_setback_ft),
    maxHeightFt: toNum(row.max_height_ft),
    maxLotCoveragePercent: toNum(row.max_lot_coverage_percent),
    minDwellingSqft: toNum(row.min_dwelling_sqft),
    aduAllowed: (row.adu_allowed as boolean | null) ?? null,
    septicAllowed: (row.septic_allowed as boolean | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

/** Postgres numeric columns come back as strings through supabase-js */
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
