# Scout Database Schema Reference

> Auto-generated from 125 migration files. 156 tables.
> Generated: 2026-05-11

## Core Tables (contacts, territories, users, sessions, etc.)

### app_settings (26 rows)

created_at (timestamptz), description (text), id (uuid), is_encrypted (boolean), setting_key (varchar(255)), setting_value (jsonb), updated_at (timestamptz)

### candidate_intelligence (1987 rows)

active_flags (jsonb), avg_response_time_hours (float), construction_comfort (varchar), contact_id (varchar), created_at (timestamptz), current_score (int), disc_profile (varchar), financial_red_flags (jsonb), funding_path (varchar), ghl_location_id (varchar), homework_completion_rate (float), id (uuid), illiquid_capital (int), liquid_capital (int), net_worth_bucket (varchar), outstanding_liabilities (text), personality_flags (jsonb), pfs_received (boolean), pfs_uploaded_url (varchar), prior_business_owner (boolean), prior_business_type (text), risk_tolerance_score (int), score_engagement (int), score_financial (int), score_momentum (int), score_operational (int), spouse_supportive (varchar), stated_motivation (varchar), trainual_completion_pct (int), trainual_last_activity (timestamptz), updated_at (timestamptz), urgency (varchar), zorakle_completed (boolean), zorakle_results (jsonb)

### candidate_score_history (1854 rows)

changes_explained (jsonb), contact_id (varchar), created_at (timestamptz), engagement_after (int), engagement_before (int), financial_after (int), financial_before (int), id (uuid), momentum_after (int), momentum_before (int), operational_after (int), operational_before (int), score_after (int), score_before (int), trigger_id (uuid), triggered_by (varchar)

### coach_assignments (0 rows)

CONSTRAINT (coach_assignments_coach_territory_key), TerritorySlug (text), assigned_at (timestamptz), coach_user_id (text), ended_at (timestamptz), id (uuid), specialty (text)

### compliance_tracking (0 rows)

background_check_at (timestamptz), background_check_status (text), contact_id (uuid), created_at (timestamptz), docusign_envelope_id (text), fdd_acknowledged_at (timestamptz), fdd_cooling_ends_at (timestamptz), fdd_issued_at (timestamptz), fdd_state (text), fdd_version (text), franchise_agreement_sent_at (timestamptz), franchise_agreement_signed_at (timestamptz), franchise_agreement_version (text), id (uuid), insurance_verified_at (timestamptz), notes (text), state_registration_expiry (date), state_registration_status (text), training_completed_at (timestamptz), training_modules_completed (int), training_modules_total (int), training_started_at (timestamptz), updated_at (timestamptz), updated_by (uuid)

### contact_activity_messages (9 rows)

author_user_id (uuid), body (text), contact_id (uuid), created_at (timestamptz), deleted_at (timestamptz), id (uuid), mentioned_user_ids (uuid[]), updated_at (timestamptz)

### contact_emails (2665 rows)

contact_id (uuid), created_at (timestamptz), email (citext), id (uuid), is_primary (boolean), label (text), source (text), updated_at (timestamptz)

### contact_journals (20 rows)

contact_id (uuid), created_at (timestamptz), embedding_id (uuid), id (uuid), interactions (jsonb), journal_date (date), signals_extracted (jsonb), summary (text), tenant_id (uuid)

### contact_profile_data (6 rows)

competitor_notes (text), created_at (timestamptz), decision_style (text), definition_of_success (text), desired_territory (text), financing_type (text), ghl_contact_id (text), guidant_robs_active (boolean), liquid_capital (numeric), local_market_notes (text), market_area (text), net_worth_estimate (numeric), objections_raised (text), pfs_received (boolean), primary_motivation (text), prior_re_experience (text), secondary_territory (text), skill_set_notes (text), territory_value_est (numeric), updated_at (timestamptz), zip_codes_of_interest (text)

### contact_profile_fields (463 rows)

contact_id (uuid), created_at (timestamptz), field_name (text), field_value (jsonb), id (uuid), last_updated_at (timestamptz), last_updated_by (text), source_history (jsonb)

### contact_related_people (12 rows)

contact_id (uuid), created_at (timestamptz), deleted_at (timestamptz), email (text), first_name (text), id (uuid), is_primary_decision_maker (boolean), last_name (text), linked_contact_id (uuid), phone (text), relationship_notes (text), role (text), updated_at (timestamptz)

### contact_scores (0 rows)

confidence (text), created_at (timestamptz), expires_at (timestamptz), ghl_contact_id (text), id (uuid), reason (text), score_type (text), score_value (text), source (text), updated_at (timestamptz)

### contact_sub_task_logs (205 rows)

CONSTRAINT (chk_sub_task_log_has_scope), content_file_url (text), content_link_url (text), content_text (text), content_type (log_content_type), created_at (timestamptz), deleted_at (timestamptz), id (uuid), journey_pipeline_state_id (uuid), logger_user_id (uuid), metadata (jsonb), source (log_source), state_advance (log_state_advance), sub_task_id (uuid), updated_at (timestamptz)

### contact_team_members (6 rows)

contact_id (uuid), created_at (timestamptz), id (uuid), user_id (uuid)

### contact_zorakle_data (0 rows)

created_at (timestamptz), culture (text), eclipse_drive_id (text), eclipse_overall (int), fit_score (int), ghl_contact_id (text), id (uuid), risk_flag (text), source (text), spoton_drive_id (text), updated_at (timestamptz), values_type (text), work_style (text), zorakle_completed_at (timestamptz)

### contacts (3000 rows)

BriefWorkHistory (text), CountiesInterestedIn (text), LeadSource (text), NonRetirementCapitalAvailable (text), PartnerEmail (text), PartnerName (text), PartnerPhone (text), PreferredName (text), WhatInterestsInOpportunity (text), address (text), city (text), clickx_package (text), converted_at (timestamptz), created_at (timestamptz), ecosystem_partners (text), email (text), fb_url (text), first_name (text), framing_call_logged (boolean), franchise_fee (numeric), franchise_start_date (date), ghl_contact_id (text), happyfox_url (text), id (uuid), incoming_lead_email (text), investment_timeline (text), is_converted_franchisee (boolean), last_name (text), last_synced_at (timestamptz), lead_manager_email (text), lead_manager_name (text), legal_entity (text), marketing_phone (text), merged_into_contact_id (uuid), nda_status (text), needs_review (boolean), nexa_phone (text), notes (text), number_of_franchisees (integer), onboarding_completion_date (date), openclaw_enriched (boolean), opportunity_source (text), phone (text), phone_normalized (text), property_submission_status (text), real_estate_agent_broker (text), real_estate_agent_email (text), real_estate_partner (text), real_estate_phone (text), return_mail_address (text), royalty_pct (numeric), scout_lead_score (numeric), source (text), state (text), sub_source (text), term_months (int), territory_email (text), territory_interest (text), territory_status (text), trainual_access_sent (boolean), trainual_completion_pct (numeric), updated_at (timestamptz), website (text), zip (text)

### cron_job_log (204 rows)

created_at (timestamptz), error (text), finished_at (timestamptz), id (uuid), job_name (text), result (jsonb), started_at (timestamptz), status (cron_job_status)

### data_update_suggestions (1226 rows)

TerritorySlug (text), combination_note (text), combined_sources (text[]), confidence (text), contact_id (text), created_at (timestamptz), current_value (text), evidence (text), field_name (text), field_table (text), final_value (text), id (uuid), resolved_at (timestamptz), reviewer_id (text), source (text), source_id (text), status (text), suggested_value (text), superseded_by (uuid), updated_at (timestamptz)

### embeddings (20 rows)

contact_id (uuid), content (text), content_type (text), created_at (timestamptz), embedding (vector(1536)), id (uuid), metadata (jsonb), tenant_id (uuid), updated_at (timestamptz)

### franchise_owners (67 rows)

TerritorySlug (text), created_at (timestamptz), ct_email (text), ct_id (text), full_name (text), ghl_contact_id (text), status (text), updated_at (timestamptz)

### franchisee_performance (0 rows)

active_status (varchar), contact_id (varchar), created_at (timestamptz), data_source (varchar), franchise_agreement_signed (boolean), franchise_software_id (varchar), franchisee_name (varchar), funds_received_at (timestamptz), houses_purchased_total (int), houses_purchased_year1 (int), houses_purchased_year2 (int), houses_purchased_year3 (int), id (uuid), last_synced_at (timestamptz), nps_score (int), revenue_year1 (int), revenue_year2 (int), revenue_year3 (int), royalty_payment_consistent (boolean), signed_at (timestamptz), staff_hired (int), support_calls_year1 (int), territory (varchar), territory_utilization_pct (int), time_to_first_flip_days (int), updated_at (timestamptz)

