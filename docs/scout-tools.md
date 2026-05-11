---
Last verified: 2026-04-27
Source: code (lib/scout/tools.ts)
---

# Scout Tools — Catalog

Scout has 21 tools defined in `lib/scout/tools.ts`, executed in `lib/scout/executor.ts`.

---

## Read tools (no side effects)

| Tool               | Input                           | Returns                                          | Notes                                            |
| ------------------ | ------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `get_entity`       | entityType, entityId            | Full entity record (contact, territory, journey) | Primary lookup tool                              |
| `query`            | table, filters, select, limit   | Raw Supabase query results                       | Flexible data access                             |
| `aggregate`        | table, filters, groupBy, metric | Aggregated counts/sums                           | For dashboard-style questions                    |
| `search_contacts`  | query (name/email/phone)        | Matching contacts                                | Fuzzy search                                     |
| `get_pipeline`     | pipelineSlug?                   | Pipeline stages + contact counts                 | Overview of all pipelines                        |
| `get_next_action`  | contactId                       | Recommended next step for a contact              | Uses stage + sub-task state                      |
| `get_schedule`     | userId?, days?                  | Upcoming appointments from GHL                   | Calendar integration                             |
| `search_knowledge` | query                           | Matching KB documents by keyword                 | Knowledge base search                            |
| `workflow_analyze` | workflowId                      | Health score (A-F) + diagnosis                   | Workflow intelligence                            |
| `workflow_rewrite` | workflowId, stepId, context     | 3 rewrite variants                               | AI-suggested improvements                        |
| `trainual_status`  | contactId                       | Trainual completion % + last activity            | PTO tracking                                     |
| `describe_data`    | table?                          | Table list + key columns + row counts            | Self-awareness — use before claiming data access |

## Draft tools (produce actions for human review — DRC pattern)

| Tool                       | Input                                    | Produces                                                 | Notes                          |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `draft_message`            | contactId, channel, content              | Message draft (SMS or Email)                             | Human confirms before send     |
| `draft_task`               | contactId, title, description, dueDate   | GHL task draft                                           | Human confirms before create   |
| `draft_stage_move`         | contactId, newStage                      | Pipeline stage move draft                                | Enforces stage move rules      |
| `draft_profile_update`     | contactId, fields[]                      | Profile field update draft                               | Updates candidate intelligence |
| `draft_eos_update`         | entityType, entityId, section, updates[] | EOS data update draft                                    | Contact or territory EOS       |
| `draft_market_data_update` | territorySlug, fields[]                  | Territory market data draft                              | Market research updates        |
| `draft_journey_action`     | kind, contactId, ...                     | Journey action draft (enroll/pause/resume/exit workflow) | Workflow management            |
| `draft_appointment`        | contactId, title, startTime, endTime     | GHL appointment draft                                    | Calendar scheduling            |
| `draft_note`               | contactId, body                          | GHL note draft                                           | Contact notes                  |
| `draft_trigger_workflow`   | contactId, workflowName                  | GHL workflow trigger draft                               | External workflow triggers     |

---

## How to add a new tool

Three files must be updated in coordination:

### 1. Define the tool schema — `lib/scout/tools.ts`

Add a new entry to the `tools` array:

```ts
{
  name: "your_tool_name",
  description: "What Scout sees — be specific about when to use this tool",
  input_schema: {
    type: "object",
    properties: { /* ... */ },
    required: ["param1"],
  },
}
```

### 2. Implement execution — `lib/scout/executor.ts`

Add a `case` in the tool executor switch:

```ts
case "your_tool_name": {
  const { param1 } = input as { param1: string };
  // ... do work
  return { result: "data" };
}
```

### 3. Document — `docs/scout-tools.md`

Add the tool to the appropriate table above with its input, output, and notes.

### Testing

After adding a tool, test it by asking Scout a question that should trigger it. Check Vercel function logs for the tool call and result.
