# GHL Sub-Account Manual Setup Guide

**Location ID:** `0WYp7DssxULm1SJYaOsz`

---

> **CRITICAL WARNING — READ THIS BEFORE DOING ANYTHING**
>
> This GHL sub-account already has **existing OLD pipelines** and **27 existing leads** in the system.
>
> **DO NOT** delete anything that already exists.
> **DO NOT** rename anything that already exists.
> **DO NOT** modify or edit anything that already exists.
> **DO NOT** touch, merge, or move any existing leads.
>
> You are **ONLY creating new things alongside what already exists.** The old pipelines and leads stay exactly where they are. Leave them alone entirely.

---

## 1. Create Three New Pipelines

Go to **GHL -> Opportunities -> Pipelines -> "Create Pipeline"**

You will create three separate pipelines. Each one has its own set of stages listed below. Create them in the exact order shown.

### Pipeline 1: NAH Franchise Sales — Active

Name it exactly: **NAH Franchise Sales — Active**

Add these 12 stages in this exact order (top to bottom):

1. New Lead
2. Contacted
3. Qualified
4. Discovery Scheduled
5. Discovery Complete
6. Validation
7. Compliance Gate
8. Application + Approval
9. FDD Issued
10. Decision Call
11. Award + Agreement
12. Funds Received

### Pipeline 2: NAH Franchise Sales — Long-Term

Name it exactly: **NAH Franchise Sales — Long-Term**

Add these 3 stages in this exact order:

1. Follow-up
2. Nurture
3. Re-engaged

### Pipeline 3 — NOT NEEDED

Won and Lost are handled as **opportunity statuses** in GHL, not a separate pipeline. Do not create a third pipeline.

---

## 2. Create Contact Custom Fields

Go to **GHL -> Settings -> Custom Fields -> Contacts**

Click "Add Field" for each one below. Use the exact name, type, and options listed.

| Field Name | Field Type | Dropdown Options (if applicable) |
|---|---|---|
| Lead Source Detail | Text | — |
| Territory Interest | Text | — |
| Territory Status | Dropdown | Available, Waitlist, Unavailable, Confirmed |
| Capital Availability | Dropdown | Confirmed, Needs Verification, Unknown |
| Investment Timeline | Dropdown | Under 6 months, 6-12 months, 12+ months |
| Business Ownership Experience | Dropdown | Yes, No |
| Motivation Clarity | Dropdown | Strong, Moderate, Weak |
| Scout Lead Score | Number | — |
| Trainual Access Sent | Checkbox | — |
| Trainual Completion Percent | Number | — |
| Framing Call Logged | Checkbox | — |
| NDA Status | Dropdown | Not Sent, Sent, Signed |
| OpenClaw Enriched | Checkbox | — |

**How to create each one:**

1. Click "Add Field"
2. Type the exact field name from the table above
3. Select the field type from the table above
4. If it is a Dropdown, add each option listed in the table — one option per line, in the order shown
5. Click Save
6. Move on to the next field

---

## 3. Create Opportunity Custom Fields

Go to **GHL -> Settings -> Custom Fields -> Opportunities**

Click "Add Field" for each one below. Use the exact name, type, and options listed.

| Field Name | Field Type | Dropdown Options (if applicable) |
|---|---|---|
| Discovery Scorecard Score | Number | — |
| Validation Call 1 Complete | Checkbox | — |
| Validation Call 2 Complete | Checkbox | — |
| Validation Call 3 Complete | Checkbox | — |
| Compliance Gate Passed | Checkbox | — |
| FDD Issued Date | Date | — |
| FDD 14-Day Unlocks | Date | — |
| Loss Reason | Dropdown | Not qualified financially, No available territory, Chose a competitor franchise, Completely unresponsive, Changed mind, Bad fit, Timing — moved to Nurture, Other |
| Days in Current Stage | Number | — |

**How to create each one:**

1. Click "Add Field"
2. Type the exact field name from the table above
3. Select the field type from the table above
4. If it is a Dropdown, add each option listed in the table — one option per line, in the order shown
5. Click Save
6. Move on to the next field

---

## 4. Create Three Calendars

Go to **GHL -> Calendars -> "Create Calendar"**

Create each calendar with the settings below.

### Calendar 1: Chad — Discovery Calls

- **Name:** Chad — Discovery Calls
- **Duration:** 60 minutes
- **Availability:** Monday through Friday, 9:00 AM to 5:00 PM Eastern Time
- **Time Zone:** US/Eastern (ET)

### Calendar 2: Construction Coach Intro Calls

