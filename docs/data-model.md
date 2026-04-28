---
Last verified: 2026-04-27
Source: code (supabase/migrations/)
---

# Data Model — NAH Franchise OS

45+ tables across numbered and timestamped migrations in `supabase/migrations/`.
All access via service role key (bypasses RLS). App-level auth enforced by `requireAuth`.

---

## Core tables

### users
App user accounts. Mapped to Supabase Auth users by email.
- `id` UUID PK, `email`, `full_name`, `role` (UserRole enum), `ghl_user_id`, `is_active`, `is_real_user`, `label_color`, `last_login_at`

### sessions
Scout chat sessions per user.
- `id` UUID PK, `user_id`, `conversation_history` JSONB, `is_active`, `last_activity_at`

### notifications
In-app notification feed.
- `id` UUID PK, `user_id`, `type`, `title`, `body`, `is_read`, `metadata` JSONB

---

## Contacts + profiles

### contacts
Mirror of GHL contacts. Primary entity for all contact-level data.
- `id` UUID PK, `ghl_contact_id` (unique), `first_name`, `last_name`, `email`, `phone`, `opportunity_source`, `city`, `state`

### contact_profile_fields
Flexible key-value profile data per contact.
- `contact_id`, `field_name`, `field_value` JSONB, `last_updated_by`, `last_updated_at`

### contact_team_members
Manual team member assignments to contacts.
- `contact_id`, `user_id` (unique together)

### contact_activity_messages
Internal team messages on a contact thread.
- `id` UUID PK, `contact_id`, `author_user_id`, `content`, `deleted_at`

---

## Pipelines + journeys

### pipelines
Pipeline definitions (sales, follow-up, onboarding, runway).
- `id` UUID PK, `name`, `slug`, `sort_order`, `is_active`

### pipeline_stages
Ordered stages within a pipeline.
- `id` UUID PK, `pipeline_id` FK, `name`, `slug`, `sort_order`, `is_terminal`, `auto_advance_enabled`

### pipeline_sub_tasks
Checklist items within a stage.
- `id` UUID PK, `stage_id` FK, `name`, `slug`, `state_type` (single/two_state), `is_required`, `sort_order`

### journeys
A prospect's progression through the franchise process.
- `id` UUID PK, `name`, `slug`, `primary_contact_id` FK, `parent_journey_id`, `status` (active/closed)

### journey_contacts
Members of a journey (primary, co_primary, spouse, etc.).
- `journey_id`, `contact_id`, `role`, `joined_at`, `left_at`

### journey_pipeline_state
Active state of a journey in a pipeline — the canonical "where is this prospect" record.
- `id` UUID PK, `journey_id`, `pipeline_id`, `territory_ms_slug`, `current_stage_id`, `current_sub_task_id`, `assigned_user_id`, `is_active`

### contact_sub_task_logs
Log entries for sub-task completion attempts.
- `id` UUID PK, `journey_pipeline_state_id` FK, `sub_task_id`, `logger_user_id`, `source`, `state_advance`, `content_type`, `content_text`

---

## Calls

### calls
Every call record (Read.ai ingested or manually created).
- `id` UUID PK, `title`, `contact_id`, `call_type_id`, `territory_ms_slug`, `journey_pipeline_state_id`, `hosted_by_user_id`, `source`, `status`

### call_types
Configurable call type definitions (intro, matt, sam, mark, coaching, etc.).
- `id` UUID PK, `name`, `slug`, `category`, `description`

### call_transcripts
Full transcript text per call.
- `id` UUID PK, `call_id`, `source`, `full_text`, `word_count`

### call_participants
Per-call participant records with role and contact mapping.
- `id` UUID PK, `call_id`, `email`, `display_name`, `user_id`, `contact_id`, `role`

### call_action_items
AI-generated action items from call analysis.
- `id` UUID PK, `call_id`, `contact_id`, `category`, `title`, `description`, `status`, `ghl_action`

### call_data_extractions
Structured data extracted from call transcripts.
- `id` UUID PK, `call_id`, `contact_id`, `field_key`, `field_value`, `confidence`, `saved_to_profile`

---

## Intelligence

### candidate_intelligence
100-point scoring profile per contact (migration 006).
- `id` UUID PK, `contact_id`, `current_score`, `score_financial/operational/engagement/momentum`, `funding_path`, `zorakle_*`, `trainual_*`

### call_logs
Structured post-call data (migration 006).
- `id` UUID PK, `contact_id`, `call_type`, `fields` JSONB, `rep_confidence`

### candidate_score_history
Score change audit trail (migration 006).
- `id` UUID PK, `contact_id`, `score_before/after`, `triggered_by`, `changes_explained` JSONB

### objection_registry
Objections raised per contact per stage (migration 006).
- `id` UUID PK, `contact_id`, `objection_type`, `resolved`, `score_impact`

---

## Workflows

### workflows
Workflow definitions (migration 007).
- `id` UUID PK, `name`, `workflow_type`, `trigger_type`, `status`, `health_score`, `created_by`

### workflow_versions, workflow_steps, workflow_enrollments, workflow_step_logs, workflow_ab_tests, workflow_approvals
Supporting tables for the workflow engine (migration 007).

---

## EOS (Entrepreneurial Operating System)

Per-contact: `eos_contact_todos`, `eos_contact_goals`, `eos_contact_habits`, `eos_contact_issues`
Per-territory: `eos_territory_todos`, `eos_territory_goals`, `eos_territory_rocks`, `eos_territory_scorecard`, `eos_territory_habits`, `eos_territory_issues`

---

## Territories

### territories
Territory definitions with MasterSuite slug.
- `ms_slug` PK, `territory_name`, `status`, owner fields

### territory_market_data, territory_stakeholders
Market research data and stakeholder contacts per territory.

---

## Other

- `knowledge_documents` — Scout's knowledge base
- `read_ai_sessions` — Read.ai webhook payload records
- `integration_logs` — Webhook/integration event log
- `ghl_custom_fields` — Cached GHL field mappings
- `pipeline_app_settings` — App-level configuration
- `inactivity_alerts` — Accountability engine alerts
- `scout_action_logs` — Audit trail of Scout-executed actions
- `llm_call_logs` — Claude API call logging
- `rubrics`, `rubric_criteria` — Call grading rubrics
- `scout_user_memory` — Per-user persistent Scout memory
