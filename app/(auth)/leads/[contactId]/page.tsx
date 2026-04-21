"use client";

/**
 * /leads/[contactId] — legacy entry point for a prospect's detail page.
 *
 * Phase 3C intermediate state: the full UI lives in
 * components/leads/LeadDetailView so that /journeys/[journeyId] can render
 * the same view canonically with multi-contact Profile sub-tabs. This route
 * stays as a stable link target for any external bookmarks and the GHL
 * contact page link-out; it delegates to LeadDetailView with no journey
 * context. A future sprint will make this a hard 302 to /journeys when the
 * contact has an active journey.
 */

import { useParams, useSearchParams } from "next/navigation";
import LeadDetailView from "@/components/leads/LeadDetailView";

export default function LeadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const contactId = params.contactId as string;
  const journeyId = searchParams.get("journey") ?? undefined;
  const territory = searchParams.get("territory");
  const highlightMessageId = searchParams.get("message");

  return (
    <LeadDetailView
      contactId={contactId}
      journeyId={journeyId}
      initialTerritorySlug={territory}
      highlightMessageId={highlightMessageId}
    />
  );
}
