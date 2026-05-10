# FranDev Marketing Dashboard — Integration Plan

> Internal dashboard page within NAH OS that connects marketing spend to franchise performance.
> Goal: Find more people like our best franchisees.

---

## What This Dashboard Does

The FranDev Marketing Dashboard closes the loop between **marketing dollars spent** and **franchisee performance**. It answers:

1. **Who are our best franchisees?** (profile traits, Zorakle scores, financials, motivation)
2. **Where did they come from?** (which ad channel, campaign, referral source)
3. **How do we find more of them?** (targeting criteria, lookalike profiles, budget allocation)
4. **Is our spend working?** (cost per lead, cost per franchisee, cost per HIGH PERFORMER)

---

## The Closed Loop

```
ACQUIRE ──> CONVERT ──> ONBOARD ──> PERFORM ──> LEARN ──> ACQUIRE (repeat)

Marketing    Sales       Territory    Houses       Profile     Better
spend        pipeline    awarded      purchased    the         targeting
generates    converts    to new       and graded   winners     and spend
leads        leads       franchisee   quarterly    traits      allocation
```

### Data Flow (Two-Way)

**Marketing Dashboard --> NAH OS (inbound)**

- New leads from ad forms --> contacts table
- Ad spend data --> marketing_spend table (new)
- Campaign attribution --> contacts.lead_source_detail, UTM fields
- Marketing channel performance --> feed back into lead source tracking

**NAH OS --> Marketing Dashboard (outbound via API)**

- Pipeline conversion rates by source
- High performer profiles (what traits predict success)
- Territory performance by lead source origin
- ROI per channel (spend --> franchisee --> houses purchased)

---

## What Already Exists in Supabase

### Lead/Contact Data

| Table                  | Key Fields                                                                                                                     | Purpose                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `contacts`             | `opportunity_source`, `sub_source`, `lead_source_detail`                                                                       | Where the lead came from                               |
| `lead_sources`         | `name`, `sort_order`                                                                                                           | Reference: Paid Ad, Organic, Referral, Event, Outbound |
| `lead_sub_sources`     | `name`, `lead_source_id`                                                                                                       | Reference: Facebook, Google, Tres Pigg, etc.           |
| `contact_profile_data` | `liquid_capital`, `net_worth_estimate`, `primary_motivation`, `definition_of_success`, `prior_re_experience`, `decision_style` | Financial + psychological profile                      |
| `contact_zorakle_data` | `eclipse_overall`, `values_type`, `work_style`, `culture`, `fit_score`                                                         | Personality assessment data                            |

### Pipeline / Journey Data

| Table                    | Key Fields                                                    | Purpose                                            |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| `journeys`               | `name`, `status`, `primary_contact_id`                        | A franchise ownership journey (1 or more contacts) |
| `journey_pipeline_state` | `pipeline_id`, `stage_id`, `is_active`, `entered_pipeline_at` | Where each journey sits in the pipeline            |
| `pipelines`              | `slug`: sales, onboarding, runway, followup                   | The 4 pipeline types                               |
| `pipeline_stages`        | `name`, `sort_order`                                          | Stages within each pipeline                        |

### Territory / Performance Data

| Table              | Key Fields                                                                   | Purpose                               |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------- |
| `territories`      | `ms_slug`, `territory_name`, `status`, `region`                              | The franchise business unit           |
| `territory_grades` | `ms_slug`, `year`, `quarter`, `houses_purchased`, `self_grade`, `john_grade` | Quarterly performance                 |
| `territory_owners` | `ms_slug`, `ghl_contact_id`, `role`, `start_date`                            | Who owns each territory               |
| `zorakle_profiles` | `ms_slug`, `eclipse_overall`, `fit_score`, `risk_flag`                       | Personality data for territory owners |

### EOS / Operations Data