### ghl_action_drafts (0 rows)

action_type (text), confirmed_at (timestamptz), contact_id (uuid), created_at (timestamptz), drafted_by_source (text), drafted_by_user_id (uuid), edited_params (jsonb), error_message (text), executed_at (timestamptz), id (uuid), outcome (jsonb), params (jsonb), status (text)

### ghl_pipeline_stages (58 rows)

created_at (timestamptz), id (uuid), pipeline_id (varchar(255)), position (integer), stage_id (varchar(255)), stage_name (varchar(255)), updated_at (timestamptz)

### ghl_sync_queue (0 rows)

attempts (int), contact_id (uuid), created_at (timestamptz), ghl_field_id (text), id (uuid), last_error (text), status (ghl_sync_status), updated_at (timestamptz), value (text)

### ghl_workflows (0 rows)

created_at (timestamptz), description (text), ghl_workflow_id (varchar(255)), id (uuid), is_active (boolean), name (varchar(255)), updated_at (timestamptz), webhook_url (text)

### inactivity_alerts (8581 rows)

alert_type (varchar(100)), created_at (timestamptz), details (jsonb), ghl_contact_id (varchar(255)), id (uuid), is_resolved (boolean), message (text), pipeline_stage (varchar(100)), resolved_at (timestamptz), resolved_by (uuid), severity (varchar(20)), user_id (uuid)

### integration_logs (861 rows)

TerritorySlug (text), created_at (timestamptz), error_message (text), event_type (text), id (uuid), integration_name (text), payload_summary (text), related_contact_id (text), status (text)

### journeys (2975 rows)

REFERENCES (contacts(id)), close_reason (pipeline_close_reason), created_at (timestamptz), id (uuid), name (text), parent_journey_id (uuid), primary_contact_id (uuid), slug (text), status (text), updated_at (timestamptz)

### kb_gap_signals (0 rows)

id (uuid), query (text), resolved (boolean), resolved_by_doc_id (uuid), results_found (int), searched_at (timestamptz), suggested_category (text)

### knowledge_documents (57 rows)

category (varchar(100)), content (text), created_at (timestamptz), id (uuid), is_active (boolean), last_retrieved_at (timestamptz), priority (integer), status (text), title (varchar(255)), token_count (integer), updated_at (timestamptz), updated_by (uuid)

### lead_sources (5 rows)

created_at (timestamptz), id (uuid), is_active (boolean), name (text), sort_order (int)

### lead_sub_sources (16 rows)

created_at (timestamptz), id (uuid), is_active (boolean), lead_source_id (uuid), name (text), sort_order (int)

### llm_call_logs (563 rows)

created_at (timestamptz), error_message (text), id (uuid), input_messages (jsonb), input_tokens (integer), iteration (integer), latency_ms (integer), model (varchar(100)), output_content (jsonb), output_tokens (integer), prompt_blocks (jsonb), prompt_version (text), stop_reason (varchar(50)), tool_calls (jsonb), user_id (varchar(255))

### market_signals (0 rows)

id (uuid), observed_at (timestamptz), signal_key (varchar), signal_type (varchar), signal_value (jsonb), source (varchar)

### notifications (7 rows)

contact_id (uuid), created_at (timestamptz), id (uuid), read_at (timestamptz), recipient_user_id (uuid), source_id (uuid), source_type (notification_source_type), type (text)

### objection_registry (51 rows)

call_log_id (uuid), contact_id (varchar), created_at (timestamptz), id (uuid), objection_detail (text), objection_type (varchar), resolution_notes (text), resolved (boolean), resolved_at (timestamptz), score_impact (int), stage_at_time (varchar)

### pipelines (5 rows)

created_at (timestamptz), description (text), entity_type (text), ghl_field_id (text), id (uuid), is_active (boolean), is_visible_in_nav (boolean), name (text), slug (text), sort_order (int), updated_at (timestamptz)

### read_ai_sessions (121 rows)

CONSTRAINT (read_ai_sessions_call_type_check), call_type (text), classified_at (timestamptz), created_at (timestamptz), end_time (timestamptz), error_message (text), linked_call_id (uuid), owner_email (text), participant_emails (text[]), platform (text), processed_at (timestamptz), processing_status (text), raw_payload (jsonb), session_id (text), start_time (timestamptz), title (text)

### read_ai_webhook_keys (0 rows)

created_at (timestamptz), signing_key (text), user_email (text)

### rep_journals (9 rows)

calls_completed (int), coaching_notes (text), contacts_touched (int), created_at (timestamptz), focus_tomorrow (text), ghl_actions_fired (int), id (uuid), journal_date (date), sub_tasks_logged (int), summary (text), tenant_id (uuid), user_id (uuid)

### rubric_criteria (66 rows)

created_at (timestamptz), description (text), example_phrases_negative (text[]), example_phrases_positive (text[]), id (uuid), kb_document_ids (uuid[]), name (text), negative_examples (text[]), positive_examples (text[]), rubric_id (uuid), sort_order (int), updated_at (timestamptz), weight (numeric)

### rubric_review_suggestions (0 rows)

created_at (timestamptz), criterion_id (uuid), criterion_name (text), current_state (jsonb), id (uuid), issue_type (text), review_month (date), reviewed_at (timestamptz), reviewed_by (uuid), status (text), suggested_change (text), supporting_data (jsonb)

### rubrics (14 rows)

call_type_id (uuid), created_at (timestamptz), description (text), id (uuid), is_active (boolean), name (text), updated_at (timestamptz)

### scout_action_logs (23 rows)

action_status (varchar(50)), action_type (varchar(50)), confirmed_at (timestamptz), created_at (timestamptz), draft_content (jsonb), error_message (text), executed_at (timestamptz), final_content (jsonb), ghl_contact_id (varchar(255)), ghl_response (jsonb), id (uuid), session_id (uuid), user_id (uuid)

### scout_performance_reports (5 rows)

acceptance_rate (float), action_type_breakdown (jsonb), created_at (timestamptz), edit_rate (float), id (uuid), kb_gap_signals (jsonb), kb_retrieval_count (int), most_edited_fields (jsonb), rejection_rate (float), rep_breakdown (jsonb), top_rejected_types (jsonb), total_suggestions (int), week_end (date), week_start (date)

### scout_user_memory (4 rows)

content (text), turn_count (integer), updated_at (timestamptz), user_id (uuid)

### sessions (105 rows)

context_summary (text), conversation_history (jsonb), ended_at (timestamptz), ghl_contact_focus (varchar(255)), id (uuid), is_active (boolean), last_activity_at (timestamptz), started_at (timestamptz), user_id (uuid)

### suggestion_feedback (0 rows)

accepted_value (jsonb), call_id (uuid), call_type (text), contact_id (uuid), created_at (timestamptz), edit_delta (jsonb), id (uuid), original_value (jsonb), outcome (text), rep_id (uuid), suggestion_type (text)

### system_logs (18 rows)

action_type (text), contact_id (uuid), created_at (timestamptz), id (uuid), input_params (jsonb), log_date (date), result_summary (text), tenant_id (uuid), user_id (uuid), was_auto (boolean)

### tasks (0 rows)

assigned_to_ghl_user_id (text), assigned_to_user_id (uuid), body (text), completed (boolean), completed_at (timestamptz), contact_id (uuid), created_at (timestamptz), due_date (timestamptz), ghl_contact_id (text), ghl_synced_at (timestamptz), ghl_task_id (text), id (uuid), source (text), title (text), updated_at (timestamptz)

### territories (99 rows)

FranchiseAgreementDate (date), Nickname (text), TerritoryId (int), TerritorySlug (text), created_at (timestamptz), ghl_contact_id (text), ms_synced_at (timestamptz), region (text), status (text), updated_at (timestamptz)

### territory_candidates (0 rows)

CONSTRAINT (uq_territory_candidate), TerritorySlug (text), created_at (timestamptz), ghl_contact_id (text), id (uuid), status (text), updated_at (timestamptz)

### territory_grades (0 rows)

CONSTRAINT (uq_grade_period), TerritorySlug (text), created_at (timestamptz), houses_purchased (int), id (uuid), john_grade (int), notes (text), quarter (int), self_grade (int), year (int)

