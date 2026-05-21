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
            "Entity identifier — GHL contact ID for contact, TerritorySlug for territory, UUID for journey, opportunity ID for opportunity",
        },
      },
      required: ["type", "id"],
    },
  },
  {
    name: "query",
    description:
      "Filter a collection of records and return matching rows. Use this for 'show me X where Y' questions. " +
      "Supported entities: contacts, journeys, pipeline_entries, territories, opportunities, call_logs, alerts, objections, workflow_enrollments, " +
      "inventory (ms_property_inventory — purchase/sell dates, status), properties (ms_properties — leads, addresses, categories). " +
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
            "pipeline_entries",
            "territories",
            "opportunities",
            "call_logs",
            "alerts",
            "objections",
            "workflow_enrollments",
            "inventory",
            "properties",
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
      "objection frequency by type — all flow through here. Period filter: pass {field, from, to} to bound by a date column. " +
      "For form submission / new lead counts, use contacts filtered by ghl_date_added (the original GHL creation date). " +
      "For pipeline entry counts (leads that reached a specific stage), use pipeline_entries filtered by entered_pipeline_at. " +
      "These are different: form submissions >> pipeline entries (many leads never make it to a first call).",
    input_schema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          description: "Collection to aggregate over",
          enum: [
            "contacts",
            "journeys",
            "pipeline_entries",
            "territories",
            "call_logs",
            "alerts",
            "objections",
            "workflow_enrollments",
            "inventory",
            "properties",
          ],
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
      "Search contacts by name, email, or phone. Includes fuzzy/phonetic matching — misspellings like 'Rearson' will find 'Rierson'. " +
      "Returns a list of matches with profile context (city, state, source). If only one result matches the user's context " +
      "(name + city, name + company, etc.), proceed directly with that contact — do NOT ask the user to confirm obvious matches. " +
      "Only ask for clarification when multiple results are genuinely ambiguous. Call get_entity for full detail after resolving.",
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
    name: "get_calendar_availability",
    description:
      "Get OPEN (free) appointment slots on a specific GHL calendar within a date range. Use this BEFORE draft_appointment whenever " +
      "the user gives a vague time like 'Monday morning', 'next week', or 'this Thursday afternoon' — you need to see which slots are " +
      "actually available before drafting. If the user picks a specific time and you skip this check, you might draft on a slot that's " +
      "already booked. Match calendar_hint against calendar names (e.g. 'intro' → Intro Call). Times come back in ISO 8601 — surface " +
      "them to the user in plain English with their local timezone.",
    input_schema: {
      type: "object",
      properties: {
        calendar_hint: {
          type: "string",
          description:
            "Name fragment to match against active calendars (e.g. 'intro', 'discovery', 'validation'). Required — pick from the " +
            "calendar list in your system context.",
        },
        start_date: { type: "string", description: "ISO 8601 start of search window" },
        end_date: { type: "string", description: "ISO 8601 end of search window" },
        timezone: {
          type: "string",
          description:
            "Optional IANA timezone (e.g. 'America/Chicago'). Defaults to the calendar's configured timezone if omitted.",
        },
      },
      required: ["calendar_hint", "start_date", "end_date"],
    },
  },
  {
    name: "get_contact_insights",
    description:
      "Get analytical insights across franchise PROSPECTS (candidates in the sales pipeline) — who has momentum, who's at risk, who's most engaged. " +
      "Use for questions about PROSPECTS like 'who should I focus on?', 'who are you excited about?', 'who's stalling?'. " +
      "Returns prospect lead scores and pipeline context. " +
      "IMPORTANT: This tool is for PROSPECTS only — NOT active franchisees. If the user asks about franchisee performance, " +
      "territory acquisitions, or pushing existing franchise owners, use network_benchmarks and territory_performance instead.",
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
    name: "get_contact_calls",
    description:
      "Get call history for a contact. Returns recent calls with title, date, duration, type, grade, AI summary, and key action items. " +
      "Use this when asked about a contact's call history, recent conversations, or coaching progress.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "GHL contact ID or Supabase UUID",
        },
      },
      required: ["contact_id"],
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
    name: "get_journey_documents",
    description:
      "Get uploaded documents for a journey (PFS, Zorakle profile, franchise agreement, etc.). " +
      "Returns document metadata and extracted text content. Use when the user asks about a prospect's " +
      "financial statement, personality profile, LLC info, or any uploaded document.",
    input_schema: {
      type: "object",
      properties: {
        journey_id: {
          type: "string",
          description: "Journey UUID",
        },
        contact_id: {
          type: "string",
          description: "Contact UUID or GHL contact ID — used to find the journey if journey_id is not known",
        },
      },
      required: [],
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
        entity_id: { type: "string", description: "Contact UUID or territory TerritorySlug" },
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
        TerritorySlug: { type: "string", description: "Territory TerritorySlug" },
        Nickname: { type: "string", description: "Display name" },
        updates: {
          type: "string",
          description: "JSON array of {fieldName, value, reason}",
        },
      },
      required: ["TerritorySlug", "Nickname", "updates"],
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
      "Draft a GHL calendar appointment for human review. ALWAYS pass `calendar_hint` — pick from the calendar list in your system " +
      "context based on the type of meeting (e.g. 'intro' for new prospects, 'discovery' for qualification, 'validation' for talking " +
      "to existing franchisees, 'chad onboarding' for newly awarded franchisees). The executor fuzzy-matches the hint against active " +
      "calendar names. If you give a vague time without checking availability first, call `get_calendar_availability` BEFORE this tool " +
      "so you draft on a slot that's actually open. Times are ISO 8601. After drafting, an inline card with a green Confirm button " +
      "appears in chat — remind the user to click it; do not claim success from a chat reply alone.",
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
            "REQUIRED calendar TYPE name to match (e.g. 'Intro Call', 'Discovery Call', 'FDD Review Call', 'Chad Coaching'). " +
            "Must be the calendar name from your CALENDAR_CONTEXT, NOT a person's name or contact name. " +
            "The executor fuzzy-matches this against active GHL calendar names.",
        },
        assigned_user_id: { type: "string", description: "Optional GHL user ID to host" },
      },
      required: ["contact_id", "title", "start_time", "end_time", "calendar_hint"],
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

  // ════════════════════════════════════════════════════════════════
  // MASTERSUITE PERFORMANCE — franchise operations data
  // ════════════════════════════════════════════════════════════════
  {
    name: "territory_performance",
    description:
      "Get franchise territory performance KPIs from MasterSuite operational data. Returns: purchases, sales, profit, " +
      "cycle times, lead funnel (S1→S6), active inventory, and lead category breakdown for a specific territory. " +
      "Use when asked 'how is [territory] doing?', 'what are the numbers for [territory]?', 'show me [territory] performance'. " +
      "Also use for social proof in sales conversations — e.g., 'what does success look like in a territory like this?'",
    input_schema: {
      type: "object",
      properties: {
        TerritorySlug: {
          type: "string",
          description: "Territory slug (e.g., 'spokane-wa')",
        },
        period: {
          type: "string",
          description: "Time period: t1 (1 month), t3 (3 months, default), t12 (12 months), ytd, all",
          enum: ["t1", "t3", "t12", "ytd", "all"],
        },
      },
      required: ["TerritorySlug"],
    },
  },
  {
    name: "network_benchmarks",
    description:
      "Get network-wide performance benchmarks across all active franchise territories. Returns: " +
      "average/median purchases, sales, profit, cycle days + high performer list + territory rankings + " +
      "network totals. Use for benchmarking a specific territory against peers, answering 'how does [territory] " +
      "compare?', 'what do high performers look like?', 'what's the network average?', 'who are the top territories?'. " +
      "Also use when coaching franchisees — compare their metrics to high performer benchmarks to identify gaps.",
    input_schema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Time period: t3 (3 months), t12 (12 months, default), ytd, all",
          enum: ["t3", "t12", "ytd", "all"],
        },
      },
      required: [],
    },
  },

  {
    name: "compare_territories",
    description:
      "Compare 2-5 franchise territories side-by-side on key performance metrics. Returns: purchases, sales, profit, " +
      "cycle time, active inventory, conversion rate, high performer status, and EOS habits for each territory. " +
      "Use when asked 'compare X and Y', 'how does X stack up against Y?', 'what's the difference between these territories?'. " +
      "Also use to identify what a high performer does differently from a struggling territory.",
    input_schema: {
      type: "object",
      properties: {
        slugs: {
          type: "string",
          description: 'JSON array of 2-5 TerritorySlug values. Example: ["spokane-wa","boise-id","portland-or"]',
        },
        period: {
          type: "string",
          description: "Time period: t3 (3 months), t12 (12 months, default), ytd, all",
          enum: ["t3", "t12", "ytd", "all"],
        },
      },
      required: ["slugs"],
    },
  },

  {
    name: "describe_data",
    description:
      "List all 156 database tables with their columns and row counts. Use this BEFORE claiming you don't have " +
      "access to certain data — check first. Covers: contacts, territories, calls, pipeline stages, EOS, " +
      "MasterSuite properties, intelligence scores, Trainual, compliance, workflows, and more. " +
      "Pass a table name for detailed column info, or omit to see the full schema overview.",
    input_schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description:
            "Optional: specific table name to describe (e.g., 'ms_property_inventory'). Omit to get an overview of all tables.",
        },
      },
      required: [],
    },
  },

  // ════════════════════════════════════════════════════════════════
  // COMPLIANCE
  // ════════════════════════════════════════════════════════════════
  {
    name: "get_compliance",
    description:
      "Get compliance tracking data for a contact — FDD disclosure status, 14-day cooling period, " +
      "state registration, franchise agreement, training progress, background check. Use when asked " +
      "'Has this prospect received their FDD?', 'When does the cooling period end?', 'Is training complete?'",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Supabase contact UUID" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "draft_compliance_update",
    description:
      "Draft a compliance record update for human review. Use when the user says " +
      "'Mark FDD as issued', 'Log agreement signed', 'Update training to 5 of 8 modules complete'. " +
      "Supports: fdd_issued_at, fdd_acknowledged_at, fdd_version, fdd_state, " +
      "franchise_agreement_sent_at, franchise_agreement_signed_at, " +
      "training_started_at, training_completed_at, training_modules_completed, training_modules_total, " +
      "background_check_status, insurance_verified_at, state_registration_status.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "Supabase contact UUID" },
        updates: {
          type: "object",
          description: "Key-value pairs of fields to update. Date fields use ISO 8601 format.",
        },
        reason: { type: "string", description: "Brief reason for the update" },
      },
      required: ["contact_id", "updates"],
    },
  },
];
