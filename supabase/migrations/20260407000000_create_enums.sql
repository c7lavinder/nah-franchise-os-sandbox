-- Sprint 1: Create custom enum types for the new pipeline schema
-- Reference: docs/MASTER_PLAN.md §1.20

-- Sub-task state types (§1.5)
CREATE TYPE sub_task_state_type AS ENUM ('single', 'two_state');

-- Who can log a sub-task (§1.8)
CREATE TYPE sub_task_logger_type AS ENUM ('user', 'api', 'ai', 'null');

-- Source of a sub-task log entry (§1.5)
CREATE TYPE log_source AS ENUM ('manual', 'api', 'ai');

-- Which state a log advances to (§1.5)
CREATE TYPE log_state_advance AS ENUM ('first', 'second');

-- Content type for sub-task logs (§1.5)
CREATE TYPE log_content_type AS ENUM ('note', 'file', 'link', 'transcript', 'appointment', 'email', 'sms', 'call');

-- Cron job execution status (§1.20 Group 5)
CREATE TYPE cron_job_status AS ENUM ('running', 'success', 'failed');

-- GHL sync queue status (§1.16)
CREATE TYPE ghl_sync_status AS ENUM ('pending', 'success', 'failed');

-- Notification source type — MVP: @-mentions only (§1.17)
CREATE TYPE notification_source_type AS ENUM ('activity_mention');

-- Why a pipeline entry was closed (§1.9, §1.13)
CREATE TYPE pipeline_close_reason AS ENUM ('won', 'dropped_to_followup', 'dropped_to_nurture');

-- Ensure the moddatetime extension is available for updated_at triggers
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;
