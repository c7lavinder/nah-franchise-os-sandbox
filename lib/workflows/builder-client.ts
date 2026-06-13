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

TRIGGER EVENTS (these are the trigger event names to use in triggerConfig.event):

Internal NAH OS triggers (most common — these fire from actions inside the app):
- stage.advanced: Contact advances to a new pipeline stage in NAH OS. Use conditions to specify which pipeline and stage. Example: { field: "pipelineSlug", operator: "equals", value: "sales" } and { field: "toStageSlug", operator: "equals", value: "qualification" }
- subtask.completed: A sub-task is completed for a contact. Use conditions to match specific sub-tasks. Example: { field: "subTaskSlug", operator: "equals", value: "discovery-call" }
- subtask.logged: Any sub-task log entry is created (even partial progress on two-state tasks). Use conditions on subTaskSlug, stageSlug, pipelineSlug.
- journey.created: New journey created in a pipeline (fires when contacts are created in NAH OS with a pipeline)
- manual: Enrolled manually by a user or another workflow

GHL webhook triggers (fire when events happen in GHL):
- appointment.created: Contact books an appointment (GHL: AppointmentCreate)
- contact.created: New contact created (GHL: ContactCreate)
- contact.stage_changed: Contact moves pipeline stage in GHL (GHL: OpportunityUpdate) — prefer stage.advanced for NAH OS pipeline moves
- contact.tag_added: Tag added to contact (GHL: ContactUpdate)
- contact.updated: Contact field changed (GHL: ContactUpdate)

IMPORTANT: For NAH OS pipeline workflows, ALWAYS use stage.advanced (not contact.stage_changed). stage.advanced fires from the NAH OS pipeline UI. contact.stage_changed only fires from GHL.

CONDITION FIELDS for stage.advanced triggers:
- pipelineSlug: "sales", "followup", "onboarding", "runway"
- pipelineName: Full pipeline name like "Sales — Path to Ownership"
- toStageSlug: The stage slug being entered (e.g., "qualification", "discovery", "compliance", "awarding")
- fromStageSlug: The stage slug being left
- toStageName, fromStageName: Human-readable stage names

CONDITION FIELDS for subtask.completed / subtask.logged triggers:
- subTaskSlug: The sub-task slug (e.g., "discovery-call", "fdd-delivered", "trainual-opened")
- subTaskName: Human-readable sub-task name
- stageSlug: Stage the sub-task belongs to
- pipelineSlug: Pipeline the stage belongs to
- contentType: Type of log entry ("note", "call", "file", etc.)

TRIGGER RULES:
- NEVER use a vague trigger like just "contact.stage_changed". Always add conditions specifying the pipeline and stage.
- The trigger description MUST be specific and human-readable: "When a new journey is created in Path to Ownership pipeline" NOT "When contact stage changes"
- For pipeline-based triggers, use conditions like: { field: "pipelineName", operator: "contains", value: "Path to Ownership" }

NAH PIPELINES:
- Sales — Path to Ownership (stages: Engagement, Qualification, Discovery, Compliance, Awarding, Closed)
- Follow-up — Long-term Re-engagement (stages: Follow-up, Nurture, Re-engaged)
- Onboarding — Path to Launch (stages: Setup, Training, Launch Prep, Onboarded)
- Runway — First Purchases (stages: First Offers, First Acquisition, Inventory Building, Runway Complete)

CONTENT GUIDELINES:
- Write actual message content, not placeholders
- Use [Name] and [FirstName] for personalization
- SMS: Keep under 160 chars, conversational tone
- Email: Professional but warm, NAH brand voice
- Reference New Again Houses naturally

