/**
 * Workflow Builder Client
 *
 * Focused AI client for the conversational workflow builder.
 * Same tool-call loop pattern as lib/scout/client.ts, but with:
 * - Workflow-specific system prompt
 * - 3 focused tools (not 24 general Scout tools)
 * - Sonnet model (design reasoning needs more than Haiku)
 * - Returns WorkflowDraft instead of DraftedAction
 */

import Anthropic from "@anthropic-ai/sdk";
import { logLLMCall } from "@/lib/scout/llm-logger";
import { createServerClient } from "@/lib/supabase/server";
import type { WorkflowDraft } from "@/types/workflow-builder";
import type { WorkflowStepType } from "@/lib/workflows/types";

const MAX_TOKENS = 8192;
const MAX_TOOL_ITERATIONS = 10;
const BUILDER_MODEL = "claude-sonnet-4-6";

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}

// ═══════════════════════════════════════════════════════
// System prompt
// ═══════════════════════════════════════════════════════

const BUILDER_SYSTEM_PROMPT = `You are the Workflow Builder for NAH Franchise OS, powered by Scout AI.

Your job is to help the user design workflow automations through conversation. The user will describe what they need — often referencing what "Franchise Tether" (their old CRM) does — and you'll help design a working workflow.

HOW YOU WORK:
1. Listen to what the user describes
2. Ask smart follow-up questions about triggers, timing, channels, content, and exit conditions
3. When you have enough info, use the generate_workflow_draft tool to produce a complete workflow
4. The user sees a visual preview and can request changes
5. When they confirm, the workflow gets saved to the database

STEP TYPES AVAILABLE (maps to GHL actions):
- sms: Send SMS message (C1)
- email: Send email (C2)
- chad_call_task: Create call task for Chad (T1)
- appointment: Schedule appointment (A1)
- send_reminder: Send appointment reminder SMS (A5)
- internal_note: Add internal note (C8)
- add_tag: Add tag to contact (M4)
- remove_tag: Remove tag from contact (M5)
- update_contact: Update contact fields (M2)
- pipeline_move: Move pipeline stage (M3)
- trigger_workflow: Trigger a GHL workflow/campaign (C5)
- condition_check: Evaluate a condition and branch
- team_notify: Internal team notification
- trainual_check: Check Trainual completion

TRIGGER EVENTS (GHL webhooks):
- appointment.created: Contact books an appointment
- contact.created: New contact created
- contact.stage_changed: Contact moves pipeline stage
- contact.tag_added: Tag added to contact
- contact.updated: Contact field changed
- manual: Enrolled manually by a user or another workflow

CONTENT GUIDELINES:
- Write actual message content, not placeholders
- Use [Name] and [FirstName] for personalization
- SMS: Keep under 160 chars, conversational tone
- Email: Professional but warm, NAH brand voice
- Reference New Again Houses naturally

EXIT CONDITIONS:
- Always include a maxDays safety net
- Define goalConditions when there's a clear success metric
- Common goals: contact showed up, responded, moved to next stage, completed Trainual

RULES:
- Always ask clarifying questions before generating a draft
- Generate the FULL workflow in one tool call (not step by step)
- For complex needs, recommend multiple workflows organized logically
- Keep workflows focused — one goal per workflow
- Default to requires_confirmation: true for SMS/email (DRC pattern)`;

// ═══════════════════════════════════════════════════════
// Tool definitions
// ═══════════════════════════════════════════════════════

