/**
 * /contacts/[contactId] — lightweight contact-only URL.
 *
 * Phase 3B intermediate state: redirects to the existing /leads/[contactId]
 * UI. A later sprint will split this into a dedicated slim page (profile,
 * calls, messages, and a Journeys list) for contacts who aren't the primary
 * of any journey (spouses, advisors, accountants). The existing full UI
 * gracefully handles all contact types today, so the redirect is safe.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  redirect(`/leads/${contactId}`);
}
