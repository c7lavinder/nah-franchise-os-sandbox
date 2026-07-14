export const dynamic = "force-dynamic";

/**
 * POST /api/zoning/prescreen — batch pre-screen LandPortal parcels against a
 * jurisdiction's zoning rules, BEFORE skip-trace/mail spend.
 *
 * body: {
 *   jurisdictionId: string,
 *   plannedFootprintSqft?: number,      // default applied to parcels without one
 *   parcels: [{ id?, zoningCode, lotAcres?, buildableAcres?, roadFrontageFt?, plannedFootprintSqft? }]
 * }
 *
 * Only verified/manual districts are used — ai_extracted rows never gate
 * spend (docs/landportal-zoning-integration.md). Parcels whose zoning code
 * has no trusted district row come back "unknown".
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { prescreenParcel } from "@/lib/zoning/prescreen";
import { normalizeCode } from "@/lib/zoning/merge-extracted";
import { rowToRules } from "@/lib/zoning/db";

const MAX_PARCELS = 2000;

interface ParcelInput {
  id?: string;
  zoningCode?: string;
  lotAcres?: number;
  buildableAcres?: number;
  roadFrontageFt?: number;
  plannedFootprintSqft?: number;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const body = await request.json().catch(() => null);
  const jurisdictionId = typeof body?.jurisdictionId === "string" ? body.jurisdictionId : "";
  const parcels: ParcelInput[] = Array.isArray(body?.parcels) ? body.parcels : [];
  const defaultFootprint =
    typeof body?.plannedFootprintSqft === "number" && Number.isFinite(body.plannedFootprintSqft)
      ? body.plannedFootprintSqft
      : null;

  if (!jurisdictionId) return NextResponse.json({ error: "jurisdictionId is required" }, { status: 400 });
  if (parcels.length === 0) return NextResponse.json({ error: "parcels is required" }, { status: 400 });
  if (parcels.length > MAX_PARCELS) {
    return NextResponse.json({ error: `Too many parcels (max ${MAX_PARCELS} per request)` }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: districtRows, error } = await supabase
    .from("zoning_districts")
    .select("*")
    .eq("jurisdiction_id", jurisdictionId)
    .in("extraction_status", ["verified", "manual"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const districtsByCode = new Map(
    (districtRows ?? []).map((row: Record<string, unknown>) => [normalizeCode(String(row.code)), rowToRules(row)])
  );

  if (districtsByCode.size === 0) {
    return NextResponse.json(
      { error: "Jurisdiction has no verified districts — verify extracted rules first" },
      { status: 422 }
    );
  }

  const results = parcels.map((parcel, index) => {
    const key = parcel.zoningCode ? normalizeCode(parcel.zoningCode) : "";
    const district = key ? districtsByCode.get(key) : undefined;

    if (!district) {
      return {
        id: parcel.id ?? String(index),
        zoningCode: parcel.zoningCode ?? null,
        verdict: "unknown" as const,
        checks: [],
        note: parcel.zoningCode
          ? `No verified district on record for code "${parcel.zoningCode}"`
          : "Parcel has no zoning code",
      };
    }

    const result = prescreenParcel(
      {
        lotAcres: numOrNull(parcel.lotAcres),
        zoningCode: parcel.zoningCode ?? null,
        buildableAcres: numOrNull(parcel.buildableAcres),
        roadFrontageFt: numOrNull(parcel.roadFrontageFt),
        plannedFootprintSqft: numOrNull(parcel.plannedFootprintSqft) ?? defaultFootprint,
      },
      district
    );

    return {
      id: parcel.id ?? String(index),
      zoningCode: parcel.zoningCode ?? null,
      district: district.code,
      verdict: result.verdict,
      checks: result.checks,
    };
  });

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.verdict === "pass").length,
    fail: results.filter((r) => r.verdict === "fail").length,
    unknown: results.filter((r) => r.verdict === "unknown").length,
  };

  return NextResponse.json({ summary, results });
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
