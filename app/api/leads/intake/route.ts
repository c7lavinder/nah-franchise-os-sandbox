export const dynamic = "force-dynamic";

/**
 * POST /api/leads/intake — public lead ingestion endpoint.
 *
 * Accepts form submissions from external sources (marketing site,
 * landing pages, partner integrations) and auto-creates a prospect
 * in GHL + Supabase with full pipeline setup.
 *
 * Auth: WEBHOOK_SHARED_SECRET (header or query param).
 *       Skipped in development mode or when env var is not set.
 *
 * Flow:
 *   1. Verify webhook secret
 *   2. Validate required fields
 *   3. Deduplicate by email/phone
 *   4. Create contact in GHL → mirror in Supabase
 *   5. Create journey → Sales pipeline → Engagement stage
 *   6. Fire workflow triggers (journey.created)
 *   7. Notify team (in-app notification)
 *   8. Trigger background research agent
 *   9. Log to integration_logs
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSecret } from "@/lib/auth/webhook-verify";
import { checkRateLimit, RATE_LIMITS } from "@/lib/auth/rate-limit";
import { createServerClient } from "@/lib/supabase/server";
import { upsertContact } from "@/lib/ghl/client";
import { ensureJourneyForContact } from "@/lib/journeys/sync";
import { matchWorkflowTriggers } from "@/lib/workflows/trigger-matcher";
import { runContactResearch } from "@/lib/agents/contact-research";

interface LeadIntakeBody {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  /** Lead source (e.g. "Website", "Landing Page", "Partner Referral") */
  source?: string;
  /** Sub-source for attribution (e.g. "Google Ads", "Facebook", page URL) */
  subSource?: string;
  /** Territory interest if captured on form */
  territoryInterest?: string;
  /** Any additional form fields passed through */
  customFields?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  // 1. Verify webhook secret
  const webhookAuthError = verifyWebhookSecret(request);
  if (webhookAuthError) return webhookAuthError;

  // Rate limit by IP (public endpoint)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimited = checkRateLimit(`ip:${ip}`, RATE_LIMITS.leadIntake);
  if (rateLimited) return rateLimited;

  let body: LeadIntakeBody;
  try {
    body = (await request.json()) as LeadIntakeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 2. Validate required fields
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
  }

  const email = body.email?.trim() || null;
  const phone = body.phone?.trim() || null;
  if (!email && !phone) {
    return NextResponse.json({ error: "At least email or phone is required" }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    // 3. Check for existing contact (dedup before GHL call)
    let existingContactId: string | null = null;
    if (email) {
      const { data: byEmail } = await supabase.from("contacts").select("id").eq("email", email).maybeSingle();
      existingContactId = byEmail?.id ?? null;
    }
    if (!existingContactId && phone) {
      const { data: byPhone } = await supabase.from("contacts").select("id").eq("phone", phone).maybeSingle();
      existingContactId = byPhone?.id ?? null;
    }

    if (existingContactId) {
      // Log the duplicate attempt
      await supabase.from("integration_logs").insert({
        integration_name: "lead-intake",
        event_type: "duplicate_lead",
        status: "skipped",
        payload_summary: `Duplicate lead: ${firstName} ${lastName} (${email || phone}) → existing contact ${existingContactId}`,
        metadata: { existingContactId, email, phone, source: body.source },
      });

      return NextResponse.json({
        success: true,
        duplicate: true,
        contactId: existingContactId,
        message: "Contact already exists",
      });
    }

    // 4. Save to Supabase FIRST (source of truth — works even if GHL is down)
    const { data: contact, error: dbError } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        opportunity_source: body.source?.trim() || "Website",
        sub_source: body.subSource?.trim() || null,
        territory_interest: body.territoryInterest?.trim() || null,
        last_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("[leads/intake] Supabase error:", dbError.message);
      return NextResponse.json({ error: "Failed to save contact" }, { status: 500 });
    }

    // 5. Sync to GHL (best-effort — contact is saved locally regardless)
    let ghlContactId: string | null = null;
    try {
      const ghlResult = await upsertContact({
        firstName,
        lastName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(body.city?.trim() ? { city: body.city.trim() } : {}),
        ...(body.state?.trim() ? { state: body.state.trim() } : {}),
        ...(body.source?.trim() ? { source: body.source.trim() } : {}),
      });

      ghlContactId = ghlResult.contact.id;

      // Update the Supabase record with the GHL ID
      await supabase.from("contacts").update({ ghl_contact_id: ghlContactId }).eq("id", contact.id);
    } catch (ghlErr) {
      // GHL sync failed — contact is still saved locally, log the failure
      console.error("[leads/intake] GHL sync failed:", ghlErr instanceof Error ? ghlErr.message : ghlErr);
      await supabase.from("integration_logs").insert({
        integration_name: "lead-intake",
        event_type: "ghl_sync_failed",
        status: "failed",
        error_message: ghlErr instanceof Error ? ghlErr.message : String(ghlErr),
        metadata: { contactId: contact.id, firstName, lastName },
      });
    }

    // 6. Place in Sales pipeline → Engagement stage
    const { data: salesPipeline } = await supabase.from("pipelines").select("id").eq("slug", "sales").single();

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

          // Default to Outreach sub-task so new leads don't land as "unsorted"
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

    // 7. Fire workflow triggers (only if GHL sync succeeded)
    if (salesPipeline && ghlContactId) {
      matchWorkflowTriggers("journey.created", ghlContactId, {
        pipelineName: "Sales — Path to Ownership",
        pipelineSlug: "sales",
        stageName: "Engagement",
        contactName: `${firstName} ${lastName}`,
        source: body.source || "Website",
      }).catch(() => {});
    }

    // 8. Notify team — create in-app notification for admins/operators
    const { data: teamUsers } = await supabase
      .from("users")
      .select("id")
      .in("role", ["admin", "operator"])
      .eq("is_active", true);

    if (teamUsers && teamUsers.length > 0) {
      const notifications = teamUsers.map((u) => ({
        recipient_user_id: u.id,
        type: "new_lead",
        title: "New Lead",
        body: `${firstName} ${lastName} submitted via ${body.source || "website"}${body.city ? ` from ${body.city}, ${body.state || ""}` : ""}`,
        metadata: {
          contactId: contact.id,
          source: body.source || "Website",
        },
      }));

      await supabase.from("notifications").insert(notifications);
    }

    // 9. Seed EOS goals
    await supabase
      .from("eos_contact_goals")
      .upsert({ contact_id: contact.id, source: "system" }, { onConflict: "contact_id", ignoreDuplicates: true });

    // 10. Background research (non-blocking, only if GHL ID available)
    if (ghlContactId) {
      runContactResearch(ghlContactId, true).catch((err) => {
        console.error("[leads/intake] Research failed:", err instanceof Error ? err.message : err);
      });
    }

    // 11. Log success
    await supabase.from("integration_logs").insert({
      integration_name: "lead-intake",
      event_type: "lead_created",
      status: "success",
      payload_summary: `New lead: ${firstName} ${lastName} (${email || phone}) → contact ${contact.id}`,
      metadata: {
        contactId: contact.id,
        ghlContactId,
        ghlSynced: !!ghlContactId,
        source: body.source,
        subSource: body.subSource,
      },
    });

    return NextResponse.json({
      success: true,
      contactId: contact.id,
      ghlContactId,
      ghlSynced: !!ghlContactId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[leads/intake] Error:", message);

    // Log failure (best-effort)
    try {
      await supabase.from("integration_logs").insert({
        integration_name: "lead-intake",
        event_type: "lead_error",
        status: "failed",
        error_message: message,
        metadata: { firstName, lastName, email, phone, source: body.source },
      });
    } catch {
      // swallow — logging must not mask the original error
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
