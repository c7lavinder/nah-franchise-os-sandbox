export const dynamic = "force-dynamic";

/**
 * PATCH /api/journeys/:journeyId — update mutable journey fields.
 *
 * Currently accepts `{ name }` only. The slug is intentionally NOT regenerated
 * on rename — slugs are permalinks and existing bookmarks / deep links
 * (e.g. /journeys/ryan-shannon-partnership) must continue to resolve.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

interface PatchBody {
  name?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const body = (await request.json()) as PatchBody;
  const supabase = createServerClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 200) {
      return NextResponse.json({ error: "Name too long (200 char max)" }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("journeys")
    .update(updates)
    .eq("id", journeyId)
    .select("id, name, slug")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  return NextResponse.json({ journey: data });
}

function canDeleteJourney(role: string) {
  return role === "admin" || role === "operator";
}

type CallJourneyRow = {
  call_id: string;
  journey_id: string;
  journey_pipeline_state_id: string;
  is_primary: boolean;
};

async function runStep(name: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await fn();
  if (error) throw new Error(`${name}: ${error.message}`);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ journeyId: string }> }) {
  const authUser = await requireAuth(request);
  if (authUser instanceof Response) return authUser;
  if (!canDeleteJourney(authUser.role)) {
    return NextResponse.json({ error: "Only admins and operators can delete journeys" }, { status: 403 });
  }

  const { journeyId } = await params;
  const supabase = createServerClient();

  const { data: journey, error: loadErr } = await supabase
    .from("journeys")
    .select("id, name")
    .eq("id", journeyId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  const { data: journeyCallLinks, error: callLinkErr } = await supabase
    .from("call_journeys")
    .select("call_id, journey_id, journey_pipeline_state_id, is_primary")
    .eq("journey_id", journeyId);

  if (callLinkErr) return NextResponse.json({ error: callLinkErr.message }, { status: 500 });

  const callIds = [...new Set((journeyCallLinks ?? []).map((row) => row.call_id))];
  let callsSoftDeleted = 0;

  try {
    if (callIds.length > 0) {
      const { data: allCallLinks, error: allCallLinksErr } = await supabase
        .from("call_journeys")
        .select("call_id, journey_id, journey_pipeline_state_id, is_primary")
        .in("call_id", callIds);

      if (allCallLinksErr) throw new Error(`load call links: ${allCallLinksErr.message}`);

      const linksByCall = new Map<string, CallJourneyRow[]>();
      for (const link of (allCallLinks ?? []) as CallJourneyRow[]) {
        const list = linksByCall.get(link.call_id) ?? [];
        list.push(link);
        linksByCall.set(link.call_id, list);
      }

      const deleteCallIds: string[] = [];
      const sharedCallFallbacks: Array<{ callId: string; jpsId: string | null }> = [];

      for (const callId of callIds) {
        const links = linksByCall.get(callId) ?? [];
        const remaining = links.filter((link) => link.journey_id !== journeyId);
        if (remaining.length === 0) {
          deleteCallIds.push(callId);
        } else {
          const primary = remaining.find((link) => link.is_primary) ?? remaining[0];
          sharedCallFallbacks.push({ callId, jpsId: primary?.journey_pipeline_state_id ?? null });
        }
      }

      if (deleteCallIds.length > 0) {
        const { error } = await supabase
          .from("calls")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", deleteCallIds)
          .is("deleted_at", null);
        if (error) throw new Error(`soft-delete journey-only calls: ${error.message}`);
        callsSoftDeleted = deleteCallIds.length;
      }

      for (const fallback of sharedCallFallbacks) {
        await runStep("repoint shared call", () =>
          supabase.from("calls").update({ journey_pipeline_state_id: fallback.jpsId }).eq("id", fallback.callId)
        );
      }
    }

    await runStep("delete journey action items", () =>
      supabase.from("call_action_items").delete().eq("journey_id", journeyId)
    );
    await runStep("delete journey data extractions", () =>
      supabase.from("call_data_extractions").delete().eq("journey_id", journeyId)
    );
    await runStep("delete journey AI embeddings", () =>
      supabase
        .from("embeddings")
        .delete()
        .eq("content_type", "profile_summary")
        .contains("metadata", { source_id: journeyId, entity_type: "journey" })
    );
    await runStep("delete journey", () => supabase.from("journeys").delete().eq("id", journeyId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete journey";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deletedJourneyId: journeyId,
    deletedJourneyName: journey.name,
    callsSoftDeleted,
  });
}
