/**
 * POST /api/zorakle/prospect/sync — Upsert prospect Zorakle data
 *
 * Requires x-api-key header matching INTERNAL_API_KEY env var.
 * Computes fit_score + risk_flag on write.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeFitScore, computeRiskFlag } from "@/lib/zorakle";

export async function POST(request: NextRequest) {
  // API key check
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    ghl_contact_id: string;
    eclipse_overall?: number;
    values_type?: string;
    work_style?: string;
    culture?: string;
    eclipse_drive_id?: string;
    spoton_drive_id?: string;
    source?: string;
  };

  if (!body.ghl_contact_id) {
    return NextResponse.json({ error: "ghl_contact_id required" }, { status: 400 });
  }

  const fitScore = computeFitScore({
    eclipse_overall: body.eclipse_overall ?? null,
    values_type: body.values_type ?? null,
    work_style: body.work_style ?? null,
  });

  const riskFlag = computeRiskFlag({
    eclipse_overall: body.eclipse_overall ?? null,
    values_type: body.values_type ?? null,
    work_style: body.work_style ?? null,
  });

  const supabase = createServerClient();

  const { error } = await supabase
    .from("contact_zorakle_data")
    .upsert(
      {
        ghl_contact_id: body.ghl_contact_id,
        eclipse_overall: body.eclipse_overall ?? null,
        values_type: body.values_type ?? null,
        work_style: body.work_style ?? null,
        culture: body.culture ?? null,
        eclipse_drive_id: body.eclipse_drive_id ?? null,
        spoton_drive_id: body.spoton_drive_id ?? null,
        fit_score: fitScore,
        risk_flag: riskFlag,
        zorakle_completed_at: new Date().toISOString(),
        source: body.source ?? "api",
      },
      { onConflict: "ghl_contact_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, fitScore, riskFlag });
}
