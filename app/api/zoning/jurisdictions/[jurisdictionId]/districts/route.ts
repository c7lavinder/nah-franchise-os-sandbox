export const dynamic = "force-dynamic";

/**
 * GET  /api/zoning/jurisdictions/[jurisdictionId]/districts — list districts
 *      (optional ?status=ai_extracted|verified|manual)
 * POST /api/zoning/jurisdictions/[jurisdictionId]/districts — create a district
 *      manually (admin); manual rows are trusted like verified ones
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { rulesToRow } from "@/lib/zoning/db";
import type { DistrictCategory, ExtractionStatus, ZoningDistrictRules } from "@/lib/zoning/types";

const STATUSES: ExtractionStatus[] = ["ai_extracted", "verified", "manual"];
const CATEGORIES: DistrictCategory[] = [
  "residential",
  "commercial",
  "industrial",
  "agricultural",
  "mixed",
  "overlay",
  "other",
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ jurisdictionId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  const { jurisdictionId } = await params;

  const status = request.nextUrl.searchParams.get("status");

  const supabase = createServerClient();
  let query = supabase.from("zoning_districts").select("*").eq("jurisdiction_id", jurisdictionId).order("code");
  if (status && STATUSES.includes(status as ExtractionStatus)) {
    query = query.eq("extraction_status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ districts: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jurisdictionId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { jurisdictionId } = await params;

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const rules: ZoningDistrictRules = {
    code,
    name: strOrNull(body?.name),
    category: CATEGORIES.includes(body?.category) ? body.category : "residential",
    minLotAcres: numOrNull(body?.minLotAcres),
    minLotWidthFt: numOrNull(body?.minLotWidthFt),
    minRoadFrontageFt: numOrNull(body?.minRoadFrontageFt),
    frontSetbackFt: numOrNull(body?.frontSetbackFt),
    sideSetbackFt: numOrNull(body?.sideSetbackFt),
    rearSetbackFt: numOrNull(body?.rearSetbackFt),
    maxHeightFt: numOrNull(body?.maxHeightFt),
    maxLotCoveragePercent: numOrNull(body?.maxLotCoveragePercent),
    minDwellingSqft: numOrNull(body?.minDwellingSqft),
    aduAllowed: boolOrNull(body?.aduAllowed),
    septicAllowed: boolOrNull(body?.septicAllowed),
    notes: strOrNull(body?.notes),
  };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("zoning_districts")
    .insert(rulesToRow(rules, jurisdictionId, { extractionStatus: "manual" }))
    .select("*")
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : error.code === "23503" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ district: data }, { status: 201 });
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
