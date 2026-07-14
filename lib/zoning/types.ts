/**
 * Zoning codes foundation — shared types.
 *
 * Mirrors the zoning_districts table (supabase/migrations/20260714120000_zoning_codes_foundation.sql).
 * See docs/landportal-zoning-integration.md for the full architecture.
 */

export type DistrictCategory =
  | "residential"
  | "commercial"
  | "industrial"
  | "agricultural"
  | "mixed"
  | "overlay"
  | "other";

export type ExtractionStatus = "ai_extracted" | "verified" | "manual";

/** The deal-critical dimensional rules for one zoning district. */
export interface ZoningDistrictRules {
  code: string; // e.g. "R-1"
  name: string | null; // e.g. "Low Density Residential"
  category: DistrictCategory;
  minLotAcres: number | null;
  minLotWidthFt: number | null;
  minRoadFrontageFt: number | null;
  frontSetbackFt: number | null;
  sideSetbackFt: number | null;
  rearSetbackFt: number | null;
  maxHeightFt: number | null;
  maxLotCoveragePercent: number | null;
  minDwellingSqft: number | null;
  aduAllowed: boolean | null;
  septicAllowed: boolean | null;
  notes: string | null;
}

/** What we know about a parcel at pre-screen time (LandPortal export + REAPI enrichment). */
export interface ParcelFacts {
  lotAcres: number | null;
  zoningCode: string | null;
  /** LandPortal buildable acreage (before setbacks). */
  buildableAcres?: number | null;
  roadFrontageFt?: number | null;
  /** Footprint of the planned build, used for the buildable-envelope check. */
  plannedFootprintSqft?: number | null;
}

export type CheckOutcome = "pass" | "fail" | "unknown";

export interface PrescreenCheck {
  rule: string;
  outcome: CheckOutcome;
  detail: string;
}

export interface PrescreenResult {
  /** fail if any check fails; unknown if nothing failed but data was missing; pass otherwise */
  verdict: CheckOutcome;
  checks: PrescreenCheck[];
}
