/**
 * Parcel pre-screen against a zoning district's dimensional rules.
 *
 * Pure function — no I/O. Callers load the district row (matched by the
 * parcel's zoning code within the right jurisdiction) and the parcel facts
 * from a LandPortal export / REAPI enrichment.
 *
 * A "fail" means don't spend money on this lead (skip trace, postcard).
 * This is a pre-screening tool, not a legal opinion — deal-critical results
 * still get confirmed with the planning office.
 */

import type { ParcelFacts, PrescreenCheck, PrescreenResult, ZoningDistrictRules } from "./types";

const SQFT_PER_ACRE = 43560;

export function prescreenParcel(parcel: ParcelFacts, district: ZoningDistrictRules): PrescreenResult {
  const checks: PrescreenCheck[] = [];

  // 1. Minimum lot size
  if (district.minLotAcres == null) {
    checks.push({ rule: "min_lot_size", outcome: "unknown", detail: "District has no minimum lot size on record" });
  } else if (parcel.lotAcres == null) {
    checks.push({ rule: "min_lot_size", outcome: "unknown", detail: "Parcel lot size unknown" });
  } else if (parcel.lotAcres < district.minLotAcres) {
    checks.push({
      rule: "min_lot_size",
      outcome: "fail",
      detail: `Lot is ${parcel.lotAcres} ac; ${district.code} requires ${district.minLotAcres} ac minimum`,
    });
  } else {
    checks.push({
      rule: "min_lot_size",
      outcome: "pass",
      detail: `Lot ${parcel.lotAcres} ac meets ${district.minLotAcres} ac minimum`,
    });
  }

  // 2. Road frontage
  if (district.minRoadFrontageFt == null) {
    checks.push({
      rule: "road_frontage",
      outcome: "unknown",
      detail: "District has no frontage requirement on record",
    });
  } else if (parcel.roadFrontageFt == null) {
    checks.push({ rule: "road_frontage", outcome: "unknown", detail: "Parcel road frontage unknown" });
  } else if (parcel.roadFrontageFt < district.minRoadFrontageFt) {
    checks.push({
      rule: "road_frontage",
      outcome: "fail",
      detail: `Frontage is ${parcel.roadFrontageFt} ft; ${district.code} requires ${district.minRoadFrontageFt} ft`,
    });
  } else {
    checks.push({
      rule: "road_frontage",
      outcome: "pass",
      detail: `Frontage ${parcel.roadFrontageFt} ft meets ${district.minRoadFrontageFt} ft minimum`,
    });
  }

  // 3. Buildable envelope: LandPortal's buildable acreage minus a setback
  // allowance must still fit the planned footprint. The setback allowance is
  // an approximation (perimeter geometry is unknown at pre-screen time): we
  // shrink buildable area by the front+rear and 2×side setbacks applied to a
  // square lot of the parcel's size.
  const footprint = parcel.plannedFootprintSqft ?? null;
  if (footprint == null || parcel.buildableAcres == null) {
    checks.push({
      rule: "buildable_envelope",
      outcome: "unknown",
      detail: "Buildable acreage or planned footprint unknown",
    });
  } else {
    const envelopeSqft = estimateEnvelopeSqft(parcel, district);
    if (envelopeSqft == null) {
      checks.push({ rule: "buildable_envelope", outcome: "unknown", detail: "District setbacks not on record" });
    } else if (envelopeSqft < footprint) {
      checks.push({
        rule: "buildable_envelope",
        outcome: "fail",
        detail: `~${Math.round(envelopeSqft)} sqft buildable after setbacks; plan needs ${footprint} sqft`,
      });
    } else {
      checks.push({
        rule: "buildable_envelope",
        outcome: "pass",
        detail: `~${Math.round(envelopeSqft)} sqft buildable after setbacks fits ${footprint} sqft plan`,
      });
    }
  }

  // 4. District category sanity — building a house in a non-residential district
  // isn't automatically dead (mixed districts exist) but flags for review.
  if (district.category === "residential" || district.category === "mixed") {
    checks.push({ rule: "district_use", outcome: "pass", detail: `${district.code} is ${district.category}` });
  } else {
    checks.push({
      rule: "district_use",
      outcome: "fail",
      detail: `${district.code} is ${district.category} — residential build likely not permitted by right`,
    });
  }

  const verdict: PrescreenResult["verdict"] = checks.some((c) => c.outcome === "fail")
    ? "fail"
    : checks.some((c) => c.outcome === "unknown")
      ? "unknown"
      : "pass";

  return { verdict, checks };
}

/**
 * Approximate the post-setback buildable envelope in sqft.
 * Models the buildable area as a square and insets it by the district's
 * setbacks. Returns null when no setbacks are on record.
 */
function estimateEnvelopeSqft(parcel: ParcelFacts, district: ZoningDistrictRules): number | null {
  if (parcel.buildableAcres == null) return null;

  const front = district.frontSetbackFt;
  const side = district.sideSetbackFt;
  const rear = district.rearSetbackFt;
  if (front == null && side == null && rear == null) return null;

  const buildableSqft = parcel.buildableAcres * SQFT_PER_ACRE;
  const sideLen = Math.sqrt(buildableSqft);
  const depth = sideLen - (front ?? 0) - (rear ?? 0);
  const width = sideLen - 2 * (side ?? 0);
  if (depth <= 0 || width <= 0) return 0;

  return depth * width;
}
