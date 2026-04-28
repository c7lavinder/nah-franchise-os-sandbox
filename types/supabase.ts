export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_encrypted: boolean | null
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: unknown
          description?: unknown
          id?: unknown
          is_encrypted?: unknown
          setting_key: unknown
          setting_value: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          description?: unknown
          id?: unknown
          is_encrypted?: unknown
          setting_key?: unknown
          setting_value?: unknown
          updated_at?: unknown
        }
      }
      call_action_feedback: {
        Row: {
          action: string
          call_action_item_id: string | null
          created_at: string
          edit_diff: string | null
          extraction_id: string | null
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          action: unknown
          call_action_item_id?: unknown
          created_at?: unknown
          edit_diff?: unknown
          extraction_id?: unknown
          id?: unknown
          payload?: unknown
          user_id?: unknown
        }
        Update: {
          action?: unknown
          call_action_item_id?: unknown
          created_at?: unknown
          edit_diff?: unknown
          extraction_id?: unknown
          id?: unknown
          payload?: unknown
          user_id?: unknown
        }
      }
      call_action_items: {
        Row: {
          assigned_to_name: string | null
          call_id: string
          category: string
          contact_id: string | null
          contact_name: string | null
          created_at: string
          description: string | null
          ghl_action: boolean
          id: string
          journey_id: string | null
          metadata: Json | null
          original_description: string | null
          original_title: string | null
          pushed_at: string | null
          skipped_at: string | null
          source: string
          status: string
          title: string
          updated_at: string
          why: string | null
        }
        Insert: {
          assigned_to_name?: unknown
          call_id?: unknown
          category: unknown
          contact_id?: unknown
          contact_name?: unknown
          created_at?: unknown
          description?: unknown
          ghl_action?: unknown
          id?: unknown
          journey_id?: unknown
          metadata?: unknown
          original_description?: unknown
          original_title?: unknown
          pushed_at?: unknown
          skipped_at?: unknown
          source?: unknown
          status?: unknown
          title: unknown
          updated_at?: unknown
          why?: unknown
        }
        Update: {
          assigned_to_name?: unknown
          call_id?: unknown
          category?: unknown
          contact_id?: unknown
          contact_name?: unknown
          created_at?: unknown
          description?: unknown
          ghl_action?: unknown
          id?: unknown
          journey_id?: unknown
          metadata?: unknown
          original_description?: unknown
          original_title?: unknown
          pushed_at?: unknown
          skipped_at?: unknown
          source?: unknown
          status?: unknown
          title?: unknown
          updated_at?: unknown
          why?: unknown
        }
      }
      call_coaching: {
        Row: {
          call_id: string
          coaching_notes: string | null
          coaching_plan: string | null
          created_at: string
          created_by: string
          id: string
          kb_snippets_used: string[] | null
          scout_model: string | null
        }
        Insert: {
          call_id?: unknown
          coaching_notes?: unknown
          coaching_plan?: unknown
          created_at?: unknown
          created_by?: unknown
          id?: unknown
          kb_snippets_used?: unknown
          scout_model?: unknown
        }
        Update: {
          call_id?: unknown
          coaching_notes?: unknown
          coaching_plan?: unknown
          created_at?: unknown
          created_by?: unknown
          id?: unknown
          kb_snippets_used?: unknown
          scout_model?: unknown
        }
      }
      call_data_extractions: {
        Row: {
          call_id: string
          confidence: string | null
          contact_id: string | null
          created_at: string
          dismissed: boolean
          extracted_value: string | null
          field_category: string
          field_key: string
          id: string
          journey_id: string | null
          saved_to_profile: boolean
          source: string
          target_scope: string | null
          territory_ms_slug: string | null
        }
        Insert: {
          call_id?: unknown
          confidence?: unknown
          contact_id?: unknown
          created_at?: unknown
          dismissed?: unknown
          extracted_value?: unknown
          field_category: unknown
          field_key: unknown
          id?: unknown
          journey_id?: unknown
          saved_to_profile?: unknown
          source?: unknown
          target_scope?: unknown
          territory_ms_slug?: unknown
        }
        Update: {
          call_id?: unknown
          confidence?: unknown
          contact_id?: unknown
          created_at?: unknown
          dismissed?: unknown
          extracted_value?: unknown
          field_category?: unknown
          field_key?: unknown
          id?: unknown
          journey_id?: unknown
          saved_to_profile?: unknown
          source?: unknown
          target_scope?: unknown
          territory_ms_slug?: unknown
        }
      }
      call_grades: {
        Row: {
          call_id: string
          created_at: string
          criterion_scores: Json | null
          graded_by: string
          id: string
          improvements: string[] | null
          overall_grade: string | null
          overall_score: number | null
          rubric_id: string | null
          scout_model: string | null
          strengths: string[] | null
          suggested_next_action: string | null
        }
        Insert: {
          call_id?: unknown
          created_at?: unknown
          criterion_scores?: unknown
          graded_by?: unknown
          id?: unknown
          improvements?: unknown
          overall_grade?: unknown
          overall_score?: unknown
          rubric_id?: unknown
          scout_model?: unknown
          strengths?: unknown
          suggested_next_action?: unknown
        }
        Update: {
          call_id?: unknown
          created_at?: unknown
          criterion_scores?: unknown
          graded_by?: unknown
          id?: unknown
          improvements?: unknown
          overall_grade?: unknown
          overall_score?: unknown
          rubric_id?: unknown
          scout_model?: unknown
          strengths?: unknown
          suggested_next_action?: unknown
        }
      }
      call_journeys: {
        Row: {
          call_id: string
          created_at: string
          id: string
          is_primary: boolean
          journey_id: string
          journey_pipeline_state_id: string
        }
        Insert: {
          call_id?: unknown
          created_at?: unknown
          id?: unknown
          is_primary?: unknown
          journey_id?: unknown
          journey_pipeline_state_id?: unknown
        }
        Update: {
          call_id?: unknown
          created_at?: unknown
          id?: unknown
          is_primary?: unknown
          journey_id?: unknown
          journey_pipeline_state_id?: unknown
        }
      }
      call_logs: {
        Row: {
          ai_prefilled: boolean | null
          call_type: string
          called_at: string | null
          contact_id: string
          created_at: string | null
          fields: Json
          human_confirmed: boolean | null
          id: string
          logged_at: string | null
          logged_by: string
          notes: string | null
          red_flags_raised: string | null
          rep_confidence: string | null
          transcript_url: string | null
        }
        Insert: {
          ai_prefilled?: unknown
          call_type: unknown
          called_at?: unknown
          contact_id: unknown
          created_at?: unknown
          fields: unknown
          human_confirmed?: unknown
          id?: unknown
          logged_at?: unknown
          logged_by: unknown
          notes?: unknown
          red_flags_raised?: unknown
          rep_confidence?: unknown
          transcript_url?: unknown
        }
        Update: {
          ai_prefilled?: unknown
          call_type?: unknown
          called_at?: unknown
          contact_id?: unknown
          created_at?: unknown
          fields?: unknown
          human_confirmed?: unknown
          id?: unknown
          logged_at?: unknown
          logged_by?: unknown
          notes?: unknown
          red_flags_raised?: unknown
          rep_confidence?: unknown
          transcript_url?: unknown
        }
      }
      call_participants: {
        Row: {
          call_id: string
          contact_id: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          journey_pipeline_state_id: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          call_id?: unknown
          contact_id?: unknown
          created_at?: unknown
          display_name?: unknown
          email?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          role: unknown
          user_id?: unknown
        }
        Update: {
          call_id?: unknown
          contact_id?: unknown
          created_at?: unknown
          display_name?: unknown
          email?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          role?: unknown
          user_id?: unknown
        }
      }
      call_review_packages: {
        Row: {
          call_id: string
          coaching_citations: Json | null
          coaching_feedback: string | null
          contact_id: string | null
          created_at: string
          grade: string | null
          grade_detail: Json | null
          id: string
          next_step_cards: Json | null
          profile_suggestions: Json | null
          rep_id: string | null
          status: string
        }
        Insert: {
          call_id?: unknown
          coaching_citations?: unknown
          coaching_feedback?: unknown
          contact_id?: unknown
          created_at?: unknown
          grade?: unknown
          grade_detail?: unknown
          id?: unknown
          next_step_cards?: unknown
          profile_suggestions?: unknown
          rep_id?: unknown
          status?: unknown
        }
        Update: {
          call_id?: unknown
          coaching_citations?: unknown
          coaching_feedback?: unknown
          contact_id?: unknown
          created_at?: unknown
          grade?: unknown
          grade_detail?: unknown
          id?: unknown
          next_step_cards?: unknown
          profile_suggestions?: unknown
          rep_id?: unknown
          status?: unknown
        }
      }
      call_territories: {
        Row: {
          call_id: string
          created_at: string
          id: string
          is_primary: boolean
          territory_ms_slug: string
        }
        Insert: {
          call_id?: unknown
          created_at?: unknown
          id?: unknown
          is_primary?: unknown
          territory_ms_slug: unknown
        }
        Update: {
          call_id?: unknown
          created_at?: unknown
          id?: unknown
          is_primary?: unknown
          territory_ms_slug?: unknown
        }
      }
      call_transcripts: {
        Row: {
          call_id: string
          created_at: string
          full_text: string
          id: string
          language: string | null
          metadata: Json | null
          source: string
          word_count: number | null
        }
        Insert: {
          call_id?: unknown
          created_at?: unknown
          full_text: unknown
          id?: unknown
          language?: unknown
          metadata?: unknown
          source: unknown
          word_count?: unknown
        }
        Update: {
          call_id?: unknown
          created_at?: unknown
          full_text?: unknown
          id?: unknown
          language?: unknown
          metadata?: unknown
          source?: unknown
          word_count?: unknown
        }
      }
      call_types: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category?: unknown
          created_at?: unknown
          description?: unknown
          id?: unknown
          name: unknown
          slug: unknown
          updated_at?: unknown
        }
        Update: {
          category?: unknown
          created_at?: unknown
          description?: unknown
          id?: unknown
          name?: unknown
          slug?: unknown
          updated_at?: unknown
        }
      }
      calls: {
        Row: {
          action_items: Json | null
          ai_summary: string | null
          ai_summary_generated_at: string | null
          brief_context: string | null
          brief_generated_at: string | null
          call_type_id: string
          classification_reason: string | null
          coach_user_id: string | null
          coaching_data: Json | null
          coaching_generated_at: string | null
          coaching_score: number | null
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          ghl_event_id: string | null
          hosted_by_user_id: string | null
          id: string
          journey_pipeline_state_id: string | null
          kb_intel_items: Json | null
          match_confidence: number | null
          match_reason: string | null
          meeting_link: string | null
          participant_count: number | null
          raw_transcript: string | null
          read_ai_session_id: string | null
          recording_url: string | null
          scheduled_at: string | null
          source: string | null
          started_at: string | null
          status: string
          sub_task_id: string | null
          summary: string | null
          summary_bullets: string[] | null
          territory_ms_slug: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          action_items?: unknown
          ai_summary?: unknown
          ai_summary_generated_at?: unknown
          brief_context?: unknown
          brief_generated_at?: unknown
          call_type_id?: unknown
          classification_reason?: unknown
          coach_user_id?: unknown
          coaching_data?: unknown
          coaching_generated_at?: unknown
          coaching_score?: unknown
          contact_id?: unknown
          created_at?: unknown
          deleted_at?: unknown
          duration_seconds?: unknown
          ended_at?: unknown
          ghl_event_id?: unknown
          hosted_by_user_id?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          kb_intel_items?: unknown
          match_confidence?: unknown
          match_reason?: unknown
          meeting_link?: unknown
          participant_count?: unknown
          raw_transcript?: unknown
          read_ai_session_id?: unknown
          recording_url?: unknown
          scheduled_at?: unknown
          source?: unknown
          started_at?: unknown
          status?: unknown
          sub_task_id?: unknown
          summary?: unknown
          summary_bullets?: unknown
          territory_ms_slug?: unknown
          title?: unknown
          updated_at?: unknown
        }
        Update: {
          action_items?: unknown
          ai_summary?: unknown
          ai_summary_generated_at?: unknown
          brief_context?: unknown
          brief_generated_at?: unknown
          call_type_id?: unknown
          classification_reason?: unknown
          coach_user_id?: unknown
          coaching_data?: unknown
          coaching_generated_at?: unknown
          coaching_score?: unknown
          contact_id?: unknown
          created_at?: unknown
          deleted_at?: unknown
          duration_seconds?: unknown
          ended_at?: unknown
          ghl_event_id?: unknown
          hosted_by_user_id?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          kb_intel_items?: unknown
          match_confidence?: unknown
          match_reason?: unknown
          meeting_link?: unknown
          participant_count?: unknown
          raw_transcript?: unknown
          read_ai_session_id?: unknown
          recording_url?: unknown
          scheduled_at?: unknown
          source?: unknown
          started_at?: unknown
          status?: unknown
          sub_task_id?: unknown
          summary?: unknown
          summary_bullets?: unknown
          territory_ms_slug?: unknown
          title?: unknown
          updated_at?: unknown
        }
      }
      candidate_intelligence: {
        Row: {
          active_flags: Json | null
          avg_response_time_hours: number | null
          construction_comfort: string | null
          contact_id: string
          created_at: string | null
          current_score: number | null
          disc_profile: string | null
          financial_red_flags: Json | null
          funding_path: string | null
          ghl_location_id: string
          homework_completion_rate: number | null
          id: string
          illiquid_capital: number | null
          liquid_capital: number | null
          net_worth_bucket: string | null
          outstanding_liabilities: string | null
          personality_flags: Json | null
          pfs_received: boolean | null
          pfs_uploaded_url: string | null
          prior_business_owner: boolean | null
          prior_business_type: string | null
          risk_tolerance_score: number | null
          score_engagement: number | null
          score_financial: number | null
          score_momentum: number | null
          score_operational: number | null
          spouse_supportive: string | null
          stated_motivation: string | null
          trainual_completion_pct: number | null
          trainual_last_activity: string | null
          updated_at: string | null
          urgency: string | null
          zorakle_completed: boolean | null
          zorakle_results: Json | null
        }
        Insert: {
          active_flags?: unknown
          avg_response_time_hours?: unknown
          construction_comfort?: unknown
          contact_id: unknown
          created_at?: unknown
          current_score?: unknown
          disc_profile?: unknown
          financial_red_flags?: unknown
          funding_path?: unknown
          ghl_location_id: unknown
          homework_completion_rate?: unknown
          id?: unknown
          illiquid_capital?: unknown
          liquid_capital?: unknown
          net_worth_bucket?: unknown
          outstanding_liabilities?: unknown
          personality_flags?: unknown
          pfs_received?: unknown
          pfs_uploaded_url?: unknown
          prior_business_owner?: unknown
          prior_business_type?: unknown
          risk_tolerance_score?: unknown
          score_engagement?: unknown
          score_financial?: unknown
          score_momentum?: unknown
          score_operational?: unknown
          spouse_supportive?: unknown
          stated_motivation?: unknown
          trainual_completion_pct?: unknown
          trainual_last_activity?: unknown
          updated_at?: unknown
          urgency?: unknown
          zorakle_completed?: unknown
          zorakle_results?: unknown
        }
        Update: {
          active_flags?: unknown
          avg_response_time_hours?: unknown
          construction_comfort?: unknown
          contact_id?: unknown
          created_at?: unknown
          current_score?: unknown
          disc_profile?: unknown
          financial_red_flags?: unknown
          funding_path?: unknown
          ghl_location_id?: unknown
          homework_completion_rate?: unknown
          id?: unknown
          illiquid_capital?: unknown
          liquid_capital?: unknown
          net_worth_bucket?: unknown
          outstanding_liabilities?: unknown
          personality_flags?: unknown
          pfs_received?: unknown
          pfs_uploaded_url?: unknown
          prior_business_owner?: unknown
          prior_business_type?: unknown
          risk_tolerance_score?: unknown
          score_engagement?: unknown
          score_financial?: unknown
          score_momentum?: unknown
          score_operational?: unknown
          spouse_supportive?: unknown
          stated_motivation?: unknown
          trainual_completion_pct?: unknown
          trainual_last_activity?: unknown
          updated_at?: unknown
          urgency?: unknown
          zorakle_completed?: unknown
          zorakle_results?: unknown
        }
      }
      candidate_score_history: {
        Row: {
          changes_explained: Json | null
          contact_id: string
          created_at: string | null
          engagement_after: number | null
          engagement_before: number | null
          financial_after: number | null
          financial_before: number | null
          id: string
          momentum_after: number | null
          momentum_before: number | null
          operational_after: number | null
          operational_before: number | null
          score_after: number | null
          score_before: number | null
          trigger_id: string | null
          triggered_by: string
        }
        Insert: {
          changes_explained?: unknown
          contact_id: unknown
          created_at?: unknown
          engagement_after?: unknown
          engagement_before?: unknown
          financial_after?: unknown
          financial_before?: unknown
          id?: unknown
          momentum_after?: unknown
          momentum_before?: unknown
          operational_after?: unknown
          operational_before?: unknown
          score_after?: unknown
          score_before?: unknown
          trigger_id?: unknown
          triggered_by: unknown
        }
        Update: {
          changes_explained?: unknown
          contact_id?: unknown
          created_at?: unknown
          engagement_after?: unknown
          engagement_before?: unknown
          financial_after?: unknown
          financial_before?: unknown
          id?: unknown
          momentum_after?: unknown
          momentum_before?: unknown
          operational_after?: unknown
          operational_before?: unknown
          score_after?: unknown
          score_before?: unknown
          trigger_id?: unknown
          triggered_by?: unknown
        }
      }
      coach_assignments: {
        Row: {
          assigned_at: string | null
          coach_user_id: string
          ended_at: string | null
          id: string
          specialty: string | null
          territory_ms_slug: string
        }
        Insert: {
          assigned_at?: unknown
          coach_user_id: unknown
          ended_at?: unknown
          id?: unknown
          specialty?: unknown
          territory_ms_slug: unknown
        }
        Update: {
          assigned_at?: unknown
          coach_user_id?: unknown
          ended_at?: unknown
          id?: unknown
          specialty?: unknown
          territory_ms_slug?: unknown
        }
      }
      contact_activity_messages: {
        Row: {
          author_user_id: string
          body: string
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          mentioned_user_ids: string[] | null
          updated_at: string
        }
        Insert: {
          author_user_id?: unknown
          body: unknown
          contact_id?: unknown
          created_at?: unknown
          deleted_at?: unknown
          id?: unknown
          mentioned_user_ids?: unknown
          updated_at?: unknown
        }
        Update: {
          author_user_id?: unknown
          body?: unknown
          contact_id?: unknown
          created_at?: unknown
          deleted_at?: unknown
          id?: unknown
          mentioned_user_ids?: unknown
          updated_at?: unknown
        }
      }
      contact_emails: {
        Row: {
          contact_id: string
          created_at: string
          email: string
          id: string
          is_primary: boolean
          label: string | null
          source: string
          updated_at: string
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          email: unknown
          id?: unknown
          is_primary?: unknown
          label?: unknown
          source?: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          email?: unknown
          id?: unknown
          is_primary?: unknown
          label?: unknown
          source?: unknown
          updated_at?: unknown
        }
      }
      contact_journals: {
        Row: {
          contact_id: string
          created_at: string
          embedding_id: string | null
          id: string
          interactions: Json
          journal_date: string
          signals_extracted: Json
          summary: string
          tenant_id: string | null
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          embedding_id?: unknown
          id?: unknown
          interactions: unknown
          journal_date: unknown
          signals_extracted: unknown
          summary: unknown
          tenant_id?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          embedding_id?: unknown
          id?: unknown
          interactions?: unknown
          journal_date?: unknown
          signals_extracted?: unknown
          summary?: unknown
          tenant_id?: unknown
        }
      }
      contact_profile_data: {
        Row: {
          competitor_notes: string | null
          created_at: string
          decision_style: string | null
          definition_of_success: string | null
          desired_territory: string | null
          financing_type: string | null
          ghl_contact_id: string
          guidant_robs_active: boolean | null
          liquid_capital: number | null
          local_market_notes: string | null
          market_area: string | null
          net_worth_estimate: number | null
          objections_raised: string | null
          pfs_received: boolean | null
          primary_motivation: string | null
          prior_re_experience: string | null
          secondary_territory: string | null
          skill_set_notes: string | null
          territory_value_est: number | null
          updated_at: string
          zip_codes_of_interest: string | null
        }
        Insert: {
          competitor_notes?: unknown
          created_at?: unknown
          decision_style?: unknown
          definition_of_success?: unknown
          desired_territory?: unknown
          financing_type?: unknown
          ghl_contact_id: unknown
          guidant_robs_active?: unknown
          liquid_capital?: unknown
          local_market_notes?: unknown
          market_area?: unknown
          net_worth_estimate?: unknown
          objections_raised?: unknown
          pfs_received?: unknown
          primary_motivation?: unknown
          prior_re_experience?: unknown
          secondary_territory?: unknown
          skill_set_notes?: unknown
          territory_value_est?: unknown
          updated_at?: unknown
          zip_codes_of_interest?: unknown
        }
        Update: {
          competitor_notes?: unknown
          created_at?: unknown
          decision_style?: unknown
          definition_of_success?: unknown
          desired_territory?: unknown
          financing_type?: unknown
          ghl_contact_id?: unknown
          guidant_robs_active?: unknown
          liquid_capital?: unknown
          local_market_notes?: unknown
          market_area?: unknown
          net_worth_estimate?: unknown
          objections_raised?: unknown
          pfs_received?: unknown
          primary_motivation?: unknown
          prior_re_experience?: unknown
          secondary_territory?: unknown
          skill_set_notes?: unknown
          territory_value_est?: unknown
          updated_at?: unknown
          zip_codes_of_interest?: unknown
        }
      }
      contact_profile_fields: {
        Row: {
          contact_id: string
          created_at: string
          field_name: string
          field_value: Json | null
          id: string
          last_updated_at: string
          last_updated_by: string
          source_history: Json
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          field_name: unknown
          field_value?: unknown
          id?: unknown
          last_updated_at?: unknown
          last_updated_by?: unknown
          source_history: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          field_name?: unknown
          field_value?: unknown
          id?: unknown
          last_updated_at?: unknown
          last_updated_by?: unknown
          source_history?: unknown
        }
      }
      contact_related_people: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string | null
          id: string
          is_primary_decision_maker: boolean
          last_name: string | null
          linked_contact_id: string | null
          phone: string | null
          relationship_notes: string | null
          role: string
          updated_at: string
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          deleted_at?: unknown
          email?: unknown
          first_name?: unknown
          id?: unknown
          is_primary_decision_maker?: unknown
          last_name?: unknown
          linked_contact_id?: unknown
          phone?: unknown
          relationship_notes?: unknown
          role?: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          deleted_at?: unknown
          email?: unknown
          first_name?: unknown
          id?: unknown
          is_primary_decision_maker?: unknown
          last_name?: unknown
          linked_contact_id?: unknown
          phone?: unknown
          relationship_notes?: unknown
          role?: unknown
          updated_at?: unknown
        }
      }
      contact_scores: {
        Row: {
          confidence: string | null
          created_at: string
          expires_at: string | null
          ghl_contact_id: string
          id: string
          reason: string | null
          score_type: string
          score_value: string
          source: string
          updated_at: string
        }
        Insert: {
          confidence?: unknown
          created_at?: unknown
          expires_at?: unknown
          ghl_contact_id: unknown
          id?: unknown
          reason?: unknown
          score_type: unknown
          score_value: unknown
          source?: unknown
          updated_at?: unknown
        }
        Update: {
          confidence?: unknown
          created_at?: unknown
          expires_at?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          reason?: unknown
          score_type?: unknown
          score_value?: unknown
          source?: unknown
          updated_at?: unknown
        }
      }
      contact_sub_task_logs: {
        Row: {
          content_file_url: string | null
          content_link_url: string | null
          content_text: string | null
          content_type: string
          created_at: string
          deleted_at: string | null
          id: string
          journey_pipeline_state_id: string
          logger_user_id: string | null
          metadata: Json | null
          source: string
          state_advance: string | null
          sub_task_id: string
          updated_at: string
        }
        Insert: {
          content_file_url?: unknown
          content_link_url?: unknown
          content_text?: unknown
          content_type?: unknown
          created_at?: unknown
          deleted_at?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          logger_user_id?: unknown
          metadata?: unknown
          source?: unknown
          state_advance?: unknown
          sub_task_id?: unknown
          updated_at?: unknown
        }
        Update: {
          content_file_url?: unknown
          content_link_url?: unknown
          content_text?: unknown
          content_type?: unknown
          created_at?: unknown
          deleted_at?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          logger_user_id?: unknown
          metadata?: unknown
          source?: unknown
          state_advance?: unknown
          sub_task_id?: unknown
          updated_at?: unknown
        }
      }
      contact_team_members: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          user_id?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          user_id?: unknown
        }
      }
      contact_territory_history: {
        Row: {
          contact_name: string | null
          end_date: string | null
          ghl_contact_id: string | null
          is_current: boolean | null
          ms_slug: string | null
          role: string | null
          start_date: string | null
          territory_name: string | null
          transfer_notes: string | null
        }
        Insert: {
          contact_name?: unknown
          end_date?: unknown
          ghl_contact_id?: unknown
          is_current?: unknown
          ms_slug?: unknown
          role?: unknown
          start_date?: unknown
          territory_name?: unknown
          transfer_notes?: unknown
        }
        Update: {
          contact_name?: unknown
          end_date?: unknown
          ghl_contact_id?: unknown
          is_current?: unknown
          ms_slug?: unknown
          role?: unknown
          start_date?: unknown
          territory_name?: unknown
          transfer_notes?: unknown
        }
      }
      contact_zorakle_data: {
        Row: {
          created_at: string
          culture: string | null
          eclipse_drive_id: string | null
          eclipse_overall: number | null
          fit_score: number | null
          ghl_contact_id: string
          id: string
          risk_flag: string | null
          source: string
          spoton_drive_id: string | null
          updated_at: string
          values_type: string | null
          work_style: string | null
          zorakle_completed_at: string | null
        }
        Insert: {
          created_at?: unknown
          culture?: unknown
          eclipse_drive_id?: unknown
          eclipse_overall?: unknown
          fit_score?: unknown
          ghl_contact_id: unknown
          id?: unknown
          risk_flag?: unknown
          source?: unknown
          spoton_drive_id?: unknown
          updated_at?: unknown
          values_type?: unknown
          work_style?: unknown
          zorakle_completed_at?: unknown
        }
        Update: {
          created_at?: unknown
          culture?: unknown
          eclipse_drive_id?: unknown
          eclipse_overall?: unknown
          fit_score?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          risk_flag?: unknown
          source?: unknown
          spoton_drive_id?: unknown
          updated_at?: unknown
          values_type?: unknown
          work_style?: unknown
          zorakle_completed_at?: unknown
        }
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          first_name: string | null
          franchise_fee: number | null
          ghl_contact_id: string
          id: string
          is_converted_franchisee: boolean
          last_name: string | null
          last_synced_at: string | null
          legal_entity: string | null
          merged_at: string | null
          merged_into_contact_id: string | null
          needs_review: boolean | null
          notes: string | null
          opportunity_source: string | null
          phone: string | null
          royalty_pct: number | null
          source: string | null
          state: string | null
          sub_source: string | null
          term_months: number | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: unknown
          city?: unknown
          converted_at?: unknown
          created_at?: unknown
          email?: unknown
          first_name?: unknown
          franchise_fee?: unknown
          ghl_contact_id: unknown
          id?: unknown
          is_converted_franchisee?: unknown
          last_name?: unknown
          last_synced_at?: unknown
          legal_entity?: unknown
          merged_at?: unknown
          merged_into_contact_id?: unknown
          needs_review?: unknown
          notes?: unknown
          opportunity_source?: unknown
          phone?: unknown
          royalty_pct?: unknown
          source?: unknown
          state?: unknown
          sub_source?: unknown
          term_months?: unknown
          updated_at?: unknown
          website?: unknown
          zip?: unknown
        }
        Update: {
          address?: unknown
          city?: unknown
          converted_at?: unknown
          created_at?: unknown
          email?: unknown
          first_name?: unknown
          franchise_fee?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          is_converted_franchisee?: unknown
          last_name?: unknown
          last_synced_at?: unknown
          legal_entity?: unknown
          merged_at?: unknown
          merged_into_contact_id?: unknown
          needs_review?: unknown
          notes?: unknown
          opportunity_source?: unknown
          phone?: unknown
          royalty_pct?: unknown
          source?: unknown
          state?: unknown
          sub_source?: unknown
          term_months?: unknown
          updated_at?: unknown
          website?: unknown
          zip?: unknown
        }
      }
      cron_job_log: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: Json | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: unknown
          error?: unknown
          finished_at?: unknown
          id?: unknown
          job_name: unknown
          result?: unknown
          started_at?: unknown
          status?: unknown
        }
        Update: {
          created_at?: unknown
          error?: unknown
          finished_at?: unknown
          id?: unknown
          job_name?: unknown
          result?: unknown
          started_at?: unknown
          status?: unknown
        }
      }
      current_territory_owners: {
        Row: {
          email: string | null
          first_name: string | null
          ghl_contact_id: string | null
          last_name: string | null
          ms_slug: string | null
          owner_record_id: string | null
          phone: string | null
          region: string | null
          role: string | null
          start_date: string | null
          territory_name: string | null
          territory_status: string | null
        }
        Insert: {
          email?: unknown
          first_name?: unknown
          ghl_contact_id?: unknown
          last_name?: unknown
          ms_slug?: unknown
          owner_record_id?: unknown
          phone?: unknown
          region?: unknown
          role?: unknown
          start_date?: unknown
          territory_name?: unknown
          territory_status?: unknown
        }
        Update: {
          email?: unknown
          first_name?: unknown
          ghl_contact_id?: unknown
          last_name?: unknown
          ms_slug?: unknown
          owner_record_id?: unknown
          phone?: unknown
          region?: unknown
          role?: unknown
          start_date?: unknown
          territory_name?: unknown
          territory_status?: unknown
        }
      }
      data_update_suggestions: {
        Row: {
          combination_note: string | null
          combined_sources: string[] | null
          confidence: string | null
          contact_id: string | null
          created_at: string | null
          current_value: string | null
          evidence: string | null
          field_name: string
          field_table: string
          final_value: string | null
          id: string
          resolved_at: string | null
          reviewer_id: string | null
          source: string
          source_id: string | null
          status: string
          suggested_value: string
          superseded_by: string | null
          territory_ms_slug: string | null
          updated_at: string | null
        }
        Insert: {
          combination_note?: unknown
          combined_sources?: unknown
          confidence?: unknown
          contact_id?: unknown
          created_at?: unknown
          current_value?: unknown
          evidence?: unknown
          field_name: unknown
          field_table: unknown
          final_value?: unknown
          id?: unknown
          resolved_at?: unknown
          reviewer_id?: unknown
          source: unknown
          source_id?: unknown
          status?: unknown
          suggested_value: unknown
          superseded_by?: unknown
          territory_ms_slug?: unknown
          updated_at?: unknown
        }
        Update: {
          combination_note?: unknown
          combined_sources?: unknown
          confidence?: unknown
          contact_id?: unknown
          created_at?: unknown
          current_value?: unknown
          evidence?: unknown
          field_name?: unknown
          field_table?: unknown
          final_value?: unknown
          id?: unknown
          resolved_at?: unknown
          reviewer_id?: unknown
          source?: unknown
          source_id?: unknown
          status?: unknown
          suggested_value?: unknown
          superseded_by?: unknown
          territory_ms_slug?: unknown
          updated_at?: unknown
        }
      }
      embeddings: {
        Row: {
          contact_id: string | null
          content: string
          content_type: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: unknown
          content: unknown
          content_type: unknown
          created_at?: unknown
          embedding: unknown
          id?: unknown
          metadata: unknown
          tenant_id?: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          content?: unknown
          content_type?: unknown
          created_at?: unknown
          embedding?: unknown
          id?: unknown
          metadata?: unknown
          tenant_id?: unknown
          updated_at?: unknown
        }
      }
      eos_contact_goals: {
        Row: {
          contact_id: string
          id: string
          income_goal: string | null
          lifestyle_goal: string | null
          qol_goal: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: unknown
          id?: unknown
          income_goal?: unknown
          lifestyle_goal?: unknown
          qol_goal?: unknown
          source?: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          id?: unknown
          income_goal?: unknown
          lifestyle_goal?: unknown
          qol_goal?: unknown
          source?: unknown
          updated_at?: unknown
        }
      }
      eos_contact_habits: {
        Row: {
          cadence: string
          contact_id: string
          created_at: string | null
          grade: string | null
          habit_text: string
          id: string
          sort_order: number | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          cadence?: unknown
          contact_id?: unknown
          created_at?: unknown
          grade?: unknown
          habit_text: unknown
          id?: unknown
          sort_order?: unknown
          source?: unknown
          updated_at?: unknown
        }
        Update: {
          cadence?: unknown
          contact_id?: unknown
          created_at?: unknown
          grade?: unknown
          habit_text?: unknown
          id?: unknown
          sort_order?: unknown
          source?: unknown
          updated_at?: unknown
        }
      }
      eos_contact_issues: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          is_done: boolean | null
          issue_text: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          issue_text: unknown
          source?: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          issue_text?: unknown
          source?: unknown
          updated_at?: unknown
        }
      }
      eos_contact_todos: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          is_done: boolean | null
          owner_user_id: string | null
          source: string | null
          todo_text: string
          updated_at: string | null
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          owner_user_id?: unknown
          source?: unknown
          todo_text: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          owner_user_id?: unknown
          source?: unknown
          todo_text?: unknown
          updated_at?: unknown
        }
      }
      eos_territory_budgets: {
        Row: {
          amount: number | null
          description: string
          id: string
          sort_order: number | null
          territory_slug: string
          updated_at: string | null
        }
        Insert: {
          amount?: unknown
          description: unknown
          id?: unknown
          sort_order?: unknown
          territory_slug: unknown
          updated_at?: unknown
        }
        Update: {
          amount?: unknown
          description?: unknown
          id?: unknown
          sort_order?: unknown
          territory_slug?: unknown
          updated_at?: unknown
        }
      }
      eos_territory_goals: {
        Row: {
          actual: string | null
          current_year_goal: string | null
          goal_type: string
          id: string
          territory_slug: string
          updated_at: string | null
          year_25_goal: string | null
          year_5_goal: string | null
        }
        Insert: {
          actual?: unknown
          current_year_goal?: unknown
          goal_type: unknown
          id?: unknown
          territory_slug: unknown
          updated_at?: unknown
          year_25_goal?: unknown
          year_5_goal?: unknown
        }
        Update: {
          actual?: unknown
          current_year_goal?: unknown
          goal_type?: unknown
          id?: unknown
          territory_slug?: unknown
          updated_at?: unknown
          year_25_goal?: unknown
          year_5_goal?: unknown
        }
      }
      eos_territory_habits: {
        Row: {
          grade: string | null
          habit_key: string
          habit_label: string
          id: string
          sort_order: number | null
          territory_slug: string
          updated_at: string | null
        }
        Insert: {
          grade?: unknown
          habit_key: unknown
          habit_label: unknown
          id?: unknown
          sort_order?: unknown
          territory_slug: unknown
          updated_at?: unknown
        }
        Update: {
          grade?: unknown
          habit_key?: unknown
          habit_label?: unknown
          id?: unknown
          sort_order?: unknown
          territory_slug?: unknown
          updated_at?: unknown
        }
      }
      eos_territory_issues: {
        Row: {
          created_at: string | null
          id: string
          is_done: boolean | null
          issue_text: string
          origin_contact_id: string | null
          source: string | null
          territory_slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          issue_text: unknown
          origin_contact_id?: unknown
          source?: unknown
          territory_slug: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          issue_text?: unknown
          origin_contact_id?: unknown
          source?: unknown
          territory_slug?: unknown
          updated_at?: unknown
        }
      }
      eos_territory_lead_channels: {
        Row: {
          channel_name: string
          id: string
          is_active: boolean | null
          sort_order: number | null
          territory_slug: string
          updated_at: string | null
        }
        Insert: {
          channel_name: unknown
          id?: unknown
          is_active?: unknown
          sort_order?: unknown
          territory_slug: unknown
          updated_at?: unknown
        }
        Update: {
          channel_name?: unknown
          id?: unknown
          is_active?: unknown
          sort_order?: unknown
          territory_slug?: unknown
          updated_at?: unknown
        }
      }
      eos_territory_rocks: {
        Row: {
          created_at: string | null
          id: string
          quarter: number | null
          rock_text: string
          status: string | null
          territory_slug: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: unknown
          id?: unknown
          quarter?: unknown
          rock_text: unknown
          status?: unknown
          territory_slug: unknown
          updated_at?: unknown
          year?: unknown
        }
        Update: {
          created_at?: unknown
          id?: unknown
          quarter?: unknown
          rock_text?: unknown
          status?: unknown
          territory_slug?: unknown
          updated_at?: unknown
          year?: unknown
        }
      }
      eos_territory_scorecard: {
        Row: {
          goal_value: string | null
          id: string
          metric_key: string
          metric_label: string
          sort_order: number | null
          territory_slug: string
          updated_at: string | null
        }
        Insert: {
          goal_value?: unknown
          id?: unknown
          metric_key: unknown
          metric_label: unknown
          sort_order?: unknown
          territory_slug: unknown
          updated_at?: unknown
        }
        Update: {
          goal_value?: unknown
          id?: unknown
          metric_key?: unknown
          metric_label?: unknown
          sort_order?: unknown
          territory_slug?: unknown
          updated_at?: unknown
        }
      }
      eos_territory_todos: {
        Row: {
          created_at: string | null
          id: string
          is_done: boolean | null
          origin_contact_id: string | null
          owner_user_id: string | null
          source: string | null
          territory_slug: string
          todo_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          origin_contact_id?: unknown
          owner_user_id?: unknown
          source?: unknown
          territory_slug: unknown
          todo_text: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          id?: unknown
          is_done?: unknown
          origin_contact_id?: unknown
          owner_user_id?: unknown
          source?: unknown
          territory_slug?: unknown
          todo_text?: unknown
          updated_at?: unknown
        }
      }
      franchise_owners: {
        Row: {
          created_at: string
          ct_email: string | null
          ct_id: string | null
          full_name: string
          ghl_contact_id: string | null
          ms_slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: unknown
          ct_email?: unknown
          ct_id?: unknown
          full_name: unknown
          ghl_contact_id?: unknown
          ms_slug: unknown
          status?: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          ct_email?: unknown
          ct_id?: unknown
          full_name?: unknown
          ghl_contact_id?: unknown
          ms_slug?: unknown
          status?: unknown
          updated_at?: unknown
        }
      }
      franchisee_performance: {
        Row: {
          active_status: string | null
          contact_id: string
          created_at: string | null
          data_source: string | null
          franchise_agreement_signed: boolean | null
          franchise_software_id: string | null
          franchisee_name: string
          funds_received_at: string | null
          houses_purchased_total: number | null
          houses_purchased_year1: number | null
          houses_purchased_year2: number | null
          houses_purchased_year3: number | null
          id: string
          last_synced_at: string | null
          nps_score: number | null
          revenue_year1: number | null
          revenue_year2: number | null
          revenue_year3: number | null
          royalty_payment_consistent: boolean | null
          signed_at: string | null
          staff_hired: number | null
          support_calls_year1: number | null
          territory: string | null
          territory_utilization_pct: number | null
          time_to_first_flip_days: number | null
          updated_at: string | null
        }
        Insert: {
          active_status?: unknown
          contact_id: unknown
          created_at?: unknown
          data_source?: unknown
          franchise_agreement_signed?: unknown
          franchise_software_id?: unknown
          franchisee_name: unknown
          funds_received_at?: unknown
          houses_purchased_total?: unknown
          houses_purchased_year1?: unknown
          houses_purchased_year2?: unknown
          houses_purchased_year3?: unknown
          id?: unknown
          last_synced_at?: unknown
          nps_score?: unknown
          revenue_year1?: unknown
          revenue_year2?: unknown
          revenue_year3?: unknown
          royalty_payment_consistent?: unknown
          signed_at?: unknown
          staff_hired?: unknown
          support_calls_year1?: unknown
          territory?: unknown
          territory_utilization_pct?: unknown
          time_to_first_flip_days?: unknown
          updated_at?: unknown
        }
        Update: {
          active_status?: unknown
          contact_id?: unknown
          created_at?: unknown
          data_source?: unknown
          franchise_agreement_signed?: unknown
          franchise_software_id?: unknown
          franchisee_name?: unknown
          funds_received_at?: unknown
          houses_purchased_total?: unknown
          houses_purchased_year1?: unknown
          houses_purchased_year2?: unknown
          houses_purchased_year3?: unknown
          id?: unknown
          last_synced_at?: unknown
          nps_score?: unknown
          revenue_year1?: unknown
          revenue_year2?: unknown
          revenue_year3?: unknown
          royalty_payment_consistent?: unknown
          signed_at?: unknown
          staff_hired?: unknown
          support_calls_year1?: unknown
          territory?: unknown
          territory_utilization_pct?: unknown
          time_to_first_flip_days?: unknown
          updated_at?: unknown
        }
      }
      ghl_action_drafts: {
        Row: {
          action_type: string
          confirmed_at: string | null
          contact_id: string | null
          created_at: string
          drafted_by_source: string
          drafted_by_user_id: string | null
          edited_params: Json | null
          error_message: string | null
          executed_at: string | null
          id: string
          outcome: Json | null
          params: Json
          status: string
        }
        Insert: {
          action_type: unknown
          confirmed_at?: unknown
          contact_id?: unknown
          created_at?: unknown
          drafted_by_source?: unknown
          drafted_by_user_id?: unknown
          edited_params?: unknown
          error_message?: unknown
          executed_at?: unknown
          id?: unknown
          outcome?: unknown
          params: unknown
          status?: unknown
        }
        Update: {
          action_type?: unknown
          confirmed_at?: unknown
          contact_id?: unknown
          created_at?: unknown
          drafted_by_source?: unknown
          drafted_by_user_id?: unknown
          edited_params?: unknown
          error_message?: unknown
          executed_at?: unknown
          id?: unknown
          outcome?: unknown
          params?: unknown
          status?: unknown
        }
      }
      ghl_custom_fields: {
        Row: {
          created_at: string | null
          dropdown_options: Json | null
          entity_type: string
          field_key: string
          field_name: string
          field_type: string
          ghl_field_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: unknown
          dropdown_options?: unknown
          entity_type: unknown
          field_key: unknown
          field_name: unknown
          field_type: unknown
          ghl_field_id: unknown
          id?: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          dropdown_options?: unknown
          entity_type?: unknown
          field_key?: unknown
          field_name?: unknown
          field_type?: unknown
          ghl_field_id?: unknown
          id?: unknown
          updated_at?: unknown
        }
      }
      ghl_pipeline_stages: {
        Row: {
          created_at: string | null
          id: string
          pipeline_id: string
          position: number | null
          stage_id: string
          stage_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: unknown
          id?: unknown
          pipeline_id: unknown
          position?: unknown
          stage_id: unknown
          stage_name: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          id?: unknown
          pipeline_id?: unknown
          position?: unknown
          stage_id?: unknown
          stage_name?: unknown
          updated_at?: unknown
        }
      }
      ghl_sync_queue: {
        Row: {
          attempts: number
          contact_id: string
          created_at: string
          ghl_field_id: string
          id: string
          last_error: string | null
          status: string
          updated_at: string
          value: string
        }
        Insert: {
          attempts?: unknown
          contact_id?: unknown
          created_at?: unknown
          ghl_field_id: unknown
          id?: unknown
          last_error?: unknown
          status?: unknown
          updated_at?: unknown
          value: unknown
        }
        Update: {
          attempts?: unknown
          contact_id?: unknown
          created_at?: unknown
          ghl_field_id?: unknown
          id?: unknown
          last_error?: unknown
          status?: unknown
          updated_at?: unknown
          value?: unknown
        }
      }
      ghl_workflows: {
        Row: {
          created_at: string | null
          description: string | null
          ghl_workflow_id: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: unknown
          description?: unknown
          ghl_workflow_id?: unknown
          id?: unknown
          is_active?: unknown
          name: unknown
          updated_at?: unknown
          webhook_url: unknown
        }
        Update: {
          created_at?: unknown
          description?: unknown
          ghl_workflow_id?: unknown
          id?: unknown
          is_active?: unknown
          name?: unknown
          updated_at?: unknown
          webhook_url?: unknown
        }
      }
      inactivity_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          details: Json | null
          ghl_contact_id: string | null
          id: string
          is_resolved: boolean | null
          message: string
          pipeline_stage: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          alert_type: unknown
          created_at?: unknown
          details?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          is_resolved?: unknown
          message: unknown
          pipeline_stage?: unknown
          resolved_at?: unknown
          resolved_by?: unknown
          severity: unknown
          user_id?: unknown
        }
        Update: {
          alert_type?: unknown
          created_at?: unknown
          details?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          is_resolved?: unknown
          message?: unknown
          pipeline_stage?: unknown
          resolved_at?: unknown
          resolved_by?: unknown
          severity?: unknown
          user_id?: unknown
        }
      }
      integration_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          integration_name: string
          payload_summary: string | null
          related_contact_id: string | null
          related_ms_slug: string | null
          status: string
        }
        Insert: {
          created_at?: unknown
          error_message?: unknown
          event_type: unknown
          id?: unknown
          integration_name: unknown
          payload_summary?: unknown
          related_contact_id?: unknown
          related_ms_slug?: unknown
          status: unknown
        }
        Update: {
          created_at?: unknown
          error_message?: unknown
          event_type?: unknown
          id?: unknown
          integration_name?: unknown
          payload_summary?: unknown
          related_contact_id?: unknown
          related_ms_slug?: unknown
          status?: unknown
        }
      }
      journey_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary_decision_maker: boolean
          joined_at: string
          journey_id: string
          left_at: string | null
          role: string
          role_notes: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          is_primary_decision_maker?: unknown
          joined_at?: unknown
          journey_id?: unknown
          left_at?: unknown
          role: unknown
          role_notes?: unknown
          updated_at?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          is_primary_decision_maker?: unknown
          joined_at?: unknown
          journey_id?: unknown
          left_at?: unknown
          role?: unknown
          role_notes?: unknown
          updated_at?: unknown
        }
      }
      journey_pipeline_state: {
        Row: {
          assigned_user_id: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          current_stage_id: string
          current_sub_task_id: string | null
          current_sub_task_started_at: string | null
          entered_current_stage_at: string
          entered_pipeline_at: string
          id: string
          is_active: boolean
          journey_id: string
          pipeline_id: string
          territory_ms_slug: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: unknown
          closed_at?: unknown
          closed_reason?: unknown
          created_at?: unknown
          current_stage_id?: unknown
          current_sub_task_id?: unknown
          current_sub_task_started_at?: unknown
          entered_current_stage_at?: unknown
          entered_pipeline_at?: unknown
          id?: unknown
          is_active?: unknown
          journey_id?: unknown
          pipeline_id?: unknown
          territory_ms_slug?: unknown
          updated_at?: unknown
        }
        Update: {
          assigned_user_id?: unknown
          closed_at?: unknown
          closed_reason?: unknown
          created_at?: unknown
          current_stage_id?: unknown
          current_sub_task_id?: unknown
          current_sub_task_started_at?: unknown
          entered_current_stage_at?: unknown
          entered_pipeline_at?: unknown
          id?: unknown
          is_active?: unknown
          journey_id?: unknown
          pipeline_id?: unknown
          territory_ms_slug?: unknown
          updated_at?: unknown
        }
      }
      journeys: {
        Row: {
          close_reason: string | null
          created_at: string
          id: string
          name: string
          parent_journey_id: string | null
          primary_contact_id: string
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          close_reason?: unknown
          created_at?: unknown
          id?: unknown
          name: unknown
          parent_journey_id?: unknown
          primary_contact_id?: unknown
          slug?: unknown
          status?: unknown
          updated_at?: unknown
        }
        Update: {
          close_reason?: unknown
          created_at?: unknown
          id?: unknown
          name?: unknown
          parent_journey_id?: unknown
          primary_contact_id?: unknown
          slug?: unknown
          status?: unknown
          updated_at?: unknown
        }
      }
      kb_gap_signals: {
        Row: {
          id: string
          query: string
          resolved: boolean
          resolved_by_doc_id: string | null
          results_found: number
          searched_at: string
          suggested_category: string | null
        }
        Insert: {
          id?: unknown
          query: unknown
          resolved?: unknown
          resolved_by_doc_id?: unknown
          results_found?: unknown
          searched_at?: unknown
          suggested_category?: unknown
        }
        Update: {
          id?: unknown
          query?: unknown
          resolved?: unknown
          resolved_by_doc_id?: unknown
          results_found?: unknown
          searched_at?: unknown
          suggested_category?: unknown
        }
      }
      knowledge_documents: {
        Row: {
          category: string
          content: string
          created_at: string | null
          flagged_as_stale: boolean
          gap_signal: string | null
          id: string
          is_active: boolean | null
          last_retrieved_at: string | null
          priority: number | null
          retrieval_count: number
          retrieval_quality_score: number | null
          seeded_from: string | null
          status: string | null
          title: string
          token_count: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category: unknown
          content: unknown
          created_at?: unknown
          flagged_as_stale?: unknown
          gap_signal?: unknown
          id?: unknown
          is_active?: unknown
          last_retrieved_at?: unknown
          priority?: unknown
          retrieval_count?: unknown
          retrieval_quality_score?: unknown
          seeded_from?: unknown
          status?: unknown
          title: unknown
          token_count?: unknown
          updated_at?: unknown
          updated_by?: unknown
        }
        Update: {
          category?: unknown
          content?: unknown
          created_at?: unknown
          flagged_as_stale?: unknown
          gap_signal?: unknown
          id?: unknown
          is_active?: unknown
          last_retrieved_at?: unknown
          priority?: unknown
          retrieval_count?: unknown
          retrieval_quality_score?: unknown
          seeded_from?: unknown
          status?: unknown
          title?: unknown
          token_count?: unknown
          updated_at?: unknown
          updated_by?: unknown
        }
      }
      lead_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: unknown
          id?: unknown
          is_active?: unknown
          name: unknown
          sort_order?: unknown
        }
        Update: {
          created_at?: unknown
          id?: unknown
          is_active?: unknown
          name?: unknown
          sort_order?: unknown
        }
      }
      lead_sub_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lead_source_id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: unknown
          id?: unknown
          is_active?: unknown
          lead_source_id?: unknown
          name: unknown
          sort_order?: unknown
        }
        Update: {
          created_at?: unknown
          id?: unknown
          is_active?: unknown
          lead_source_id?: unknown
          name?: unknown
          sort_order?: unknown
        }
      }
      llm_call_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          input_messages: Json
          input_tokens: number | null
          iteration: number | null
          latency_ms: number | null
          model: string
          output_content: Json
          output_tokens: number | null
          stop_reason: string | null
          tool_calls: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: unknown
          error_message?: unknown
          id?: unknown
          input_messages: unknown
          input_tokens?: unknown
          iteration?: unknown
          latency_ms?: unknown
          model: unknown
          output_content: unknown
          output_tokens?: unknown
          stop_reason?: unknown
          tool_calls?: unknown
          user_id?: unknown
        }
        Update: {
          created_at?: unknown
          error_message?: unknown
          id?: unknown
          input_messages?: unknown
          input_tokens?: unknown
          iteration?: unknown
          latency_ms?: unknown
          model?: unknown
          output_content?: unknown
          output_tokens?: unknown
          stop_reason?: unknown
          tool_calls?: unknown
          user_id?: unknown
        }
      }
      market_signals: {
        Row: {
          id: string
          observed_at: string | null
          signal_key: string
          signal_type: string
          signal_value: Json
          source: string | null
        }
        Insert: {
          id?: unknown
          observed_at?: unknown
          signal_key: unknown
          signal_type: unknown
          signal_value: unknown
          source?: unknown
        }
        Update: {
          id?: unknown
          observed_at?: unknown
          signal_key?: unknown
          signal_type?: unknown
          signal_value?: unknown
          source?: unknown
        }
      }
      notifications: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          read_at: string | null
          recipient_user_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          read_at?: unknown
          recipient_user_id?: unknown
          source_id?: unknown
          source_type?: unknown
        }
        Update: {
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          read_at?: unknown
          recipient_user_id?: unknown
          source_id?: unknown
          source_type?: unknown
        }
      }
      objection_registry: {
        Row: {
          call_log_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          objection_detail: string | null
          objection_type: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          score_impact: number | null
          stage_at_time: string
        }
        Insert: {
          call_log_id?: unknown
          contact_id: unknown
          created_at?: unknown
          id?: unknown
          objection_detail?: unknown
          objection_type: unknown
          resolution_notes?: unknown
          resolved?: unknown
          resolved_at?: unknown
          score_impact?: unknown
          stage_at_time: unknown
        }
        Update: {
          call_log_id?: unknown
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          objection_detail?: unknown
          objection_type?: unknown
          resolution_notes?: unknown
          resolved?: unknown
          resolved_at?: unknown
          score_impact?: unknown
          stage_at_time?: unknown
        }
      }
      pipeline_app_settings: {
        Row: {
          ghl_sync_enabled: boolean
          ghl_sync_queue_alert_threshold: number
          id: number
          time_in_stage_red_days: number
          time_in_stage_yellow_days: number
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          ghl_sync_enabled?: unknown
          ghl_sync_queue_alert_threshold?: unknown
          id?: unknown
          time_in_stage_red_days?: unknown
          time_in_stage_yellow_days?: unknown
          updated_at?: unknown
          updated_by_user_id?: unknown
        }
        Update: {
          ghl_sync_enabled?: unknown
          ghl_sync_queue_alert_threshold?: unknown
          id?: unknown
          time_in_stage_red_days?: unknown
          time_in_stage_yellow_days?: unknown
          updated_at?: unknown
          updated_by_user_id?: unknown
        }
      }
      pipeline_stage_history: {
        Row: {
          created_at: string
          from_stage_id: string | null
          id: string
          journey_pipeline_state_id: string
          moved_by_user_id: string | null
          reason: string | null
          to_stage_id: string
          was_auto: boolean
          was_revert: boolean
          was_skip: boolean
        }
        Insert: {
          created_at?: unknown
          from_stage_id?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          moved_by_user_id?: unknown
          reason?: unknown
          to_stage_id?: unknown
          was_auto?: unknown
          was_revert?: unknown
          was_skip?: unknown
        }
        Update: {
          created_at?: unknown
          from_stage_id?: unknown
          id?: unknown
          journey_pipeline_state_id?: unknown
          moved_by_user_id?: unknown
          reason?: unknown
          to_stage_id?: unknown
          was_auto?: unknown
          was_revert?: unknown
          was_skip?: unknown
        }
      }
      pipeline_stages: {
        Row: {
          auto_advance_enabled: boolean
          auto_spawn_pipeline_id: string | null
          created_at: string
          description: string | null
          id: string
          is_terminal: boolean
          name: string
          pipeline_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_advance_enabled?: unknown
          auto_spawn_pipeline_id?: unknown
          created_at?: unknown
          description?: unknown
          id?: unknown
          is_terminal?: unknown
          name: unknown
          pipeline_id?: unknown
          slug: unknown
          sort_order?: unknown
          updated_at?: unknown
        }
        Update: {
          auto_advance_enabled?: unknown
          auto_spawn_pipeline_id?: unknown
          created_at?: unknown
          description?: unknown
          id?: unknown
          is_terminal?: unknown
          name?: unknown
          pipeline_id?: unknown
          slug?: unknown
          sort_order?: unknown
          updated_at?: unknown
        }
      }
      pipeline_sub_tasks: {
        Row: {
          created_at: string
          default_logger_type: string
          default_logger_user_id: string | null
          description: string | null
          first_state_label: string | null
          id: string
          is_required: boolean
          name: string
          second_state_label: string | null
          slug: string
          sort_order: number
          stage_id: string
          state_type: string
          updated_at: string
        }
        Insert: {
          created_at?: unknown
          default_logger_type?: unknown
          default_logger_user_id?: unknown
          description?: unknown
          first_state_label?: unknown
          id?: unknown
          is_required?: unknown
          name: unknown
          second_state_label?: unknown
          slug: unknown
          sort_order?: unknown
          stage_id?: unknown
          state_type?: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          default_logger_type?: unknown
          default_logger_user_id?: unknown
          description?: unknown
          first_state_label?: unknown
          id?: unknown
          is_required?: unknown
          name?: unknown
          second_state_label?: unknown
          slug?: unknown
          sort_order?: unknown
          stage_id?: unknown
          state_type?: unknown
          updated_at?: unknown
        }
      }
      pipelines: {
        Row: {
          created_at: string
          description: string | null
          entity_type: string
          ghl_field_id: string | null
          id: string
          is_active: boolean
          is_visible_in_nav: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: unknown
          description?: unknown
          entity_type?: unknown
          ghl_field_id?: unknown
          id?: unknown
          is_active?: unknown
          is_visible_in_nav?: unknown
          name: unknown
          slug: unknown
          sort_order?: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          description?: unknown
          entity_type?: unknown
          ghl_field_id?: unknown
          id?: unknown
          is_active?: unknown
          is_visible_in_nav?: unknown
          name?: unknown
          slug?: unknown
          sort_order?: unknown
          updated_at?: unknown
        }
      }
      read_ai_sessions: {
        Row: {
          call_type: string | null
          classified_at: string | null
          created_at: string | null
          end_time: string | null
          error_message: string | null
          linked_call_id: string | null
          owner_email: string | null
          participant_emails: string[] | null
          platform: string | null
          processed_at: string | null
          processing_status: string | null
          raw_payload: Json | null
          session_id: string
          start_time: string | null
          title: string | null
        }
        Insert: {
          call_type?: unknown
          classified_at?: unknown
          created_at?: unknown
          end_time?: unknown
          error_message?: unknown
          linked_call_id?: unknown
          owner_email?: unknown
          participant_emails?: unknown
          platform?: unknown
          processed_at?: unknown
          processing_status?: unknown
          raw_payload?: unknown
          session_id: unknown
          start_time?: unknown
          title?: unknown
        }
        Update: {
          call_type?: unknown
          classified_at?: unknown
          created_at?: unknown
          end_time?: unknown
          error_message?: unknown
          linked_call_id?: unknown
          owner_email?: unknown
          participant_emails?: unknown
          platform?: unknown
          processed_at?: unknown
          processing_status?: unknown
          raw_payload?: unknown
          session_id?: unknown
          start_time?: unknown
          title?: unknown
        }
      }
      read_ai_webhook_keys: {
        Row: {
          created_at: string | null
          signing_key: string
          user_email: string
        }
        Insert: {
          created_at?: unknown
          signing_key: unknown
          user_email: unknown
        }
        Update: {
          created_at?: unknown
          signing_key?: unknown
          user_email?: unknown
        }
      }
      rep_journals: {
        Row: {
          calls_completed: number
          coaching_notes: string | null
          contacts_touched: number
          created_at: string
          focus_tomorrow: string | null
          ghl_actions_fired: number
          id: string
          journal_date: string
          sub_tasks_logged: number
          summary: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          calls_completed?: unknown
          coaching_notes?: unknown
          contacts_touched?: unknown
          created_at?: unknown
          focus_tomorrow?: unknown
          ghl_actions_fired?: unknown
          id?: unknown
          journal_date: unknown
          sub_tasks_logged?: unknown
          summary: unknown
          tenant_id?: unknown
          user_id?: unknown
        }
        Update: {
          calls_completed?: unknown
          coaching_notes?: unknown
          contacts_touched?: unknown
          created_at?: unknown
          focus_tomorrow?: unknown
          ghl_actions_fired?: unknown
          id?: unknown
          journal_date?: unknown
          sub_tasks_logged?: unknown
          summary?: unknown
          tenant_id?: unknown
          user_id?: unknown
        }
      }
      rubric_criteria: {
        Row: {
          created_at: string
          description: string | null
          example_phrases_negative: string[] | null
          example_phrases_positive: string[] | null
          id: string
          kb_document_ids: string[] | null
          name: string
          negative_examples: string[] | null
          positive_examples: string[] | null
          rubric_id: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: unknown
          description?: unknown
          example_phrases_negative?: unknown
          example_phrases_positive?: unknown
          id?: unknown
          kb_document_ids?: unknown
          name: unknown
          negative_examples?: unknown
          positive_examples?: unknown
          rubric_id?: unknown
          sort_order?: unknown
          updated_at?: unknown
          weight?: unknown
        }
        Update: {
          created_at?: unknown
          description?: unknown
          example_phrases_negative?: unknown
          example_phrases_positive?: unknown
          id?: unknown
          kb_document_ids?: unknown
          name?: unknown
          negative_examples?: unknown
          positive_examples?: unknown
          rubric_id?: unknown
          sort_order?: unknown
          updated_at?: unknown
          weight?: unknown
        }
      }
      rubric_review_suggestions: {
        Row: {
          created_at: string
          criterion_id: string | null
          criterion_name: string
          current_state: Json | null
          id: string
          issue_type: string
          review_month: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_change: string | null
          supporting_data: Json | null
        }
        Insert: {
          created_at?: unknown
          criterion_id?: unknown
          criterion_name: unknown
          current_state?: unknown
          id?: unknown
          issue_type: unknown
          review_month: unknown
          reviewed_at?: unknown
          reviewed_by?: unknown
          status?: unknown
          suggested_change?: unknown
          supporting_data?: unknown
        }
        Update: {
          created_at?: unknown
          criterion_id?: unknown
          criterion_name?: unknown
          current_state?: unknown
          id?: unknown
          issue_type?: unknown
          review_month?: unknown
          reviewed_at?: unknown
          reviewed_by?: unknown
          status?: unknown
          suggested_change?: unknown
          supporting_data?: unknown
        }
      }
      rubrics: {
        Row: {
          call_type_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          call_type_id?: unknown
          created_at?: unknown
          description?: unknown
          id?: unknown
          is_active?: unknown
          name: unknown
          updated_at?: unknown
        }
        Update: {
          call_type_id?: unknown
          created_at?: unknown
          description?: unknown
          id?: unknown
          is_active?: unknown
          name?: unknown
          updated_at?: unknown
        }
      }
      scout_action_logs: {
        Row: {
          action_status: string
          action_type: string
          confirmed_at: string | null
          created_at: string | null
          draft_content: Json
          error_message: string | null
          executed_at: string | null
          final_content: Json | null
          ghl_contact_id: string | null
          ghl_response: Json | null
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          action_status: unknown
          action_type: unknown
          confirmed_at?: unknown
          created_at?: unknown
          draft_content: unknown
          error_message?: unknown
          executed_at?: unknown
          final_content?: unknown
          ghl_contact_id?: unknown
          ghl_response?: unknown
          id?: unknown
          session_id?: unknown
          user_id?: unknown
        }
        Update: {
          action_status?: unknown
          action_type?: unknown
          confirmed_at?: unknown
          created_at?: unknown
          draft_content?: unknown
          error_message?: unknown
          executed_at?: unknown
          final_content?: unknown
          ghl_contact_id?: unknown
          ghl_response?: unknown
          id?: unknown
          session_id?: unknown
          user_id?: unknown
        }
      }
      scout_performance_reports: {
        Row: {
          acceptance_rate: number | null
          action_type_breakdown: Json | null
          created_at: string
          edit_rate: number | null
          id: string
          kb_gap_signals: Json | null
          kb_retrieval_count: number
          most_edited_fields: Json | null
          rejection_rate: number | null
          rep_breakdown: Json | null
          top_rejected_types: Json | null
          total_suggestions: number
          week_end: string
          week_start: string
        }
        Insert: {
          acceptance_rate?: unknown
          action_type_breakdown?: unknown
          created_at?: unknown
          edit_rate?: unknown
          id?: unknown
          kb_gap_signals?: unknown
          kb_retrieval_count?: unknown
          most_edited_fields?: unknown
          rejection_rate?: unknown
          rep_breakdown?: unknown
          top_rejected_types?: unknown
          total_suggestions?: unknown
          week_end: unknown
          week_start: unknown
        }
        Update: {
          acceptance_rate?: unknown
          action_type_breakdown?: unknown
          created_at?: unknown
          edit_rate?: unknown
          id?: unknown
          kb_gap_signals?: unknown
          kb_retrieval_count?: unknown
          most_edited_fields?: unknown
          rejection_rate?: unknown
          rep_breakdown?: unknown
          top_rejected_types?: unknown
          total_suggestions?: unknown
          week_end?: unknown
          week_start?: unknown
        }
      }
      scout_user_memory: {
        Row: {
          content: string
          turn_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: unknown
          turn_count?: unknown
          updated_at?: unknown
          user_id?: unknown
        }
        Update: {
          content?: unknown
          turn_count?: unknown
          updated_at?: unknown
          user_id?: unknown
        }
      }
      sessions: {
        Row: {
          context_summary: string | null
          conversation_history: Json | null
          ended_at: string | null
          ghl_contact_focus: string | null
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          context_summary?: unknown
          conversation_history?: unknown
          ended_at?: unknown
          ghl_contact_focus?: unknown
          id?: unknown
          is_active?: unknown
          last_activity_at?: unknown
          started_at?: unknown
          user_id?: unknown
        }
        Update: {
          context_summary?: unknown
          conversation_history?: unknown
          ended_at?: unknown
          ghl_contact_focus?: unknown
          id?: unknown
          is_active?: unknown
          last_activity_at?: unknown
          started_at?: unknown
          user_id?: unknown
        }
      }
      suggestion_feedback: {
        Row: {
          accepted_value: Json | null
          call_id: string | null
          call_type: string | null
          confidence: string | null
          contact_id: string | null
          created_at: string
          edit_delta: Json | null
          field_name: string | null
          final_value: string | null
          id: string
          original_value: Json | null
          outcome: string
          pipeline_stage: string | null
          rep_id: string
          resolved_at: string | null
          reviewer_id: string | null
          suggested_value: string | null
          suggestion_id: string | null
          suggestion_type: string
          territory_ms_slug: string | null
        }
        Insert: {
          accepted_value?: unknown
          call_id?: unknown
          call_type?: unknown
          confidence?: unknown
          contact_id?: unknown
          created_at?: unknown
          edit_delta?: unknown
          field_name?: unknown
          final_value?: unknown
          id?: unknown
          original_value?: unknown
          outcome: unknown
          pipeline_stage?: unknown
          rep_id?: unknown
          resolved_at?: unknown
          reviewer_id?: unknown
          suggested_value?: unknown
          suggestion_id?: unknown
          suggestion_type: unknown
          territory_ms_slug?: unknown
        }
        Update: {
          accepted_value?: unknown
          call_id?: unknown
          call_type?: unknown
          confidence?: unknown
          contact_id?: unknown
          created_at?: unknown
          edit_delta?: unknown
          field_name?: unknown
          final_value?: unknown
          id?: unknown
          original_value?: unknown
          outcome?: unknown
          pipeline_stage?: unknown
          rep_id?: unknown
          resolved_at?: unknown
          reviewer_id?: unknown
          suggested_value?: unknown
          suggestion_id?: unknown
          suggestion_type?: unknown
          territory_ms_slug?: unknown
        }
      }
      system_logs: {
        Row: {
          action_type: string
          contact_id: string | null
          created_at: string
          id: string
          input_params: Json | null
          log_date: string
          result_summary: string | null
          tenant_id: string | null
          user_id: string | null
          was_auto: boolean
        }
        Insert: {
          action_type: unknown
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          input_params?: unknown
          log_date?: unknown
          result_summary?: unknown
          tenant_id?: unknown
          user_id?: unknown
          was_auto?: unknown
        }
        Update: {
          action_type?: unknown
          contact_id?: unknown
          created_at?: unknown
          id?: unknown
          input_params?: unknown
          log_date?: unknown
          result_summary?: unknown
          tenant_id?: unknown
          user_id?: unknown
          was_auto?: unknown
        }
      }
      territories: {
        Row: {
          awarded_date: string | null
          created_at: string
          ms_slug: string
          region: string | null
          status: string
          territory_name: string
          updated_at: string
        }
        Insert: {
          awarded_date?: unknown
          created_at?: unknown
          ms_slug: unknown
          region?: unknown
          status?: unknown
          territory_name: unknown
          updated_at?: unknown
        }
        Update: {
          awarded_date?: unknown
          created_at?: unknown
          ms_slug?: unknown
          region?: unknown
          status?: unknown
          territory_name?: unknown
          updated_at?: unknown
        }
      }
      territory_candidates: {
        Row: {
          created_at: string
          ghl_contact_id: string
          id: string
          ms_slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: unknown
          ghl_contact_id: unknown
          id?: unknown
          ms_slug: unknown
          status?: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          ms_slug?: unknown
          status?: unknown
          updated_at?: unknown
        }
      }
      territory_grades: {
        Row: {
          created_at: string
          houses_purchased: number | null
          id: string
          john_grade: number | null
          ms_slug: string
          notes: string | null
          quarter: number
          self_grade: number | null
          year: number
        }
        Insert: {
          created_at?: unknown
          houses_purchased?: unknown
          id?: unknown
          john_grade?: unknown
          ms_slug: unknown
          notes?: unknown
          quarter: unknown
          self_grade?: unknown
          year: unknown
        }
        Update: {
          created_at?: unknown
          houses_purchased?: unknown
          id?: unknown
          john_grade?: unknown
          ms_slug?: unknown
          notes?: unknown
          quarter?: unknown
          self_grade?: unknown
          year?: unknown
        }
      }
      territory_market_data: {
        Row: {
          field_name: string
          field_value: string | null
          id: string
          source: string | null
          source_date: string | null
          territory_slug: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          field_name: unknown
          field_value?: unknown
          id?: unknown
          source?: unknown
          source_date?: unknown
          territory_slug: unknown
          updated_at?: unknown
          updated_by?: unknown
        }
        Update: {
          field_name?: unknown
          field_value?: unknown
          id?: unknown
          source?: unknown
          source_date?: unknown
          territory_slug?: unknown
          updated_at?: unknown
          updated_by?: unknown
        }
      }
      territory_owners: {
        Row: {
          created_at: string
          end_date: string | null
          ghl_contact_id: string | null
          id: string
          ms_slug: string
          role: string
          start_date: string
          transfer_notes: string | null
        }
        Insert: {
          created_at?: unknown
          end_date?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          ms_slug: unknown
          role?: unknown
          start_date?: unknown
          transfer_notes?: unknown
        }
        Update: {
          created_at?: unknown
          end_date?: unknown
          ghl_contact_id?: unknown
          id?: unknown
          ms_slug?: unknown
          role?: unknown
          start_date?: unknown
          transfer_notes?: unknown
        }
      }
      territory_ownership_history: {
        Row: {
          days_owned: number | null
          end_date: string | null
          ghl_contact_id: string | null
          ms_slug: string | null
          owner_name: string | null
          role: string | null
          start_date: string | null
          territory_name: string | null
          transfer_notes: string | null
        }
        Insert: {
          days_owned?: unknown
          end_date?: unknown
          ghl_contact_id?: unknown
          ms_slug?: unknown
          owner_name?: unknown
          role?: unknown
          start_date?: unknown
          territory_name?: unknown
          transfer_notes?: unknown
        }
        Update: {
          days_owned?: unknown
          end_date?: unknown
          ghl_contact_id?: unknown
          ms_slug?: unknown
          owner_name?: unknown
          role?: unknown
          start_date?: unknown
          territory_name?: unknown
          transfer_notes?: unknown
        }
      }
      territory_performance: {
        Row: {
          active_deals: number | null
          avg_profit_per_flip: number | null
          current_owner_contact_id: string | null
          current_owner_name: string | null
          houses_purchased_ytd: number | null
          houses_sold_ytd: number | null
          lead_conversion_rate: number | null
          ms_slug: string | null
          status: string | null
          territory_name: string | null
          velocity_status: string | null
        }
        Insert: {
          active_deals?: unknown
          avg_profit_per_flip?: unknown
          current_owner_contact_id?: unknown
          current_owner_name?: unknown
          houses_purchased_ytd?: unknown
          houses_sold_ytd?: unknown
          lead_conversion_rate?: unknown
          ms_slug?: unknown
          status?: unknown
          territory_name?: unknown
          velocity_status?: unknown
        }
        Update: {
          active_deals?: unknown
          avg_profit_per_flip?: unknown
          current_owner_contact_id?: unknown
          current_owner_name?: unknown
          houses_purchased_ytd?: unknown
          houses_sold_ytd?: unknown
          lead_conversion_rate?: unknown
          ms_slug?: unknown
          status?: unknown
          territory_name?: unknown
          velocity_status?: unknown
        }
      }
      territory_profile: {
        Row: {
          active_deals: number | null
          actual_purchases: number | null
          avg_profit_per_flip: number | null
          avg_time_to_flip_days: number | null
          coaching_notes: string | null
          competitor_presence: string | null
          created_at: string
          flip_activity_score: number | null
          houses_purchased_ytd: number | null
          houses_sold_ytd: number | null
          last_checkin_date: string | null
          lead_conversion_rate: number | null
          leads_received_ytd: number | null
          local_market_notes: string | null
          market_type: string | null
          ms_slug: string
          projected_purchases: number | null
          revenue_ytd: number | null
          stage3_pct: number | null
          stage5_pct: number | null
          territory_value_est: number | null
          total_invested: number | null
          updated_at: string
        }
        Insert: {
          active_deals?: unknown
          actual_purchases?: unknown
          avg_profit_per_flip?: unknown
          avg_time_to_flip_days?: unknown
          coaching_notes?: unknown
          competitor_presence?: unknown
          created_at?: unknown
          flip_activity_score?: unknown
          houses_purchased_ytd?: unknown
          houses_sold_ytd?: unknown
          last_checkin_date?: unknown
          lead_conversion_rate?: unknown
          leads_received_ytd?: unknown
          local_market_notes?: unknown
          market_type?: unknown
          ms_slug: unknown
          projected_purchases?: unknown
          revenue_ytd?: unknown
          stage3_pct?: unknown
          stage5_pct?: unknown
          territory_value_est?: unknown
          total_invested?: unknown
          updated_at?: unknown
        }
        Update: {
          active_deals?: unknown
          actual_purchases?: unknown
          avg_profit_per_flip?: unknown
          avg_time_to_flip_days?: unknown
          coaching_notes?: unknown
          competitor_presence?: unknown
          created_at?: unknown
          flip_activity_score?: unknown
          houses_purchased_ytd?: unknown
          houses_sold_ytd?: unknown
          last_checkin_date?: unknown
          lead_conversion_rate?: unknown
          leads_received_ytd?: unknown
          local_market_notes?: unknown
          market_type?: unknown
          ms_slug?: unknown
          projected_purchases?: unknown
          revenue_ytd?: unknown
          stage3_pct?: unknown
          stage5_pct?: unknown
          territory_value_est?: unknown
          total_invested?: unknown
          updated_at?: unknown
        }
      }
      territory_stakeholders: {
        Row: {
          company: string | null
          contact_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          ms_slug: string
          notes: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company?: unknown
          contact_id?: unknown
          created_at?: unknown
          email?: unknown
          first_name?: unknown
          id?: unknown
          is_active?: unknown
          last_name?: unknown
          ms_slug: unknown
          notes?: unknown
          phone?: unknown
          role?: unknown
          updated_at?: unknown
        }
        Update: {
          company?: unknown
          contact_id?: unknown
          created_at?: unknown
          email?: unknown
          first_name?: unknown
          id?: unknown
          is_active?: unknown
          last_name?: unknown
          ms_slug?: unknown
          notes?: unknown
          phone?: unknown
          role?: unknown
          updated_at?: unknown
        }
      }
      transcript_jobs: {
        Row: {
          attempts: number
          audio_url: string
          call_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          transcript_id: string | null
        }
        Insert: {
          attempts?: unknown
          audio_url: unknown
          call_id?: unknown
          completed_at?: unknown
          created_at?: unknown
          error_message?: unknown
          id?: unknown
          started_at?: unknown
          status?: unknown
          transcript_id?: unknown
        }
        Update: {
          attempts?: unknown
          audio_url?: unknown
          call_id?: unknown
          completed_at?: unknown
          created_at?: unknown
          error_message?: unknown
          id?: unknown
          started_at?: unknown
          status?: unknown
          transcript_id?: unknown
        }
      }
      user_memory: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          memory_key: string
          memory_type: string
          memory_value: string
          source: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence?: unknown
          created_at?: unknown
          id?: unknown
          last_accessed_at?: unknown
          memory_key: unknown
          memory_type: unknown
          memory_value: unknown
          source: unknown
          updated_at?: unknown
          user_id?: unknown
        }
        Update: {
          confidence?: unknown
          created_at?: unknown
          id?: unknown
          last_accessed_at?: unknown
          memory_key?: unknown
          memory_type?: unknown
          memory_value?: unknown
          source?: unknown
          updated_at?: unknown
          user_id?: unknown
        }
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          ghl_user_id: string | null
          id: string
          is_active: boolean | null
          is_real_user: boolean
          label_color: string | null
          last_login_at: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: unknown
          email: unknown
          full_name: unknown
          ghl_user_id?: unknown
          id?: unknown
          is_active?: unknown
          is_real_user?: unknown
          label_color?: unknown
          last_login_at?: unknown
          role: unknown
          updated_at?: unknown
        }
        Update: {
          created_at?: unknown
          email?: unknown
          full_name?: unknown
          ghl_user_id?: unknown
          id?: unknown
          is_active?: unknown
          is_real_user?: unknown
          label_color?: unknown
          last_login_at?: unknown
          role?: unknown
          updated_at?: unknown
        }
      }
      workflow_ab_tests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          declared_by: string | null
          id: string
          min_sample_size: number | null
          status: string
          test_type: string
          variant_a_count: number | null
          variant_a_metric: number | null
          variant_a_step_id: string | null
          variant_a_version_id: string | null
          variant_b_count: number | null
          variant_b_metric: number | null
          variant_b_step_id: string | null
          variant_b_version_id: string | null
          winner: string | null
          winner_explanation: string | null
          workflow_id: string
        }
        Insert: {
          completed_at?: unknown
          created_at?: unknown
          created_by?: unknown
          declared_by?: unknown
          id?: unknown
          min_sample_size?: unknown
          status?: unknown
          test_type: unknown
          variant_a_count?: unknown
          variant_a_metric?: unknown
          variant_a_step_id?: unknown
          variant_a_version_id?: unknown
          variant_b_count?: unknown
          variant_b_metric?: unknown
          variant_b_step_id?: unknown
          variant_b_version_id?: unknown
          winner?: unknown
          winner_explanation?: unknown
          workflow_id?: unknown
        }
        Update: {
          completed_at?: unknown
          created_at?: unknown
          created_by?: unknown
          declared_by?: unknown
          id?: unknown
          min_sample_size?: unknown
          status?: unknown
          test_type?: unknown
          variant_a_count?: unknown
          variant_a_metric?: unknown
          variant_a_step_id?: unknown
          variant_a_version_id?: unknown
          variant_b_count?: unknown
          variant_b_metric?: unknown
          variant_b_step_id?: unknown
          variant_b_version_id?: unknown
          winner?: unknown
          winner_explanation?: unknown
          workflow_id?: unknown
        }
      }
      workflow_approvals: {
        Row: {
          ab_test_id: string | null
          approval_type: string
          approved_by: string | null
          id: string
          notes: string | null
          resolved_at: string | null
          status: string
          submitted_at: string | null
          submitted_by: string
          workflow_id: string
          workflow_version_id: string | null
        }
        Insert: {
          ab_test_id?: unknown
          approval_type: unknown
          approved_by?: unknown
          id?: unknown
          notes?: unknown
          resolved_at?: unknown
          status?: unknown
          submitted_at?: unknown
          submitted_by?: unknown
          workflow_id?: unknown
          workflow_version_id?: unknown
        }
        Update: {
          ab_test_id?: unknown
          approval_type?: unknown
          approved_by?: unknown
          id?: unknown
          notes?: unknown
          resolved_at?: unknown
          status?: unknown
          submitted_at?: unknown
          submitted_by?: unknown
          workflow_id?: unknown
          workflow_version_id?: unknown
        }
      }
      workflow_enrollments: {
        Row: {
          completed_at: string | null
          contact_name: string | null
          current_day: number | null
          current_step_id: string | null
          enrolled_at: string | null
          exit_reason: string | null
          ghl_contact_id: string
          goal_achieved: boolean | null
          id: string
          last_step_at: string | null
          paused_at: string | null
          status: string
          workflow_id: string
          workflow_version_id: string
        }
        Insert: {
          completed_at?: unknown
          contact_name?: unknown
          current_day?: unknown
          current_step_id?: unknown
          enrolled_at?: unknown
          exit_reason?: unknown
          ghl_contact_id: unknown
          goal_achieved?: unknown
          id?: unknown
          last_step_at?: unknown
          paused_at?: unknown
          status?: unknown
          workflow_id?: unknown
          workflow_version_id?: unknown
        }
        Update: {
          completed_at?: unknown
          contact_name?: unknown
          current_day?: unknown
          current_step_id?: unknown
          enrolled_at?: unknown
          exit_reason?: unknown
          ghl_contact_id?: unknown
          goal_achieved?: unknown
          id?: unknown
          last_step_at?: unknown
          paused_at?: unknown
          status?: unknown
          workflow_id?: unknown
          workflow_version_id?: unknown
        }
      }
      workflow_step_logs: {
        Row: {
          clicked: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          content_sent: string | null
          created_at: string | null
          delivered: boolean | null
          delivery_data: Json | null
          enrollment_id: string
          executed_at: string | null
          ghl_contact_id: string
          ghl_message_id: string | null
          id: string
          opened: boolean | null
          responded: boolean | null
          step_id: string
          step_type: string
        }
        Insert: {
          clicked?: unknown
          confirmed_at?: unknown
          confirmed_by?: unknown
          content_sent?: unknown
          created_at?: unknown
          delivered?: unknown
          delivery_data?: unknown
          enrollment_id?: unknown
          executed_at?: unknown
          ghl_contact_id: unknown
          ghl_message_id?: unknown
          id?: unknown
          opened?: unknown
          responded?: unknown
          step_id?: unknown
          step_type: unknown
        }
        Update: {
          clicked?: unknown
          confirmed_at?: unknown
          confirmed_by?: unknown
          content_sent?: unknown
          created_at?: unknown
          delivered?: unknown
          delivery_data?: unknown
          enrollment_id?: unknown
          executed_at?: unknown
          ghl_contact_id?: unknown
          ghl_message_id?: unknown
          id?: unknown
          opened?: unknown
          responded?: unknown
          step_id?: unknown
          step_type?: unknown
        }
      }
      workflow_steps: {
        Row: {
          click_rate: number | null
          condition_config: Json | null
          content: string | null
          created_at: string | null
          day_number: number
          id: string
          open_rate: number | null
          performance_status: string | null
          requires_confirmation: boolean | null
          response_rate: number | null
          send_time: string | null
          step_number: number
          step_type: string
          subject: string | null
          workflow_version_id: string
        }
        Insert: {
          click_rate?: unknown
          condition_config?: unknown
          content?: unknown
          created_at?: unknown
          day_number: unknown
          id?: unknown
          open_rate?: unknown
          performance_status?: unknown
          requires_confirmation?: unknown
          response_rate?: unknown
          send_time?: unknown
          step_number: unknown
          step_type: unknown
          subject?: unknown
          workflow_version_id?: unknown
        }
        Update: {
          click_rate?: unknown
          condition_config?: unknown
          content?: unknown
          created_at?: unknown
          day_number?: unknown
          id?: unknown
          open_rate?: unknown
          performance_status?: unknown
          requires_confirmation?: unknown
          response_rate?: unknown
          send_time?: unknown
          step_number?: unknown
          step_type?: unknown
          subject?: unknown
          workflow_version_id?: unknown
        }
      }
      workflow_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_description: string | null
          created_at: string | null
          created_by: string
          id: string
          update_mode: string | null
          version_number: number
          workflow_id: string
        }
        Insert: {
          approved_at?: unknown
          approved_by?: unknown
          change_description?: unknown
          created_at?: unknown
          created_by?: unknown
          id?: unknown
          update_mode?: unknown
          version_number: unknown
          workflow_id?: unknown
        }
        Update: {
          approved_at?: unknown
          approved_by?: unknown
          change_description?: unknown
          created_at?: unknown
          created_by?: unknown
          id?: unknown
          update_mode?: unknown
          version_number?: unknown
          workflow_id?: unknown
        }
      }
      workflows: {
        Row: {
          active_enrollee_count: number | null
          created_at: string | null
          created_by: string
          current_version_id: string | null
          description: string | null
          exit_conditions: Json | null
          health_score: string | null
          id: string
          name: string
          pause_conditions: Json | null
          primary_metric_name: string | null
          primary_metric_value: number | null
          status: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
          workflow_type: string
        }
        Insert: {
          active_enrollee_count?: unknown
          created_at?: unknown
          created_by?: unknown
          current_version_id?: unknown
          description?: unknown
          exit_conditions?: unknown
          health_score?: unknown
          id?: unknown
          name: unknown
          pause_conditions?: unknown
          primary_metric_name?: unknown
          primary_metric_value?: unknown
          status?: unknown
          trigger_config?: unknown
          trigger_type: unknown
          updated_at?: unknown
          workflow_type: unknown
        }
        Update: {
          active_enrollee_count?: unknown
          created_at?: unknown
          created_by?: unknown
          current_version_id?: unknown
          description?: unknown
          exit_conditions?: unknown
          health_score?: unknown
          id?: unknown
          name?: unknown
          pause_conditions?: unknown
          primary_metric_name?: unknown
          primary_metric_value?: unknown
          status?: unknown
          trigger_config?: unknown
          trigger_type?: unknown
          updated_at?: unknown
          workflow_type?: unknown
        }
      }
      zorakle_assessments: {
        Row: {
          batch: string | null
          biz_path_score: number | null
          contact_id: string | null
          created_at: string
          cultural_score: number | null
          culture: string | null
          eclipse_drive_id: string | null
          eclipse_overall: number | null
          full_name: string
          id: string
          ms_slug: string | null
          sales_score: number | null
          spoton_drive_id: string | null
          stages_score: number | null
          values_score: number | null
          values_type: string | null
          work_style: string | null
        }
        Insert: {
          batch?: unknown
          biz_path_score?: unknown
          contact_id?: unknown
          created_at?: unknown
          cultural_score?: unknown
          culture?: unknown
          eclipse_drive_id?: unknown
          eclipse_overall?: unknown
          full_name: unknown
          id?: unknown
          ms_slug?: unknown
          sales_score?: unknown
          spoton_drive_id?: unknown
          stages_score?: unknown
          values_score?: unknown
          values_type?: unknown
          work_style?: unknown
        }
        Update: {
          batch?: unknown
          biz_path_score?: unknown
          contact_id?: unknown
          created_at?: unknown
          cultural_score?: unknown
          culture?: unknown
          eclipse_drive_id?: unknown
          eclipse_overall?: unknown
          full_name?: unknown
          id?: unknown
          ms_slug?: unknown
          sales_score?: unknown
          spoton_drive_id?: unknown
          stages_score?: unknown
          values_score?: unknown
          values_type?: unknown
          work_style?: unknown
        }
      }
      zorakle_profiles: {
        Row: {
          batch: string | null
          biz_path_score: number | null
          created_at: string
          cultural_score: number | null
          culture: string | null
          eclipse_drive_id: string | null
          eclipse_overall: number | null
          fit_score: number | null
          full_name: string
          id: string
          ms_slug: string | null
          risk_flag: string | null
          sales_score: number | null
          spoton_drive_id: string | null
          stages_score: number | null
          values_score: number | null
          values_type: string | null
          work_style: string | null
        }
        Insert: {
          batch?: unknown
          biz_path_score?: unknown
          created_at?: unknown
          cultural_score?: unknown
          culture?: unknown
          eclipse_drive_id?: unknown
          eclipse_overall?: unknown
          fit_score?: unknown
          full_name: unknown
          id?: unknown
          ms_slug?: unknown
          risk_flag?: unknown
          sales_score?: unknown
          spoton_drive_id?: unknown
          stages_score?: unknown
          values_score?: unknown
          values_type?: unknown
          work_style?: unknown
        }
        Update: {
          batch?: unknown
          biz_path_score?: unknown
          created_at?: unknown
          cultural_score?: unknown
          culture?: unknown
          eclipse_drive_id?: unknown
          eclipse_overall?: unknown
          fit_score?: unknown
          full_name?: unknown
          id?: unknown
          ms_slug?: unknown
          risk_flag?: unknown
          sales_score?: unknown
          spoton_drive_id?: unknown
          stages_score?: unknown
          values_score?: unknown
          values_type?: unknown
          work_style?: unknown
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
