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
];
