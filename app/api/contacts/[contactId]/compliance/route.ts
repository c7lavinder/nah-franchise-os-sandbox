export const dynamic = "force-dynamic";

/**
 * GET/PUT /api/contacts/[contactId]/compliance
 *
 * Reads or updates compliance tracking for a contact.
 * Tracks FDD disclosure, state registration, training, and agreements.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface ComplianceUpdate {
  fdd_version?: string;
  fdd_issued_at?: string;
  fdd_acknowledged_at?: string;
  fdd_state?: string;
  state_registration_status?: string;
  state_registration_expiry?: string;
  franchise_agreement_sent_at?: string;
  franchise_agreement_signed_at?: string;
  franchise_agreement_version?: string;
  docusign_envelope_id?: string;
  training_started_at?: string;
  training_completed_at?: string;
  training_modules_completed?: number;
  training_modules_total?: number;
  insurance_verified_at?: string;
  background_check_status?: string;
  background_check_at?: string;
  notes?: string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("compliance_tracking")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate compliance status flags
  const now = new Date();
  const flags: string[] = [];

  if (data) {
    // FDD cooling period check
    if (data.fdd_cooling_ends_at && !data.franchise_agreement_signed_at) {
      const coolingEnds = new Date(data.fdd_cooling_ends_at);
      if (now < coolingEnds) {
        const daysLeft = Math.ceil((coolingEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        flags.push(`FDD cooling: ${daysLeft} days remaining`);
      }
    }

    // Agreement signed but no FDD
    if (data.franchise_agreement_signed_at && !data.fdd_issued_at) {
      flags.push("WARNING: Agreement signed without FDD disclosure");
    }

    // Agreement signed during cooling period
    if (data.franchise_agreement_signed_at && data.fdd_cooling_ends_at) {
      const signedAt = new Date(data.franchise_agreement_signed_at);
      const coolingEnds = new Date(data.fdd_cooling_ends_at);
      if (signedAt < coolingEnds) {
        flags.push("WARNING: Agreement signed before 14-day cooling period ended");
      }
    }

    // State registration expired
    if (data.state_registration_expiry) {
      const expiry = new Date(data.state_registration_expiry);
      if (now > expiry) {
        flags.push("WARNING: State registration expired");
      } else {
        const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 30) {
          flags.push(`State registration expires in ${daysToExpiry} days`);
        }
      }
    }

    // Training incomplete
    if (data.training_started_at && !data.training_completed_at) {
      flags.push(
        `Training in progress: ${data.training_modules_completed ?? 0}/${data.training_modules_total ?? 0} modules`
      );
    }

    // Background check
    if (data.background_check_status === "failed") {
      flags.push("WARNING: Background check failed");
    }
  }

  return NextResponse.json({
    compliance: data ?? null,
    flags,
    exists: !!data,
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  const { contactId } = await params;
  const body = (await request.json()) as ComplianceUpdate;
  const supabase = createServerClient();

  // Build update object — only include provided fields
  const update: Record<string, unknown> = { updated_by: user.id };
  const allowedFields: (keyof ComplianceUpdate)[] = [
    "fdd_version",
    "fdd_issued_at",
    "fdd_acknowledged_at",
    "fdd_state",
    "state_registration_status",
    "state_registration_expiry",
    "franchise_agreement_sent_at",
    "franchise_agreement_signed_at",
    "franchise_agreement_version",
    "docusign_envelope_id",
    "training_started_at",
    "training_completed_at",
    "training_modules_completed",
    "training_modules_total",
    "insurance_verified_at",
    "background_check_status",
    "background_check_at",
    "notes",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      update[field] = body[field];
    }
  }

  // Upsert — create if doesn't exist, update if it does
  const { data, error } = await supabase
    .from("compliance_tracking")
    .upsert({ contact_id: contactId, ...update }, { onConflict: "contact_id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ compliance: data });
}
