/**
 * Scout Workflow Rewrite Engine
 *
 * For every underperforming workflow step, Scout drafts 3 rewrite variants
 * with different approaches (shorter, more personal, different angle).
 * Human reviews and picks the best one — it can be pushed as an A/B test
 * or a direct replacement.
 *
 * Uses Claude API (same as Scout chat) to generate rewrites.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { logLLMCall } from "@/lib/scout/llm-logger";
import type { WorkflowStep } from "@/lib/workflows/types";

/** The Claude model for rewrite generation — Haiku for speed/cost */
const REWRITE_MODEL = "claude-haiku-4-5-20251001";

/** A single rewrite variant */
export interface RewriteVariant {
  approach: string;
  content: string;
  subject?: string;
  rationale: string;
}

/** Result of a rewrite request */
export interface RewriteResult {
  stepId: string;
  stepType: string;
  dayNumber: number;
  originalContent: string;
  originalSubject?: string;
  variants: RewriteVariant[];
  diagnosis: string;
}

/**
 * Generate 3 rewrite variants for an underperforming workflow step.
 */
export async function generateRewrites(params: {
  stepId: string;
  context?: string;
}): Promise<RewriteResult> {
  const supabase = createServerClient();

  // Get the step details
  const { data: step, error } = await supabase
    .from("workflow_steps")
    .select("*, workflow_versions(workflows(name, workflow_type))")
    .eq("id", params.stepId)
    .single();

  if (error || !step) {
    throw new Error(`Step ${params.stepId} not found`);
  }

  const typedStep = step as WorkflowStep & {
    workflow_versions?: { workflows?: { name: string; workflow_type: string } };
  };

  const workflowName = typedStep.workflow_versions?.workflows?.name ?? "Unknown workflow";
  const workflowType = typedStep.workflow_versions?.workflows?.workflow_type ?? "general";

  const prompt = buildRewritePrompt({
    stepType: typedStep.step_type,
    dayNumber: typedStep.day_number,
    stepNumber: typedStep.step_number,
    currentContent: typedStep.content ?? "",
    currentSubject: typedStep.subject ?? undefined,
    openRate: typedStep.open_rate ?? undefined,
    clickRate: typedStep.click_rate ?? undefined,
    responseRate: typedStep.response_rate ?? undefined,
    workflowName,
    workflowType,
    additionalContext: params.context,
  });

  const anthropic = createAnthropicClient();
  const inputMessages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  const startTime = Date.now();
  let response: Anthropic.Messages.Message;

  try {
    response = await anthropic.messages.create({
      model: REWRITE_MODEL,
      max_tokens: 2048,
      system: REWRITE_SYSTEM_PROMPT,
      messages: inputMessages,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown API error";
    logLLMCall({
      model: REWRITE_MODEL,
      inputMessages: inputMessages,
      toolsProvided: [],
      responseContent: [],
      toolCallsMade: [],
      tokensInput: 0,
      tokensOutput: 0,
      latencyMs: Date.now() - startTime,
      error: errorMsg,
      caller: "rewrite_engine",
    }).catch(() => { /* swallow */ });
    throw err;
  }

  const latencyMs = Date.now() - startTime;

  // Log the successful rewrite call — fire-and-forget
  logLLMCall({
    model: REWRITE_MODEL,
    inputMessages: inputMessages,
    toolsProvided: [],
    responseContent: response.content as unknown[],
    toolCallsMade: [],
    tokensInput: response.usage?.input_tokens ?? 0,
    tokensOutput: response.usage?.output_tokens ?? 0,
    latencyMs,
    caller: "rewrite_engine",
  }).catch(() => { /* swallow */ });

  // Parse the response
  const textContent = response.content.find((c) => c.type === "text");
  const rawText = textContent?.type === "text" ? textContent.text : "";

  const { diagnosis, variants } = parseRewriteResponse(rawText, typedStep.step_type);

  return {
    stepId: params.stepId,
    stepType: typedStep.step_type,
    dayNumber: typedStep.day_number,
    originalContent: typedStep.content ?? "",
    originalSubject: typedStep.subject ?? undefined,
    variants,
    diagnosis,
  };
}

/** Creates an Anthropic client */
function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }
  return new Anthropic({ apiKey });
}

