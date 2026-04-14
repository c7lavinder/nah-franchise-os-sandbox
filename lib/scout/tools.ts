/** Scout tool definitions for Claude's tool-use API */

import type { ScoutToolDefinition } from "@/types/scout";

/** All tools available to Scout during conversations */
export const SCOUT_TOOLS: ScoutToolDefinition[] = [
  {
    name: "get_contact",
    description:
      "Fetch a single contact from GHL by their contact ID. Returns full contact details including name, email, phone, tags, source, and custom fields.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "search_contacts",
    description:
      "Search for contacts in GHL by name, email, or phone number. Returns a list of matching contacts.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search term — can be a name, email address, or phone number",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_pipeline",
    description:
      "Get the current state of the franchise sales pipeline. Returns all opportunities (leads) organized by pipeline stage.",
    input_schema: {
      type: "object",
      properties: {
        pipeline_id: {
          type: "string",
          description:
            "The pipeline ID. If not provided, uses the default franchise sales pipeline.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_profile",
    description:
      "Fetch the full candidate profile for a contact — returns all custom fields across 8 categories: territory, franchise fit, financial, trainual, validation, engagement, AI scout scores, and compliance. Use this to answer questions about a prospect's qualifications, status, financial readiness, or any specific profile detail.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to fetch the profile for",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "get_next_action",
    description:
      "Analyze a contact's full context — stage, profile, last activity, missing fields, overdue calls — and return a specific recommended next action. Use this when Chad asks 'What should I do next?' or 'What's the status on this lead?' or 'Who needs attention?'. Returns: current stage, days since last touch, missing profile gaps, overdue milestones, and a clear recommended next step.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to analyze",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "draft_message",
    description:
      "Draft an SMS or email message for a contact. The message will be presented to the user for review before sending. NEVER send without user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to send the message to",
        },
        channel: {
          type: "string",
          description: "The message channel",
          enum: ["SMS", "Email"],
        },
        content: {
          type: "string",
          description: "The message content/body",
        },
        subject: {
          type: "string",
          description: "Email subject line (required for Email, ignored for SMS)",
        },
      },
      required: ["contact_id", "channel", "content"],
    },
  },
  {
    name: "draft_task",
    description:
      "Draft a task for a contact. The task will be presented to the user for review before creation. NEVER create without user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to create the task for",
        },
        title: {
          type: "string",
          description: "The task title",
        },
        due_date: {
          type: "string",
          description: "The task due date in ISO 8601 format",
        },
        description: {
          type: "string",
          description: "Optional task description with additional details",
        },
      },
      required: ["contact_id", "title", "due_date"],
    },
  },
  {
    name: "draft_stage_move",
    description:
      "Draft a pipeline stage change for a contact. The move will be presented to the user for review before execution. Pipeline rules and entry/exit criteria are enforced.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to move",
        },
        new_stage: {
          type: "string",
          description: "The name of the target pipeline stage",
        },
        reason: {
          type: "string",
          description:
            "Reason for the stage move. Required when moving to Lost/Nurture.",
        },
      },
      required: ["contact_id", "new_stage"],
    },
  },
  {
    name: "draft_profile_update",
    description:
      "Draft updates to a contact's candidate profile fields. Use this when Chad tells you new information about a prospect during chat, like 'Ryan is planning to use an SBA loan' or 'She has 5 years of flipping experience'. The update will be presented to the user for review before saving. NEVER save without user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to update",
        },
        updates: {
          type: "string",
          description: "JSON array of field updates. Each item: {\"fieldName\": \"Capital Source\", \"value\": \"SBA Loan\", \"reason\": \"Chad mentioned Ryan is pursuing SBA\"}. Use exact field names from the profile schema.",
        },
      },
      required: ["contact_id", "updates"],
    },
  },
  {
    name: "draft_eos_update",
    description:
      "Draft updates to a contact's or territory's EOS (Entrepreneurial Operating System) data. Use this when the user provides information about goals, issues, to-dos, rocks, habits, or scorecard metrics. For contacts: goals (income/lifestyle/QoL), issues, to-dos. For territories: goals, scorecard, habits, rocks, issues, to-dos, budgets. The update will be presented to the user for review before saving.",
    input_schema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          description: "Whether this update is for a 'contact' or a 'territory'",
          enum: ["contact", "territory"],
        },
        entity_id: {
          type: "string",
          description: "The contact ID (UUID) or territory slug (e.g. 'CHLTNE')",
        },
        entity_name: {
          type: "string",
          description: "Display name of the contact or territory",
        },
        section: {
          type: "string",
          description: "Which EOS section to update: goals, issues, todos, scorecard, habits, rocks, budgets, lead_channels",
        },
        updates: {
          type: "string",
          description: "JSON array of updates. Each item: {\"fieldName\": \"income_goal\", \"value\": \"$200k year 1\", \"reason\": \"Discussed on coaching call\"}",
        },
      },
      required: ["entity_type", "entity_id", "entity_name", "section", "updates"],
    },
  },
  {
    name: "draft_market_data_update",
    description:
      "Draft updates to a territory's market data fields (demographics, housing, real estate market, flip market, economy, construction, competition, financial). Use this when the user mentions market conditions, property values, flip stats, contractor costs, competition, or any territory-level market intelligence. The update will be presented to the user for review before saving.",
    input_schema: {
      type: "object",
      properties: {
        territory_slug: {
          type: "string",
          description: "The territory slug (e.g. 'CHLTNE')",
        },
        territory_name: {
          type: "string",
          description: "Display name of the territory",
        },
        updates: {
          type: "string",
          description: "JSON array of field updates. Each item: {\"fieldName\": \"median_home_value\", \"value\": \"285000\", \"reason\": \"Updated from latest Zillow data discussed\"}. Use field names from the market data registry.",
        },
      },
      required: ["territory_slug", "territory_name", "updates"],
    },
  },
  {
    name: "get_schedule",
    description:
      "Get upcoming appointments and scheduled events within a date range.",
    input_schema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start of the date range in ISO 8601 format",
        },
        end_date: {
          type: "string",
          description: "End of the date range in ISO 8601 format",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "search_knowledge",
    description:
      "Search the NAH franchise knowledge base for information about the brand, pipeline process, objection handling, competitors, or the FDD. Use this when the user asks questions about NAH or the franchise opportunity.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for the knowledge base",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "workflow_analyze",
    description:
      "Analyze a workflow's health and get Scout's assessment. Returns health score (A–F), key metrics, top issue, and count of underperforming steps.",
    input_schema: {
      type: "object",
      properties: {
        workflow_id: {
          type: "string",
          description: "The workflow ID to analyze",
        },
      },
      required: ["workflow_id"],
    },
  },
  {
    name: "workflow_rewrite",
    description:
      "Draft 3 rewrite variants for an underperforming workflow step. Returns a diagnosis of why the step is underperforming plus 3 alternative versions with different approaches.",
    input_schema: {
      type: "object",
      properties: {
        step_id: {
          type: "string",
          description: "The workflow step ID to rewrite",
        },
        context: {
          type: "string",
          description:
            "Optional additional context about why the step is underperforming or what to focus on",
        },
      },
      required: ["step_id"],
    },
  },
  {
    name: "sequence_status",
    description:
      "Check what day of a workflow sequence a prospect is on and what's due next. Returns workflow name, current day, enrollment status, and next step details for each active enrollment.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to check enrollment status for",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "trainual_status",
    description:
      "Check a prospect's Trainual completion percentage and last activity. Returns completion %, last activity date, and whether a nudge is needed.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: {
          type: "string",
          description: "The GHL contact ID to check Trainual status for",
        },
      },
      required: ["contact_id"],
    },
  },
];