### territory_market_data (140 rows)

CONSTRAINT (territory_market_data_slug_field_key), TerritorySlug (text), field_name (text), field_value (text), id (uuid), source (text), source_date (timestamptz), updated_at (timestamptz), updated_by (uuid)

### territory_owners (80 rows)

TerritorySlug (text), created_at (timestamptz), end_date (date), ghl_contact_id (text), id (uuid), role (text), start_date (date), transfer_notes (text)

### territory_profile (67 rows)

TerritorySlug (text), active_deals (int), actual_purchases (int), avg_profit_per_flip (numeric), avg_time_to_flip_days (int), coaching_notes (text), competitor_presence (text), created_at (timestamptz), flip_activity_score (numeric), houses_sold_ytd (int), last_checkin_date (date), lead_conversion_rate (numeric), leads_received_ytd (int), local_market_notes (text), market_type (text), projected_purchases (int), revenue_ytd (numeric), stage3_pct (numeric), stage5_pct (numeric), territory_value_est (numeric), total_invested (numeric), updated_at (timestamptz)

### territory_stakeholders (70 rows)

TerritorySlug (text), company (text), contact_id (uuid), created_at (timestamptz), email (text), first_name (text), id (uuid), is_active (boolean), last_name (text), notes (text), phone (text), role (text), updated_at (timestamptz)

### transcript_jobs (0 rows)

attempts (int), audio_url (text), call_id (uuid), completed_at (timestamptz), created_at (timestamptz), error_message (text), id (uuid), started_at (timestamptz), status (text), transcript_id (uuid)

### user_email_aliases (4 rows)

created_at (timestamptz), email (text), id (uuid), user_id (uuid)

### user_memory (0 rows)