/** System prompt for the rewrite engine */
const REWRITE_SYSTEM_PROMPT = `You are Scout's Workflow Intelligence Engine for New Again Houses (NAH), a house-flipping franchise company.

Your job: diagnose why a workflow step is underperforming and draft 3 improved variants.

RULES:
- Write in NAH's voice: confident, direct, professional but human
- Each variant must take a DIFFERENT approach (not just word swaps)
- SMS must be under 160 characters when possible
- Emails need a compelling subject line
- Never use pressure language during FDD review periods
- Never make earnings claims
- Always have ONE clear call-to-action per message
- Use [Name] and [FirstName] as personalization placeholders

OUTPUT FORMAT (follow exactly):
DIAGNOSIS: [1-2 sentences explaining why this step is underperforming]

VARIANT 1 - [approach name]:
RATIONALE: [why this approach might work better]
SUBJECT: [email subject if applicable]
CONTENT: [the rewritten content]

VARIANT 2 - [approach name]:
RATIONALE: [why this approach might work better]
SUBJECT: [email subject if applicable]
CONTENT: [the rewritten content]

VARIANT 3 - [approach name]:
RATIONALE: [why this approach might work better]
SUBJECT: [email subject if applicable]
CONTENT: [the rewritten content]`;

/** Build the user prompt with step context */
function buildRewritePrompt(params: {
  stepType: string;
  dayNumber: number;
  stepNumber: number;
  currentContent: string;
  currentSubject?: string;
  openRate?: number;
  clickRate?: number;
  responseRate?: number;
  workflowName: string;
  workflowType: string;
  additionalContext?: string;
}): string {
  let prompt = `Rewrite this underperforming ${params.stepType.toUpperCase()} step.

WORKFLOW: ${params.workflowName} (${params.workflowType})
STEP: Day ${params.dayNumber}, Step ${params.stepNumber}
TYPE: ${params.stepType}

CURRENT CONTENT:
${params.currentContent}`;

  if (params.currentSubject) {
    prompt += `\n\nCURRENT SUBJECT LINE:\n${params.currentSubject}`;
  }

  prompt += "\n\nPERFORMANCE:";
  if (params.openRate !== undefined) prompt += `\n- Open rate: ${params.openRate}%`;
  if (params.clickRate !== undefined) prompt += `\n- Click rate: ${params.clickRate}%`;
  if (params.responseRate !== undefined) prompt += `\n- Response rate: ${params.responseRate}%`;

  if (params.additionalContext) {
    prompt += `\n\nADDITIONAL CONTEXT:\n${params.additionalContext}`;
  }

  prompt += "\n\nGenerate 3 rewrite variants with different approaches.";

  return prompt;
}

/** Parse Claude's response into structured variants */
function parseRewriteResponse(
  text: string,
  stepType: string
): { diagnosis: string; variants: RewriteVariant[] } {
  const lines = text.split("\n");
  let diagnosis = "";
  const variants: RewriteVariant[] = [];

  let currentVariant: Partial<RewriteVariant> | null = null;
  let currentField: "content" | "rationale" | "subject" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("DIAGNOSIS:")) {
      diagnosis = trimmed.replace("DIAGNOSIS:", "").trim();
      continue;
    }

    if (trimmed.match(/^VARIANT \d+ - /)) {
      // Save previous variant
      if (currentVariant?.content && currentVariant?.approach) {
        variants.push(currentVariant as RewriteVariant);
      }
      currentVariant = {
        approach: trimmed.replace(/^VARIANT \d+ - /, "").replace(/:$/, "").trim(),
        content: "",
        rationale: "",
      };
      currentField = null;
      continue;
    }

    if (currentVariant) {
      if (trimmed.startsWith("RATIONALE:")) {
        currentField = "rationale";
        currentVariant.rationale = trimmed.replace("RATIONALE:", "").trim();
        continue;
      }
      if (trimmed.startsWith("SUBJECT:")) {
        currentField = "subject";
        currentVariant.subject = trimmed.replace("SUBJECT:", "").trim();
        continue;
      }
      if (trimmed.startsWith("CONTENT:")) {
        currentField = "content";
        currentVariant.content = trimmed.replace("CONTENT:", "").trim();
        continue;
      }

      // Continuation of current field
      if (currentField === "content" && trimmed) {
        currentVariant.content = ((currentVariant.content ?? "") + "\n" + trimmed).trim();
      } else if (currentField === "rationale" && trimmed) {
        currentVariant.rationale = ((currentVariant.rationale ?? "") + " " + trimmed).trim();
      }
    }
  }

  // Push last variant
  if (currentVariant?.content && currentVariant?.approach) {
    variants.push(currentVariant as RewriteVariant);
  }

  // Fallback: if parsing failed, create a single variant from the whole text
  if (variants.length === 0 && text.length > 50) {
    variants.push({
      approach: "AI Rewrite",
      content: text,
      rationale: "Auto-generated rewrite based on performance data",
    });
  }

  // Remove subject from SMS variants (not applicable)
  if (stepType === "sms") {
    for (const v of variants) {
      delete v.subject;
    }
  }

  return { diagnosis, variants };
}