const BUILDER_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "generate_workflow_draft",
    description:
      "Generate a complete workflow draft from the user's description. Returns a structured WorkflowDraft JSON that the frontend renders as a visual preview. Call this when you have enough information to design the workflow.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Workflow name (e.g. 'Call Reminder: Discovery')" },
        description: { type: "string", description: "One-line description of what this workflow does" },
        workflowType: {
          type: "string",
          description: "Category (e.g. 'call_reminder', 'new_lead_nurture', 'follow_up')",
        },
        triggerConfig: {
          type: "object",
          properties: {
            event: { type: "string", description: "GHL webhook event type" },
            conditions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  operator: {
                    type: "string",
                    enum: ["equals", "not_equals", "contains", "in", "not_empty", "empty", "greater_than", "less_than"],
                  },
                  value: {},
                },
                required: ["field", "operator", "value"],
              },
            },
            description: { type: "string", description: "Human-readable trigger description" },
          },
          required: ["event", "conditions", "description"],
        },
        exitConditions: {
          type: "object",
          properties: {
            maxDays: { type: "number" },
            goalConditions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  operator: { type: "string" },
                  value: {},
                },
                required: ["field", "operator", "value"],
              },
            },
            description: { type: "string" },
          },
          required: ["maxDays", "goalConditions", "description"],
        },
        primaryMetric: { type: "string", description: "Key metric to track (e.g. 'Show-up rate', 'Response rate')" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "number" },
              stepNumber: { type: "number" },
              stepType: {
                type: "string",
                enum: [
                  "sms",
                  "email",
                  "chad_call_task",
                  "appointment",
                  "send_reminder",
                  "internal_note",
                  "add_tag",
                  "remove_tag",
                  "update_contact",
                  "pipeline_move",
                  "trigger_workflow",
                  "condition_check",
                  "team_notify",
                  "trainual_check",
                ],
              },
              content: { type: ["string", "null"], description: "Message content, task title, or note text" },
              subject: { type: ["string", "null"], description: "Email subject line (email only)" },
              sendTime: { type: ["string", "null"], description: "Time to send (e.g. '09:00')" },
              requiresConfirmation: { type: "boolean", description: "True for SMS/email (DRC pattern)" },
              actionParams: { type: "object", description: "Extra params for GHL actions (tags, fields, etc.)" },
            },
            required: ["dayNumber", "stepNumber", "stepType", "content", "requiresConfirmation"],
          },
        },
      },
      required: ["name", "description", "workflowType", "triggerConfig", "exitConditions", "primaryMetric", "steps"],
    },
  },
  {
    name: "modify_workflow_draft",
    description:
      "Modify the current workflow draft based on the user's change request. Returns the full updated WorkflowDraft. The current draft is provided in the system prompt.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        workflowType: { type: "string" },
        triggerConfig: { type: "object" },
        exitConditions: { type: "object" },
        primaryMetric: { type: "string" },
        steps: { type: "array" },
      },
      required: ["name", "description", "workflowType", "triggerConfig", "exitConditions", "primaryMetric", "steps"],
    },
  },
  {
    name: "lookup_workflow_context",
    description:
      "Fetch an existing workflow's details for editing. Returns the workflow metadata and all steps. Use this when the user wants to edit an existing workflow.",
    input_schema: {
      type: "object" as const,
      properties: {
        workflowId: { type: "string", description: "The workflow ID to fetch" },
      },
      required: ["workflowId"],
    },
  },
];

// ═══════════════════════════════════════════════════════
// Tool execution
// ═══════════════════════════════════════════════════════

async function executeBuilderTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<{ data: string; workflowDraft?: WorkflowDraft }> {
  switch (toolName) {
    case "generate_workflow_draft":
    case "modify_workflow_draft": {
      const draft: WorkflowDraft = {
        name: String(input.name),
        description: String(input.description),
        workflowType: String(input.workflowType),
        triggerConfig: input.triggerConfig as WorkflowDraft["triggerConfig"],
        exitConditions: input.exitConditions as WorkflowDraft["exitConditions"],
        primaryMetric: String(input.primaryMetric),
        steps: (input.steps as Array<Record<string, unknown>>).map((s, i) => ({
          dayNumber: Number(s.dayNumber),
          stepNumber: Number(s.stepNumber ?? i + 1),
          stepType: String(s.stepType) as WorkflowStepType,
          content: s.content != null ? String(s.content) : null,
          subject: s.subject != null ? String(s.subject) : null,
          sendTime: s.sendTime != null ? String(s.sendTime) : null,
          requiresConfirmation: Boolean(s.requiresConfirmation),
          actionParams: s.actionParams as Record<string, unknown> | undefined,
        })),
      };

      return {
        data: JSON.stringify({ success: true, draft }),
        workflowDraft: draft,
      };
    }

    case "lookup_workflow_context": {
      const supabase = createServerClient();
      const workflowId = String(input.workflowId);

      const { data: workflow } = await supabase.from("workflows").select("*").eq("id", workflowId).single();

      if (!workflow) {
        return { data: JSON.stringify({ error: "Workflow not found" }) };
      }

      const { data: steps } = await supabase
        .from("workflow_steps")
        .select("*")
        .eq("workflow_version_id", workflow.current_version_id)
        .order("day_number", { ascending: true })
        .order("step_number", { ascending: true });

      return {
        data: JSON.stringify({
          workflow: {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            workflowType: workflow.workflow_type,
            triggerType: workflow.trigger_type,
            triggerConfig: workflow.trigger_config,
            exitConditions: workflow.exit_conditions,
            status: workflow.status,
            healthScore: workflow.health_score,
            primaryMetric: workflow.primary_metric_name,
          },
          steps: (steps ?? []).map((s: Record<string, unknown>) => ({
            id: s.id,
            dayNumber: s.day_number,
            stepNumber: s.step_number,
            stepType: s.step_type,
            content: s.content,
            subject: s.subject,
            sendTime: s.send_time,
            requiresConfirmation: s.requires_confirmation,
            conditionConfig: s.condition_config,
          })),
        }),
      };
    }

    default:
      return { data: JSON.stringify({ error: `Unknown tool: ${toolName}` }) };
  }
}

