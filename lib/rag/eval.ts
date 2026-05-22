/**
 * Retrieval Eval Framework
 *
 * Runs a set of Q&A pairs against the retrieval pipeline and scores:
 * 1. Classification accuracy — did planRetrieval pick the right question type?
 * 2. Content type coverage — did the right content types appear in results?
 * 3. Retrieval hit rate — did we get any results at all?
 * 4. Relevance quality — average similarity score of returned chunks
 *
 * Run: npx tsx lib/rag/eval.ts
 * Or: npm run eval:retrieval
 */

import { planRetrieval, type QuestionType, type ContentTypeFilter } from "./question-classifier";
import { hybridSearch } from "./retriever";

// ---------------------------------------------------------------------------
// Eval pair definition
// ---------------------------------------------------------------------------

export interface EvalPair {
  id: string;
  question: string;
  expectedType: QuestionType;
  expectedContentTypes: ContentTypeFilter[];
  /** Keywords that should appear in at least one returned chunk */
  expectedKeywords: string[];
  /** Optional: specific source_id that should appear */
  expectedSourceId?: string;
}

export interface EvalResult {
  id: string;
  question: string;
  expectedType: QuestionType;
  actualType: QuestionType;
  classificationCorrect: boolean;
  expectedContentTypes: ContentTypeFilter[];
  actualContentTypes: ContentTypeFilter[];
  contentTypeCoverage: number; // 0-1
  chunksReturned: number;
  avgSimilarity: number;
  keywordsFound: string[];
  keywordsMissed: string[];
  keywordHitRate: number; // 0-1
  sourceIdFound: boolean | null;
}

export interface EvalSummary {
  totalPairs: number;
  classificationAccuracy: number;
  avgContentTypeCoverage: number;
  avgChunksReturned: number;
  avgSimilarity: number;
  avgKeywordHitRate: number;
  retrievalHitRate: number; // % of queries that returned at least 1 chunk
  byQuestionType: Record<
    string,
    {
      count: number;
      classificationAccuracy: number;
      avgSimilarity: number;
      avgKeywordHitRate: number;
    }
  >;
  results: EvalResult[];
}

// ---------------------------------------------------------------------------
// The 20 eval pairs — 2-3 per question type
// ---------------------------------------------------------------------------