- **Name:** Construction Coach Intro Calls
- **Duration:** 30 minutes
- **Availability:** Monday through Friday, 9:00 AM to 5:00 PM Eastern Time
- **Time Zone:** US/Eastern (ET)

### Calendar 3: Lending Partner Calls

- **Name:** Lending Partner Calls
- **Duration:** 30 minutes
- **Availability:** Monday through Friday, 9:00 AM to 5:00 PM Eastern Time
- **Time Zone:** US/Eastern (ET)

---

## 5. Create Ten Workflows with Inbound Webhook Triggers

Go to **GHL -> Automation -> Workflows -> "Create Workflow" -> Start from scratch**

You will create 10 workflows total. For EVERY single one, the trigger must be set to **Inbound Webhook**. Here is the exact process for each:

1. Click "Create Workflow"
2. Select "Start from scratch"
3. Name the workflow using the exact name below
4. Click on the trigger box (the first step in the workflow)
5. Select **"Inbound Webhook"** as the trigger type
6. **IMMEDIATELY copy the webhook URL** that GHL generates — you will need this later
7. Save the workflow
8. Repeat for the next workflow

### The 10 Workflows to Create

| # | Workflow Name |
|---|---|
| 1 | New Lead Welcome |
| 2 | Active Follow-up Sequence |
| 3 | Qualified Lead — Trainual Access |
| 4 | Discovery Reminder Sequence |
| 5 | Validation Team Intro Sequence |
| 6 | FDD Nurture Sequence |
| 7 | Long-term Nurture |
| 8 | New Franchisee Onboarding |
| 9 | Agreement Execution |
| 10 | Re-engagement Alert |

**IMPORTANT:** After you create each workflow and set the trigger to Inbound Webhook, GHL will show you a webhook URL. **Copy that URL right away.** Do not skip this step. You need all 10 URLs saved before you are done.

---

## 6. Create Tags

Go to **GHL -> Settings -> Tags** (or you can create tags inline when editing a contact — either way works)

Create all of the following tags. Type each one exactly as shown:

- `new-lead`
- `hot`
- `warm`
- `cool`
- `cold`
- `qualified`
- `validation-complete`
- `fdd-issued`
- `closed-won`
- `closed-lost`
- `nurture`
- `re-engaged`
- `trainual-complete`
- `compliance-passed`
- `referral`
- `paid-ad`
- `organic`
- `at-risk`

That is 18 tags total.

---

## 7. After Setup — Save Workflow Webhook URLs

Once all 10 workflows are created, collect every webhook URL and save them in a file or message using this format:

| Workflow Name | Inbound Webhook URL |
|---|---|
| New Lead Welcome | (paste URL here) |
| Active Follow-up Sequence | (paste URL here) |
| Qualified Lead — Trainual Access | (paste URL here) |
| Discovery Reminder Sequence | (paste URL here) |
| Validation Team Intro Sequence | (paste URL here) |
| FDD Nurture Sequence | (paste URL here) |
| Long-term Nurture | (paste URL here) |
| New Franchisee Onboarding | (paste URL here) |
| Agreement Execution | (paste URL here) |
| Re-engagement Alert | (paste URL here) |

**Send this table to your developer.** They will store these URLs in the database so the system can trigger each workflow automatically.

---

## 8. Verify Everything

After completing all the steps above, do a final check:

**Pipelines:**
- Go to GHL -> Opportunities
- Confirm both new pipelines appear: "NAH Franchise Sales - Active", "NAH Franchise Sales - Long-Term"
- Confirm the old pipelines are still there and untouched

**Contact Custom Fields:**
- Go to GHL -> Contacts -> click on any contact -> look at custom fields
- Confirm all 13 new contact fields appear (Lead Source Detail through OpenClaw Enriched)

**Opportunity Custom Fields:**
- Go to GHL -> Opportunities -> click on any opportunity -> look at custom fields
- Confirm all 9 new opportunity fields appear (Discovery Scorecard Score through Days in Current Stage)

**Calendars:**
- Go to GHL -> Calendars
- Confirm all 3 calendars appear: "Chad — Discovery Calls", "Construction Coach Intro Calls", "Lending Partner Calls"

**Workflows:**
- Go to GHL -> Automation -> Workflows
- Confirm all 10 new workflows appear
- Confirm each one has an Inbound Webhook trigger

**Tags:**
- Go to GHL -> Settings -> Tags
- Confirm all 18 tags are listed

If anything is missing, go back to the relevant section and create it. Do not modify or delete anything that was already there before you started.
