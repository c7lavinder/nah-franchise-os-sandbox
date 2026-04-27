/**
 * Page context derivation for Scout.
 *
 * Maps a pathname (the page the user was on when they invoked Scout) to
 * the structured pageContext the chat API and KB-boosting use.
 *
 * Keys of `page` line up with PAGE_CATEGORY_BOOST in lib/scout/client.ts.
 */

export interface ScoutPageContext {
  /** Page key — must match a key in PAGE_CATEGORY_BOOST */
  page:
    | "pipeline"
    | "calls"
    | "call_detail"
    | "leads"
    | "lead_detail"
    | "territory"
    | "knowledge"
    | "dashboard"
    | "settings"
    | "scout"
    | "other";
  callType?: string;
  contactId?: string;
  territorySlug?: string;
  pipelineStage?: string;
  callId?: string;
}

/**
 * Parse a pathname into a Scout page context.
 *
 * Pathnames inspected:
 *   /leads/[contactId]      → lead_detail (with contactId)
 *   /leads                  → leads
 *   /calls/[callId]         → call_detail (with callId)
 *   /calls                  → calls
 *   /territories/[slug]     → territory (with territorySlug)
 *   /pipeline               → pipeline
 *   /daily-hq | /dashboard  → dashboard
 *   /knowledge              → knowledge
 *   /settings               → settings
 *   /scout                  → scout
 *   anything else           → other
 */
export function parsePageContext(pathname: string | null): ScoutPageContext {
  if (!pathname) return { page: "other" };

  const leadDetail = pathname.match(/^\/leads\/([^/]+)/);
  if (leadDetail) {
    return { page: "lead_detail", contactId: leadDetail[1] };
  }
  if (pathname === "/leads" || pathname.startsWith("/leads?")) {
    return { page: "leads" };
  }

  const callDetail = pathname.match(/^\/calls\/([^/]+)/);
  if (callDetail) {
    return { page: "call_detail", callId: callDetail[1] };
  }
  if (pathname === "/calls" || pathname.startsWith("/calls?")) {
    return { page: "calls" };
  }

  const territoryDetail = pathname.match(/^\/territories\/([^/]+)/);
  if (territoryDetail) {
    return { page: "territory", territorySlug: territoryDetail[1] };
  }

  if (pathname.startsWith("/pipeline")) return { page: "pipeline" };
  if (pathname.startsWith("/daily-hq") || pathname.startsWith("/dashboard"))
    return { page: "dashboard" };
  if (pathname.startsWith("/knowledge")) return { page: "knowledge" };
  if (pathname.startsWith("/settings")) return { page: "settings" };
  if (pathname.startsWith("/scout")) return { page: "scout" };

  return { page: "other" };
}
