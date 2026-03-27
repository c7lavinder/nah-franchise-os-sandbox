/**
 * Transcript Analyzer — extracts structured call log fields from transcripts.
 *
 * Per intelligence plan: "Scout reads transcript + extracts structured field answers"
 * Uses Claude to analyze call transcripts and pre-fill the call log form.
 *
 * Works with any transcript source:
 * - Pasted text (immediate)
 * - Google Meet / Gemini notes (via Drive API — future)
 * - Uploaded file
 */

import Anthropic from "@anthropic-ai/sdk";
import { logLLMCall } from "@/lib/scout/llm-logger";

const ANALYZER_MODEL = "claude-haiku-4-5-20251001";

/** Result of transcript analysis */
export interface TranscriptAnalysis {
  /** Detected call type */
  callType: "intro" | "matt" | "sam" | "mark" | "unknown";
  /** Structured fields extracted — keys match CallLogForm field names */
  extractedFields: Record<string, string>;
  /** Brief summary of the call */
  summary: string;
  /** Rep confidence if detectable */
  repConfidence: "high" | "medium" | "low" | null;
  /** Red flags noticed */
  redFlags: string | null;
  /** Objections raised */
  objections: { type: string; detail: string }[];
}

/**
 * Analyze a call transcript and extract structured intelligence fields.
 */
export async function analyzeTranscript(
  transcript: string,
  contactName?: string
): Promise<TranscriptAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const anthropic = new Anthropic({ apiKey });
  const startTime = Date.now();

  const prompt = buildAnalysisPrompt(transcript, contactName);

  try {
    const response = await anthropic.messages.create({
      model: ANALYZER_MODEL,
      max_tokens: 2048,
      system: ANALYZER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const latencyMs = Date.now() - startTime;
    const textContent = response.content.find((c) => c.type === "text");
    const rawText = textContent?.type === "text" ? textContent.text : "";

    // Log the LLM call
    logLLMCall({
      model: ANALYZER_MODEL,
      inputMessages: [{ role: "system", content: ANALYZER_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      responseContent: response.content,
      toolsProvided: [],
      toolCallsMade: [],
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      latencyMs,
      caller: "transcript-analyzer",
    }).catch(() => { /* fire and forget */ });

    return parseAnalysis(rawText);
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    logLLMCall({
      model: ANALYZER_MODEL,
      inputMessages: [{ role: "user", content: prompt }],
      responseContent: [],
      toolsProvided: [],
      toolCallsMade: [],
      tokensInput: 0,
      tokensOutput: 0,
      latencyMs,
      error: err instanceof Error ? err.message : "Unknown error",
      caller: "transcript-analyzer",
    }).catch(() => { /* fire and forget */ });
    throw err;
  }
}

const ANALYZER_SYSTEM_PROMPT = `You analyze franchise sales call transcripts for New Again Houses (NAH).

Extract structured data from the transcript to fill a call log form. Be specific and accurate — only extract what was actually discussed.

OUTPUT FORMAT (follow exactly):

CALL_TYPE: [intro|matt|sam|mark|unknown]
SUMMARY: [2-3 sentence summary of the call]
REP_CONFIDENCE: [high|medium|low|null]
RED_FLAGS: [any red flags noticed, or null]

FIELDS:
[key]: [value]
[key]: [value]
...

OBJECTIONS:
[type]: [detail]
...

FIELD KEYS BY CALL TYPE:

For intro calls (Chad):
- stated_motivation: buy_job | wealth_building | escape_corporate | other
- prior_business_owner: yes | no
- prior_business_type: [text if yes]
- construction_comfort: hands_on | project_oversight | no_experience
- liquid_capital: under_50k | 50_75k | 75_100k | 100k_plus
- funding_path: cash | guidant | sba | unknown
- spouse_supportive: yes | no | unknown
- urgency: ready_now | 3_6_months | exploring

For matt calls (Discovery):
- homework_done: yes | partially | no
- capital_concern_surfaced: yes | no
- capital_concern_detail: [text]
- royalty_objection_raised: yes | no
- disc_impression: D | I | S | C
- financial_situation_read: strong | adequate | concerning
- deal_breaker_flags: territory | undercapitalized | wrong_profile | none
- close_confidence: high | medium | low

For sam calls (Validation):
- market_analysis_quality: thorough | partial | not_done
- capital_structure_understood: yes | no
- wholesaling_comfort: yes | willing_to_learn | resistant
- construction_management_realism: realistic | overconfident | underconfident
- sams_read: move_forward | needs_more_work | flag_for_review

For mark calls (Lending):
- pfs_complete: yes | incomplete | not_submitted
- alta_terms_accepted: yes | no | negotiating
- funding_path_confirmed: yes | no
- capital_gap_identified: yes | no
- capital_gap_amount: [number if yes]
- marks_recommendation: proceed | hold | decline

OBJECTION TYPES: capital | value | timing | territory | going_cold | royalty | other

Only include fields that were clearly discussed. Do not guess.`;

function buildAnalysisPrompt(transcript: string, contactName?: string): string {
  let prompt = "Analyze this franchise sales call transcript";
  if (contactName) prompt += ` with prospect ${contactName}`;
  prompt += ":\n\n";
  prompt += transcript.slice(0, 15000); // Limit to ~15k chars
  return prompt;
}

function parseAnalysis(text: string): TranscriptAnalysis {
  const lines = text.split("\n");
  let callType: TranscriptAnalysis["callType"] = "unknown";
  let summary = "";
  let repConfidence: TranscriptAnalysis["repConfidence"] = null;
  let redFlags: string | null = null;
  const extractedFields: Record<string, string> = {};
  const objections: { type: string; detail: string }[] = [];

  let section: "header" | "fields" | "objections" = "header";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("CALL_TYPE:")) {
      const val = trimmed.replace("CALL_TYPE:", "").trim().toLowerCase();
      if (["intro", "matt", "sam", "mark"].includes(val)) {
        callType = val as TranscriptAnalysis["callType"];
      }
      continue;
    }
    if (trimmed.startsWith("SUMMARY:")) {
      summary = trimmed.replace("SUMMARY:", "").trim();
      continue;
    }
    if (trimmed.startsWith("REP_CONFIDENCE:")) {
      const val = trimmed.replace("REP_CONFIDENCE:", "").trim().toLowerCase();
      if (["high", "medium", "low"].includes(val)) {
        repConfidence = val as "high" | "medium" | "low";
      }
      continue;
    }
    if (trimmed.startsWith("RED_FLAGS:")) {
      const val = trimmed.replace("RED_FLAGS:", "").trim();
      redFlags = val === "null" || val === "none" ? null : val;
      continue;
    }
    if (trimmed === "FIELDS:") {
      section = "fields";
      continue;
    }
    if (trimmed === "OBJECTIONS:") {
      section = "objections";
      continue;
    }

    if (section === "fields" && trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim().replace(/^- /, "");
      const value = trimmed.slice(colonIdx + 1).trim();
      if (key && value && value !== "null" && value !== "none") {
        extractedFields[key] = value;
      }
    }

    if (section === "objections" && trimmed.includes(":")) {
      const colonIdx = trimmed.indexOf(":");
      const type = trimmed.slice(0, colonIdx).trim().replace(/^- /, "");
      const detail = trimmed.slice(colonIdx + 1).trim();
      if (type && detail) {
        objections.push({ type, detail });
      }
    }
  }

  return { callType, extractedFields, summary, repConfidence, redFlags, objections };
}