export const EVAL_PAIRS: EvalPair[] = [
  // PROSPECT (3)
  {
    id: "p1",
    question: "What's the status with Chuck Rierson?",
    expectedType: "prospect",
    expectedContentTypes: ["transcript", "kb_doc"],
    expectedKeywords: ["chuck", "rierson"],
  },
  {
    id: "p2",
    question: "What's going on with the lead from Birmingham?",
    expectedType: "prospect",
    expectedContentTypes: ["transcript", "kb_doc"],
    expectedKeywords: ["birmingham"],
  },
  {
    id: "p3",
    question: "What's the next step with our newest candidate?",
    expectedType: "prospect",
    expectedContentTypes: ["transcript", "kb_doc"],
    expectedKeywords: ["next", "step"],
  },

  // FRANCHISEE (2)
  {
    id: "f1",
    question: "How are the Spokane franchisees performing this quarter?",
    expectedType: "franchisee",
    expectedContentTypes: ["transcript", "kb_doc"],
    expectedKeywords: ["spokane"],
  },
  {
    id: "f2",
    question: "What's the owner's T12 purchase count?",
    expectedType: "franchisee",
    expectedContentTypes: ["transcript", "kb_doc"],
    expectedKeywords: ["purchase"],
  },

  // TERRITORY (2)
  {
    id: "t1",
    question: "How is the Birmingham territory doing?",
    expectedType: "territory",
    expectedContentTypes: ["kb_doc"],
    expectedKeywords: ["birmingham"],
  },
  {
    id: "t2",
    question: "What's the market data for the Spokane area?",
    expectedType: "territory",
    expectedContentTypes: ["kb_doc"],
    expectedKeywords: ["spokane"],
  },

  // CALL_PREP (2)
  {
    id: "cp1",
    question: "Prep me for my call with Chuck",
    expectedType: "call_prep",
    expectedContentTypes: ["transcript", "kb_doc", "external_research"],
    expectedKeywords: ["chuck"],
  },
  {
    id: "cp2",
    question: "What should I know before my meeting today?",
    expectedType: "call_prep",
    expectedContentTypes: ["transcript", "kb_doc", "external_research"],
    expectedKeywords: [],
  },

  // COMPARISON (2)
  {
    id: "cmp1",
    question: "Compare Spokane vs Birmingham territories",
    expectedType: "comparison",
    expectedContentTypes: ["kb_doc"],
    expectedKeywords: ["spokane", "birmingham"],
  },
  {
    id: "cmp2",
    question: "How does Nashville stack up against Memphis?",
    expectedType: "comparison",
    expectedContentTypes: ["kb_doc"],
    expectedKeywords: ["nashville", "memphis"],
  },

  // METRIC (2)
  {
    id: "m1",
    question: "How many leads came in this month?",
    expectedType: "metric",
    expectedContentTypes: [],
    expectedKeywords: [],
  },
  {
    id: "m2",
    question: "What's the conversion rate from Discovery to Validation?",
    expectedType: "metric",
    expectedContentTypes: [],
    expectedKeywords: [],
  },

  // SEARCH (2)
  {
    id: "s1",
    question: "Which leads mentioned royalty concerns?",
    expectedType: "search",
    expectedContentTypes: ["transcript", "kb_doc", "external_research"],
    expectedKeywords: ["royalt"],
  },
  {
    id: "s2",
    question: "Who talked about capital in the last month?",
    expectedType: "search",
    expectedContentTypes: ["transcript", "kb_doc", "external_research"],
    expectedKeywords: ["capital"],
  },

  // KNOWLEDGE (2)
  {
    id: "k1",
    question: "How do we handle the capital objection?",
    expectedType: "knowledge",
    expectedContentTypes: ["kb_doc"],
    expectedKeywords: ["capital", "objection"],
  },
  {
    id: "k2",
    question: "What's our approach to competitor questions?",
    expectedType: "knowledge",
    expectedContentTypes: ["kb_doc"],
    expectedKeywords: ["competitor"],
  },

  // GENERAL (1)
  {
    id: "g1",
    question: "Hi Scout",
    expectedType: "general",
    expectedContentTypes: [],
    expectedKeywords: [],
  },
];

// ---------------------------------------------------------------------------
// Run eval
// ---------------------------------------------------------------------------

