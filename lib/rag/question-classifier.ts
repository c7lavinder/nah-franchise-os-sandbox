/**
 * Question Classifier — maps user questions to retrieval strategies.
 *
 * Rule-based classifier that determines:
 * 1. Question type (prospect, franchisee, territory, comparison, metric, search, general)
 * 2. Retrieval strategy (which content types to search)
 * 3. Token budget for context injection (2K / 5K / 10K)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestionType =
  | "prospect" // About a specific prospect/lead
  | "franchisee" // About a specific franchisee
  | "territory" // About a territory
  | "call_prep" // Preparing for a call
  | "comparison" // Comparing territories or contacts
  | "metric" // Aggregate/numeric question
  | "search" // Open-ended search ("which leads...", "who...")
  | "knowledge" // Policy/process question
  | "general"; // Greeting, meta-question, or unclassifiable

export type ContentTypeFilter = "transcript" | "kb_doc" | "external_research" | "journal" | "profile_summary";

export interface RetrievalStrategy {
  questionType: QuestionType;
  /** Content types to search in pre-fetch */
  contentTypes: ContentTypeFilter[];
  /** Max tokens of context to inject into system prompt */
  tokenBudget: number;
  /** Number of chunks to retrieve */
  chunkLimit: number;
  /** Minimum similarity threshold */
  threshold: number;
  /** Whether to use reranking (adds latency but improves quality) */
  rerank: boolean;
}

// ---------------------------------------------------------------------------
// Classification rules
// ---------------------------------------------------------------------------

const CALL_PREP_PATTERNS = [
  /\b(prep|prepare|brief|prepar)\b.*\b(call|meeting|appointment|convo)\b/i,
  /\b(call|meeting)\b.*\b(prep|prepare|brief)\b/i,
  /\bwhat (should|do) I (know|need|review)\b.*\b(call|meeting|before)\b/i,
  /\bcoming up\b.*\bcall\b/i,
];

const COMPARISON_PATTERNS = [
  /\bcompar(e|ing|ison)\b/i,
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bstack(s|ed)?\s+up\b/i,
  /\bdifference\s+between\b/i,
  /\bside[\s-]+by[\s-]+side\b/i,
];

