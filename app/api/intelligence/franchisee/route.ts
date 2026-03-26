export const dynamic = "force-dynamic";

/**
 * GET  /api/intelligence/franchisee?status=active — list franchisee performance records
 * POST /api/intelligence/franchisee — create a new franchisee performance record
 *
 * Required fields on POST: contact_id, franchisee_name
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { FranchiseePerformanceInsert } from "@/lib/intelligence/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const supabase = createServerClient();
    let query = supabase
      .from("franchisee_performance")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("active_status", status);
    }

    const { data: records, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ franchisees: records ?? [] });
  } catch (err) {
    console.error("GET franchisee error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const contactId = body.contact_id as string | undefined;
    const franchiseeName = body.franchisee_name as string | undefined;

    // ─── Validation ───
    if (!contactId || !franchiseeName) {
      return NextResponse.json(
        { error: "contact_id and franchisee_name are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // ─── Build insert record ───
    const insert: FranchiseePerformanceInsert = {
      contact_id: contactId,
      franchisee_name: franchiseeName,
      territory: (body.territory as string) ?? null,
      signed_at: (body.signed_at as string) ?? null,
      funds_received_at: (body.funds_received_at as string) ?? null,
      franchise_agreement_signed: (body.franchise_agreement_signed as boolean) ?? false,
      houses_purchased_year1: (body.houses_purchased_year1 as number) ?? null,
      houses_purchased_year2: (body.houses_purchased_year2 as number) ?? null,
      houses_purchased_year3: (body.houses_purchased_year3 as number) ?? null,
      houses_purchased_total: (body.houses_purchased_total as number) ?? null,
      revenue_year1: (body.revenue_year1 as number) ?? null,
      revenue_year2: (body.revenue_year2 as number) ?? null,
      revenue_year3: (body.revenue_year3 as number) ?? null,
      time_to_first_flip_days: (body.time_to_first_flip_days as number) ?? null,
      staff_hired: (body.staff_hired as number) ?? null,
      royalty_payment_consistent: (body.royalty_payment_consistent as boolean) ?? null,
      territory_utilization_pct: (body.territory_utilization_pct as number) ?? null,
      nps_score: (body.nps_score as number) ?? null,
      support_calls_year1: (body.support_calls_year1 as number) ?? null,
      active_status: (body.active_status as string) ?? null,
      franchise_software_id: (body.franchise_software_id as string) ?? null,
      last_synced_at: (body.last_synced_at as string) ?? null,
      data_source: (body.data_source as string) ?? null,
    };

    const { data: record, error } = await supabase
      .from("franchisee_performance")
      .insert(insert)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ franchisee: record }, { status: 201 });
  } catch (err) {
    console.error("POST franchisee error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
