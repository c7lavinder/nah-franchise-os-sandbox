export const dynamic = "force-dynamic";

/**
 * GET   /api/intelligence/franchisee/[franchiseeId] — single franchisee record
 * PATCH /api/intelligence/franchisee/[franchiseeId] — update performance metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/** Allowed fields for PATCH updates */
const UPDATABLE_FIELDS = new Set([
  "franchisee_name",
  "territory",
  "signed_at",
  "funds_received_at",
  "franchise_agreement_signed",
  "houses_purchased_year1",
  "houses_purchased_year2",
  "houses_purchased_year3",
  "houses_purchased_total",
  "revenue_year1",
  "revenue_year2",
  "revenue_year3",
  "time_to_first_flip_days",
  "staff_hired",
  "royalty_payment_consistent",
  "territory_utilization_pct",
  "nps_score",
  "support_calls_year1",
  "active_status",
  "franchise_software_id",
  "last_synced_at",
  "data_source",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ franchiseeId: string }> }
) {
  try {
    const { franchiseeId } = await params;

    const supabase = createServerClient();
    const { data: record, error } = await supabase
      .from("franchisee_performance")
      .select("*")
      .eq("id", franchiseeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Franchisee not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ franchisee: record });
  } catch (err) {
    console.error("GET franchisee/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ franchiseeId: string }> }
) {
  try {
    const { franchiseeId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    // ─── Filter to only allowed fields ───
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(body)) {
      if (UPDATABLE_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify the record exists first
    const { data: existing, error: fetchError } = await supabase
      .from("franchisee_performance")
      .select("id")
      .eq("id", franchiseeId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Franchisee not found" }, { status: 404 });
    }

    const { data: record, error: updateError } = await supabase
      .from("franchisee_performance")
      .update(updates)
      .eq("id", franchiseeId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ franchisee: record });
  } catch (err) {
    console.error("PATCH franchisee/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