// ═══════════════════════════════════════════════════════
// Main conversation turn
// ═══════════════════════════════════════════════════════

export interface BuilderTurnInput {
  messages: Anthropic.Messages.MessageParam[];
  userId: string;
  userName: string;
  currentDraft?: WorkflowDraft;
  workflowId?: string;
}

export interface BuilderTurnResult {
  responseText: string;
  workflowDraft?: WorkflowDraft;
  updatedMessages: Anthropic.Messages.MessageParam[];
}

export async function runWorkflowBuilderTurn(input: BuilderTurnInput): Promise<BuilderTurnResult> {
  const client = createAnthropicClient();

  // Build system prompt with optional current draft context
  const systemParts = [BUILDER_SYSTEM_PROMPT];

  if (input.currentDraft) {
    systemParts.push(
      `CURRENT DRAFT (the user is iterating on this — modify it when they request changes):\n${JSON.stringify(input.currentDraft, null, 2)}`
    );
  }

  if (input.workflowId) {
    systemParts.push(
      `EDIT MODE: The user wants to modify an existing workflow (ID: ${input.workflowId}). Use lookup_workflow_context to fetch its current state before making changes.`
    );
  }

  const systemPrompt = systemParts.join("\n\n");

  let messages: Anthropic.Messages.MessageParam[] = [...input.messages];
  let workflowDraft: WorkflowDraft | undefined;
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const startTime = Date.now();
    let response: Anthropic.Messages.Message;

    try {
      response = await client.messages.create({
        model: BUILDER_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: BUILDER_TOOLS,
        messages,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown API error";
      logLLMCall({
        userId: input.userId,
        model: BUILDER_MODEL,
        inputMessages: messages,
        toolsProvided: BUILDER_TOOLS.map((t) => t.name),
        responseContent: [],
        toolCallsMade: [],
        tokensInput: 0,
        tokensOutput: 0,
        latencyMs: Date.now() - startTime,
        error: errorMsg,
        iteration: iterations,
        caller: "workflow_builder",
      }).catch(() => {});
      throw err;
    }

    const latencyMs = Date.now() - startTime;
    const toolCallNames = response.content
      .filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use")
      .map((b) => b.name);

    logLLMCall({
      userId: input.userId,
      model: BUILDER_MODEL,
      inputMessages: messages,
      toolsProvided: BUILDER_TOOLS.map((t) => t.name),
      responseContent: response.content as unknown[],
      toolCallsMade: toolCallNames,
      tokensInput: response.usage?.input_tokens ?? 0,
      tokensOutput: response.usage?.output_tokens ?? 0,
      latencyMs,
      iteration: iterations,
      caller: "workflow_builder",
    }).catch(() => {});

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeBuilderTool(block.name, block.input as Record<string, unknown>);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result.data,
          });

          if (result.workflowDraft) {
            workflowDraft = result.workflowDraft;
          }
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Final response
    messages.push({ role: "assistant", content: response.content });

    const textBlock = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");

    return {
      responseText: textBlock?.text ?? "I wasn't able to generate a response. Please try again.",
      workflowDraft,
      updatedMessages: messages,
    };
  }

  return {
    responseText: "I ran into an issue (too many tool calls). Please try rephrasing.",
    workflowDraft,
    updatedMessages: messages,
  };
}
