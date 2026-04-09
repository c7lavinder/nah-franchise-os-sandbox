/**
 * Scout Query Router
 *
 * Detects query intent and routes to the appropriate handler:
 * - Contact-specific: uses hybrid retrieval with contact filter
 * - Business intelligence: queries across all contacts
 * - Knowledge/methodology: searches KB only
 * - Pre-call brief: generates 8-section brief
 */

export type QueryIntent =
  | "contact_specific"
  | "business_intelligence"
  | "knowledge_methodology"
  | "pre_call_brief"
  | "general";

interface RouteResult {
  intent: QueryIntent;
  contactId?: string;
  callType?: string;
}

const BI_PATTERNS = [
  /how many\s+(leads|contacts|prospects)/i,
  /conversion\s+rate/i,
  /pipeline\s+(health|performance|velocity)/i,
  /average\s+(time|days)/i,
  /top\s+(objection|concern|reason)/i,
  /which\s+(rep|stage|source)/i,
  /compare\s+(reps|stages|months)/i,
  /trend/i,
  /forecast/i,
  /this\s+(week|month|quarter)/i,
  /best\s+(performing|lead\s+source)/i,
  /worst\s+(performing|stage)/i,
  /how\s+is\s+(the team|everyone|we) doing/i,
  /what.*pattern/i,
  /stalled?\s+(deals|leads)/i,
  /closing\s+rate/i,
];

const BRIEF_PATTERNS = [
  /pre.?call\s+brief/i,
  /brief\s+me/i,
  /prepare\s+me/i,
  /what\s+should\s+I\s+know\s+before/i,
  /call\s+prep/i,
  /get\s+me\s+ready/i,
];

const KB_PATTERNS = [
  /how\s+do\s+(we|I)\s+(handle|approach|respond)/i,
  /what.s\s+the\s+(process|procedure|playbook)/i,
  /best\s+practice/i,
  /objection\s+handling/i,
  /what\s+should\s+I\s+say/i,
  /sales\s+(methodology|approach|strategy)/i,
  /franchise\s+(disclosure|agreement|fee)/i,
];

/**
 * Route a user query to the appropriate handler.
 */
export function routeQuery(
  query: string,
  pageContext?: { contactId?: string; contactName?: string }
): RouteResult {
  // Check for pre-call brief
  if (BRIEF_PATTERNS.some((p) => p.test(query))) {
    // Try to extract call type
    const callTypeMatch = query.match(/(intro|discovery|matt|sam|mark|validation|capital|fdd|territory|awarding|final)/i);
    return {
      intent: "pre_call_brief",
      contactId: pageContext?.contactId,
      callType: callTypeMatch?.[1] ?? "general",
    };
  }

  // Check for BI patterns
  if (BI_PATTERNS.some((p) => p.test(query))) {
    return { intent: "business_intelligence" };
  }

  // Check for KB/methodology
  if (KB_PATTERNS.some((p) => p.test(query))) {
    return { intent: "knowledge_methodology" };
  }

  // If page context has a contactId, it's likely contact-specific
  if (pageContext?.contactId) {
    return {
      intent: "contact_specific",
      contactId: pageContext.contactId,
    };
  }

  return { intent: "general" };
}