confidence (decimal(3), created_at (timestamptz), id (uuid), last_accessed_at (timestamptz), memory_key (varchar(255)), memory_type (varchar(50)), memory_value (text), source (varchar(100)), updated_at (timestamptz), user_id (uuid)

### users (18 rows)

CONSTRAINT (users_role_check), created_at (timestamptz), email (varchar(255)), full_name (varchar(255)), ghl_user_id (varchar(255)), id (uuid), is_active (boolean), is_real_user (boolean), label_color (text), last_login_at (timestamptz), ms_user_id (int), role (varchar(50)), updated_at (timestamptz)

### workflow_ab_tests (0 rows)

completed_at (timestamptz), created_at (timestamptz), created_by (uuid), declared_by (uuid), id (uuid), min_sample_size (integer), status (varchar(50)), test_type (varchar(50)), variant_a_count (integer), variant_a_metric (decimal(5), variant_a_step_id (uuid), variant_a_version_id (uuid), variant_b_count (integer), variant_b_metric (decimal(5), variant_b_step_id (uuid), variant_b_version_id (uuid), winner (varchar(10)), winner_explanation (text), workflow_id (uuid)

### workflow_approvals (2 rows)

ab_test_id (uuid), approval_type (varchar(50)), approved_by (uuid), id (uuid), notes (text), resolved_at (timestamptz), status (varchar(50)), submitted_at (timestamptz), submitted_by (uuid), workflow_id (uuid), workflow_version_id (uuid)

### workflow_enrollments (0 rows)

completed_at (timestamptz), contact_name (varchar(255)), current_day (integer), current_step_id (uuid), enrolled_at (timestamptz), exit_reason (varchar(255)), ghl_contact_id (varchar(255)), goal_achieved (boolean), id (uuid), last_step_at (timestamptz), paused_at (timestamptz), status (varchar(50)), workflow_id (uuid), workflow_version_id (uuid)

### workflow_step_logs (0 rows)

clicked (boolean), confirmed_at (timestamptz), confirmed_by (uuid), content_sent (text), created_at (timestamptz), delivered (boolean), delivery_data (jsonb), enrollment_id (uuid), executed_at (timestamptz), ghl_contact_id (varchar(255)), ghl_message_id (varchar(255)), id (uuid), opened (boolean), responded (boolean), step_id (uuid), step_type (varchar(50))

### workflow_steps (107 rows)

CONSTRAINT (workflow_steps_step_type_check), click_rate (decimal(5), condition_config (jsonb), content (text), created_at (timestamptz), day_number (integer), id (uuid), open_rate (decimal(5), performance_status (varchar(20)), requires_confirmation (boolean), response_rate (decimal(5), send_time (time), step_number (integer), step_type (varchar(50)), subject (varchar(500)), workflow_version_id (uuid)

### workflow_versions (12 rows)

approved_at (timestamptz), approved_by (uuid), change_description (text), created_at (timestamptz), created_by (uuid), id (uuid), update_mode (varchar(50)), version_number (integer), workflow_id (uuid)

### workflows (12 rows)

CONSTRAINT (fk_workflows_current_version), active_enrollee_count (integer), created_at (timestamptz), created_by (uuid), current_version_id (uuid), description (text), exit_conditions (jsonb), health_score (char(1)), id (uuid), name (varchar(255)), pause_conditions (jsonb), primary_metric_name (varchar(100)), primary_metric_value (decimal(5), status (varchar(50)), trigger_config (jsonb), trigger_type (varchar(100)), updated_at (timestamptz), workflow_type (varchar(100))

### zorakle_assessments (82 rows)

TerritorySlug (text), batch (text), biz_path_score (int), contact_id (uuid), created_at (timestamptz), cultural_score (int), culture (text), eclipse_drive_id (text), eclipse_overall (int), full_name (text), id (uuid), sales_score (int), spoton_drive_id (text), stages_score (int), values_score (int), values_type (text), work_style (text)

### zorakle_profiles (82 rows)

TerritorySlug (text), batch (text), biz_path_score (int), created_at (timestamptz), cultural_score (int), culture (text), eclipse_drive_id (text), eclipse_overall (int), fit_score (int), full_name (text), id (uuid), risk_flag (text), sales_score (int), spoton_drive_id (text), stages_score (int), values_score (int), values_type (text), work_style (text)

## Pipeline & Journey Tables

### journey_contacts (3017 rows)

contact_id (uuid), created_at (timestamptz), id (uuid), is_primary_decision_maker (boolean), joined_at (timestamptz), journey_id (uuid), left_at (timestamptz), role (text), role_notes (text), updated_at (timestamptz)

### journey_pipeline_state (3158 rows)

TerritorySlug (text), assigned_user_id (uuid), closed_at (timestamptz), closed_reason (pipeline_close_reason), created_at (timestamptz), current_stage_id (uuid), current_sub_task_id (uuid), current_sub_task_started_at (timestamptz), entered_current_stage_at (timestamptz), entered_pipeline_at (timestamptz), id (uuid), is_active (boolean), journey_id (uuid), pipeline_id (uuid), updated_at (timestamptz)

### pipeline_app_settings (1 rows)

ghl_sync_enabled (boolean), ghl_sync_queue_alert_threshold (int), id (int), time_in_stage_red_days (int), time_in_stage_yellow_days (int), updated_at (timestamptz), updated_by_user_id (uuid)

### pipeline_stage_history (43 rows)

CONSTRAINT (chk_stage_history_has_scope), created_at (timestamptz), from_stage_id (uuid), id (uuid), journey_pipeline_state_id (uuid), moved_by_user_id (uuid), reason (text), to_stage_id (uuid), was_auto (boolean), was_revert (boolean), was_skip (boolean)

### pipeline_stages (20 rows)

auto_advance_enabled (boolean), auto_spawn_pipeline_id (uuid), created_at (timestamptz), description (text), id (uuid), is_terminal (boolean), name (text), pipeline_id (uuid), slug (text), sort_order (int), updated_at (timestamptz)

### pipeline_sub_tasks (51 rows)

created_at (timestamptz), default_logger_type (sub_task_logger_type), default_logger_user_id (uuid), description (text), first_state_label (text), id (uuid), is_required (boolean), name (text), second_state_label (text), slug (text), sort_order (int), stage_id (uuid), state_type (sub_task_state_type), updated_at (timestamptz)

## Call Tables

### call_action_feedback (2 rows)

action (text), call_action_item_id (uuid), created_at (timestamptz), edit_diff (text), extraction_id (uuid), id (uuid), payload (jsonb), user_id (uuid)

### call_action_items (634 rows)

call_id (uuid), category (text), constraint (call_action_items_category_check), contact_id (uuid), created_at (timestamptz), description (text), ghl_action (bool), id (uuid), journey_id (uuid), metadata (jsonb), original_description (text), original_title (text), pushed_at (timestamptz), skipped_at (timestamptz), source (text), status (text), title (text), updated_at (timestamptz)

### call_coaching (31 rows)

call_id (uuid), coaching_notes (text), coaching_plan (text), created_at (timestamptz), created_by (text), id (uuid), kb_snippets_used (uuid[]), scout_model (text)

### call_data_extractions (3967 rows)

CONSTRAINT (call_data_extractions_field_category_check), CONSTRAINT (chk_extraction_has_scope), TerritorySlug (text), call_id (uuid), confidence (text), contact_id (uuid), created_at (timestamptz), dismissed (bool), extracted_value (text), field_category (text), field_key (text), id (uuid), journey_id (uuid), saved_to_profile (bool), source (text), target_scope (text)

### call_grades (49 rows)

call_id (uuid), created_at (timestamptz), criterion_scores (jsonb), graded_by (text), id (uuid), improvements (text[]), overall_grade (text), overall_score (numeric), rubric_id (uuid), scout_model (text), strengths (text[]), suggested_next_action (text)

### call_journeys (261 rows)

REFERENCES (journey_pipeline_state(id)), call_id (uuid), created_at (timestamptz), id (uuid), is_primary (boolean), journey_id (uuid), journey_pipeline_state_id (uuid)

### call_logs (0 rows)

ai_prefilled (boolean), call_type (varchar), called_at (timestamptz), contact_id (varchar), created_at (timestamptz), fields (jsonb), human_confirmed (boolean), id (uuid), logged_at (timestamptz), logged_by (varchar), notes (text), red_flags_raised (text), rep_confidence (varchar), transcript_url (varchar)

### call_participants (822 rows)

call_id (uuid), contact_id (uuid), created_at (timestamptz), display_name (text), email (text), id (uuid), journey_pipeline_state_id (uuid), role (text), user_id (uuid)

### call_review_packages (33 rows)

call_id (uuid), coaching_citations (jsonb), coaching_feedback (text), contact_id (uuid), created_at (timestamptz), grade (text), grade_detail (jsonb), id (uuid), next_step_cards (jsonb), profile_suggestions (jsonb), rep_id (uuid), status (text)

### call_territories (200 rows)

CONSTRAINT (call_territories_call_territory_key), TerritorySlug (text), call_id (uuid), created_at (timestamptz), id (uuid), is_primary (boolean)

### call_transcripts (33 rows)

call_id (uuid), created_at (timestamptz), full_text (text), id (uuid), language (text), metadata (jsonb), source (text), word_count (int)

### call_types (14 rows)

category (text), created_at (timestamptz), description (text), id (uuid), name (text), slug (text), updated_at (timestamptz)

### calls (145 rows)

TerritorySlug (text), action_items (jsonb), ai_summary (text), ai_summary_generated_at (timestamptz), brief_context (text), brief_generated_at (timestamptz), call_type_id (uuid), classification_reason (text), coach_user_id (uuid), coaching_data (jsonb), coaching_generated_at (timestamptz), coaching_score (int), contact_id (uuid), created_at (timestamptz), deleted_at (timestamptz), duration_seconds (int), ended_at (timestamptz), ghl_event_id (text), hosted_by_user_id (uuid), id (uuid), journey_pipeline_state_id (uuid), kb_intel_items (jsonb), match_confidence (numeric(3), meeting_link (text), participant_count (int), raw_transcript (text), read_ai_session_id (text), recording_url (text), scheduled_at (timestamptz), source (text), started_at (timestamptz), status (text), sub_task_id (uuid), summary (text), summary_bullets (text[]), title (text), updated_at (timestamptz)

## EOS Tables

### eos_contact_goals (45 rows)

contact_id (uuid), id (uuid), income_goal (text), lifestyle_goal (text), qol_goal (text), source (text), updated_at (timestamptz)

### eos_contact_habits (0 rows)

cadence (text), contact_id (uuid), created_at (timestamptz), grade (text), habit_text (text), id (uuid), sort_order (int), source (text), updated_at (timestamptz)

### eos_contact_issues (3 rows)

contact_id (uuid), created_at (timestamptz), id (uuid), is_done (boolean), issue_text (text), source (text), updated_at (timestamptz)

### eos_contact_todos (7 rows)

contact_id (uuid), created_at (timestamptz), id (uuid), is_done (boolean), owner_user_id (uuid), source (text), todo_text (text), updated_at (timestamptz)

### eos_territory_budgets (317 rows)

TerritorySlug (text), amount (numeric), description (text), id (uuid), ms_id (int), sort_order (int), updated_at (timestamptz)

### eos_territory_goals (231 rows)

CONSTRAINT (eos_territory_goals_slug_goal_type_key), TerritorySlug (text), actual (text), current_year_goal (text), goal_type (text), id (uuid), updated_at (timestamptz), year_25_goal (text), year_5_goal (text)

### eos_territory_habits (404 rows)

CONSTRAINT (eos_territory_habits_slug_habit_key_key), TerritorySlug (text), grade (text), habit_key (text), habit_label (text), id (uuid), sort_order (int), updated_at (timestamptz)

### eos_territory_issues (223 rows)

Issue (text), TerritorySlug (text), created_at (timestamptz), id (uuid), is_done (boolean), ms_id (int), origin_contact_id (uuid), source (text), updated_at (timestamptz)

### eos_territory_lead_channels (2912 rows)

CONSTRAINT (eos_territory_lead_channels_slug_channel_key), TerritorySlug (text), channel_name (text), id (uuid), is_active (boolean), sort_order (int), updated_at (timestamptz)

### eos_territory_rocks (135 rows)

Rock (text), TerritorySlug (text), created_at (timestamptz), id (uuid), ms_id (int), quarter (int), status (text), updated_at (timestamptz), year (int)

### eos_territory_scorecard (811 rows)

CONSTRAINT (eos_territory_scorecard_slug_metric_key), TerritorySlug (text), goal_value (text), id (uuid), metric_key (text), metric_label (text), sort_order (int), updated_at (timestamptz)

### eos_territory_todos (209 rows)

TerritorySlug (text), Todo (text), created_at (timestamptz), id (uuid), is_done (boolean), ms_id (int), origin_contact_id (uuid), owner_user_id (uuid), source (text), updated_at (timestamptz)

## MasterSuite Synced Tables (ms\_\*)

### ms_construction_default_rooms (0 rows)

Description (text), IconUrl (text), Name (text), RoomToken (text)

### ms_construction_property_rooms (0 rows)

ConstructionPropertyRoomId (text), PropertyId (int), RoomToken (text)

### ms_eos_construction_habits (26 rows)

AltaWeeklyVideoUpdates (text), Phase1Walkthroughs (text), PropertyAutopsies (text), QuarterlyIndexUpdate (text), TerritorySlug (text), WeeklyBudgetMeeting (text)

### ms_eos_construction_issues (20 rows)

Done (boolean), Id (int), Issue (text), TerritorySlug (text)

### ms_eos_construction_master_statuses (5 rows)

SortOrder (int), StatusColor (text), StatusName (text)

### ms_eos_construction_master_tasks (16 rows)

Color (text), Enabled (boolean), SortOrder (smallint), TaskId (int), TaskName (text)

### ms_eos_construction_rocks (21 rows)

Id (int), Rock (text), Status (text), TerritorySlug (text)

### ms_eos_construction_task_history (2010 rows)

Id (int), InsertedBy (text), InsertedTime (timestamptz), MasterTask (text), PropertyId (int), Status (text)

### ms_eos_construction_task_notes (110 rows)

MasterTask (text), Note (text), PropertyId (int), UpdatedBy (text), UpdatedTime (timestamptz)

### ms_eos_construction_tasks (1826 rows)

MasterTask (text), PropertyId (int), Status (text), UpdatedBy (text), UpdatedTime (timestamptz)

### ms_eos_construction_todos (29 rows)

Done (boolean), Id (int), TerritorySlug (text), Todo (text)

### ms_lead_list_counts (8207 rows)

LeadCategory (text), LeadType (text), TerritorySlug (text), count (int), id (uuid), month (date), synced_at (timestamptz)

### ms_lead_type_categories (0 rows)

LeadCategory (text), LeadCategoryId (int)

### ms_lead_types (0 rows)

LeadCategoryId (int), LeadType (text), LeadTypeId (int)

### ms_master_list_intangibles (0 rows)

FriendlyName (text), Token (text)

### ms_note_holders (0 rows)

CommittedProjects (decimal(13), Name (text), NextFundingDate (date), Token (text), TotalFunds (decimal(13)

### ms_project_management_master_statuses (5 rows)

StatusColor (text), StatusName (text)

### ms_project_management_master_tasks (2223 rows)

Color (text), Enabled (boolean), SortOrder (smallint), TaskId (int), TaskName (text), TerritoryId (int)

### ms_project_management_task_notes (509 rows)

MasterTask (text), Note (text), PropertyId (int), UpdatedBy (text), UpdatedTime (timestamptz)

### ms_project_management_tasks (16013 rows)

MasterTask (text), PropertyId (int), Status (text), UpdatedBy (text), UpdatedTime (timestamptz)

### ms_properties (49966 rows)

Address1 (text), AddressSlugShort (text), AddressSlugVerbose (text), AedQualified (text), Archived (boolean), ArchivedDate (timestamptz), ArvCeiling (decimal(20), AuctionAdPrice (decimal(20), AuctionCountyLocation (text), AuctionDate (text), AuctionDriveBy (text), AuctionReserveBid (decimal(20), AuctionStatus (text), AuctionTime (text), AuctionTitle (text), AuctionTrustee (text), Auctioneer (text), AutoTerritorySlug (text), BaseGrade (decimal(20), BatchId (text), BuyingCost (decimal(20), City (text), ClosingCost (decimal(20), ComparableSubjectCondition (text), County (text), DirectMailInitiatedDate (date), DirectSellerNotes (text), DispositionNotes (text), EvaluationStatus (text), ExteriorIndicators (decimal(20), FloodRisk (text), GoogleCity (text), GoogleCounty (text), GoogleSearch (text), GoogleState (text), HighEndPriceSquareFoot (decimal(20), HoldingCost (decimal(20), HouseCanaryValue (decimal(13), Inserted (timestamptz), InsertedBy (text), LastModified (timestamptz), LastModifiedBy (text), Latitude (decimal(9), LeadCategory (text), LeadClassification (text), LeadSubType2 (text), LeadType (text), Longitude (decimal(9), LowEndPriceSquareFoot (decimal(20), MarketRiskFactor (decimal(12), MethCheck (text), MlsListCost (decimal(20), OfferRange (text), OwnerDoNotSend (boolean), OwnerLeadSource (text), OwnerOfferStatus (text), Premium (decimal(20), PropertyAddressDoNotSend (boolean), PropertyId (int), PropertyReviewedBy (text), PropertyReviewedByFriendlyName (text), PropertyReviewedDate (timestamptz), PropertyType (text), PropertyUrl (text), ReferralPartnerName (text), RoadType (text), Roof (decimal(20), SellDate (date), SellerApproxAge (text), SellerBlackSwans (text), SellerGender (text), SellerMotivation (text), SellerRole (text), SellerType (text), Septic (text), Siding (decimal(20), Stage1Arv (decimal(20), Stage1CostOfMoneyPercent (decimal(20), Stage1LocationGrade (decimal(20), Stage1ManualArv (decimal(20), Stage1MaxRiskFactorPercent (decimal(20), Stage1MlsSellPercent (decimal(20), Stage1Notes (text), Stage1Price (decimal(20), Stage1RehabLevel (decimal(20), Stage2Arv (decimal(20), Stage2LocationGrade (decimal(20), Stage2Notes (text), Stage2Price (decimal(20), Stage2RehabLevel (decimal(20), Stage3Arv (decimal(20), Stage3ConstructionBudget (decimal(20), Stage3ConstructionProfitRatio (decimal(20), Stage3CostOfMoneyPercent (decimal(20), Stage3LocationGrade (decimal(20), Stage3MaxOffer (decimal(20), Stage3MaxRiskFactorPercent (decimal(20), Stage3Mortgage2Amount (decimal(20), Stage3Mortgage2KnownInterestRate (decimal(6), Stage3Mortgage2StartDate (date), Stage3Mortgage2Term (decimal(20), Stage3Mortgage2_Calculated_Payoff (decimal(20), Stage3MortgageAmount (decimal(20), Stage3MortgageKnownInterestRate (decimal(6), Stage3MortgageStartDate (date), Stage3MortgageTerm (decimal(20), Stage3Mortgage_Calculated_Payoff (decimal(20), Stage3Notes (text), Stage3Price (decimal(20), Stage3RiskFactor (decimal(20), State (text), Status (text), Streetname (text), TaxOverallGrade (text), TerritorySlug (text), TrusteeDoNotSend (boolean), UsdaQualified (text), Vacant (text), Windows (decimal(20), ZillowPropertyId (text), Zip (text), ms_synced_at (timestamptz), utmCampaign (text), utmContent (text), utmMedium (text), utmSource (text)

### ms_property_agent_feedback (0 rows)

AgentFeedback (text), AgentRecommendedArvHigh (decimal(10), AgentRecommendedArvLow (decimal(10), AgentRecommendedFinalValuation (decimal(10), NoteToAgent (text), PropertyId (int), ms_synced_at (timestamptz)

### ms_property_calculations (49965 rows)

Calculated_AbsenteeSeller (boolean), Calculated_AdjustedRiskFactor (decimal(20), Calculated_AdjustedSqFt (decimal(20), Calculated_AmountFinanced (decimal(20), Calculated_Arv (decimal(9), Calculated_ArvCeilingSqFt (decimal(20), Calculated_ArvPerAdjustedSqFt (decimal(20), Calculated_ArvRiskFactor (decimal(20), Calculated_Arv_MarketRiskAdjusted (decimal(9), Calculated_AuctionMinimumPrice (decimal(20), Calculated_AuctionMinimumPriceMeta (text), Calculated_BuiltAge (decimal(20), Calculated_BuyingCost (decimal(20), Calculated_CashRequired (decimal(20), Calculated_ClosingCost (decimal(20), Calculated_CompRiskAdjustment (decimal(20), Calculated_ConstructionBudget (decimal(20), Calculated_ConstructionBudgetStage1 (decimal(20), Calculated_ConstructionBudgetStage2 (decimal(20), Calculated_ConstructionDaysComplete (int), Calculated_ConstructionDaysOver (int), Calculated_ConstructionDaysRemaining (int), Calculated_ConstructionEstimatedDays (int), Calculated_ConstructionStage3RehabGrade (decimal(20), Calculated_EffectiveAge (decimal(20), Calculated_EstimatedPayoff2 (decimal(20), Calculated_FinanceCost (decimal(20), Calculated_FinanceCostCycleTimeDays (int), Calculated_FullPropertyAddress (text), Calculated_HighEndTotalPrice (decimal(20), Calculated_HoldingCost (decimal(20), Calculated_IntangibleRiskAdjustment (decimal(20), Calculated_IntangibleScore (int), Calculated_Inv_CBGrade (decimal(20), Calculated_Inv_CashInvested (decimal(20), Calculated_Inv_ConstructionProfitRatio (decimal(20), Calculated_Inv_DaysOnMarket (int), Calculated_Inv_DaysOwned (int), Calculated_Inv_Item19Year (int), Calculated_Inv_MonthsOwned (int), Calculated_Inv_OverBudget (decimal(20), Calculated_Inv_Proceeds (decimal(20), Calculated_Inv_Profit (decimal(20), Calculated_Inv_ProjectProfit (decimal(20), Calculated_Inv_RiskFactor (decimal(20), Calculated_Inv_Royalty (decimal(20), Calculated_Inv_TotalNotesPayable (decimal(20), Calculated_Inv_YearsOwned (int), Calculated_LastSoldDate (timestamptz), Calculated_LeadScore (int), Calculated_LocationGrade (decimal(20), Calculated_LocationRiskAdjustment (decimal(20), Calculated_LowEndTotalPrice (decimal(20), Calculated_MaxOffer (decimal(20), Calculated_MaxOffer_Auction_Price_Ratio (decimal(20), Calculated_MaxOffer_Original (decimal(20), Calculated_MaxOffer_Price_Ratio (decimal(20), Calculated_MlsConstructionProfitRatio (decimal(20), Calculated_MlsListCost (decimal(20), Calculated_MlsProfit (decimal(20), Calculated_MlsProfitMarketAdjusted (decimal(11), Calculated_NahConstructionProfitRatio (decimal(20), Calculated_NahProfit (decimal(20), Calculated_NahProfitMarketAdjusted (decimal(11), Calculated_Price (decimal(20), Calculated_RehabGrade (decimal(20), Calculated_ReportingStatus (text), Calculated_ReturnOnInvestment (decimal(20), Calculated_RiskFactor (decimal(20), Calculated_RiskFactorStage1 (decimal(20), Calculated_RiskFactorStage2 (decimal(20), Calculated_RiskFactorStage3 (decimal(8), Calculated_RiskFactor_Original (decimal(20), Calculated_SellerAddress (text), Calculated_SellerAddressDistance (decimal(13), Calculated_SellerCity (text), Calculated_SellerEmail (text), Calculated_SellerFirstName (text), Calculated_SellerLastName (text), Calculated_SellerMailingAddress (text), Calculated_SellerMarketingWeek (int), Calculated_SellerName (text), Calculated_SellerPhone (text), Calculated_SellerState (text), Calculated_SellerType (text), Calculated_SellerZip (text), Calculated_Stage1ArvSqFt (decimal(20), Calculated_Stage1MaxOfferPriceRatio (int), Calculated_Stage2Arv (decimal(20), Calculated_StageMaturity (int), Calculated_StarredCompsAveragePriceSqFt (decimal(20), Calculated_StarredCompsMedianPriceSqFt (decimal(20), Calculated_TotalCbGrade (decimal(20), Calculated_TotalCostOfMoney (decimal(20), Calculated_TotalQuietCosts (decimal(20), Calculated_YearsOwned (int), ConstructionCostPerSquareFoot (decimal(20), CycleTimeConstructionCompleteToSell (int), CycleTimeConstructionStartToConstructionComplete (int), CycleTimeListToSell (int), CycleTimePurchaseToConstructionComplete (int), CycleTimePurchaseToConstructionStart (int), CycleTimePurchaseToContractedSell (int), CycleTimePurchaseToList (int), CycleTimePurchaseToSell (int), CycleTimeS1ToFinalOutcome (int), FollowUpScore (int), FollowUpScore_LeadCategory_Points (decimal(20), FollowUpScore_MarketingWeek_Points (decimal(20), FollowUpScore_Status_Points (decimal(20), HasActiveInventory (boolean), HasInventory (boolean), LeadScore_AbsenteeOwnerScore_Percent (decimal(10), LeadScore_AbsenteeOwnerScore_Points (decimal(10), LeadScore_ConditionScore_Percent (decimal(10), LeadScore_ConditionScore_Points (decimal(10), LeadScore_MaxOfferPriceScore_Percent (decimal(10), LeadScore_MaxOfferPriceScore_Points (decimal(10), LeadScore_SoldAmountArvScore_Percent (decimal(10), LeadScore_SoldAmountArvScore_Points (decimal(10), LeadScore_SquareFootageScore_Percent (decimal(10), LeadScore_SquareFootageScore_Points (decimal(10), LeadScore_YearBuiltScore_Percent (decimal(10), LeadScore_YearBuiltScore_Points (decimal(10), Modified (timestamptz), ProjectedRoyaltyDate (date), PropertyId (int), Stage1ArvEstatedCombined (decimal(20), StatusSnapshot (text), ms_synced_at (timestamptz)

### ms_property_comparables (0 rows)

AdjustedPricePerSqFt (decimal(8), AdjustedSqFt (decimal(13), AgentNotes (text), AgentSelected (boolean), AuxSqFt (decimal(5), BasementAtticPercentage (decimal(3), Bathrooms (decimal(3), Bedrooms (decimal(3), Calculated_DaysOnMarket (int), Category (text), ComparableId (text), Condition (text), ConditionScore (text), ConfidenceScore (decimal(3), DaysOnMarket (int), Description (text), Distance (decimal(7), Inserted (timestamptz), Latitude (decimal(13), ListDate (date), Location (text), LocationScore (text), Longitude (decimal(13), LotSizeAcres (decimal(20), ModifiedBy (text), Notes (text), PropertyId (int), RestbScore (decimal(4), SoldDate (date), SortOrder (int), SqFt (decimal(5), Starred (boolean), UnfinishedSqFt (decimal(5), UnfinishedSqFtPercentage (decimal(3), Updated (timestamptz), UrlLink (text), Value (decimal(9), YearBuilt (text), ms_synced_at (timestamptz)

### ms_property_contacts (0 rows)

Address (text), City (text), Email (text), FirstName (text), GoHighLevelContactId (text), Inserted (timestamptz), LastName (text), Phone (text), PropertyId (int), SkipTraceLandLinePhone1 (text), SkipTraceLandLinePhone2 (text), SkipTraceLandLinePhone3 (text), SkipTraceLandLinePhone4 (text), SkipTraceLandLinePhone5 (text), SkipTraceLandLinePhone6 (text), SkipTraceMobilePhone1 (text), SkipTraceMobilePhone2 (text), SkipTraceMobilePhone3 (text), SkipTraceMobilePhone4 (text), SkipTraceMobilePhone5 (text), SkipTraceMobilePhone6 (text), SkipTraceVoipPhone1 (text), SkipTraceVoipPhone2 (text), SkipTraceVoipPhone3 (text), SkipTraceVoipPhone4 (text), SkipTraceVoipPhone5 (text), SkipTraceVoipPhone6 (text), State (text), Zip (text), ms_synced_at (timestamptz), utmCampaign (text), utmContent (text), utmMedium (text), utmSource (text)

### ms_property_corporate_notes (0 rows)

Id (int), Inserted (timestamptz), Message (text), Name (text), PropertyId (int), Updated (timestamptz), Username (text)

### ms_property_dispositions (0 rows)

AlternateAssignmentFeeExpense (decimal(13), AlternateBuyingCosts (decimal(13), AlternateCB (decimal(13), AlternateClosingCosts (decimal(13), AlternateConcessions (decimal(13), AlternateCostOfMoney (decimal(13), AlternateCostOfProperty (decimal(13), AlternateCycleMonths (decimal(13), AlternateHoldingCosts (decimal(13), AlternateOtherCosts (decimal(13), AlternatePercentSplitOfProfitTo3rdParty (decimal(6), AlternateSellingCosts (decimal(13), AlternativeArv (decimal(13), AssignmentFeeRevenue (decimal(13), Profit (decimal(13), PropertyId (int), Type (text), ms_synced_at (timestamptz)

### ms_property_inventory (49957 rows)

Inv_AnnualProForma_RentalCapEx_Actual (decimal(13), Inv_AnnualProForma_RentalHoa_Actual (decimal(13), Inv_AnnualProForma_RentalInsurance_Actual (decimal(13), Inv_AnnualProForma_RentalInterestRate_Actual (decimal(13), Inv_AnnualProForma_RentalMaintenance_Actual (decimal(13), Inv_AnnualProForma_RentalManagement_Actual (decimal(13), Inv_AnnualProForma_RentalMaxLoanToValue_Actual (decimal(13), Inv_AnnualProForma_RentalMisc_Actual (decimal(13), Inv_AnnualProForma_RentalMowing_Actual (decimal(13), Inv_AnnualProForma_RentalPrevailingCapRate_Actual (decimal(13), Inv_AnnualProForma_RentalPropertyTax_Actual (decimal(13), Inv_AnnualProForma_RentalRent_Actual (decimal(13), Inv_AnnualProForma_RentalUtilities_Actual (decimal(13), Inv_AnnualProForma_RentalVacancy_Actual (decimal(13), Inv_AssignmentFee (decimal(8), Inv_BuyingCostActual (decimal(20), Inv_BuyingCostMostMature (decimal(20), Inv_BuyingCostOriginal (decimal(20), Inv_BuyingCostRevised (decimal(20), Inv_BuyingCostStage0 (decimal(20), Inv_CityTaxesActual (decimal(20), Inv_CityTaxesMostMature (decimal(20), Inv_CityTaxesOriginal (decimal(20), Inv_CityTaxesRevised (decimal(20), Inv_CityTaxesStage0 (decimal(20), Inv_CompletionDate (timestamptz), Inv_ConcessionsActual (decimal(20), Inv_ConcessionsMostMature (decimal(20), Inv_ConcessionsOriginal (decimal(20), Inv_ConcessionsRevised (decimal(20), Inv_ConcessionsStage0 (decimal(20), Inv_ConstructionBudgetActual (decimal(20), Inv_ConstructionBudgetMostMature (decimal(20), Inv_ConstructionBudgetOriginal (decimal(20), Inv_ConstructionBudgetRevised (decimal(20), Inv_ConstructionBudgetStage0 (decimal(20), Inv_ConstructionStartDate (timestamptz), Inv_ContractedPurchaseDate (timestamptz), Inv_ContractedSellDate (timestamptz), Inv_CostOfPropertyActual (decimal(20), Inv_CostOfPropertyMostMature (decimal(20), Inv_CostOfPropertyOriginal (decimal(20), Inv_CostOfPropertyRevised (decimal(20), Inv_CostOfPropertyStage0 (decimal(20), Inv_CountyTaxesActual (decimal(20), Inv_CountyTaxesMostMature (decimal(20), Inv_CountyTaxesOriginal (decimal(20), Inv_CountyTaxesRevised (decimal(20), Inv_CountyTaxesStage0 (decimal(20), Inv_CurrentArvActual (decimal(20), Inv_CurrentArvMostMature (decimal(20), Inv_CurrentArvMostMaturePriceSqFt (decimal(20), Inv_CurrentArvOriginal (decimal(20), Inv_CurrentArvRevised (decimal(20), Inv_CurrentArvStage0 (decimal(20), Inv_Electric (text), Inv_ExpectedListPrice (text), Inv_FinanceStrategy (text), Inv_Gas (text), Inv_HoldingCostsActual (decimal(20), Inv_HoldingCostsMostMature (decimal(20), Inv_HoldingCostsOriginal (decimal(20), Inv_HoldingCostsRevised (decimal(20), Inv_HoldingCostsStage0 (decimal(20), Inv_InterestPaymentsActual (decimal(20), Inv_InterestPaymentsMostMature (decimal(20), Inv_InterestPaymentsOriginal (decimal(20), Inv_InterestPaymentsRevised (decimal(20), Inv_InterestPaymentsStage0 (decimal(20), Inv_ListDate (timestamptz), Inv_LocationGradeActual (decimal(20), Inv_LocationGradeMostMature (decimal(20), Inv_LocationGradeOriginal (decimal(20), Inv_LocationGradeRevised (decimal(20), Inv_LocationGradeStage0 (decimal(20), Inv_MaintenanceActual (decimal(20), Inv_MaintenanceMostMature (decimal(20), Inv_MaintenanceOriginal (decimal(20), Inv_MaintenanceRevised (decimal(20), Inv_MaintenanceStage0 (decimal(20), Inv_MonthlyMortgagePaymentActual (decimal(20), Inv_MonthlyMortgagePaymentMostMature (decimal(20), Inv_MonthlyMortgagePaymentOriginal (decimal(20), Inv_MonthlyMortgagePaymentRevised (decimal(20), Inv_MonthlyMortgagePaymentStage0 (decimal(20), Inv_MortgagePrincipalActual (decimal(20), Inv_MortgagePrincipalMostMature (decimal(20), Inv_MortgagePrincipalOriginal (decimal(20), Inv_MortgagePrincipalRevised (decimal(20), Inv_MortgagePrincipalStage0 (decimal(20), Inv_MowCostActual (decimal(20), Inv_MowCostMostMature (decimal(20), Inv_MowCostOriginal (decimal(20), Inv_MowCostRevised (decimal(20), Inv_MowCostStage0 (decimal(20), Inv_OccupiedDate (timestamptz), Inv_Phase5CostsActual (decimal(20), Inv_Phase5CostsMostMature (decimal(20), Inv_Phase5CostsOriginal (decimal(20), Inv_Phase5CostsRevised (decimal(20), Inv_Phase5CostsStage0 (decimal(20), Inv_PriceActual (decimal(20), Inv_PriceMostMature (decimal(20), Inv_PriceOriginal (decimal(20), Inv_PriceRevised (decimal(20), Inv_PriceStage0 (decimal(20), Inv_PurchaseDate (timestamptz), Inv_RefiCostsActual (decimal(20), Inv_RefiCostsMostMature (decimal(20), Inv_RefiCostsOriginal (decimal(20), Inv_RefiCostsRevised (decimal(20), Inv_RefiCostsStage0 (decimal(20), Inv_RentalIncomeActual (decimal(20), Inv_RentalIncomeMostMature (decimal(20), Inv_RentalIncomeOriginal (decimal(20), Inv_RentalIncomeRevised (decimal(20), Inv_RentalIncomeStage0 (decimal(20), Inv_SalesTeamInfo (text), Inv_SellDate (timestamptz), Inv_SellingCostsActual (decimal(20), Inv_SellingCostsMostMature (decimal(20), Inv_SellingCostsOriginal (decimal(20), Inv_SellingCostsRevised (decimal(20), Inv_SellingCostsStage0 (decimal(20), Inv_Septic (text), Inv_Status (text), Inv_Type (text), Inv_UtilityProviders (text), Inv_Water (text), PropertyId (int), ms_synced_at (timestamptz)

### ms_property_media (0 rows)

Error (boolean), FileExtension (text), Inserted (timestamptz), MediaCategory (text), OriginalFileName (text), PropertyId (int), ThumbnailUrl (text), Type (text), Url (text), YoutubeUrl (text)

### ms_property_mortgages (0 rows)

Amount (decimal(13), Calculated_EstimatedPayoff (decimal(20), Date (date), DeedType (text), DetailsJson (text), DueDate (date), Enabled (boolean), KnownInterestRate (decimal(6), LenderName (text), LoanType (text), PropertyId (int), PropertyMortgageId (int), RateType (text), Term (int), ms_synced_at (timestamptz)

### ms_property_notes (0 rows)

Note_AprPercentage (decimal(13), Note_Calculated_NoteBalance (decimal(20), Note_Calculated_NotePayable (decimal(20), Note_CommittedForDate (date), Note_Date (date), Note_Fees (decimal(20), Note_Holder (text), Note_Id (int), Note_InterestCompounded (boolean), Note_InterestPayable (decimal(20), Note_InterestPayableMessage (text), Note_MaturityDate (date), Note_MinimumFlatPercentage (decimal(13), Note_Points (decimal(20), Note_Principal (decimal(13), Note_Type (text), PropertyId (int), ms_synced_at (timestamptz)

### ms_property_royalty (0 rows)

AcquisitionRoyaltyOverride (decimal(8), AcquisitionRoyaltyPaid (decimal(8), AcquisitionRoyaltyPaidDate (date), Calculated_AcquisitionRoyalty (decimal(8), Calculated_AcquisitionRoyaltyDue (decimal(8), Calculated_AcquisitionRoyaltyDueDate (date), Calculated_DelayedRoyaltyFee (decimal(8), Calculated_DelayedRoyaltyFeeDue (decimal(8), Calculated_DelayedRoyaltyFeeDueDate (date), Calculated_DispositionRoyalty (decimal(8), Calculated_DispositionRoyaltyDue (decimal(8), Calculated_DispositionRoyaltyDueDate (date), Calculated_RoyaltyTrueUp (decimal(8), Calculated_RoyaltyTrueUpDue (decimal(8), Calculated_RoyaltyTrueUpDueDate (date), DelayedRoyaltyFeeOverride (decimal(8), DelayedRoyaltyFeePaid (decimal(8), DelayedRoyaltyFeePaidDate (date), DispositionRoyaltyOverride (decimal(8), DispositionRoyaltyPaid (decimal(8), DispositionRoyaltyPaidDate (date), LockedInMedianSalePriceMax (decimal(10), LockedInMedianSalePriceMaxSetDate (timestamptz), PropertyId (int), RoyaltyPaidAtOverride (text), RoyaltyTrueUpOverride (decimal(8), RoyaltyTrueUpPaid (decimal(8), RoyaltyTrueUpPaidDate (date), RoyaltyVersionOverride (int), ms_synced_at (timestamptz)

### ms_property_stage0 (0 rows)

AuxFinishedSqFt (decimal(20), Bathrooms (decimal(20), Bedrooms (decimal(20), CensusTract (text), EffectiveYear (text), LastSoldDate (timestamptz), LastSoldPrice (decimal(20), LatLongSource (text), Latitude (text), Longitude (text), LotSizeAcres (decimal(20), OwnerAddress (text), OwnerCity (text), OwnerEmail (text), OwnerName (text), OwnerPhone (text), OwnerPhoneNormalized (text), OwnerState (text), OwnerZip (text), PropertyId (int), PropertyType (text), SqFtBase (decimal(20), Stage0Type (text), TaxValue (decimal(20), TrusteeAddress (text), TrusteeCity (text), TrusteeEmail (text), TrusteeName (text), TrusteePhone (text), TrusteeState (text), TrusteeZip (text), UnfinishedSqFt (decimal(20), Valuation (decimal(20), ValuationHigh (decimal(20), ValuationLow (decimal(20), YearBuilt (text)

### ms_property_stage1 (0 rows)

PropertyId (int), S1_AuxFinishedSqFt (decimal(20), S1_Bathrooms (decimal(20), S1_Bedrooms (decimal(20), S1_CensusTract (text), S1_EffectiveYear (text), S1_LastSoldDate (timestamptz), S1_LastSoldPrice (decimal(20), S1_LotSizeAcres (decimal(20), S1_OwnerAddress (text), S1_OwnerCity (text), S1_OwnerEmail (text), S1_OwnerName (text), S1_OwnerPhone (text), S1_OwnerPhoneNormalized (text), S1_OwnerState (text), S1_OwnerZip (text), S1_PropertyType (text), S1_SqFtBase (decimal(20), S1_TaxValue (decimal(20), S1_TrusteeAddress (text), S1_TrusteeCity (text), S1_TrusteeEmail (text), S1_TrusteeName (text), S1_TrusteePhone (text), S1_TrusteeState (text), S1_TrusteeZip (text), S1_UnfinishedSqFt (decimal(20), S1_YearBuilt (text)

### ms_property_status_history (117308 rows)

Inserted (timestamptz), NewStatus (text), PreviousStatus (text), PropertyId (int)

### ms_property_status_timelines (0 rows)

DaysBetweenFirstStageToStage4 (int), DaysBetweenInsertedToFirstStage (int), FirstStageDate (timestamptz), PropertyId (int), Stage4Date (timestamptz)

### ms_report_variable_configuration (0 rows)

Description (text), Hidden (boolean), Name (text), SortOrder (int), TutorialTextToken (text), UserFriendlyName (text), UserInterfaceFormatter (text), UserInterfaceFormatterArgument1 (text)

### ms_report_variables (0 rows)

ArvPercentAuxSqFt (decimal(13), ArvPercentSqFt (decimal(13), ArvPercentUnfinishedSqFt (decimal(13), ConstructionBudgetDefaultRehabGrade (decimal(13), ConstructionBudgetDefaultRehabGradeForeclosure (decimal(20), ConstructionBudgetDefaultRehabGradeTax (decimal(20), ConstructionBudgetS1 (decimal(13), DefaultLocationGrade (decimal(13), EstimatedDaysBetweenConstructionEndAndSell (int), EstimatedDaysBetweenPurchaseAndConstructionStart (int), InvRentalCapEx (decimal(10), InvRentalHoa (decimal(10), InvRentalInsurance (decimal(10), InvRentalInterestRate (decimal(10), InvRentalMaintenance (decimal(10), InvRentalManagement (decimal(10), InvRentalMaxLtvPercent (decimal(10), InvRentalMisc (decimal(10), InvRentalMowing (decimal(10), InvRentalMowingMonthsPerYear (int), InvRentalNoteTerm (int), InvRentalPrevailingCapRate (decimal(10), InvRentalPropertyTax (decimal(10), InvRentalRentAsf (decimal(10), InvRentalTargetRentAllIn (decimal(10), InvRentalUtilities (decimal(10), InvRentalVacancy (decimal(10), LeadScoreIdealSquareFootage (int), LeadScoreIdealSquareFootageHigh (int), LeadScoreIdealSquareFootageLow (int), LeadScoreIdealYearBuilt (int), LeadScoreIdealYearBuiltHigh (int), LeadScoreIdealYearBuiltLow (int), NarRegion (text), QuietCostsAgentSellCommissions (decimal(5), QuietCostsBuyingCost (decimal(8), QuietCostsClosingCostPercentage (decimal(5), QuietCostsEstimatedCycleMonths (int), QuietCostsHoldingCost (decimal(5), QuietCostsInterestRate (decimal(5), QuietCostsMaxClosingCost (decimal(8), QuietCostsMoneyFees (decimal(8), QuietCostsMoneyPoints (decimal(5), QuietCostsPercentOfConstructionFinanced (decimal(5), QuietCostsPercentOfPurchaseFinanced (decimal(5), RiskFactorArvMaxPercentage (decimal(13), RiskFactorArvPercentageIncrement (decimal(13), RiskFactorBasePercentage (decimal(13), RiskFactorComparableRiskPercentageAdjustment (decimal(13), RiskFactorIntangibleScoreAdjustment (decimal(13), RiskFactorLocationPercentageAdjustment (decimal(13), RiskFactorMaxPercentage (decimal(13), RoyaltyPaidAt (text), RoyaltyVersion (int), TargetCbSpendPerDay (decimal(10), TerritorySlug (text)

### ms_stage0_types (0 rows)

Type (text)

### ms_territory_associated_counties (0 rows)

CountyName (text), State (text), TerritorySlug (text)

### ms_territory_associated_zip_codes (0 rows)

TerritorySlug (text), ZipCode (text)

### ms_territory_badges (0 rows)

DisplayName (text), GroupName (text), ImageUrl (text), Levels (int), TerritoryBadgeId (int)

### ms_territory_badges_earned (0 rows)

CurrentLevel (int), Id (int), TerritoryBadgeId (int), TerritorySlug (text)

### ms_territory_dashboard_links (0 rows)

Name (text), TerritorySlug (text), Url (text)

### ms_territory_inbox (0 rows)

FormSubmissionId (int), FormType (text), From (text), Inserted (timestamptz), Message (text), PropertyId (int), TerritoryInboxId (int), TerritorySlug (text)

### ms_territory_variables (0 rows)

InvRentalCapEx (decimal(10), InvRentalHoa (decimal(10), InvRentalInsurance (decimal(10), InvRentalInterestRate (decimal(10), InvRentalMaintenance (decimal(10), InvRentalManagement (decimal(10), InvRentalMaxLtvPercent (decimal(10), InvRentalMisc (decimal(10), InvRentalMowing (decimal(10), InvRentalMowingMonthsPerYear (int), InvRentalNoteTerm (int), InvRentalPrevailingCapRate (decimal(10), InvRentalPropertyTax (decimal(10), InvRentalRentAsf (decimal(10), InvRentalTargetRentAllIn (decimal(10), InvRentalUtilities (decimal(10), InvRentalVacancy (decimal(10), LeadScoreIdealSquareFootage (int), LeadScoreIdealSquareFootageHigh (int), LeadScoreIdealSquareFootageLow (int), LeadScoreIdealYearBuilt (int), LeadScoreIdealYearBuiltHigh (int), LeadScoreIdealYearBuiltLow (int), PropertyId (int), RoyaltyPaidAt (text), RoyaltyVersion (int), TerritorySlug (text)

### ms_user_territories (0 rows)

TerritorySlug (text), UserId (int)

### ms_zillow_home_value_forecast_county (0 rows)

County (text), ForecastYoYPctChange (decimal(20), State (text)

### ms_zillow_home_value_forecast_zip (0 rows)

ForecastYoYPctChange (decimal(20), Zip (text)

### ms_zillow_median_sales_price_county (0 rows)

County (text), MedianSalesPrice (decimal(20), SizeRank (int), State (text)

### ms_zillow_median_sales_price_zip (0 rows)

MedianSalesPrice (decimal(20), SizeRank (int), Zip (text)

### ms_zillow_sfh_time_series_county (0 rows)

County (text), HomeValueIndex (decimal(20), SizeRank (int), State (text)

### ms_zillow_sfh_time_series_zip (0 rows)

HomeValueIndex (decimal(20), SizeRank (int), Zip (text)

### ms_zip_code_avg_price_sqft (0 rows)

LastUpdatedUtc (timestamptz), PriceSqFt (decimal(13), R1 (decimal(10), R1DaysOnMarket (decimal(10), R1n (decimal(10), R1nDaysOnMarket (decimal(10), R2 (decimal(10), R2DaysOnMarket (decimal(10), R2n (decimal(10), R2nDaysOnMarket (decimal(10), R3 (decimal(10), R3DaysOnMarket (decimal(10), R3n (decimal(10), R3nDaysOnMarket (decimal(10), R4 (decimal(10), R4DaysOnMarket (decimal(10), R4n (decimal(10), R4nDaysOnMarket (decimal(10), R5 (decimal(10), R5DaysOnMarket (decimal(10), R5n (decimal(10), R5nDaysOnMarket (decimal(10), R6 (decimal(10), R6DaysOnMarket (decimal(10), R6n (decimal(10), R6nDaysOnMarket (decimal(10), ZipCode (text)

### ms_zip_code_locations (0 rows)

City (text), CountyName (text), Metro (text), State (text), ZipCode (text)