| Table                         | Key Fields                                    | Purpose                            |
| ----------------------------- | --------------------------------------------- | ---------------------------------- |
| `eos_territory_budgets`       | `territory_slug`, `description`, `amount`     | Marketing budget per territory     |
| `eos_territory_lead_channels` | `territory_slug`, `channel_name`, `is_active` | Which channels each territory uses |
| `eos_territory_habits`        | `territory_slug`, `habit_key`, `grade`        | A/B/C/D/F habit grading            |

---

## What Needs to Be Built

### 1. API Endpoints (for FranDev dashboard to consume)

All endpoints live at `/api/marketing/*` and require auth.

| Endpoint                                    | Returns                                                                                                        | Source                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /api/marketing/pipeline-metrics`       | Active pipeline counts (sales, onboarding, runway), close rate                                                 | `journey_pipeline_state` + `pipelines`                                     |
| `GET /api/marketing/franchisee-metrics`     | Active franchisee count, goal (250), by region                                                                 | `territories`                                                              |
| `GET /api/marketing/performance-metrics`    | High performer count, avg houses, grade distribution                                                           | `territory_grades`                                                         |
| `GET /api/marketing/source-attribution`     | Conversion rates by lead source (Paid Ad/Google --> how many became franchisees, how many are high performers) | `contacts` + `journey_pipeline_state` + `territories` + `territory_grades` |
| `GET /api/marketing/high-performer-profile` | Aggregate traits of top franchisees (avg liquid capital, common Zorakle scores, common motivations)            | `contact_profile_data` + `contact_zorakle_data` + `territory_grades`       |

### 2. New Table: `marketing_spend` (pending Matt's input)

Need to understand where Matt's spend data lives before designing this. Possible schema:

```sql
CREATE TABLE marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,          -- 'facebook', 'google', 'linkedin', etc.
  campaign_name text,             -- optional campaign identifier
  period_start date NOT NULL,     -- month or week start
  period_end date NOT NULL,
  spend_amount numeric NOT NULL,  -- dollars spent
  leads_generated int,            -- leads attributed to this spend
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. Dashboard Page: `/frandev`

A page within NAH OS (not a separate app) with sections:

- **Pipeline Health** — active counts across all 4 pipelines, conversion funnel
- **Source Performance** — which channels produce leads, franchisees, and high performers
- **High Performer Profile** — aggregate traits of top-performing franchisees
- **Spend vs. ROI** — marketing dollars in vs. franchise performance out (needs marketing_spend table)
- **Lead Quality Score** — how closely a new lead matches the high performer profile

---

## Questions for Matt

1. **Where does ad spend data live today?** Google Ads dashboard export? Spreadsheet? A tool like Triple Whale or HubSpot?
2. **What campaign/UTM data comes with each lead?** Do leads arrive with campaign IDs, UTM parameters, or just a source name?
3. **How do leads currently enter the system?** Through GHL forms? Direct to a landing page? Manual entry?
4. **What metrics does the current FranDev dashboard show?** (So we know what to replace with real data)
5. **What's the reporting cadence?** Real-time? Daily? Weekly/monthly snapshots?

---

## Integration Approach: API Endpoints (Not Direct DB Access)

Instead of sharing Supabase credentials, NAH OS exposes read-only API endpoints that the FranDev dashboard calls. This means:

- NAH OS credentials stay private
- We control exactly what data is exposed
- Schema changes don't break the dashboard
- We can add caching, rate limiting, and auth as needed
- Two-way: inbound data (new leads, spend data) comes through POST endpoints

---

## Implementation Order

1. Build `/api/marketing/pipeline-metrics` endpoint (pipeline counts — answers Matt's immediate need)
2. Build `/api/marketing/franchisee-metrics` endpoint (active franchisee count)
3. Build `/api/marketing/performance-metrics` endpoint (high performers, grades)
4. Build `/api/marketing/source-attribution` endpoint (the money query — source to performance)
5. Build `/api/marketing/high-performer-profile` endpoint (aggregate winner traits)
6. Design `marketing_spend` table (after Matt answers spend data questions)
7. Build `/frandev` dashboard page in NAH OS
8. Connect FranDev dashboard to API endpoints