const METRIC_PATTERNS = [
  /\bhow many\b/i,
  /\bwhat('s| is) the (average|median|total|count|number|sum)\b/i,
  /\bbreakdown\b/i,
  /\bdistribution\b/i,
  /\bconversion rate\b/i,
  /\blead (flow|volume|count)\b/i,
  /\bpipeline (health|status|numbers)\b/i,
];

const SEARCH_PATTERNS = [
  /\bwhich (leads?|prospects?|contacts?|candidates?|franchisees?|territories?)\b/i,
  /\bwho (has|is|are|should|needs?|mentioned|said|talked)\b/i,
  /\bfind (the|all|any|me)\b/i,
  /\bshow me\b/i,
  /\blist (all|the|any)\b/i,
];

const KNOWLEDGE_PATTERNS = [
  /\b(how do we|what('s| is) our|what('s| is) the) (approach|policy|process|procedure|playbook|script)\b/i,
  /\bhow (should|do) (I|we) (handle|approach|respond|deal)\b/i,
  /\bobjection\b/i,
  /\bFDD\b/i,
  /\bcompetitor\b/i,
  /\bbrand (standard|guideline|positioning)\b/i,
  /\bplaybook\b/i,
  /\bwhat (should|do) I say\b/i,
];

const TERRITORY_PATTERNS = [
  /\bterritor(y|ies)\b/i,
  /\b(market|region|area)\s+(data|performance|health|numbers)\b/i,
  /\bhow is .{2,30} doing\b/i, // "how is Spokane doing"
];

const FRANCHISEE_PATTERNS = [
  /\bfranchisee\b/i,
  /\bowner\b/i,
  /\btheir (territory|performance|numbers|flips?|inventory)\b/i,
  /\b(T12|T3|cycle time|profit per flip|purchases?|sold)\b/i,
  /\bEOS\b/i,
];

const PROSPECT_PATTERNS = [
  /\b(prospect|lead|candidate)\b/i,
  /\b(pipeline|stage|sub-?task)\b/i,
  /\b(score|intelligence|capital|timeline|trainual|NDA|validation)\b/i,
  /\bnext (step|action|move)\b/i,
  /\bwhat('s| is) (going on|happening|new|the status) with\b/i,
];

const GENERAL_PATTERNS = [
  /^(hi|hey|hello|yo|good morning|good afternoon|good evening|thanks|thank you|ok|okay)\b/i,
  /\bwhat can you do\b/i,
  /\bwho are you\b/i,
  /\bhelp\b/i,
];

/**
 * Classify a user message into a question type.
 * Returns the first matching type in priority order.
 */
export function classifyQuestion(message: string): QuestionType {
  const text = message.trim();

  // Short messages or greetings → general (no retrieval needed)
  if (text.length < 8 || GENERAL_PATTERNS.some((p) => p.test(text))) {
    return "general";
  }

  // Call prep — highest priority, clear intent
  if (CALL_PREP_PATTERNS.some((p) => p.test(text))) {
    return "call_prep";
  }

  // Comparison
  if (COMPARISON_PATTERNS.some((p) => p.test(text))) {
    return "comparison";
  }

  // Metric / aggregate questions
  if (METRIC_PATTERNS.some((p) => p.test(text))) {
    return "metric";
  }

  // Knowledge / policy questions
  if (KNOWLEDGE_PATTERNS.some((p) => p.test(text))) {
    return "knowledge";
  }

  // Search / cross-contact questions
  if (SEARCH_PATTERNS.some((p) => p.test(text))) {
    return "search";
  }

  // Territory-specific
  if (TERRITORY_PATTERNS.some((p) => p.test(text))) {
    return "territory";
  }

  // Franchisee-specific
  if (FRANCHISEE_PATTERNS.some((p) => p.test(text))) {
    return "franchisee";
  }

  // Prospect-specific
  if (PROSPECT_PATTERNS.some((p) => p.test(text))) {
    return "prospect";
  }

  // Default: general (let Scout use tools as needed)
  return "general";
}

// ---------------------------------------------------------------------------
// Retrieval strategy mapping
// ---------------------------------------------------------------------------

const STRATEGIES: Record<QuestionType, RetrievalStrategy> = {
  general: {
    questionType: "general",
    contentTypes: [],
    tokenBudget: 0,
    chunkLimit: 0,
    threshold: 0.4,
    rerank: false,
  },
  prospect: {
    questionType: "prospect",
    contentTypes: ["transcript", "kb_doc"],
    tokenBudget: 2000,
    chunkLimit: 4,
    threshold: 0.35,
    rerank: true,
  },
  franchisee: {
    questionType: "franchisee",
    contentTypes: ["transcript", "kb_doc"],
    tokenBudget: 5000,
    chunkLimit: 6,
    threshold: 0.35,
    rerank: true,
  },
  territory: {
    questionType: "territory",
    contentTypes: ["kb_doc"],
    tokenBudget: 2000,
    chunkLimit: 3,
    threshold: 0.35,
    rerank: true,
  },
  call_prep: {
    questionType: "call_prep",
    contentTypes: ["transcript", "kb_doc", "external_research"],
    tokenBudget: 10000,
    chunkLimit: 8,
    threshold: 0.3,
    rerank: true,
  },
  comparison: {
    questionType: "comparison",
    contentTypes: ["kb_doc"],
    tokenBudget: 2000,
    chunkLimit: 3,
    threshold: 0.35,
    rerank: false,
  },
  metric: {
    questionType: "metric",
    contentTypes: [],
    tokenBudget: 0,
    chunkLimit: 0,
    threshold: 0.4,
    rerank: false,
  },
  search: {
    questionType: "search",
    contentTypes: ["transcript", "kb_doc", "external_research"],
    tokenBudget: 10000,
    chunkLimit: 8,
    threshold: 0.3,
    rerank: true,
  },
  knowledge: {
    questionType: "knowledge",
    contentTypes: ["kb_doc"],
    tokenBudget: 5000,
    chunkLimit: 5,
    threshold: 0.3,
    rerank: true,
  },
};

/**
 * Get the retrieval strategy for a question type.
 */
export function getRetrievalStrategy(questionType: QuestionType): RetrievalStrategy {
  return STRATEGIES[questionType];
}

/**
 * Classify a message and return the full retrieval strategy.
 */
export function planRetrieval(message: string): RetrievalStrategy {
  const questionType = classifyQuestion(message);
  return getRetrievalStrategy(questionType);
}
