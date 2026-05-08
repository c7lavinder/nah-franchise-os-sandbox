export const dynamic = "force-dynamic";

/**
 * GET /api/compliance — compliance overview for all tracked contacts.
 *
 * Returns counts by status and any active warnings (cooling periods,
 * expired registrations, unsigned agreements).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const supabase = createServerClient();

  const { data: rows, error } = await supabase
    .from("compliance_tracking")
    .select(
      `
      id, contact_id,
      fdd_issued_at, fdd_cooling_ends_at, fdd_acknowledged_at,
      franchise_agreement_signed_at,
      state_registration_status, state_registration_expiry,
      training_started_at, training_completed_at,
      training_modules_completed, training_modules_total,
      background_check_status,
      contacts!inner (first_name, last_name)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const alerts: { contactId: string; contactName: string; type: string; message: string; severity: string }[] = [];
  let fddIssued = 0;
  let inCooling = 0;
  let agreementsSigned = 0;
  let trainingInProgress = 0;
  let trainingComplete = 0;

  for (const row of rows ?? []) {
    const contact = row.contacts as unknown as { first_name: string; last_name: string };
    const name = `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim();

    if (row.fdd_issued_at) fddIssued++;

    if (row.fdd_cooling_ends_at && !row.franchise_agreement_signed_at) {
      const coolingEnds = new Date(row.fdd_cooling_ends_at);
      if (now < coolingEnds) {
        inCooling++;
        const daysLeft = Math.ceil((coolingEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 3) {
          alerts.push({
            contactId: row.contact_id,
            contactName: name,
            type: "fdd_cooling",
            message: `FDD cooling period ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
            severity: "info",
          });
        }
      }
    }

    if (row.franchise_agreement_signed_at) agreementsSigned++;

    // Signed without FDD
    if (row.franchise_agreement_signed_at && !row.fdd_issued_at) {
      alerts.push({
        contactId: row.contact_id,
        contactName: name,
        type: "missing_fdd",
        message: "Agreement signed without FDD disclosure on file",
        severity: "critical",
      });
    }

    // Signed during cooling
    if (row.franchise_agreement_signed_at && row.fdd_cooling_ends_at) {
      const signed = new Date(row.franchise_agreement_signed_at);
      const coolingEnds = new Date(row.fdd_cooling_ends_at);
      if (signed < coolingEnds) {
        alerts.push({
          contactId: row.contact_id,
          contactName: name,
          type: "early_signing",
          message: "Agreement signed before 14-day cooling period ended",
          severity: "critical",
        });
      }
    }

    // State registration
    if (row.state_registration_expiry) {
      const expiry = new Date(row.state_registration_expiry);
      if (now > expiry) {
        alerts.push({
          contactId: row.contact_id,
          contactName: name,
          type: "state_expired",
          message: "State registration has expired",
          severity: "critical",
        });
      }
    }

    // Training
    if (row.training_started_at && !row.training_completed_at) trainingInProgress++;
    if (row.training_completed_at) trainingComplete++;

    // Background check
    if (row.background_check_status === "failed") {
      alerts.push({
        contactId: row.contact_id,
        contactName: name,
        type: "background_failed",
        message: "Background check failed",
        severity: "critical",
      });
    }
  }

  return NextResponse.json({
    summary: {
      total: rows?.length ?? 0,
      fddIssued,
      inCooling,
      agreementsSigned,
      trainingInProgress,
      trainingComplete,
    },
    alerts: alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
    }),
  });
}
