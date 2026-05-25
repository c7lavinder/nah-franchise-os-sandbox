export const dynamic = "force-dynamic";

/**
 * POST /api/contacts/create — create a new prospect in GHL + mirror in Supabase.
 *
 * 1. Upserts contact in GHL (deduplicates by email/phone).
 * 2. Inserts or updates the local mirror in contacts table.
 * 3. Returns the new contact ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { upsertContact } from "@/lib/ghl/client";
import { runContactResearch } from "@/lib/agents/contact-research";
import { ensureJourneyForContact } from "@/lib/journeys/sync";
import { matchWorkflowTriggers } from "@/lib/workflows/trigger-matcher";

interface CreateContactBody {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  source?: string;
  subSource?: string;
  /** Default true. Set false for contacts that shouldn't own a sales journey
   *  (employees, contractors, spouses, attorneys — anyone we're adding via
   *  the ecosystem flow). Only prospects/franchisees own journeys. */
  createJourney?: boolean;
}

export async function POST(request: NextRequest) {
  {
    const _auth = await requireAuth(request);
    if (_auth instanceof Response) return _auth;
  }
  const body = (await request.json()) as CreateContactBody;

  // Validate required fields
  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json({ error: "First name and last name are required" }, { status: 400 });
  }

  // Must have at least email or phone for GHL dedup
  if (!body.email?.trim() && !body.phone?.trim()) {
    return NextResponse.json({ error: "At least an email or phone number is required" }, { status: 400 });
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
        { onConflict: "ghl_contact_id" }
      )
      .select("id")
      .single();

    if (dbError) {
      console.error("[contacts/create] Supabase error:", dbError.message);
      return NextResponse.json({ error: "Contact created in GHL but failed to save locally" }, { status: 500 });
    }

    // 3. Place in Sales pipeline → Engagement stage. Creates the journey
    // + primary membership via ensureJourneyForContact, then inserts a
    // single NULL-territory jps row (sales is journey-level).
    //
    // Skipped when createJourney is explicitly false — only prospects and
    // franchisees own journeys. Employees, contractors, spouses, etc. are
    // contacts without a sales pipeline of their own.
    const shouldCreateJourney = body.createJourney !== false;
    const { data: salesPipeline } = shouldCreateJourney
      ? await supabase.from("pipelines").select("id").eq("slug", "sales").single()
      : { data: null };

    if (salesPipeline) {
      const journeyId = await ensureJourneyForContact(supabase, contact.id);
      if (journeyId) {
        const { data: existingState } = await supabase
          .from("journey_pipeline_state")
          .select("id")
          .eq("journey_id", journeyId)
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

          // Default to Outreach sub-task so new contacts don't land as "unsorted"
          const { data: outreachSubTask } = await supabase
            .from("pipeline_sub_tasks")
            .select("id")
            .eq("stage_id", engagementStage?.id)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (engagementStage) {
            await supabase.from("journey_pipeline_state").insert({
              journey_id: journeyId,
              TerritorySlug: null,
              pipeline_id: salesPipeline.id,
              current_stage_id: engagementStage.id,
              current_sub_task_id: outreachSubTask?.id ?? null,
              is_active: true,
            });
          }
        }
      }
    }

    // 3b. Fire workflow triggers for journey creation
    if (shouldCreateJourney && salesPipeline) {
      matchWorkflowTriggers("journey.created", ghlContactId, {
        pipelineName: "Sales — Path to Ownership",
        pipelineSlug: "sales",
        stageName: "Engagement",
        contactName: `${body.firstName} ${body.lastName}`.trim(),
      }).catch(() => {});
    }

    // 4. Link existing calls where this contact's email appears as a participant.
    //    Also checks contact_related_people for business partner emails.
    const displayName = `${body.firstName.trim()} ${body.lastName.trim()}`;
    const emailsToLink: string[] = [];

    const contactEmail = body.email?.trim()?.toLowerCase();
    if (contactEmail) emailsToLink.push(contactEmail);

    // Include related people emails (business partners, spouses, etc.)
    const { data: relatedPeople } = await supabase
      .from("contact_related_people")
      .select("email")
      .eq("contact_id", contact.id)
      .not("email", "is", null);

    for (const rp of relatedPeople ?? []) {
      if (rp.email) {
        const rpEmail = rp.email.trim().toLowerCase();
        if (rpEmail && !emailsToLink.includes(rpEmail)) emailsToLink.push(rpEmail);
      }
    }

    // Also try to match by display_name (catches email typos like houstinmail vs houstonmail)
    const { data: nameMatchParticipants } = await supabase
      .from("call_participants")
      .select("call_id, email")
      .eq("display_name", displayName)
      .is("contact_id", null);

    for (const p of nameMatchParticipants ?? []) {
      if (p.email) {
        const pEmail = p.email.trim().toLowerCase();
        if (!emailsToLink.includes(pEmail)) emailsToLink.push(pEmail);
      }
    }

    for (const email of emailsToLink) {
      // Link call_participants rows (by email OR by display_name)
      await supabase
        .from("call_participants")
        .update({ contact_id: contact.id, role: "prospect", display_name: displayName })
        .eq("email", email)
        .is("contact_id", null);

      // Link calls via read_ai_sessions participant emails
      const { data: sessions } = await supabase
        .from("read_ai_sessions")
        .select("session_id")
        .contains("participant_emails", [email]);

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.session_id);
        await supabase
          .from("calls")
          .update({ contact_id: contact.id })
          .in("read_ai_session_id", sessionIds)
          .is("contact_id", null);
      }
    }

    // 5. Seed EOS goals (empty row so the tab is ready)
    await supabase
      .from("eos_contact_goals")
      .upsert({ contact_id: contact.id, source: "system" }, { onConflict: "contact_id", ignoreDuplicates: true });

    // 6. Trigger background research agent (non-blocking)
    runContactResearch(ghlContactId, true).catch((err) => {
      console.error("[contacts/create] Background research failed:", err instanceof Error ? err.message : err);
    });

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
