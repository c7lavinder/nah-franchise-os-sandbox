---
Last verified: 2026-07-02
Source: code (lib/scout/tools.ts)
---

# Scout Tools — Catalog

Scout has 38 tools defined in `lib/scout/tools.ts`, executed in `lib/scout/tool-executor.ts`.

---

## Read tools (no side effects)

- `get_entity` — full entity record for contact, territory, journey, or opportunity.
- `query` — filtered rows for supported collections. Acquisitions entities: `inventory` (post-purchase values; `Inv_*MostMature` columns are the current best ARV/budget/price), `properties` (raw per-stage evaluations), `calculations` (most-mature `Calculated_Arv` / `Calculated_ConstructionBudget` / `Calculated_MaxOffer` plus `Calculated_StageMaturity`), `royalty`.
- `aggregate` — counts, sums, averages, min/max, and group-bys. ARV/budget aggregations use `calculations` fields or inventory `Inv_*MostMature` fields — Stage1 fields are the least mature estimates.
- `search_contacts` — fuzzy contact lookup by name, email, or phone.
- `get_pipeline` — pipeline structure and open opportunities.
- `get_next_action` — recommendation engine for one contact.
- `get_schedule` — upcoming appointments for a date range.
- `get_calendar_availability` — open slots on a named calendar.
- `get_contact_insights` — prospect analytics by lens.
- `get_contact_calls` — call history, grades, summaries, and pending action items.
- `get_tasks` — open contact tasks.
- `complete_task` — completes an existing task when explicitly requested.
- `search_knowledge` — hybrid KB search with source results.
- `search_transcripts` — semantic search across call transcripts.
- `search_documents` — semantic search across uploaded journey documents.
- `get_journey_documents` — uploaded document metadata and extracted text.
- `workflow_analyze` — workflow health score and diagnosis.
- `workflow_rewrite` — rewrite variants for an underperforming workflow step.
- `trainual_status` — Trainual completion, activity, and nudge state.
- `territory_performance` — territory KPIs from operational data.
- `network_benchmarks` — network averages, high performers, rankings, and totals.
- `compare_territories` — side-by-side comparison for 2-5 territories.
- `coaching_performance` — coaching-call performance by coach: coached-call count, avg coaching score (0-100), score range, recent calls. Optional `coach` filter; only calls with a coaching evaluation are counted.
- `describe_data` — database table/column inventory and row counts.
- `get_compliance` — FDD, agreement, training, registration, background check, and insurance status.

## Draft tools (produce actions for human review — DRC pattern)

- `draft_message` — SMS or email draft.
- `draft_task` — task draft with due date and optional assignee.
- `draft_stage_move` — pipeline stage change draft.
- `draft_profile_update` — candidate profile field update draft.
- `draft_eos_update` — contact or territory EOS update draft.
- `draft_market_data_update` — territory market data update draft.
- `draft_journey_action` — workflow enroll, pause, resume, or exit draft.
- `draft_appointment` — calendar appointment draft.
- `draft_note` — contact note draft.
- `draft_trigger_workflow` — external/native workflow trigger draft.
- `draft_knowledge_doc` — KB document suggestion for admin review.
- `draft_sub_task_log` — pipeline sub-task milestone log draft.
- `draft_compliance_update` — compliance record update draft.

## Send safety contract

Scout may draft SMS/email content, but `/api/scout/action` only executes actions posted with `status: "confirmed"`. Customer-facing sends are logged as `approved_for_execution` before the GHL provider call, then logged again with the execution result.

Required gates are defined in `lib/ghl/action-safety.ts`: human approval, immutable action log, quiet hours, suppression list, daily send cap, approved template, and provider health. Phase 4 records these gates as structured metadata; future policy work should fill the gate outcomes before enabling any autonomous sends.

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

### 2. Implement execution — `lib/scout/tool-executor.ts`

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
