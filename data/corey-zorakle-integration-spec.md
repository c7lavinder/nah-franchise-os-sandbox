# Zorakle Profile Integration — Spec for Corey
## From: Max | April 8, 2026
## For: Corey's App (Monday build)

---

## OVERVIEW

We've built a complete personality profile database linking every NAH franchise owner and prospect
to their Zorakle SpotOn/Eclipse assessments. This data needs to be surfaced in your app so that
every owner and prospect card shows their personality fit score and profile type.

The goal: when a coach or FranDev rep pulls up any owner or prospect, they instantly see:
- Eclipse overall fit score (vs. NAH top performers)
- Values type (Achiever, Societal, Emulator, Belonger)
- Work style (Director, Connector, Thinker, Promoter)
- Links to the full SpotOn and Eclipse PDF files in Drive

---

## THE PRIMARY KEY: MS_SLUG

**The territory slug is the primary identifier across all systems.**

Every owner has a MasterSuite territory slug (e.g., INDYNW, CHATT, MUFRTN). This is the stable
identifier that links:
- MasterSuite (financial/operational data)
- ClientTether (prospect/owner CRM — now migrated to MasterSuite)
- GHL (Go High Level — franchisor CRM and communication)
- Google Drive (Zorakle personality profile files)
- Quarterly check-in data
- John's territory budget/actuals spreadsheet

**Always use ms_slug as the join key. Never rely on name matching alone.**

---

## THE DATA FILES

All files are in Google Drive: Candidates Folder (ID: 13qbM-3KgDHqeyFmqA4MAi8tL8-Y5o2Fy)

### 1. `zorakle-master-final.json` / `Zorakle Master Index FINAL.csv`
The complete Zorakle profile database. 83 records across 2022-2026 cohorts.

**Key fields:**
```
ms_slug          — PRIMARY KEY (e.g., "INDYNW", "CHATT")
full_name        — Owner/prospect name as filed
batch            — Which cohort year (2022, 2023, 2024, 2025-2026)
eclipse_overall  — Eclipse fit % vs. NAH top performers (integer, e.g., 94)
values_score     — Values sub-score from Eclipse (integer)
stages_score     — Stages of Growth sub-score
cultural_score   — Cultural fit sub-score
sales_score      — Sales Orientation sub-score
biz_path_score   — Business Path sub-score
values_type      — SpotOn values type: Achiever | Societal | Emulator | Belonger
culture          — SpotOn culture: Control | Create | Compete | Collaborate
work_style       — SpotOn work style: Director | Connector | Thinker | Promoter
eclipse_drive_id — Google Drive file ID for the Eclipse PDF
spoton_drive_id  — Google Drive file ID for the SpotOn PDF
```

**Drive URL format** (for display in app):
```
https://drive.google.com/file/d/{eclipse_drive_id}/view
https://drive.google.com/file/d/{spoton_drive_id}/view
```

### 2. `Owner Master Index — Active + Inactive.csv`
All 80 active + inactive territories with status flags. Join to Zorakle data via ms_slug.

**Key fields:**
```
ms_slug    — PRIMARY KEY
full_name  — Owner name
status     — "active" | "inactive"
ct_id      — ClientTether ID (where available — now in MasterSuite)
ct_email   — Owner email
```

### 3. `eclipse-performance-correlation.json`
9 owners with both Eclipse scores AND quarterly performance averages matched.
Use for the risk flagging logic.

---

## THE IDENTIFIER CHAIN YOU NEED TO BUILD

```
ms_slug (primary key, stable)
  ↓
MasterSuite owner record (financial data, operational history)
  ↓
ClientTether / GHL contact record (CRM, communication history)
  ↓
Zorakle profile (personality fit, Drive file links)
  ↓
Quarterly check-in data (self-reported performance grades)
  ↓
John's territory budget sheet (projected vs. actual purchases/sales)
```

**The GHL connection is the missing link.** I don't have GHL contact IDs yet.
You need to confirm: what is the unique identifier in GHL for each owner/prospect?
Is it email, a GHL contact ID, or the ms_slug itself if you've added it as a custom field?

Once you confirm the GHL ID field name, I can build the full cross-reference table.

---

## WHAT TO DISPLAY ON EACH CARD

### Owner Card (active franchisees)
```
[Territory Name] [ms_slug]
Owner: [full_name]
Eclipse Fit: [eclipse_overall]% ← color code: green ≥90%, yellow 85-89%, red <85%
Values Type: [values_type]
Work Style: [work_style]
[View Eclipse Report] [View SpotOn Profile] ← Drive links
```

### Prospect Card (FranDev pipeline)
```
[Prospect Name]
Stage: [ct_stage from ClientTether/GHL]
Eclipse Fit: [eclipse_overall]% ← if available
Values Type: [values_type] ← if SpotOn completed
Risk Flag: ⚠️ if eclipse_overall < 85 OR values_type = "Belonger"
[View Eclipse Report] [View SpotOn Profile]
```

---

## RISK FLAGS TO IMPLEMENT

Based on the personality-performance analysis, flag these automatically:

```
Red flag (⚠️):    eclipse_overall < 85%
Yellow flag (⚡): values_type = "Belonger" (stays but struggles financially)
Green signal (✓): values_type = "Achiever" AND work_style = "Director" AND eclipse_overall >= 90%
```

---

## DATA GAPS TO FILL

1. **GHL contact IDs** — confirm the field name and I'll add to the index
2. **2021 Zorakle cohort** — older owners' profiles not yet found
3. **MasterSuite financial data** — once DB read-only confirmed, I'll pull actual P&L per owner
   and add avg_profit_per_flip and total_flips_2025 to the index
4. **Missing Eclipse scores** — 2023 batch only has SpotOn (no Eclipse). Zorakle can generate
   Eclipse reports for these owners if you request them.

---

## QUICK START CHECKLIST FOR MONDAY

- [ ] Load `zorakle-master-final.json` into your data model
- [ ] Join on ms_slug (confirm this field exists in your owner/prospect records)
- [ ] Build Drive PDF viewer for Eclipse + SpotOn files (use `eclipse_drive_id` / `spoton_drive_id`)
- [ ] Add risk flag logic (red/yellow/green based on Eclipse + values type)
- [ ] Confirm GHL contact ID field → send to Max → I'll add to index same day
- [ ] Display Eclipse overall % prominently on both owner and prospect cards

---

## CONTACT FOR QUESTIONS

Email max@newagainhouses.com with any questions on the data structure.
I can update the index, add fields, or pull additional data same day.

*Max | April 8, 2026*
