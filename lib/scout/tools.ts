/** Scout tool definitions for Claude's tool-use API.
 *
 * Surface design philosophy: prefer a small number of general-purpose
 * data primitives (get_entity, query, aggregate) over a tool-per-question.
 * Bespoke tools only exist when they encode meaningful business logic
 * the LLM should not re-derive (next-action recommendation, KB search,
 * workflow analysis, draft-confirm gates).
 */

import type { ScoutToolDefinition } from "@/types/scout";

export const SCOUT_TOOLS: ScoutToolDefinition[] = [
  // ════════════════════════════════════════════════════════════════
  // GENERAL DATA PRIMITIVES
  // ════════════════════════════════════════════════════════════════
  {
    name: "get_entity",
    description:
      "Fetch a rich profile for a single entity. Use this for any 'tell me about X' question. " +
      "type='contact': GHL contact + intelligence score + flags + recommendations + last 5 calls + unresolved objections + active journeys. " +
      "type='territory': territory record + active owners + market data + EOS (goals/scorecard/habits/rocks/issues/todos) + active journey states. " +
      "type='journey': journey record + all attached contacts + all pipeline states (with days-in-stage) + workflow enrollments. " +
      "type='opportunity': GHL opportunity + pipeline + stage + contact ID. " +
      "Always prefer this over query() when you already know the entity ID.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Entity type",
          enum: ["contact", "territory", "journey", "opportunity"],
        },
        id: {
          type: "string",
          description:
            "Entity identifier — GHL contact ID for contact, ms_slug for territory, UUID for journey, opportunity ID for opportunity",
        },
      },
      required: ["type", "id"],
    },
  },
  {
    name: "query",
    description:
      "Filter a collection of records and return matching rows. Use this for 'show me X where Y' questions. " +
      "Supported entities: contacts, journeys, territories, opportunities, call_logs, alerts, objections, workflow_enrollments. " +
      "filters is a JSON array of {field, op, value} objects. Ops: eq, ne, gt, gte, lt, lte, in, ilike, is_null, not_null. " +
      "Each entity exposes its own filterable field set — if you use a wrong field, the error tells you what's allowed. " +
      "Defaults: limit=25 (max 100), order by updated_at desc when present.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          description: "Collection to query",
          enum: [
            "contacts",
            "journeys",
            "territories",
            "opportunities",
            "call_logs",
            "alerts",
            "objections",
            "workflow_enrollments",
          ],
        },
        filters: {
          type: "string",
          description:
            'JSON array of filter objects. Example: [{"field":"status","op":"eq","value":"active"},{"field":"created_at","op":"gte","value":"2026-04-01"}]',
        },
        order_by: {
          type: "string",
          description: 'Optional. JSON object: {"field":"created_at","direction":"desc"}',
        },
        limit: {
          type: "number",
          description: "Max rows to return (default 25, max 100)",
        },
      },
      required: ["entity"],
    },
  },
  {
    name: "aggregate",
    description:
      "Count, sum, avg, min, or max records — optionally grouped by a dimension. Use this for 'how many', 'what's the average', " +
      "'breakdown by X' questions. Lead source mix, pipeline stage distribution, conversion counts, alert counts by severity, " +
      "objection frequency by type — all flow through here. Period filter: pass {field, from, to} to bound by a date column.",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          description: "Collection to aggregate over",
          enum: ["contacts", "journeys", "territories", "call_logs", "alerts", "objections", "workflow_enrollments"],
        },
        metric: {
          type: "string",
          description: "Aggregation function",
          enum: ["count", "avg", "sum", "min", "max"],
        },
        metric_field: {
          type: "string",
          description: "Required for non-count metrics — the numeric column to reduce",
        },
        group_by: {
          type: "string",
          description:
            "Optional dimension to group by. Each entity exposes its own groupable set — wrong field returns the allowed list.",
        },
        filters: {
          type: "string",
          description: "Optional. JSON array of filter objects, same shape as query()",
        },
        period: {
          type: "string",
          description:
            'Optional period filter. JSON object: {"field":"created_at","from":"2026-04-01","to":"2026-04-30"}',
        },
      },
      required: ["entity", "metric"],
    },
  },

  // ════════════════════════════════════════════════════════════════
  // SPECIALIZED READ TOOLS — kept because they encode business logic
  // ════════════════════════════════════════════════════════════════
  {
    name: "search_contacts",
    description:
      "Substring search across GHL contacts by name, email, or phone. Use when the user names a contact " +
      "without giving an ID. Returns a small list of matches — pick the right one then call get_entity for full detail.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term — name, email, or phone",
        },
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_pipeline",
    description:
      "Get the structural definition of a pipeline (stages, names, IDs) plus its open opportunities. " +
      "Use this when the user asks 'what's in my pipeline' at the structural level. For aggregate counts, prefer aggregate().",
    input_schema: {
      type: "object",
      properties: {
        pipeline_id: {
          type: "string",
          description: "Pipeline ID. Omit for the default franchise sales pipeline.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_next_action",
    description:
      "Run the recommendation engine for one contact: stage analysis + missing profile fields + overdue milestones + " +
      "intelligence flags + top score-improvement opportunity, ending in a single recommended next step. " +
      "Use this when the user asks 'what should I do next with X' or 'who needs attention'.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "GHL contact ID",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "get_schedule",
    description: "Get upcoming GHL appointments within a date range. Use for calendar / scheduling questions.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "ISO 8601 start" },
        end_date: { type: "string", description: "ISO 8601 end" },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_contact_insights",
    description:
      "Get analytical insights across contacts — who has momentum, who's at risk, who's most engaged. " +
      "Use for broad questions like 'who should I focus on?', 'who are you excited about?', 'who's stalling?', " +
      "'top performers', 'at-risk franchisees'. Returns contacts ranked by the requested metric with call data and pipeline context.",
    input_schema: {
      type: "object",
      properties: {
        lens: {
          type: "string",
          description: "What to analyze",
          enum: ["momentum", "at_risk", "most_engaged", "stalling", "top_performers", "recent_calls"],
        },
        days: { type: "number", description: "Lookback period in days (default 90)" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["lens"],
    },
  },
  {
    name: "search_knowledge",
    description:
      "Keyword search the NAH knowledge base — brand, pipeline process, objection handling, competitors, FDD, playbooks. " +
      "Use for 'how do we approach X' / 'what's our policy on Y' questions.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "workflow_analyze",
    description:
      "Run health analysis on a marketing/onboarding workflow: health score (A-F), per-step metrics, top issue, " +
      "list of underperforming steps. Use when the user asks about a specific workflow's performance.",
    input_schema: {
      type: "object",
      properties: {
        workflow_id: { type: "string", description: "Workflow ID" },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "workflow_rewrite",
    description:
      "Generate 3 rewrite variants for a single underperforming workflow step, with diagnosis. " +
      "Use after workflow_analyze identifies a step worth improving.",
    input_schema: {
      type: "object",
      properties: {
        step_id: { type: "string", description: "Workflow step ID" },
        context: { type: "string", description: "Optional extra context for the rewrite" },
      },
      required: ["step_id"],
    },
  },
  {
    name: "trainual_status",
    description:
      "Read a prospect's Trainual completion %, last activity, framing-call status, and whether a nudge is needed. " +
      "Bespoke because the nudge logic depends on framing-call + invite-sent gating that the LLM should not re-derive.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
      },
      required: ["contact_id"],
    },
  },

  // ════════════════════════════════════════════════════════════════
  // DRAFT TOOLS — return DraftedAction for user confirmation
  // ════════════════════════════════════════════════════════════════
  {
    name: "draft_message",
    description: "Draft an SMS or email to a contact for human review. NEVER sends without confirmation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        channel: { type: "string", description: "Channel", enum: ["SMS", "Email"] },
        content: { type: "string", description: "Message body" },
        subject: { type: "string", description: "Email subject (required for Email)" },
      },
      required: ["contact_id", "channel", "content"],
    },
  },
  {
    name: "get_tasks",
    description:
      "Get open tasks for a contact from GHL. Returns task title, due date, assigned user, and status. " +
      "Use when the user asks about tasks, to-dos, or what's pending for a contact.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "complete_task",
    description:
      "Mark a GHL task as complete. Use when the user says 'check off', 'complete', 'done', or 'mark as done' for a task. " +
      "If there is only one open task for the contact, complete it without asking which one.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        task_id: {
          type: "string",
          description: "GHL task ID — if known. If not provided, completes the only open task.",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "draft_task",
    description: "Draft a NEW task for a contact for human review. NEVER creates without confirmation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        title: { type: "string", description: "Task title" },
        due_date: { type: "string", description: "ISO 8601 due date" },
        description: { type: "string", description: "Optional details" },
      },
      required: ["contact_id", "title", "due_date"],
    },
  },
  {
    name: "draft_stage_move",
    description:
      "Draft a pipeline stage change for review. Pipeline rules and entry/exit criteria are enforced server-side.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        new_stage: { type: "string", description: "Target stage name" },
        reason: { type: "string", description: "Required when moving to Lost or Nurture" },
      },
      required: ["contact_id", "new_stage"],
    },
  },
  {
    name: "draft_profile_update",
    description:
      "Draft updates to a contact's candidate profile fields (capital source, motivation, NDA status, etc). " +
      "Use when the user shares new information about a prospect.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        updates: {
          type: "string",
          description:
            'JSON array of {fieldName, value, reason}. Example: [{"fieldName":"Capital Source","value":"SBA Loan","reason":"User said Ryan is pursuing SBA"}]',
        },
      },
      required: ["contact_id", "updates"],
    },
  },
  {
    name: "draft_eos_update",
    description:
      "Draft EOS updates for a contact (goals/issues/todos) or territory (goals/issues/todos/scorecard/habits/rocks/budgets/lead_channels).",
    input_schema: {
      type: "object",
      properties: {
        entity_type: { type: "string", description: "contact | territory", enum: ["contact", "territory"] },
        entity_id: { type: "string", description: "Contact UUID or territory ms_slug" },
        entity_name: { type: "string", description: "Display name" },
        section: {
          type: "string",
          description: "EOS section: goals, issues, todos, scorecard, habits, rocks, budgets, lead_channels",
        },
        updates: {
          type: "string",
          description: "JSON array of {fieldName, value, reason}",
        },
      },
      required: ["entity_type", "entity_id", "entity_name", "section", "updates"],
    },
  },
  {
    name: "draft_market_data_update",
    description:
      "Draft updates to a territory's market data fields (demographics, housing, real estate market, flip market, etc).",
    input_schema: {
      type: "object",
      properties: {
        territory_slug: { type: "string", description: "Territory ms_slug" },
        territory_name: { type: "string", description: "Display name" },
        updates: {
          type: "string",
          description: "JSON array of {fieldName, value, reason}",
        },
      },
      required: ["territory_slug", "territory_name", "updates"],
    },
  },
  {
    name: "draft_journey_action",
    description:
      "Draft a journey-level action for human review. Kinds: " +
      "enroll_workflow (start a workflow for a contact), pause_workflow (pause an active enrollment), " +
      "resume_workflow (resume a paused one), exit_workflow (exit with reason). NEVER executes without confirmation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        kind: {
          type: "string",
          description: "Action kind",
          enum: ["enroll_workflow", "pause_workflow", "resume_workflow", "exit_workflow"],
        },
        workflow_id: { type: "string", description: "Required for enroll_workflow" },
        enrollment_id: { type: "string", description: "Required for pause/resume/exit" },
        reason: { type: "string", description: "Required for exit_workflow" },
      },
      required: ["contact_id", "kind"],
    },
  },
  {
    name: "draft_appointment",
    description:
      "Draft a GHL calendar appointment for human review. Provide your best guess at the calendar based on what the user said " +
      "(e.g., 'Matt's calendar' → match by name) — pass `calendar_hint` and the executor will resolve it to a real calendar ID. " +
      "If you can't guess, leave calendar_hint blank and the executor picks the first active calendar. The user can edit the " +
      "calendar via a searchable dropdown before pushing. Times are ISO 8601.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID the appointment is for" },
        title: { type: "string", description: "Appointment title (e.g. 'Discovery Call')" },
        start_time: { type: "string", description: "ISO 8601 start" },
        end_time: { type: "string", description: "ISO 8601 end" },
        calendar_hint: {
          type: "string",
          description:
            "Optional: a name fragment to match against active calendars (e.g. 'Matt', 'Discovery'). Executor finds the best match.",
        },
        assigned_user_id: { type: "string", description: "Optional GHL user ID to host" },
      },
      required: ["contact_id", "title", "start_time", "end_time"],
    },
  },
  {
    name: "draft_note",
    description:
      "Draft a GHL note on a contact for human review. Notes are durable record on the contact's timeline. " +
      "Use this for capturing call summaries, decisions, key facts that need to live in GHL.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        body: { type: "string", description: "Note body" },
      },
      required: ["contact_id", "body"],
    },
  },
  {
    name: "draft_trigger_workflow",
    description:
      "Draft a GHL-native workflow trigger for a contact. This fires a workflow whose automation lives in GHL itself " +
      "(drip campaigns, marketing sequences, onboarding flows). Different from draft_journey_action which manages our " +
      "internal workflow_enrollments. Use this when the user wants to start a GHL-side automation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID" },
        workflow_id: { type: "string", description: "GHL workflow ID" },
        workflow_name: { type: "string", description: "Optional display name from GHL" },
      },
      required: ["contact_id", "workflow_id"],
    },
  },
  {
    name: "draft_knowledge_doc",
    description:
      "Suggest a new knowledge base document. Use this when a user discovers a proven tactic, " +
      "objection response, playbook, or process that should be shared with the entire team. " +
      "The suggestion is submitted for ADMIN REVIEW — only admins can approve and add documents to the shared knowledge base. " +
      "Any user can suggest, but the content must be reviewed before it reaches the team. " +
      "Examples: 'Save this objection response as a playbook', 'Add this to our knowledge base', 'The team should know this'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title (e.g., 'Handling the Spouse Objection')" },
        category: {
          type: "string",
          description: "Category for the document",
          enum: [
            "objections",
            "coaching",
            "pipeline",
            "conversion_playbook",
            "territory",
            "deal_execution",
            "fdd",
            "competitors",
            "ideal_candidate",
            "marketing",
            "business_planning",
            "governance",
            "operations",
            "brand",
            "industry",
            "franchisee_playbook",
          ],
        },
        content: {
          type: "string",
          description: "The full document content — tactics, scripts, processes, or insights to share",
        },
      },
      required: ["title", "category", "content"],
    },
  },
  {
    name: "draft_sub_task_log",
    description:
      "Draft a sub-task log entry for human review. Sub-tasks are milestones within a pipeline stage " +
      "(e.g., NDA sent/signed, Matt Call scheduled/completed). Use when the user says something like " +
      "'mark the NDA as sent', 'log the Matt call as completed', 'update the PFS status'. " +
      "The sub-task state progresses through first/second states for two_state tasks, or a single completion for single-state tasks.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "GHL contact ID or Supabase contact ID" },
        sub_task_id: { type: "string", description: "Sub-task UUID" },
        state_advance: {
          type: "string",
          description: "For two_state sub-tasks: 'first' or 'second'. Omit for single-state tasks.",
          enum: ["first", "second"],
        },
        content_type: {
          type: "string",
          description: "Type of content to attach",
          enum: ["note", "file", "link"],
        },
        content_text: { type: "string", description: "Optional note text to attach to the log" },
      },
      required: ["contact_id", "sub_task_id"],
    },
  },
];
