# Data Dictionary — field meaning for Scout and other agents

One JSON file per table. Each entry defines what a column **means**, when to
use it, common misuses, and which column to prefer instead. This is the
semantic layer that raw schema (`docs/scout-schema-condensed.txt`) cannot
provide — agents read it live through the `describe_data` tool
(`lib/scout/data-dictionary.ts`).

Meanings are extracted from the MasterSuite calculation engine
(`../mastersuite/apps/analysis-api/`), which is the ground truth for every
`Calculated_*` and `Inv_*` field — the formulas define the meaning.

## Entry format

```json
"Calculated_Arv": {
  "meaning": "The current best ARV — the most mature stage evaluation wins (Stage 3 > Stage 2 > Stage 1).",
  "units": "USD",
  "use_when": "Any 'what is the ARV' question for a property not yet purchased.",
  "do_not_use_for": null,
  "prefer_instead": null,
  "source_ref": "Formulas/Arv.cs",
  "confidence": "high",
  "status": "confirmed",
  "question": null
}
```

- `confidence` — how sure the extraction is: `high` (code fully determines it),
  `medium` (inferred from naming/usage), `low` (business-policy dependent).
- `status` — `draft` (AI-extracted, unreviewed) or `confirmed` (business owner
  signed off).
- `question` — the open question for the business owner on unconfirmed
  entries, phrased as a proposal they can confirm or correct in one sentence.

## Lifecycle

1. **Draft** — an agent extracts meanings from MasterSuite source into a new
   table file, marking uncertain entries with `question`s.
2. **Review** — the business owner answers the questions (a review page is
   generated from the open questions); answers are folded back in and entries
   flip to `confirmed`.
3. **Serve** — `describe_data(table)` returns the meanings to Scout with
   `use_when` / `do_not_use_for` / `prefer_instead` guidance.
4. **Correct** — when Scout misinterprets a field in production, the fix is a
   dictionary edit **plus** a regression case in `lib/scout/smoke-evals.ts`
   (see the `data semantics` cases). Never fix a meaning with a one-off prompt
   patch — it will not survive the next prompt change.

## Validation

```bash
npx tsx scripts/validate-data-dictionary.ts
```

Checks entry shape, verifies every dictionary column exists in the
`supabase/migrations/` CREATE TABLE (drift), reports coverage gaps, and
summarizes review state (confirmed vs draft, open questions).

## Coverage

| Table                      | Scout entity   | Notes                                                      |
| -------------------------- | -------------- | ---------------------------------------------------------- |
| `ms_properties`            | `properties`   | Lead/deal record; per-stage underwriting evaluations       |
| `ms_property_calculations` | `calculations` | Calc-engine roll-ups; the authoritative most-mature values |
| `ms_property_inventory`    | `inventory`    | Post-purchase 5-tier values; `*MostMature` = current best  |

Expand one table at a time; every new file must pass the validator before
commit.