export async function runEval(pairs?: EvalPair[]): Promise<EvalSummary> {
  const evalPairs = pairs ?? EVAL_PAIRS;
  const results: EvalResult[] = [];

  for (const pair of evalPairs) {
    const strategy = planRetrieval(pair.question);

    let chunks: Awaited<ReturnType<typeof hybridSearch>> = [];
    if (strategy.chunkLimit > 0 && strategy.contentTypes.length > 0) {
      try {
        chunks = await hybridSearch({
          query: pair.question,
          limit: strategy.chunkLimit,
          threshold: strategy.threshold,
          rerank: strategy.rerank,
        });
      } catch {
        // Search failed — count as 0 chunks
      }
    }

    const actualContentTypes = [...new Set(chunks.map((c) => c.contentType))] as ContentTypeFilter[];
    const avgSim = chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length : 0;

    // Check keyword coverage
    const allContent = chunks.map((c) => c.content.toLowerCase()).join(" ");
    const keywordsFound = pair.expectedKeywords.filter((kw) => allContent.includes(kw.toLowerCase()));
    const keywordsMissed = pair.expectedKeywords.filter((kw) => !allContent.includes(kw.toLowerCase()));
    const keywordHitRate = pair.expectedKeywords.length > 0 ? keywordsFound.length / pair.expectedKeywords.length : 1;

    // Check content type coverage
    const expectedSet = new Set(pair.expectedContentTypes);
    const coveredTypes = actualContentTypes.filter((ct) => expectedSet.has(ct));
    const contentTypeCoverage =
      pair.expectedContentTypes.length > 0 ? coveredTypes.length / pair.expectedContentTypes.length : 1;

    // Check source ID
    let sourceIdFound: boolean | null = null;
    if (pair.expectedSourceId) {
      sourceIdFound = chunks.some((c) => c.metadata?.source_id === pair.expectedSourceId);
    }

    results.push({
      id: pair.id,
      question: pair.question,
      expectedType: pair.expectedType,
      actualType: strategy.questionType,
      classificationCorrect: strategy.questionType === pair.expectedType,
      expectedContentTypes: pair.expectedContentTypes,
      actualContentTypes,
      contentTypeCoverage,
      chunksReturned: chunks.length,
      avgSimilarity: avgSim,
      keywordsFound,
      keywordsMissed,
      keywordHitRate,
      sourceIdFound,
    });
  }

  // Aggregate by question type
  const byType: Record<string, { count: number; correct: number; simSum: number; kwSum: number }> = {};
  for (const r of results) {
    const key = r.expectedType;
    if (!byType[key]) byType[key] = { count: 0, correct: 0, simSum: 0, kwSum: 0 };
    byType[key].count++;
    if (r.classificationCorrect) byType[key].correct++;
    byType[key].simSum += r.avgSimilarity;
    byType[key].kwSum += r.keywordHitRate;
  }

  const byQuestionType: EvalSummary["byQuestionType"] = {};
  for (const [type, stats] of Object.entries(byType)) {
    byQuestionType[type] = {
      count: stats.count,
      classificationAccuracy: stats.correct / stats.count,
      avgSimilarity: stats.simSum / stats.count,
      avgKeywordHitRate: stats.kwSum / stats.count,
    };
  }

  const withChunks = results.filter((r) => r.expectedContentTypes.length > 0);

  return {
    totalPairs: results.length,
    classificationAccuracy: results.filter((r) => r.classificationCorrect).length / results.length,
    avgContentTypeCoverage: results.reduce((s, r) => s + r.contentTypeCoverage, 0) / results.length,
    avgChunksReturned:
      withChunks.length > 0 ? withChunks.reduce((s, r) => s + r.chunksReturned, 0) / withChunks.length : 0,
    avgSimilarity: withChunks.length > 0 ? withChunks.reduce((s, r) => s + r.avgSimilarity, 0) / withChunks.length : 0,
    avgKeywordHitRate: results.reduce((s, r) => s + r.keywordHitRate, 0) / results.length,
    retrievalHitRate:
      withChunks.length > 0 ? withChunks.filter((r) => r.chunksReturned > 0).length / withChunks.length : 1,
    byQuestionType,
    results,
  };
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

async function main() {
  console.log("Running retrieval eval...\n");
  const summary = await runEval();

  console.log("=== RETRIEVAL EVAL RESULTS ===\n");
  console.log(`Total pairs: ${summary.totalPairs}`);
  console.log(`Classification accuracy: ${(summary.classificationAccuracy * 100).toFixed(1)}%`);
  console.log(`Content type coverage: ${(summary.avgContentTypeCoverage * 100).toFixed(1)}%`);
  console.log(`Retrieval hit rate: ${(summary.retrievalHitRate * 100).toFixed(1)}%`);
  console.log(`Avg chunks returned: ${summary.avgChunksReturned.toFixed(1)}`);
  console.log(`Avg similarity: ${summary.avgSimilarity.toFixed(3)}`);
  console.log(`Avg keyword hit rate: ${(summary.avgKeywordHitRate * 100).toFixed(1)}%`);

  console.log("\n--- By Question Type ---\n");
  for (const [type, stats] of Object.entries(summary.byQuestionType)) {
    console.log(
      `  ${type}: classification=${(stats.classificationAccuracy * 100).toFixed(0)}% similarity=${stats.avgSimilarity.toFixed(3)} keywords=${(stats.avgKeywordHitRate * 100).toFixed(0)}% (n=${stats.count})`
    );
  }

  console.log("\n--- Individual Results ---\n");
  for (const r of summary.results) {
    const status = r.classificationCorrect ? "OK" : "MISS";
    const kwStatus = r.keywordsMissed.length > 0 ? ` missing:[${r.keywordsMissed.join(",")}]` : "";
    console.log(
      `  [${status}] ${r.id}: "${r.question.slice(0, 50)}" => ${r.actualType} (${r.chunksReturned} chunks, sim=${r.avgSimilarity.toFixed(3)}${kwStatus})`
    );
  }

  console.log("\n=== END ===");
}

// Only run if called directly
if (require.main === module) {
  main().catch(console.error);
}
