export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/create — create a new prospect in GHL + mirror in Supabase.
 *
 * 1. Upserts contact in GHL (deduplicates by email/phone).
 * 2. Inserts or updates the local mirror in contacts table.
 * 3. Returns the new contact ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { upsertContact } from "@/lib/ghl/client";

interface CreateContactBody {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  source?: string;
  subSource?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CreateContactBody;

  // Validate required fields
  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json(
      { error: "First name and last name are required" },
      { status: 400 },
    );
  }

  // Must have at least email or phone for GHL dedup
  if (!body.email?.trim() && !body.phone?.trim()) {
    return NextResponse.json(
      { error: "At least an email or phone number is required" },
      { status: 400 },
    );
  }

  try {
    // 1. Create in GHL
    const ghlResult = await upsertContact({
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      ...(body.email?.trim() ? { email: body.email.trim() } : {}),
      ...(body.phone?.trim() ? { phone: body.phone.trim() } : {}),
      ...(body.city?.trim() ? { city: body.city.trim() } : {}),
      ...(body.state?.trim() ? { state: body.state.trim() } : {}),
      ...(body.source?.trim() ? { source: body.source.trim() } : {}),
    });

    const ghlContactId = ghlResult.contact.id;

    // 2. Mirror in Supabase
    const supabase = createServerClient();

    const { data: contact, error: dbError } = await supabase
      .from("contacts")
      .upsert(
        {
          ghl_contact_id: ghlContactId,
          first_name: body.firstName.trim(),
          last_name: body.lastName.trim(),
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          city: body.city?.trim() || null,
          state: body.state?.trim() || null,
          opportunity_source: body.source?.trim() || null,
          sub_source: body.subSource?.trim() || null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "ghl_contact_id" },
      )
      .select("id")
      .single();

    if (dbError) {
      console.error("[contacts/create] Supabase error:", dbError.message);
      return NextResponse.json(
        { error: "Contact created in GHL but failed to save locally" },
        { status: 500 },
      );
    }

    // 3. Place in Sales pipeline → Engagement stage (if not already in pipeline)
    const { data: salesPipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("slug", "sales")
      .single();

    if (salesPipeline) {
      const { data: existingState } = await supabase
        .from("contact_pipeline_state")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("pipeline_id", salesPipeline.id)
        .maybeSingle();

      if (!existingState) {
        const { data: engagementStage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", salesPipeline.id)
          .order("sort_order", { ascending: true })
          .limit(1)
          .single();

        if (engagementStage) {
          await supabase.from("contact_pipeline_state").insert({
            contact_id: contact.id,
            pipeline_id: salesPipeline.id,
            current_stage_id: engagementStage.id,
            is_active: true,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      contactId: contact.id,
      ghlContactId,
      isNew: ghlResult.new,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[contacts/create] GHL error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
