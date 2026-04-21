/**
 * /journeys/[journeyId] — canonical journey URL.
 *
 * Phase 3B intermediate state: server-resolves the journey's current primary
 * contact and renders the proven /leads/[contactId] UI for that contact via
 * redirect. Any ?territory=<slug> query param is forwarded so the lead page
 * can later focus the Territories tab on the requested territory.
 *
 * A follow-up sprint will extract the LeadDetailView into a shared client
 * component so /journeys/[id] can be the canonical rendering URL (no URL
 * change on click). For now the pipeline-card entry point works cleanly.
 */

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ journeyId: string }>;
  searchParams: Promise<{ territory?: string }>;
}) {
  const { journeyId } = await params;
  const { territory } = await searchParams;

  const supabase = createServerClient();
  const { data: journey } = await supabase
    .from("journeys")
    .select("id, primary_contact_id, status")
    .eq("id", journeyId)
    .maybeSingle();

  if (!journey) {
    redirect("/pipeline");
  }

  const qs = new URLSearchParams();
  qs.set("journey", journey.id);
  if (territory) qs.set("territory", territory);

  redirect(`/leads/${journey.primary_contact_id}?${qs.toString()}`);
}
