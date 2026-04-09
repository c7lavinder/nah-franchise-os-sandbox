/**
 * Scout Context Injector
 *
 * Builds page-aware context that is injected into every Scout system prompt.
 * Tells Scout which page the user is on, which contact they're viewing, etc.
 */

export interface PageContext {
  currentPage: "contact" | "pipeline" | "call_details" | "daily_hq" | "settings" | "scout" | "other";
  contactId?: string;
  contactName?: string;
  currentStage?: string;
  callId?: string;
}

/**
 * Build a context injection string for Scout's system prompt.
 */
export function buildContextInjection(ctx: PageContext): string {
  const lines: string[] = [
    `[Page Context] The user is currently on the ${formatPageName(ctx.currentPage)} page.`,
  ];

  if (ctx.contactId && ctx.contactName) {
    lines.push(`They are viewing ${ctx.contactName} (ID: ${ctx.contactId}).`);
  }

  if (ctx.currentStage) {
    lines.push(`This contact is in the ${ctx.currentStage} stage.`);
  }

  if (ctx.callId) {
    lines.push(`They are looking at call ID: ${ctx.callId}.`);
  }

  lines.push(
    "Use this context to answer questions without asking which contact they mean."
  );
  lines.push(
    "Pre-fill any actions with this contact's ID automatically."
  );

  return lines.join(" ");
}

function formatPageName(page: PageContext["currentPage"]): string {
  switch (page) {
    case "contact": return "Contact Details";
    case "pipeline": return "Pipeline Board";
    case "call_details": return "Call Details";
    case "daily_hq": return "Daily HQ";
    case "settings": return "Settings";
    case "scout": return "Scout Chat";
    default: return "unknown";
  }
}

/**
 * Parse page context from a URL path.
 */
export function parsePageContext(
  pathname: string,
  extraContext?: { contactName?: string; currentStage?: string }
): PageContext {
  // /leads/[contactId]
  const contactMatch = pathname.match(/\/leads\/([^/]+)/);
  if (contactMatch) {
    return {
      currentPage: "contact",
      contactId: contactMatch[1],
      contactName: extraContext?.contactName,
      currentStage: extraContext?.currentStage,
    };
  }

  // /calls/[callId]
  const callMatch = pathname.match(/\/calls\/([^/]+)/);
  if (callMatch) {
    return {
      currentPage: "call_details",
      callId: callMatch[1],
    };
  }

  if (pathname.includes("/pipeline")) return { currentPage: "pipeline" };
  if (pathname.includes("/daily-hq")) return { currentPage: "daily_hq" };
  if (pathname.includes("/settings")) return { currentPage: "settings" };
  if (pathname.includes("/scout")) return { currentPage: "scout" };

  return { currentPage: "other" };
}