EVERY STEP MUST INCLUDE ALL DETAILS:
- SMS: Full message text, senderName (who it sends from), fromNumber (sending phone number), sendTime
- Email: Subject line, full body content, senderName, senderEmail, sendTime
- Call Task: Task title (content), task description (subject), assignedTo (who does the call), dueTime (when it's due)
- All steps: sendTime is REQUIRED — specify exact time like "09:00" or "14:00"
- senderName: The team member name this comes from (e.g. "Chad", "Ryland", "Matt")
- senderEmail: For emails, the sender address (e.g. "chad@newagainhouses.com")
- fromNumber: For SMS/reminders, the SignalHouse sending phone number (e.g. "18654215344")
- assignedTo: For tasks, who is responsible (e.g. "Chad")
- dueTime: For tasks, when it's due (e.g. "same day 5:00 PM")

NAH TEAM MEMBERS (use these exact names and emails):
- Chad Arnold — primary sales rep/orchestrator, handles all prospect communication, discovery and strategy calls. Email: chad@newagainhouses.com
- Matt Lavinder — founder, handles Matt Call (discovery/vision). Email: matt@newagainhouses.com
- Ryland — admin, handles FDD and operations. Email: ryland@newagainhouses.com
- Corey Lavinder — owner/CEO. Email: corey@newagainhouses.com
- Sam Ferguson — VP Operations, handles Sam Call (validation). Email: sam@newagainhouses.com
- Mark Pate — lending partner, handles Mark Call (financing). Email: mark@newagainhouses.com

EXIT CONDITIONS (terminals):
- Always include a maxDays safety net (e.g. 30, 14, 7)
- Set goalEvent to the internal event that signals success (same event names as triggers)
- Set goalConditions to filter which specific event means the goal is met

EXIT EVENT TYPES (use for goalEvent):
- subtask.completed: A sub-task is completed. Use goalConditions with field "subTaskSlug" to match specific sub-tasks.
  Example: goalEvent="subtask.completed", goalConditions=[{field:"subTaskSlug", operator:"equals", value:"discovery-call"}]
- stage.advanced: Contact advances to a specific stage. Use goalConditions with field "toStageSlug".
  Example: goalEvent="stage.advanced", goalConditions=[{field:"toStageSlug", operator:"equals", value:"compliance"}]
- subtask.logged: Any log entry on a sub-task (even partial progress).

COMMON EXIT PATTERNS:
- "Exit when Discovery Call completed": goalEvent="subtask.completed", goalConditions=[{field:"subTaskSlug", operator:"equals", value:"discovery-call"}]
- "Exit when contact reaches Compliance": goalEvent="stage.advanced", goalConditions=[{field:"toStageSlug", operator:"equals", value:"compliance"}]
- "Exit when FDD delivered": goalEvent="subtask.completed", goalConditions=[{field:"subTaskSlug", operator:"equals", value:"fdd-delivered"}]
- "Exit after 30 days": maxDays=30, no goalEvent needed

RULES:
- Always ask clarifying questions before generating a draft — especially: who sends it, who is it assigned to, what time
- Generate the FULL workflow in one tool call (not step by step)
- EVERY field must be filled in — no nulls for sender, timing, or content
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
            goalEvent: {
              type: "string",
              description: "Internal event that signals goal achieved (e.g. 'subtask.completed', 'stage.advanced')",
            },
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
              content: {
                type: ["string", "null"],
                description: "Full message text (SMS), email body (email), or task title (task)",
              },
              subject: {
                type: ["string", "null"],
                description: "Email subject line, or task description for call tasks",
              },
              sendTime: {
                type: ["string", "null"],
                description: "Time to send/execute (e.g. '09:00', '14:00'). REQUIRED for all steps.",
              },
              senderName: {
                type: ["string", "null"],
                description: "Who this sends from — team member name (e.g. 'Chad', 'Matt')",
              },
              senderEmail: {
                type: ["string", "null"],
                description: "Sender email address for email steps (e.g. 'chad@newagainhouses.com')",
              },
              fromNumber: {
                type: ["string", "null"],
                description: "Sender phone number for SMS/reminder steps (e.g. '18654215344')",
              },
              assignedTo: {
                type: ["string", "null"],
                description: "Who the task is assigned to (for call tasks, e.g. 'Chad')",
              },
              dueTime: {
                type: ["string", "null"],
                description: "When the task is due (e.g. 'same day 5:00 PM', 'next business day 9:00 AM')",
              },
              requiresConfirmation: { type: "boolean", description: "True for SMS/email (DRC pattern)" },
              actionParams: { type: "object", description: "Extra params for GHL actions (tags, fields, etc.)" },
            },
            required: [
              "dayNumber",
              "stepNumber",
              "stepType",
              "content",
              "sendTime",
              "senderName",
              "requiresConfirmation",
            ],
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
          senderName: s.senderName != null ? String(s.senderName) : null,
          senderEmail: s.senderEmail != null ? String(s.senderEmail) : null,
          fromNumber: s.fromNumber != null ? String(s.fromNumber) : null,
          assignedTo: s.assignedTo != null ? String(s.assignedTo) : null,
          dueTime: s.dueTime != null ? String(s.dueTime) : null,
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
