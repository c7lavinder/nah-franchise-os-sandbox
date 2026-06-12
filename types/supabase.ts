export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_actions: {
        Row: {
          action_type: string
          approved_at: string | null
          created_at: string
          executed_at: string | null
          final_payload: Json | null
          id: string
          output_schema_version: string
          proposed_payload: Json
          provider_gate: Json
          quiet_hours_check: Json
          requires_human_approval: boolean
          retry_policy: Json
          risk_tier: string
          run_id: string
          send_cap_check: Json
          status: string
          suppression_checks: Json
          target_id: string | null
          target_type: string | null
          template_check: Json
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          final_payload?: Json | null
          id?: string
          output_schema_version?: string
          proposed_payload?: Json
          provider_gate?: Json
          quiet_hours_check?: Json
          requires_human_approval?: boolean
          retry_policy?: Json
          risk_tier?: string
          run_id: string
          send_cap_check?: Json
          status?: string
          suppression_checks?: Json
          target_id?: string | null
          target_type?: string | null
          template_check?: Json
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          created_at?: string
          executed_at?: string | null
          final_payload?: Json | null
          id?: string
          output_schema_version?: string
          proposed_payload?: Json
          provider_gate?: Json
          quiet_hours_check?: Json
          requires_human_approval?: boolean
          retry_policy?: Json
          risk_tier?: string
          run_id?: string
          send_cap_check?: Json
          status?: string
          suppression_checks?: Json
          target_id?: string | null
          target_type?: string | null
          template_check?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_approvals: {
        Row: {
          action_id: string
          approval_source: string
          created_at: string
          decided_by_user_id: string | null
          decision: string
          decision_reason: string | null
          final_payload: Json | null
          id: string
          output_schema_version: string
          requested_by_user_id: string | null
          run_id: string | null
        }
        Insert: {
          action_id: string
          approval_source?: string
          created_at?: string
          decided_by_user_id?: string | null
          decision: string
          decision_reason?: string | null
          final_payload?: Json | null
          id?: string
          output_schema_version?: string
          requested_by_user_id?: string | null
          run_id?: string | null
        }
        Update: {
          action_id?: string
          approval_source?: string
          created_at?: string
          decided_by_user_id?: string | null
          decision?: string
          decision_reason?: string | null
          final_payload?: Json | null
          id?: string
          output_schema_version?: string
          requested_by_user_id?: string | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_approvals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_decided_by_user_id_fkey"
            columns: ["decided_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_events: {
        Row: {
          action_id: string | null
          created_at: string
          event_payload: Json
          event_type: string
          id: string
          output_schema_version: string
          run_id: string
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
          output_schema_version?: string
          run_id: string
        }
        Update: {
          action_id?: string | null
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
          output_schema_version?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "agent_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_key: string
          agent_name: string | null
          attempt_count: number
          completed_at: string | null
          created_at: string
          id: string
          input: Json
          output: Json | null
          output_schema_version: string
          requested_by_user_id: string | null
          retry_policy: Json
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_key: string
          agent_name?: string | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          output?: Json | null
          output_schema_version?: string
          requested_by_user_id?: string | null
          retry_policy?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_key?: string
          agent_name?: string | null
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          output?: Json | null
          output_schema_version?: string
          requested_by_user_id?: string | null
          retry_policy?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_api_activity: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          method: string
          request_params: Json
          resource: string
          status_code: number
          token_id: string | null
          token_prefix: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          method?: string
          request_params?: Json
          resource: string
          status_code?: number
          token_id?: string | null
          token_prefix?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          method?: string
          request_params?: Json
          resource?: string
          status_code?: number
          token_id?: string | null
          token_prefix?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_api_activity_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "ai_api_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_api_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_api_tokens: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          scope: string
          token_hash: string
          token_prefix: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scope?: string
          token_hash: string
          token_prefix: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          scope?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_api_tokens_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_api_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
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
          created_at?: string | null
          description?: string | null
          id?: string
          is_encrypted?: boolean | null
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_encrypted?: boolean | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          page_url: string | null
          priority: string
          report_type: string
          screenshot_url: string | null
          status: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          priority?: string
          report_type?: string
          screenshot_url?: string | null
          status?: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          priority?: string
          report_type?: string
          screenshot_url?: string | null
          status?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          action: string
          call_action_item_id?: string | null
          created_at?: string
          edit_diff?: string | null
          extraction_id?: string | null
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          call_action_item_id?: string | null
          created_at?: string
          edit_diff?: string | null
          extraction_id?: string | null
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_action_feedback_call_action_item_id_fkey"
            columns: ["call_action_item_id"]
            isOneToOne: false
            referencedRelation: "call_action_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_action_feedback_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "call_data_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_action_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          assigned_to_name?: string | null
          call_id: string
          category: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          ghl_action?: boolean
          id?: string
          journey_id?: string | null
          metadata?: Json | null
          original_description?: string | null
          original_title?: string | null
          pushed_at?: string | null
          skipped_at?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          why?: string | null
        }
        Update: {
          assigned_to_name?: string | null
          call_id?: string
          category?: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          description?: string | null
          ghl_action?: boolean
          id?: string
          journey_id?: string | null
          metadata?: Json | null
          original_description?: string | null
          original_title?: string | null
          pushed_at?: string | null
          skipped_at?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_action_items_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_action_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_action_items_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
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
          call_id: string
          coaching_notes?: string | null
          coaching_plan?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kb_snippets_used?: string[] | null
          scout_model?: string | null
        }
        Update: {
          call_id?: string
          coaching_notes?: string | null
          coaching_plan?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kb_snippets_used?: string[] | null
          scout_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_coaching_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_data_extractions: {
        Row: {
          auto_saved: boolean
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
          TerritorySlug: string | null
        }
        Insert: {
          auto_saved?: boolean
          call_id: string
          confidence?: string | null
          contact_id?: string | null
          created_at?: string
          dismissed?: boolean
          extracted_value?: string | null
          field_category: string
          field_key: string
          id?: string
          journey_id?: string | null
          saved_to_profile?: boolean
          source?: string
          target_scope?: string | null
          TerritorySlug?: string | null
        }
        Update: {
          auto_saved?: boolean
          call_id?: string
          confidence?: string | null
          contact_id?: string | null
          created_at?: string
          dismissed?: boolean
          extracted_value?: string | null
          field_category?: string
          field_key?: string
          id?: string
          journey_id?: string | null
          saved_to_profile?: boolean
          source?: string
          target_scope?: string | null
          TerritorySlug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_data_extractions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_data_extractions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_data_extractions_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
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
          call_id: string
          created_at?: string
          criterion_scores?: Json | null
          graded_by?: string
          id?: string
          improvements?: string[] | null
          overall_grade?: string | null
          overall_score?: number | null
          rubric_id?: string | null
          scout_model?: string | null
          strengths?: string[] | null
          suggested_next_action?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          criterion_scores?: Json | null
          graded_by?: string
          id?: string
          improvements?: string[] | null
          overall_grade?: string | null
          overall_score?: number | null
          rubric_id?: string | null
          scout_model?: string | null
          strengths?: string[] | null
          suggested_next_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_grades_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_grades_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
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
          call_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          journey_id: string
          journey_pipeline_state_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          journey_id?: string
          journey_pipeline_state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_journeys_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_journeys_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_journeys_journey_pipeline_state_id_fkey"
            columns: ["journey_pipeline_state_id"]
            isOneToOne: false
            referencedRelation: "journey_pipeline_state"
            referencedColumns: ["id"]
          },
        ]
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
          ai_prefilled?: boolean | null
          call_type: string
          called_at?: string | null
          contact_id: string
          created_at?: string | null
          fields: Json
          human_confirmed?: boolean | null
          id?: string
          logged_at?: string | null
          logged_by: string
          notes?: string | null
          red_flags_raised?: string | null
          rep_confidence?: string | null
          transcript_url?: string | null
        }
        Update: {
          ai_prefilled?: boolean | null
          call_type?: string
          called_at?: string | null
          contact_id?: string
          created_at?: string | null
          fields?: Json
          human_confirmed?: boolean | null
          id?: string
          logged_at?: string | null
          logged_by?: string
          notes?: string | null
          red_flags_raised?: string | null
          rep_confidence?: string | null
          transcript_url?: string | null
        }
        Relationships: []
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
          call_id: string
          contact_id?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          journey_pipeline_state_id?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          call_id?: string
          contact_id?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          journey_pipeline_state_id?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_journey_pipeline_state_id_fkey"
            columns: ["journey_pipeline_state_id"]
            isOneToOne: false
            referencedRelation: "journey_pipeline_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          call_id: string
          coaching_citations?: Json | null
          coaching_feedback?: string | null
          contact_id?: string | null
          created_at?: string
          grade?: string | null
          grade_detail?: Json | null
          id?: string
          next_step_cards?: Json | null
          profile_suggestions?: Json | null
          rep_id?: string | null
          status?: string
        }
        Update: {
          call_id?: string
          coaching_citations?: Json | null
          coaching_feedback?: string | null
          contact_id?: string | null
          created_at?: string
          grade?: string | null
          grade_detail?: Json | null
          id?: string
          next_step_cards?: Json | null
          profile_suggestions?: Json | null
          rep_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_review_packages_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_review_packages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_review_packages_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      call_territories: {
        Row: {
          call_id: string
          created_at: string
          id: string
          is_primary: boolean
          TerritorySlug: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          TerritorySlug: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_territories_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
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
          call_id: string
          created_at?: string
          full_text: string
          id?: string
          language?: string | null
          metadata?: Json | null
          source: string
          word_count?: number | null
        }
        Update: {
          call_id?: string
          created_at?: string
          full_text?: string
          id?: string
          language?: string | null
          metadata?: Json | null
          source?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
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
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          TerritorySlug: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          brief_context?: string | null
          brief_generated_at?: string | null
          call_type_id: string
          classification_reason?: string | null
          coach_user_id?: string | null
          coaching_data?: Json | null
          coaching_generated_at?: string | null
          coaching_score?: number | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          ghl_event_id?: string | null
          hosted_by_user_id?: string | null
          id?: string
          journey_pipeline_state_id?: string | null
          kb_intel_items?: Json | null
          match_confidence?: number | null
          match_reason?: string | null
          meeting_link?: string | null
          participant_count?: number | null
          raw_transcript?: string | null
          read_ai_session_id?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          source?: string | null
          started_at?: string | null
          status?: string
          sub_task_id?: string | null
          summary?: string | null
          summary_bullets?: string[] | null
          TerritorySlug?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          ai_summary?: string | null
          ai_summary_generated_at?: string | null
          brief_context?: string | null
          brief_generated_at?: string | null
          call_type_id?: string
          classification_reason?: string | null
          coach_user_id?: string | null
          coaching_data?: Json | null
          coaching_generated_at?: string | null
          coaching_score?: number | null
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          ghl_event_id?: string | null
          hosted_by_user_id?: string | null
          id?: string
          journey_pipeline_state_id?: string | null
          kb_intel_items?: Json | null
          match_confidence?: number | null
          match_reason?: string | null
          meeting_link?: string | null
          participant_count?: number | null
          raw_transcript?: string | null
          read_ai_session_id?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          source?: string | null
          started_at?: string | null
          status?: string
          sub_task_id?: string | null
          summary?: string | null
          summary_bullets?: string[] | null
          TerritorySlug?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_hosted_by_user_id_fkey"
            columns: ["hosted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_journey_pipeline_state_id_fkey"
            columns: ["journey_pipeline_state_id"]
            isOneToOne: false
            referencedRelation: "journey_pipeline_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_sub_task_id_fkey"
            columns: ["sub_task_id"]
            isOneToOne: false
            referencedRelation: "pipeline_sub_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
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
          active_flags?: Json | null
          avg_response_time_hours?: number | null
          construction_comfort?: string | null
          contact_id: string
          created_at?: string | null
          current_score?: number | null
          disc_profile?: string | null
          financial_red_flags?: Json | null
          funding_path?: string | null
          ghl_location_id: string
          homework_completion_rate?: number | null
          id?: string
          illiquid_capital?: number | null
          liquid_capital?: number | null
          net_worth_bucket?: string | null
          outstanding_liabilities?: string | null
          personality_flags?: Json | null
          pfs_received?: boolean | null
          pfs_uploaded_url?: string | null
          prior_business_owner?: boolean | null
          prior_business_type?: string | null
          risk_tolerance_score?: number | null
          score_engagement?: number | null
          score_financial?: number | null
          score_momentum?: number | null
          score_operational?: number | null
          spouse_supportive?: string | null
          stated_motivation?: string | null
          trainual_completion_pct?: number | null
          trainual_last_activity?: string | null
          updated_at?: string | null
          urgency?: string | null
          zorakle_completed?: boolean | null
          zorakle_results?: Json | null
        }
        Update: {
          active_flags?: Json | null
          avg_response_time_hours?: number | null
          construction_comfort?: string | null
          contact_id?: string
          created_at?: string | null
          current_score?: number | null
          disc_profile?: string | null
          financial_red_flags?: Json | null
          funding_path?: string | null
          ghl_location_id?: string
          homework_completion_rate?: number | null
          id?: string
          illiquid_capital?: number | null
          liquid_capital?: number | null
          net_worth_bucket?: string | null
          outstanding_liabilities?: string | null
          personality_flags?: Json | null
          pfs_received?: boolean | null
          pfs_uploaded_url?: string | null
          prior_business_owner?: boolean | null
          prior_business_type?: string | null
          risk_tolerance_score?: number | null
          score_engagement?: number | null
          score_financial?: number | null
          score_momentum?: number | null
          score_operational?: number | null
          spouse_supportive?: string | null
          stated_motivation?: string | null
          trainual_completion_pct?: number | null
          trainual_last_activity?: string | null
          updated_at?: string | null
          urgency?: string | null
          zorakle_completed?: boolean | null
          zorakle_results?: Json | null
        }
        Relationships: []
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
          changes_explained?: Json | null
          contact_id: string
          created_at?: string | null
          engagement_after?: number | null
          engagement_before?: number | null
          financial_after?: number | null
          financial_before?: number | null
          id?: string
          momentum_after?: number | null
          momentum_before?: number | null
          operational_after?: number | null
          operational_before?: number | null
          score_after?: number | null
          score_before?: number | null
          trigger_id?: string | null
          triggered_by: string
        }
        Update: {
          changes_explained?: Json | null
          contact_id?: string
          created_at?: string | null
          engagement_after?: number | null
          engagement_before?: number | null
          financial_after?: number | null
          financial_before?: number | null
          id?: string
          momentum_after?: number | null
          momentum_before?: number | null
          operational_after?: number | null
          operational_before?: number | null
          score_after?: number | null
          score_before?: number | null
          trigger_id?: string | null
          triggered_by?: string
        }
        Relationships: []
      }
      coach_assignments: {
        Row: {
          assigned_at: string | null
          coach_user_id: string
          ended_at: string | null
          id: string
          specialty: string | null
          TerritorySlug: string
        }
        Insert: {
          assigned_at?: string | null
          coach_user_id: string
          ended_at?: string | null
          id?: string
          specialty?: string | null
          TerritorySlug: string
        }
        Update: {
          assigned_at?: string | null
          coach_user_id?: string
          ended_at?: string | null
          id?: string
          specialty?: string | null
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      commitments: {
        Row: {
          call_id: string
          commitment_text: string
          commitment_type: string | null
          committed_by: string | null
          contact_id: string | null
          created_at: string
          due_date: string | null
          fulfilled_at: string | null
          id: string
          made_by_user_id: string | null
          source_extraction_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_id: string
          commitment_text: string
          commitment_type?: string | null
          committed_by?: string | null
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          fulfilled_at?: string | null
          id?: string
          made_by_user_id?: string | null
          source_extraction_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_id?: string
          commitment_text?: string
          commitment_type?: string | null
          committed_by?: string | null
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          fulfilled_at?: string | null
          id?: string
          made_by_user_id?: string | null
          source_extraction_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_tracking: {
        Row: {
          background_check_at: string | null
          background_check_status: string | null
          contact_id: string
          created_at: string | null
          docusign_envelope_id: string | null
          fdd_acknowledged_at: string | null
          fdd_cooling_ends_at: string | null
          fdd_issued_at: string | null
          fdd_state: string | null
          fdd_version: string | null
          franchise_agreement_sent_at: string | null
          franchise_agreement_signed_at: string | null
          franchise_agreement_version: string | null
          id: string
          insurance_verified_at: string | null
          notes: string | null
          state_registration_expiry: string | null
          state_registration_status: string | null
          training_completed_at: string | null
          training_modules_completed: number | null
          training_modules_total: number | null
          training_started_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          background_check_at?: string | null
          background_check_status?: string | null
          contact_id: string
          created_at?: string | null
          docusign_envelope_id?: string | null
          fdd_acknowledged_at?: string | null
          fdd_cooling_ends_at?: string | null
          fdd_issued_at?: string | null
          fdd_state?: string | null
          fdd_version?: string | null
          franchise_agreement_sent_at?: string | null
          franchise_agreement_signed_at?: string | null
          franchise_agreement_version?: string | null
          id?: string
          insurance_verified_at?: string | null
          notes?: string | null
          state_registration_expiry?: string | null
          state_registration_status?: string | null
          training_completed_at?: string | null
          training_modules_completed?: number | null
          training_modules_total?: number | null
          training_started_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          background_check_at?: string | null
          background_check_status?: string | null
          contact_id?: string
          created_at?: string | null
          docusign_envelope_id?: string | null
          fdd_acknowledged_at?: string | null
          fdd_cooling_ends_at?: string | null
          fdd_issued_at?: string | null
          fdd_state?: string | null
          fdd_version?: string | null
          franchise_agreement_sent_at?: string | null
          franchise_agreement_signed_at?: string | null
          franchise_agreement_version?: string | null
          id?: string
          insurance_verified_at?: string | null
          notes?: string | null
          state_registration_expiry?: string | null
          state_registration_status?: string | null
          training_completed_at?: string | null
          training_modules_completed?: number | null
          training_modules_total?: number | null
          training_started_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_tracking_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_tracking_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          author_user_id: string
          body: string
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mentioned_user_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          mentioned_user_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activity_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activity_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_briefs: {
        Row: {
          brief: Json
          contact_id: string
          created_at: string
          stale: boolean
          summary: string | null
          updated_at: string
        }
        Insert: {
          brief?: Json
          contact_id: string
          created_at?: string
          stale?: boolean
          summary?: string | null
          updated_at?: string
        }
        Update: {
          brief?: Json
          contact_id?: string
          created_at?: string
          stale?: boolean
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
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
          contact_id: string
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          label?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string
          created_at?: string
          embedding_id?: string | null
          id?: string
          interactions?: Json
          journal_date: string
          signals_extracted?: Json
          summary: string
          tenant_id?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          embedding_id?: string | null
          id?: string
          interactions?: Json
          journal_date?: string
          signals_extracted?: Json
          summary?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_journals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_journals_embedding_id_fkey"
            columns: ["embedding_id"]
            isOneToOne: false
            referencedRelation: "embeddings"
            referencedColumns: ["id"]
          },
        ]
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
          competitor_notes?: string | null
          created_at?: string
          decision_style?: string | null
          definition_of_success?: string | null
          desired_territory?: string | null
          financing_type?: string | null
          ghl_contact_id: string
          guidant_robs_active?: boolean | null
          liquid_capital?: number | null
          local_market_notes?: string | null
          market_area?: string | null
          net_worth_estimate?: number | null
          objections_raised?: string | null
          pfs_received?: boolean | null
          primary_motivation?: string | null
          prior_re_experience?: string | null
          secondary_territory?: string | null
          skill_set_notes?: string | null
          territory_value_est?: number | null
          updated_at?: string
          zip_codes_of_interest?: string | null
        }
        Update: {
          competitor_notes?: string | null
          created_at?: string
          decision_style?: string | null
          definition_of_success?: string | null
          desired_territory?: string | null
          financing_type?: string | null
          ghl_contact_id?: string
          guidant_robs_active?: boolean | null
          liquid_capital?: number | null
          local_market_notes?: string | null
          market_area?: string | null
          net_worth_estimate?: number | null
          objections_raised?: string | null
          pfs_received?: boolean | null
          primary_motivation?: string | null
          prior_re_experience?: string | null
          secondary_territory?: string | null
          skill_set_notes?: string | null
          territory_value_est?: number | null
          updated_at?: string
          zip_codes_of_interest?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_profile_data_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
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
          contact_id: string
          created_at?: string
          field_name: string
          field_value?: Json | null
          id?: string
          last_updated_at?: string
          last_updated_by?: string
          source_history?: Json
        }
        Update: {
          contact_id?: string
          created_at?: string
          field_name?: string
          field_value?: Json | null
          id?: string
          last_updated_at?: string
          last_updated_by?: string
          source_history?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contact_profile_fields_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary_decision_maker?: boolean
          last_name?: string | null
          linked_contact_id?: string | null
          phone?: string | null
          relationship_notes?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary_decision_maker?: boolean
          last_name?: string | null
          linked_contact_id?: string | null
          phone?: string | null
          relationship_notes?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_related_people_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_related_people_linked_contact_id_fkey"
            columns: ["linked_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          confidence?: string | null
          created_at?: string
          expires_at?: string | null
          ghl_contact_id: string
          id?: string
          reason?: string | null
          score_type: string
          score_value: string
          source?: string
          updated_at?: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          expires_at?: string | null
          ghl_contact_id?: string
          id?: string
          reason?: string | null
          score_type?: string
          score_value?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_scores_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
      }
      contact_sub_task_logs: {
        Row: {
          content_file_url: string | null
          content_link_url: string | null
          content_text: string | null
          content_type: Database["public"]["Enums"]["log_content_type"]
          created_at: string
          deleted_at: string | null
          id: string
          journey_pipeline_state_id: string
          logger_user_id: string | null
          metadata: Json | null
          source: Database["public"]["Enums"]["log_source"]
          state_advance: Database["public"]["Enums"]["log_state_advance"] | null
          sub_task_id: string
          updated_at: string
        }
        Insert: {
          content_file_url?: string | null
          content_link_url?: string | null
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["log_content_type"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          journey_pipeline_state_id: string
          logger_user_id?: string | null
          metadata?: Json | null
          source?: Database["public"]["Enums"]["log_source"]
          state_advance?:
            | Database["public"]["Enums"]["log_state_advance"]
            | null
          sub_task_id: string
          updated_at?: string
        }
        Update: {
          content_file_url?: string | null
          content_link_url?: string | null
          content_text?: string | null
          content_type?: Database["public"]["Enums"]["log_content_type"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          journey_pipeline_state_id?: string
          logger_user_id?: string | null
          metadata?: Json | null
          source?: Database["public"]["Enums"]["log_source"]
          state_advance?:
            | Database["public"]["Enums"]["log_state_advance"]
            | null
          sub_task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_sub_task_logs_journey_pipeline_state_id_fkey"
            columns: ["journey_pipeline_state_id"]
            isOneToOne: false
            referencedRelation: "journey_pipeline_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sub_task_logs_logger_user_id_fkey"
            columns: ["logger_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_sub_task_logs_sub_task_id_fkey"
            columns: ["sub_task_id"]
            isOneToOne: false
            referencedRelation: "pipeline_sub_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_team_members: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_team_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          culture?: string | null
          eclipse_drive_id?: string | null
          eclipse_overall?: number | null
          fit_score?: number | null
          ghl_contact_id: string
          id?: string
          risk_flag?: string | null
          source?: string
          spoton_drive_id?: string | null
          updated_at?: string
          values_type?: string | null
          work_style?: string | null
          zorakle_completed_at?: string | null
        }
        Update: {
          created_at?: string
          culture?: string | null
          eclipse_drive_id?: string | null
          eclipse_overall?: number | null
          fit_score?: number | null
          ghl_contact_id?: string
          id?: string
          risk_flag?: string | null
          source?: string
          spoton_drive_id?: string | null
          updated_at?: string
          values_type?: string | null
          work_style?: string | null
          zorakle_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_zorakle_data_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          BriefWorkHistory: string | null
          city: string | null
          clickx_package: string | null
          converted_at: string | null
          CountiesInterestedIn: string | null
          created_at: string
          ecosystem_partners: string | null
          email: string | null
          fb_url: string | null
          first_name: string | null
          framing_call_logged: boolean | null
          franchise_fee: number | null
          franchise_start_date: string | null
          ghl_contact_id: string
          ghl_date_added: string | null
          happyfox_url: string | null
          id: string
          incoming_lead_email: string | null
          investment_timeline: string | null
          is_converted_franchisee: boolean
          last_name: string | null
          last_synced_at: string | null
          lead_manager_email: string | null
          lead_manager_name: string | null
          LeadSource: string | null
          legal_entity: string | null
          marketing_phone: string | null
          merged_at: string | null
          merged_into_contact_id: string | null
          nda_status: string | null
          needs_review: boolean | null
          nexa_phone: string | null
          NonRetirementCapitalAvailable: string | null
          NonRetirementCapitalAvailableSource: string | null
          notes: string | null
          number_of_franchisees: number | null
          onboarding_completion_date: string | null
          openclaw_enriched: boolean | null
          opportunity_source: string | null
          PartnerEmail: string | null
          PartnerName: string | null
          PartnerOccupation: string | null
          PartnerPhone: string | null
          phone: string | null
          phone_normalized: string | null
          PreferredName: string | null
          PreferredWeeklyHours: number | null
          property_submission_status: string | null
          PtoSubmissionDate: string | null
          real_estate_agent_broker: string | null
          real_estate_agent_email: string | null
          real_estate_partner: string | null
          real_estate_phone: string | null
          ReferredBy: string | null
          RetirementFundsRollingOver: number | null
          return_mail_address: string | null
          royalty_pct: number | null
          scout_lead_score: number | null
          source: string | null
          state: string | null
          sub_source: string | null
          term_months: number | null
          territory_email: string | null
          territory_interest: string | null
          territory_status: string | null
          trainual_access_sent: boolean | null
          trainual_completion_pct: number | null
          updated_at: string
          website: string | null
          WhatInterestsInOpportunity: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          BriefWorkHistory?: string | null
          city?: string | null
          clickx_package?: string | null
          converted_at?: string | null
          CountiesInterestedIn?: string | null
          created_at?: string
          ecosystem_partners?: string | null
          email?: string | null
          fb_url?: string | null
          first_name?: string | null
          framing_call_logged?: boolean | null
          franchise_fee?: number | null
          franchise_start_date?: string | null
          ghl_contact_id: string
          ghl_date_added?: string | null
          happyfox_url?: string | null
          id?: string
          incoming_lead_email?: string | null
          investment_timeline?: string | null
          is_converted_franchisee?: boolean
          last_name?: string | null
          last_synced_at?: string | null
          lead_manager_email?: string | null
          lead_manager_name?: string | null
          LeadSource?: string | null
          legal_entity?: string | null
          marketing_phone?: string | null
          merged_at?: string | null
          merged_into_contact_id?: string | null
          nda_status?: string | null
          needs_review?: boolean | null
          nexa_phone?: string | null
          NonRetirementCapitalAvailable?: string | null
          NonRetirementCapitalAvailableSource?: string | null
          notes?: string | null
          number_of_franchisees?: number | null
          onboarding_completion_date?: string | null
          openclaw_enriched?: boolean | null
          opportunity_source?: string | null
          PartnerEmail?: string | null
          PartnerName?: string | null
          PartnerOccupation?: string | null
          PartnerPhone?: string | null
          phone?: string | null
          phone_normalized?: string | null
          PreferredName?: string | null
          PreferredWeeklyHours?: number | null
          property_submission_status?: string | null
          PtoSubmissionDate?: string | null
          real_estate_agent_broker?: string | null
          real_estate_agent_email?: string | null
          real_estate_partner?: string | null
          real_estate_phone?: string | null
          ReferredBy?: string | null
          RetirementFundsRollingOver?: number | null
          return_mail_address?: string | null
          royalty_pct?: number | null
          scout_lead_score?: number | null
          source?: string | null
          state?: string | null
          sub_source?: string | null
          term_months?: number | null
          territory_email?: string | null
          territory_interest?: string | null
          territory_status?: string | null
          trainual_access_sent?: boolean | null
          trainual_completion_pct?: number | null
          updated_at?: string
          website?: string | null
          WhatInterestsInOpportunity?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          BriefWorkHistory?: string | null
          city?: string | null
          clickx_package?: string | null
          converted_at?: string | null
          CountiesInterestedIn?: string | null
          created_at?: string
          ecosystem_partners?: string | null
          email?: string | null
          fb_url?: string | null
          first_name?: string | null
          framing_call_logged?: boolean | null
          franchise_fee?: number | null
          franchise_start_date?: string | null
          ghl_contact_id?: string
          ghl_date_added?: string | null
          happyfox_url?: string | null
          id?: string
          incoming_lead_email?: string | null
          investment_timeline?: string | null
          is_converted_franchisee?: boolean
          last_name?: string | null
          last_synced_at?: string | null
          lead_manager_email?: string | null
          lead_manager_name?: string | null
          LeadSource?: string | null
          legal_entity?: string | null
          marketing_phone?: string | null
          merged_at?: string | null
          merged_into_contact_id?: string | null
          nda_status?: string | null
          needs_review?: boolean | null
          nexa_phone?: string | null
          NonRetirementCapitalAvailable?: string | null
          NonRetirementCapitalAvailableSource?: string | null
          notes?: string | null
          number_of_franchisees?: number | null
          onboarding_completion_date?: string | null
          openclaw_enriched?: boolean | null
          opportunity_source?: string | null
          PartnerEmail?: string | null
          PartnerName?: string | null
          PartnerOccupation?: string | null
          PartnerPhone?: string | null
          phone?: string | null
          phone_normalized?: string | null
          PreferredName?: string | null
          PreferredWeeklyHours?: number | null
          property_submission_status?: string | null
          PtoSubmissionDate?: string | null
          real_estate_agent_broker?: string | null
          real_estate_agent_email?: string | null
          real_estate_partner?: string | null
          real_estate_phone?: string | null
          ReferredBy?: string | null
          RetirementFundsRollingOver?: number | null
          return_mail_address?: string | null
          royalty_pct?: number | null
          scout_lead_score?: number | null
          source?: string | null
          state?: string | null
          sub_source?: string | null
          term_months?: number | null
          territory_email?: string | null
          territory_interest?: string | null
          territory_status?: string | null
          trainual_access_sent?: boolean | null
          trainual_completion_pct?: number | null
          updated_at?: string
          website?: string | null
          WhatInterestsInOpportunity?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_merged_into_contact_id_fkey"
            columns: ["merged_into_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          status: Database["public"]["Enums"]["cron_job_status"]
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["cron_job_status"]
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["cron_job_status"]
        }
        Relationships: []
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
          TerritorySlug: string | null
          updated_at: string | null
        }
        Insert: {
          combination_note?: string | null
          combined_sources?: string[] | null
          confidence?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_value?: string | null
          evidence?: string | null
          field_name: string
          field_table: string
          final_value?: string | null
          id?: string
          resolved_at?: string | null
          reviewer_id?: string | null
          source: string
          source_id?: string | null
          status?: string
          suggested_value: string
          superseded_by?: string | null
          TerritorySlug?: string | null
          updated_at?: string | null
        }
        Update: {
          combination_note?: string | null
          combined_sources?: string[] | null
          confidence?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_value?: string | null
          evidence?: string | null
          field_name?: string
          field_table?: string
          final_value?: string | null
          id?: string
          resolved_at?: string | null
          reviewer_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          suggested_value?: string
          superseded_by?: string | null
          TerritorySlug?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_update_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
          {
            foreignKeyName: "data_update_suggestions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "data_update_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      embeddings: {
        Row: {
          contact_id: string | null
          content: string
          content_tsv: unknown
          content_type: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          model_version: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          content: string
          content_tsv?: unknown
          content_type: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          model_version?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          content?: string
          content_tsv?: unknown
          content_type?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          model_version?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string
          id?: string
          income_goal?: string | null
          lifestyle_goal?: string | null
          qol_goal?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          id?: string
          income_goal?: string | null
          lifestyle_goal?: string | null
          qol_goal?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_contact_goals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          cadence?: string
          contact_id: string
          created_at?: string | null
          grade?: string | null
          habit_text: string
          id?: string
          sort_order?: number | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          cadence?: string
          contact_id?: string
          created_at?: string | null
          grade?: string | null
          habit_text?: string
          id?: string
          sort_order?: number | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_contact_habits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          issue_text: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          issue_text?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_contact_issues_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          owner_user_id?: string | null
          source?: string | null
          todo_text: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          owner_user_id?: string | null
          source?: string | null
          todo_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_contact_todos_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_contact_todos_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_territory_budgets: {
        Row: {
          amount: number | null
          description: string
          id: string
          ms_id: number | null
          sort_order: number | null
          TerritorySlug: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          description: string
          id?: string
          ms_id?: number | null
          sort_order?: number | null
          TerritorySlug: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          description?: string
          id?: string
          ms_id?: number | null
          sort_order?: number | null
          TerritorySlug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      eos_territory_goals: {
        Row: {
          actual: string | null
          current_year_goal: string | null
          goal_type: string
          id: string
          TerritorySlug: string
          updated_at: string | null
          year_25_goal: string | null
          year_5_goal: string | null
        }
        Insert: {
          actual?: string | null
          current_year_goal?: string | null
          goal_type: string
          id?: string
          TerritorySlug: string
          updated_at?: string | null
          year_25_goal?: string | null
          year_5_goal?: string | null
        }
        Update: {
          actual?: string | null
          current_year_goal?: string | null
          goal_type?: string
          id?: string
          TerritorySlug?: string
          updated_at?: string | null
          year_25_goal?: string | null
          year_5_goal?: string | null
        }
        Relationships: []
      }
      eos_territory_habits: {
        Row: {
          grade: string | null
          habit_key: string
          habit_label: string
          id: string
          sort_order: number | null
          TerritorySlug: string
          updated_at: string | null
        }
        Insert: {
          grade?: string | null
          habit_key: string
          habit_label: string
          id?: string
          sort_order?: number | null
          TerritorySlug: string
          updated_at?: string | null
        }
        Update: {
          grade?: string | null
          habit_key?: string
          habit_label?: string
          id?: string
          sort_order?: number | null
          TerritorySlug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      eos_territory_issues: {
        Row: {
          created_at: string | null
          id: string
          is_done: boolean | null
          Issue: string
          ms_id: number | null
          origin_contact_id: string | null
          source: string | null
          TerritorySlug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          Issue: string
          ms_id?: number | null
          origin_contact_id?: string | null
          source?: string | null
          TerritorySlug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          Issue?: string
          ms_id?: number | null
          origin_contact_id?: string | null
          source?: string | null
          TerritorySlug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_territory_issues_origin_contact_id_fkey"
            columns: ["origin_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      eos_territory_lead_channels: {
        Row: {
          channel_name: string
          id: string
          is_active: boolean | null
          sort_order: number | null
          TerritorySlug: string
          updated_at: string | null
        }
        Insert: {
          channel_name: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          TerritorySlug: string
          updated_at?: string | null
        }
        Update: {
          channel_name?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          TerritorySlug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      eos_territory_rocks: {
        Row: {
          created_at: string | null
          id: string
          ms_id: number | null
          quarter: number | null
          Rock: string
          status: string | null
          TerritorySlug: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ms_id?: number | null
          quarter?: number | null
          Rock: string
          status?: string | null
          TerritorySlug: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ms_id?: number | null
          quarter?: number | null
          Rock?: string
          status?: string | null
          TerritorySlug?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      eos_territory_scorecard: {
        Row: {
          goal_value: string | null
          id: string
          metric_key: string
          metric_label: string
          sort_order: number | null
          TerritorySlug: string
          updated_at: string | null
        }
        Insert: {
          goal_value?: string | null
          id?: string
          metric_key: string
          metric_label: string
          sort_order?: number | null
          TerritorySlug: string
          updated_at?: string | null
        }
        Update: {
          goal_value?: string | null
          id?: string
          metric_key?: string
          metric_label?: string
          sort_order?: number | null
          TerritorySlug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      eos_territory_todos: {
        Row: {
          created_at: string | null
          id: string
          is_done: boolean | null
          ms_id: number | null
          origin_contact_id: string | null
          owner_user_id: string | null
          source: string | null
          TerritorySlug: string
          Todo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          ms_id?: number | null
          origin_contact_id?: string | null
          owner_user_id?: string | null
          source?: string | null
          TerritorySlug: string
          Todo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_done?: boolean | null
          ms_id?: number | null
          origin_contact_id?: string | null
          owner_user_id?: string | null
          source?: string | null
          TerritorySlug?: string
          Todo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eos_territory_todos_origin_contact_id_fkey"
            columns: ["origin_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eos_territory_todos_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      flagged_responses: {
        Row: {
          ai_response: string
          concern_type: string | null
          correction_note: string | null
          created_at: string
          id: string
          page_url: string | null
          resolved_at: string | null
          reviewed_at: string | null
          selected_text: string | null
          session_id: string | null
          status: string
          user_id: string
          user_message: string
          user_name: string
        }
        Insert: {
          ai_response: string
          concern_type?: string | null
          correction_note?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          selected_text?: string | null
          session_id?: string | null
          status?: string
          user_id: string
          user_message: string
          user_name: string
        }
        Update: {
          ai_response?: string
          concern_type?: string | null
          correction_note?: string | null
          created_at?: string
          id?: string
          page_url?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          selected_text?: string | null
          session_id?: string | null
          status?: string
          user_id?: string
          user_message?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "flagged_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flagged_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_owners: {
        Row: {
          created_at: string
          ct_email: string | null
          ct_id: string | null
          full_name: string
          ghl_contact_id: string | null
          status: string
          TerritorySlug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ct_email?: string | null
          ct_id?: string | null
          full_name: string
          ghl_contact_id?: string | null
          status?: string
          TerritorySlug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ct_email?: string | null
          ct_id?: string | null
          full_name?: string
          ghl_contact_id?: string | null
          status?: string
          TerritorySlug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_owners_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
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
          active_status?: string | null
          contact_id: string
          created_at?: string | null
          data_source?: string | null
          franchise_agreement_signed?: boolean | null
          franchise_software_id?: string | null
          franchisee_name: string
          funds_received_at?: string | null
          houses_purchased_total?: number | null
          houses_purchased_year1?: number | null
          houses_purchased_year2?: number | null
          houses_purchased_year3?: number | null
          id?: string
          last_synced_at?: string | null
          nps_score?: number | null
          revenue_year1?: number | null
          revenue_year2?: number | null
          revenue_year3?: number | null
          royalty_payment_consistent?: boolean | null
          signed_at?: string | null
          staff_hired?: number | null
          support_calls_year1?: number | null
          territory?: string | null
          territory_utilization_pct?: number | null
          time_to_first_flip_days?: number | null
          updated_at?: string | null
        }
        Update: {
          active_status?: string | null
          contact_id?: string
          created_at?: string | null
          data_source?: string | null
          franchise_agreement_signed?: boolean | null
          franchise_software_id?: string | null
          franchisee_name?: string
          funds_received_at?: string | null
          houses_purchased_total?: number | null
          houses_purchased_year1?: number | null
          houses_purchased_year2?: number | null
          houses_purchased_year3?: number | null
          id?: string
          last_synced_at?: string | null
          nps_score?: number | null
          revenue_year1?: number | null
          revenue_year2?: number | null
          revenue_year3?: number | null
          royalty_payment_consistent?: boolean | null
          signed_at?: string | null
          staff_hired?: number | null
          support_calls_year1?: number | null
          territory?: string | null
          territory_utilization_pct?: number | null
          time_to_first_flip_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ghl_action_drafts: {
        Row: {
          action_type: string
          approval_source: string | null
          approved_by_user_id: string | null
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
          output_schema_version: string
          params: Json
          risk_tier: string | null
          safety_checks: Json
          status: string
        }
        Insert: {
          action_type: string
          approval_source?: string | null
          approved_by_user_id?: string | null
          confirmed_at?: string | null
          contact_id?: string | null
          created_at?: string
          drafted_by_source?: string
          drafted_by_user_id?: string | null
          edited_params?: Json | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          outcome?: Json | null
          output_schema_version?: string
          params?: Json
          risk_tier?: string | null
          safety_checks?: Json
          status?: string
        }
        Update: {
          action_type?: string
          approval_source?: string | null
          approved_by_user_id?: string | null
          confirmed_at?: string | null
          contact_id?: string | null
          created_at?: string
          drafted_by_source?: string
          drafted_by_user_id?: string | null
          edited_params?: Json | null
          error_message?: string | null
          executed_at?: string | null
          id?: string
          outcome?: Json | null
          output_schema_version?: string
          params?: Json
          risk_tier?: string | null
          safety_checks?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_action_drafts_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_action_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ghl_action_drafts_drafted_by_user_id_fkey"
            columns: ["drafted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string | null
          id?: string
          pipeline_id: string
          position?: number | null
          stage_id: string
          stage_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pipeline_id?: string
          position?: number | null
          stage_id?: string
          stage_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ghl_sync_queue: {
        Row: {
          attempts: number
          contact_id: string
          created_at: string
          ghl_field_id: string
          id: string
          last_error: string | null
          status: Database["public"]["Enums"]["ghl_sync_status"]
          updated_at: string
          value: string
        }
        Insert: {
          attempts?: number
          contact_id: string
          created_at?: string
          ghl_field_id: string
          id?: string
          last_error?: string | null
          status?: Database["public"]["Enums"]["ghl_sync_status"]
          updated_at?: string
          value: string
        }
        Update: {
          attempts?: number
          contact_id?: string
          created_at?: string
          ghl_field_id?: string
          id?: string
          last_error?: string | null
          status?: Database["public"]["Enums"]["ghl_sync_status"]
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_sync_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string | null
          description?: string | null
          ghl_workflow_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ghl_workflow_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: []
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
          alert_type: string
          created_at?: string | null
          details?: Json | null
          ghl_contact_id?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          pipeline_stage?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          ghl_contact_id?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          pipeline_stage?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inactivity_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inactivity_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          status: string
          TerritorySlug: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          integration_name: string
          payload_summary?: string | null
          related_contact_id?: string | null
          status: string
          TerritorySlug?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          integration_name?: string
          payload_summary?: string | null
          related_contact_id?: string | null
          status?: string
          TerritorySlug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      journey_briefs: {
        Row: {
          created_at: string
          data_snapshot: Json
          journey_id: string
          narrative: string
          next_actions: Json
          stale: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_snapshot?: Json
          journey_id: string
          narrative?: string
          next_actions?: Json
          stale?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_snapshot?: Json
          journey_id?: string
          narrative?: string
          next_actions?: Json
          stale?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_briefs_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: true
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
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
          contact_id: string
          created_at?: string
          id?: string
          is_primary_decision_maker?: boolean
          joined_at?: string
          journey_id: string
          left_at?: string | null
          role: string
          role_notes?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary_decision_maker?: boolean
          joined_at?: string
          journey_id?: string
          left_at?: string | null
          role?: string
          role_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_contacts_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_documents: {
        Row: {
          contact_id: string | null
          created_at: string
          display_name: string
          doc_type: string
          extracted_text: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          journey_id: string
          mime_type: string | null
          suggested_fields: Json | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          display_name: string
          doc_type: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          file_url: string
          id?: string
          journey_id: string
          mime_type?: string | null
          suggested_fields?: Json | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          display_name?: string
          doc_type?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          journey_id?: string
          mime_type?: string | null
          suggested_fields?: Json | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_documents_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_pipeline_state: {
        Row: {
          assigned_user_id: string | null
          closed_at: string | null
          closed_reason:
            | Database["public"]["Enums"]["pipeline_close_reason"]
            | null
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
          TerritorySlug: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          closed_at?: string | null
          closed_reason?:
            | Database["public"]["Enums"]["pipeline_close_reason"]
            | null
          created_at?: string
          current_stage_id: string
          current_sub_task_id?: string | null
          current_sub_task_started_at?: string | null
          entered_current_stage_at?: string
          entered_pipeline_at?: string
          id?: string
          is_active?: boolean
          journey_id: string
          pipeline_id: string
          TerritorySlug?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          closed_at?: string | null
          closed_reason?:
            | Database["public"]["Enums"]["pipeline_close_reason"]
            | null
          created_at?: string
          current_stage_id?: string
          current_sub_task_id?: string | null
          current_sub_task_started_at?: string | null
          entered_current_stage_at?: string
          entered_pipeline_at?: string
          id?: string
          is_active?: boolean
          journey_id?: string
          pipeline_id?: string
          TerritorySlug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_pipeline_state_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_pipeline_state_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_pipeline_state_current_sub_task_id_fkey"
            columns: ["current_sub_task_id"]
            isOneToOne: false
            referencedRelation: "pipeline_sub_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_pipeline_state_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_pipeline_state_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      journeys: {
        Row: {
          close_reason:
            | Database["public"]["Enums"]["pipeline_close_reason"]
            | null
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
          close_reason?:
            | Database["public"]["Enums"]["pipeline_close_reason"]
            | null
          created_at?: string
          id?: string
          name: string
          parent_journey_id?: string | null
          primary_contact_id: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          close_reason?:
            | Database["public"]["Enums"]["pipeline_close_reason"]
            | null
          created_at?: string
          id?: string
          name?: string
          parent_journey_id?: string | null
          primary_contact_id?: string
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_parent_journey_id_fkey"
            columns: ["parent_journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          id?: string
          query: string
          resolved?: boolean
          resolved_by_doc_id?: string | null
          results_found?: number
          searched_at?: string
          suggested_category?: string | null
        }
        Update: {
          id?: string
          query?: string
          resolved?: boolean
          resolved_by_doc_id?: string | null
          results_found?: number
          searched_at?: string
          suggested_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_gap_signals_resolved_by_doc_id_fkey"
            columns: ["resolved_by_doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
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
          category: string
          content: string
          created_at?: string | null
          flagged_as_stale?: boolean
          gap_signal?: string | null
          id?: string
          is_active?: boolean | null
          last_retrieved_at?: string | null
          priority?: number | null
          retrieval_count?: number
          retrieval_quality_score?: number | null
          seeded_from?: string | null
          status?: string | null
          title: string
          token_count?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          flagged_as_stale?: boolean
          gap_signal?: string | null
          id?: string
          is_active?: boolean | null
          last_retrieved_at?: string | null
          priority?: number | null
          retrieval_count?: number
          retrieval_quality_score?: number | null
          seeded_from?: string | null
          status?: string | null
          title?: string
          token_count?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
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
          created_at?: string
          id?: string
          is_active?: boolean
          lead_source_id: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lead_source_id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_sub_sources_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
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
          prompt_blocks: Json
          prompt_version: string | null
          stop_reason: string | null
          tool_calls: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_messages: Json
          input_tokens?: number | null
          iteration?: number | null
          latency_ms?: number | null
          model: string
          output_content: Json
          output_tokens?: number | null
          prompt_blocks?: Json
          prompt_version?: string | null
          stop_reason?: string | null
          tool_calls?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          input_messages?: Json
          input_tokens?: number | null
          iteration?: number | null
          latency_ms?: number | null
          model?: string
          output_content?: Json
          output_tokens?: number | null
          prompt_blocks?: Json
          prompt_version?: string | null
          stop_reason?: string | null
          tool_calls?: Json | null
          user_id?: string | null
        }
        Relationships: []
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
          id?: string
          observed_at?: string | null
          signal_key: string
          signal_type: string
          signal_value: Json
          source?: string | null
        }
        Update: {
          id?: string
          observed_at?: string | null
          signal_key?: string
          signal_type?: string
          signal_value?: Json
          source?: string | null
        }
        Relationships: []
      }
      ms_construction_default_rooms: {
        Row: {
          Description: string
          IconUrl: string
          Name: string
          RoomToken: string
        }
        Insert: {
          Description: string
          IconUrl: string
          Name: string
          RoomToken: string
        }
        Update: {
          Description?: string
          IconUrl?: string
          Name?: string
          RoomToken?: string
        }
        Relationships: []
      }
      ms_construction_property_rooms: {
        Row: {
          ConstructionPropertyRoomId: string
          PropertyId: number
          RoomToken: string
        }
        Insert: {
          ConstructionPropertyRoomId: string
          PropertyId: number
          RoomToken: string
        }
        Update: {
          ConstructionPropertyRoomId?: string
          PropertyId?: number
          RoomToken?: string
        }
        Relationships: []
      }
      ms_eos_construction_habits: {
        Row: {
          AltaWeeklyVideoUpdates: string | null
          Phase1Walkthroughs: string | null
          PropertyAutopsies: string | null
          QuarterlyIndexUpdate: string | null
          TerritorySlug: string
          WeeklyBudgetMeeting: string | null
        }
        Insert: {
          AltaWeeklyVideoUpdates?: string | null
          Phase1Walkthroughs?: string | null
          PropertyAutopsies?: string | null
          QuarterlyIndexUpdate?: string | null
          TerritorySlug: string
          WeeklyBudgetMeeting?: string | null
        }
        Update: {
          AltaWeeklyVideoUpdates?: string | null
          Phase1Walkthroughs?: string | null
          PropertyAutopsies?: string | null
          QuarterlyIndexUpdate?: string | null
          TerritorySlug?: string
          WeeklyBudgetMeeting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_eos_construction_habits_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_habits_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_habits_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_habits_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_habits_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_eos_construction_issues: {
        Row: {
          Done: boolean
          Id: number
          Issue: string
          TerritorySlug: string
        }
        Insert: {
          Done?: boolean
          Id: number
          Issue: string
          TerritorySlug: string
        }
        Update: {
          Done?: boolean
          Id?: number
          Issue?: string
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_eos_construction_issues_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_issues_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_issues_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_issues_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_issues_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_eos_construction_master_statuses: {
        Row: {
          SortOrder: number
          StatusColor: string | null
          StatusName: string
        }
        Insert: {
          SortOrder: number
          StatusColor?: string | null
          StatusName: string
        }
        Update: {
          SortOrder?: number
          StatusColor?: string | null
          StatusName?: string
        }
        Relationships: []
      }
      ms_eos_construction_master_tasks: {
        Row: {
          Color: string | null
          Enabled: boolean
          SortOrder: number | null
          TaskId: number
          TaskName: string
        }
        Insert: {
          Color?: string | null
          Enabled?: boolean
          SortOrder?: number | null
          TaskId: number
          TaskName: string
        }
        Update: {
          Color?: string | null
          Enabled?: boolean
          SortOrder?: number | null
          TaskId?: number
          TaskName?: string
        }
        Relationships: []
      }
      ms_eos_construction_rocks: {
        Row: {
          Id: number
          Rock: string | null
          Status: string | null
          TerritorySlug: string
        }
        Insert: {
          Id: number
          Rock?: string | null
          Status?: string | null
          TerritorySlug: string
        }
        Update: {
          Id?: number
          Rock?: string | null
          Status?: string | null
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_eos_construction_rocks_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_rocks_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_rocks_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_rocks_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_rocks_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_eos_construction_task_history: {
        Row: {
          Id: number
          InsertedBy: string | null
          InsertedTime: string | null
          MasterTask: string
          PropertyId: number
          Status: string
        }
        Insert: {
          Id: number
          InsertedBy?: string | null
          InsertedTime?: string | null
          MasterTask: string
          PropertyId: number
          Status: string
        }
        Update: {
          Id?: number
          InsertedBy?: string | null
          InsertedTime?: string | null
          MasterTask?: string
          PropertyId?: number
          Status?: string
        }
        Relationships: []
      }
      ms_eos_construction_task_notes: {
        Row: {
          MasterTask: string | null
          Note: string | null
          PropertyId: number
          UpdatedBy: string | null
          UpdatedTime: string | null
        }
        Insert: {
          MasterTask?: string | null
          Note?: string | null
          PropertyId: number
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Update: {
          MasterTask?: string | null
          Note?: string | null
          PropertyId?: number
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Relationships: []
      }
      ms_eos_construction_tasks: {
        Row: {
          MasterTask: string
          PropertyId: number
          Status: string
          UpdatedBy: string | null
          UpdatedTime: string | null
        }
        Insert: {
          MasterTask: string
          PropertyId: number
          Status: string
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Update: {
          MasterTask?: string
          PropertyId?: number
          Status?: string
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Relationships: []
      }
      ms_eos_construction_todos: {
        Row: {
          Done: boolean
          Id: number
          TerritorySlug: string
          Todo: string | null
        }
        Insert: {
          Done?: boolean
          Id: number
          TerritorySlug: string
          Todo?: string | null
        }
        Update: {
          Done?: boolean
          Id?: number
          TerritorySlug?: string
          Todo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_eos_construction_todos_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_todos_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_todos_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_todos_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_eos_construction_todos_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_lead_list_counts: {
        Row: {
          count: number
          id: string
          LeadCategory: string | null
          LeadType: string | null
          month: string
          synced_at: string | null
          TerritorySlug: string
        }
        Insert: {
          count?: number
          id?: string
          LeadCategory?: string | null
          LeadType?: string | null
          month: string
          synced_at?: string | null
          TerritorySlug: string
        }
        Update: {
          count?: number
          id?: string
          LeadCategory?: string | null
          LeadType?: string | null
          month?: string
          synced_at?: string | null
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_lead_list_counts_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_counts_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_counts_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_counts_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_counts_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_lead_list_properties: {
        Row: {
          Address1: string | null
          AddressSlugShort: string | null
          AddressSlugVerbose: string | null
          Archived: boolean
          AutoTerritorySlug: string | null
          BatchId: string | null
          City: string | null
          County: string | null
          DirectSellerNotes: string | null
          GoogleCity: string | null
          GoogleCounty: string | null
          GoogleState: string | null
          Inserted: string | null
          InsertedBy: string | null
          is_current_lead_list: boolean
          LastModified: string | null
          LastModifiedBy: string | null
          Latitude: number | null
          LeadCategory: string | null
          LeadClassification: string | null
          LeadSubType2: string | null
          LeadType: string | null
          Longitude: number | null
          ms_synced_at: string
          OwnerLeadSource: string | null
          OwnerOfferStatus: string | null
          PropertyId: number
          PropertyReviewedBy: string | null
          PropertyReviewedByFriendlyName: string | null
          PropertyReviewedDate: string | null
          PropertyType: string | null
          PropertyUrl: string | null
          RoadType: string | null
          Septic: string | null
          State: string | null
          Status: string | null
          Streetname: string | null
          TerritorySlug: string | null
          Vacant: string | null
          ZillowPropertyId: string | null
          Zip: string | null
        }
        Insert: {
          Address1?: string | null
          AddressSlugShort?: string | null
          AddressSlugVerbose?: string | null
          Archived?: boolean
          AutoTerritorySlug?: string | null
          BatchId?: string | null
          City?: string | null
          County?: string | null
          DirectSellerNotes?: string | null
          GoogleCity?: string | null
          GoogleCounty?: string | null
          GoogleState?: string | null
          Inserted?: string | null
          InsertedBy?: string | null
          is_current_lead_list?: boolean
          LastModified?: string | null
          LastModifiedBy?: string | null
          Latitude?: number | null
          LeadCategory?: string | null
          LeadClassification?: string | null
          LeadSubType2?: string | null
          LeadType?: string | null
          Longitude?: number | null
          ms_synced_at?: string
          OwnerLeadSource?: string | null
          OwnerOfferStatus?: string | null
          PropertyId: number
          PropertyReviewedBy?: string | null
          PropertyReviewedByFriendlyName?: string | null
          PropertyReviewedDate?: string | null
          PropertyType?: string | null
          PropertyUrl?: string | null
          RoadType?: string | null
          Septic?: string | null
          State?: string | null
          Status?: string | null
          Streetname?: string | null
          TerritorySlug?: string | null
          Vacant?: string | null
          ZillowPropertyId?: string | null
          Zip?: string | null
        }
        Update: {
          Address1?: string | null
          AddressSlugShort?: string | null
          AddressSlugVerbose?: string | null
          Archived?: boolean
          AutoTerritorySlug?: string | null
          BatchId?: string | null
          City?: string | null
          County?: string | null
          DirectSellerNotes?: string | null
          GoogleCity?: string | null
          GoogleCounty?: string | null
          GoogleState?: string | null
          Inserted?: string | null
          InsertedBy?: string | null
          is_current_lead_list?: boolean
          LastModified?: string | null
          LastModifiedBy?: string | null
          Latitude?: number | null
          LeadCategory?: string | null
          LeadClassification?: string | null
          LeadSubType2?: string | null
          LeadType?: string | null
          Longitude?: number | null
          ms_synced_at?: string
          OwnerLeadSource?: string | null
          OwnerOfferStatus?: string | null
          PropertyId?: number
          PropertyReviewedBy?: string | null
          PropertyReviewedByFriendlyName?: string | null
          PropertyReviewedDate?: string | null
          PropertyType?: string | null
          PropertyUrl?: string | null
          RoadType?: string | null
          Septic?: string | null
          State?: string | null
          Status?: string | null
          Streetname?: string | null
          TerritorySlug?: string | null
          Vacant?: string | null
          ZillowPropertyId?: string | null
          Zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_lead_list_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_lead_list_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_lead_type_categories: {
        Row: {
          LeadCategory: string
          LeadCategoryId: number
        }
        Insert: {
          LeadCategory: string
          LeadCategoryId: number
        }
        Update: {
          LeadCategory?: string
          LeadCategoryId?: number
        }
        Relationships: []
      }
      ms_lead_types: {
        Row: {
          LeadCategoryId: number
          LeadType: string
          LeadTypeId: number
        }
        Insert: {
          LeadCategoryId: number
          LeadType: string
          LeadTypeId: number
        }
        Update: {
          LeadCategoryId?: number
          LeadType?: string
          LeadTypeId?: number
        }
        Relationships: []
      }
      ms_master_list_intangibles: {
        Row: {
          FriendlyName: string
          Token: string
        }
        Insert: {
          FriendlyName: string
          Token: string
        }
        Update: {
          FriendlyName?: string
          Token?: string
        }
        Relationships: []
      }
      ms_note_holders: {
        Row: {
          CommittedProjects: number | null
          Name: string | null
          NextFundingDate: string | null
          Token: string
          TotalFunds: number | null
        }
        Insert: {
          CommittedProjects?: number | null
          Name?: string | null
          NextFundingDate?: string | null
          Token: string
          TotalFunds?: number | null
        }
        Update: {
          CommittedProjects?: number | null
          Name?: string | null
          NextFundingDate?: string | null
          Token?: string
          TotalFunds?: number | null
        }
        Relationships: []
      }
      ms_project_management_master_statuses: {
        Row: {
          StatusColor: string | null
          StatusName: string
        }
        Insert: {
          StatusColor?: string | null
          StatusName: string
        }
        Update: {
          StatusColor?: string | null
          StatusName?: string
        }
        Relationships: []
      }
      ms_project_management_master_tasks: {
        Row: {
          Color: string | null
          Enabled: boolean
          SortOrder: number | null
          TaskId: number
          TaskName: string
          TerritoryId: number
        }
        Insert: {
          Color?: string | null
          Enabled?: boolean
          SortOrder?: number | null
          TaskId: number
          TaskName: string
          TerritoryId: number
        }
        Update: {
          Color?: string | null
          Enabled?: boolean
          SortOrder?: number | null
          TaskId?: number
          TaskName?: string
          TerritoryId?: number
        }
        Relationships: []
      }
      ms_project_management_task_notes: {
        Row: {
          MasterTask: string | null
          Note: string | null
          PropertyId: number
          UpdatedBy: string | null
          UpdatedTime: string | null
        }
        Insert: {
          MasterTask?: string | null
          Note?: string | null
          PropertyId: number
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Update: {
          MasterTask?: string | null
          Note?: string | null
          PropertyId?: number
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Relationships: []
      }
      ms_project_management_tasks: {
        Row: {
          MasterTask: string
          PropertyId: number
          Status: string
          UpdatedBy: string | null
          UpdatedTime: string | null
        }
        Insert: {
          MasterTask: string
          PropertyId: number
          Status: string
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Update: {
          MasterTask?: string
          PropertyId?: number
          Status?: string
          UpdatedBy?: string | null
          UpdatedTime?: string | null
        }
        Relationships: []
      }
      ms_properties: {
        Row: {
          Address1: string | null
          AddressSlugShort: string | null
          AddressSlugVerbose: string | null
          AedQualified: string | null
          Archived: boolean
          ArchivedDate: string | null
          ArvCeiling: number | null
          AuctionAdPrice: number | null
          AuctionCountyLocation: string | null
          AuctionDate: string | null
          AuctionDriveBy: string | null
          Auctioneer: string | null
          AuctionReserveBid: number | null
          AuctionStatus: string | null
          AuctionTime: string | null
          AuctionTitle: string | null
          AuctionTrustee: string | null
          AutoTerritorySlug: string | null
          BaseGrade: number | null
          BatchId: string | null
          BuyingCost: number | null
          City: string | null
          ClosingCost: number | null
          ComparableSubjectCondition: string | null
          County: string | null
          DirectMailInitiatedDate: string | null
          DirectSellerNotes: string | null
          DispositionNotes: string | null
          EvaluationStatus: string | null
          ExteriorIndicators: number | null
          FloodRisk: string | null
          GoogleCity: string | null
          GoogleCounty: string | null
          GoogleSearch: string | null
          GoogleState: string | null
          HighEndPriceSquareFoot: number | null
          HoldingCost: number | null
          HouseCanaryValue: number | null
          Inserted: string
          InsertedBy: string | null
          LastModified: string | null
          LastModifiedBy: string | null
          Latitude: number | null
          LeadCategory: string | null
          LeadClassification: string | null
          LeadSubType2: string | null
          LeadType: string | null
          Longitude: number | null
          LowEndPriceSquareFoot: number | null
          MarketRiskFactor: number | null
          MethCheck: string | null
          MlsListCost: number | null
          ms_synced_at: string | null
          OfferRange: string | null
          OwnerDoNotSend: boolean | null
          OwnerLeadSource: string | null
          OwnerOfferStatus: string | null
          Premium: number | null
          PropertyAddressDoNotSend: boolean | null
          PropertyId: number
          PropertyReviewedBy: string | null
          PropertyReviewedByFriendlyName: string | null
          PropertyReviewedDate: string | null
          PropertyType: string | null
          PropertyUrl: string | null
          ReferralPartnerName: string | null
          RoadType: string | null
          Roof: number | null
          SellDate: string | null
          SellerApproxAge: string | null
          SellerBlackSwans: string | null
          SellerGender: string | null
          SellerMotivation: string | null
          SellerRole: string | null
          SellerType: string | null
          Septic: string | null
          Siding: number | null
          Stage1Arv: number | null
          Stage1CostOfMoneyPercent: number | null
          Stage1LocationGrade: number | null
          Stage1ManualArv: number | null
          Stage1MaxRiskFactorPercent: number | null
          Stage1MlsSellPercent: number | null
          Stage1Notes: string | null
          Stage1Price: number | null
          Stage1RehabLevel: number | null
          Stage2Arv: number | null
          Stage2LocationGrade: number | null
          Stage2Notes: string | null
          Stage2Price: number | null
          Stage2RehabLevel: number | null
          Stage3Arv: number | null
          Stage3ConstructionBudget: number | null
          Stage3ConstructionProfitRatio: number | null
          Stage3CostOfMoneyPercent: number | null
          Stage3LocationGrade: number | null
          Stage3MaxOffer: number | null
          Stage3MaxRiskFactorPercent: number | null
          Stage3Mortgage_Calculated_Payoff: number | null
          Stage3Mortgage2_Calculated_Payoff: number | null
          Stage3Mortgage2Amount: number | null
          Stage3Mortgage2KnownInterestRate: number | null
          Stage3Mortgage2StartDate: string | null
          Stage3Mortgage2Term: number | null
          Stage3MortgageAmount: number | null
          Stage3MortgageKnownInterestRate: number | null
          Stage3MortgageStartDate: string | null
          Stage3MortgageTerm: number | null
          Stage3Notes: string | null
          Stage3Price: number | null
          Stage3RiskFactor: number | null
          State: string | null
          Status: string | null
          Streetname: string | null
          TaxOverallGrade: string | null
          TerritorySlug: string
          TrusteeDoNotSend: boolean | null
          UsdaQualified: string | null
          utmCampaign: string | null
          utmContent: string | null
          utmMedium: string | null
          utmSource: string | null
          Vacant: string | null
          Windows: number | null
          ZillowPropertyId: string | null
          Zip: string | null
        }
        Insert: {
          Address1?: string | null
          AddressSlugShort?: string | null
          AddressSlugVerbose?: string | null
          AedQualified?: string | null
          Archived?: boolean
          ArchivedDate?: string | null
          ArvCeiling?: number | null
          AuctionAdPrice?: number | null
          AuctionCountyLocation?: string | null
          AuctionDate?: string | null
          AuctionDriveBy?: string | null
          Auctioneer?: string | null
          AuctionReserveBid?: number | null
          AuctionStatus?: string | null
          AuctionTime?: string | null
          AuctionTitle?: string | null
          AuctionTrustee?: string | null
          AutoTerritorySlug?: string | null
          BaseGrade?: number | null
          BatchId?: string | null
          BuyingCost?: number | null
          City?: string | null
          ClosingCost?: number | null
          ComparableSubjectCondition?: string | null
          County?: string | null
          DirectMailInitiatedDate?: string | null
          DirectSellerNotes?: string | null
          DispositionNotes?: string | null
          EvaluationStatus?: string | null
          ExteriorIndicators?: number | null
          FloodRisk?: string | null
          GoogleCity?: string | null
          GoogleCounty?: string | null
          GoogleSearch?: string | null
          GoogleState?: string | null
          HighEndPriceSquareFoot?: number | null
          HoldingCost?: number | null
          HouseCanaryValue?: number | null
          Inserted?: string
          InsertedBy?: string | null
          LastModified?: string | null
          LastModifiedBy?: string | null
          Latitude?: number | null
          LeadCategory?: string | null
          LeadClassification?: string | null
          LeadSubType2?: string | null
          LeadType?: string | null
          Longitude?: number | null
          LowEndPriceSquareFoot?: number | null
          MarketRiskFactor?: number | null
          MethCheck?: string | null
          MlsListCost?: number | null
          ms_synced_at?: string | null
          OfferRange?: string | null
          OwnerDoNotSend?: boolean | null
          OwnerLeadSource?: string | null
          OwnerOfferStatus?: string | null
          Premium?: number | null
          PropertyAddressDoNotSend?: boolean | null
          PropertyId: number
          PropertyReviewedBy?: string | null
          PropertyReviewedByFriendlyName?: string | null
          PropertyReviewedDate?: string | null
          PropertyType?: string | null
          PropertyUrl?: string | null
          ReferralPartnerName?: string | null
          RoadType?: string | null
          Roof?: number | null
          SellDate?: string | null
          SellerApproxAge?: string | null
          SellerBlackSwans?: string | null
          SellerGender?: string | null
          SellerMotivation?: string | null
          SellerRole?: string | null
          SellerType?: string | null
          Septic?: string | null
          Siding?: number | null
          Stage1Arv?: number | null
          Stage1CostOfMoneyPercent?: number | null
          Stage1LocationGrade?: number | null
          Stage1ManualArv?: number | null
          Stage1MaxRiskFactorPercent?: number | null
          Stage1MlsSellPercent?: number | null
          Stage1Notes?: string | null
          Stage1Price?: number | null
          Stage1RehabLevel?: number | null
          Stage2Arv?: number | null
          Stage2LocationGrade?: number | null
          Stage2Notes?: string | null
          Stage2Price?: number | null
          Stage2RehabLevel?: number | null
          Stage3Arv?: number | null
          Stage3ConstructionBudget?: number | null
          Stage3ConstructionProfitRatio?: number | null
          Stage3CostOfMoneyPercent?: number | null
          Stage3LocationGrade?: number | null
          Stage3MaxOffer?: number | null
          Stage3MaxRiskFactorPercent?: number | null
          Stage3Mortgage_Calculated_Payoff?: number | null
          Stage3Mortgage2_Calculated_Payoff?: number | null
          Stage3Mortgage2Amount?: number | null
          Stage3Mortgage2KnownInterestRate?: number | null
          Stage3Mortgage2StartDate?: string | null
          Stage3Mortgage2Term?: number | null
          Stage3MortgageAmount?: number | null
          Stage3MortgageKnownInterestRate?: number | null
          Stage3MortgageStartDate?: string | null
          Stage3MortgageTerm?: number | null
          Stage3Notes?: string | null
          Stage3Price?: number | null
          Stage3RiskFactor?: number | null
          State?: string | null
          Status?: string | null
          Streetname?: string | null
          TaxOverallGrade?: string | null
          TerritorySlug: string
          TrusteeDoNotSend?: boolean | null
          UsdaQualified?: string | null
          utmCampaign?: string | null
          utmContent?: string | null
          utmMedium?: string | null
          utmSource?: string | null
          Vacant?: string | null
          Windows?: number | null
          ZillowPropertyId?: string | null
          Zip?: string | null
        }
        Update: {
          Address1?: string | null
          AddressSlugShort?: string | null
          AddressSlugVerbose?: string | null
          AedQualified?: string | null
          Archived?: boolean
          ArchivedDate?: string | null
          ArvCeiling?: number | null
          AuctionAdPrice?: number | null
          AuctionCountyLocation?: string | null
          AuctionDate?: string | null
          AuctionDriveBy?: string | null
          Auctioneer?: string | null
          AuctionReserveBid?: number | null
          AuctionStatus?: string | null
          AuctionTime?: string | null
          AuctionTitle?: string | null
          AuctionTrustee?: string | null
          AutoTerritorySlug?: string | null
          BaseGrade?: number | null
          BatchId?: string | null
          BuyingCost?: number | null
          City?: string | null
          ClosingCost?: number | null
          ComparableSubjectCondition?: string | null
          County?: string | null
          DirectMailInitiatedDate?: string | null
          DirectSellerNotes?: string | null
          DispositionNotes?: string | null
          EvaluationStatus?: string | null
          ExteriorIndicators?: number | null
          FloodRisk?: string | null
          GoogleCity?: string | null
          GoogleCounty?: string | null
          GoogleSearch?: string | null
          GoogleState?: string | null
          HighEndPriceSquareFoot?: number | null
          HoldingCost?: number | null
          HouseCanaryValue?: number | null
          Inserted?: string
          InsertedBy?: string | null
          LastModified?: string | null
          LastModifiedBy?: string | null
          Latitude?: number | null
          LeadCategory?: string | null
          LeadClassification?: string | null
          LeadSubType2?: string | null
          LeadType?: string | null
          Longitude?: number | null
          LowEndPriceSquareFoot?: number | null
          MarketRiskFactor?: number | null
          MethCheck?: string | null
          MlsListCost?: number | null
          ms_synced_at?: string | null
          OfferRange?: string | null
          OwnerDoNotSend?: boolean | null
          OwnerLeadSource?: string | null
          OwnerOfferStatus?: string | null
          Premium?: number | null
          PropertyAddressDoNotSend?: boolean | null
          PropertyId?: number
          PropertyReviewedBy?: string | null
          PropertyReviewedByFriendlyName?: string | null
          PropertyReviewedDate?: string | null
          PropertyType?: string | null
          PropertyUrl?: string | null
          ReferralPartnerName?: string | null
          RoadType?: string | null
          Roof?: number | null
          SellDate?: string | null
          SellerApproxAge?: string | null
          SellerBlackSwans?: string | null
          SellerGender?: string | null
          SellerMotivation?: string | null
          SellerRole?: string | null
          SellerType?: string | null
          Septic?: string | null
          Siding?: number | null
          Stage1Arv?: number | null
          Stage1CostOfMoneyPercent?: number | null
          Stage1LocationGrade?: number | null
          Stage1ManualArv?: number | null
          Stage1MaxRiskFactorPercent?: number | null
          Stage1MlsSellPercent?: number | null
          Stage1Notes?: string | null
          Stage1Price?: number | null
          Stage1RehabLevel?: number | null
          Stage2Arv?: number | null
          Stage2LocationGrade?: number | null
          Stage2Notes?: string | null
          Stage2Price?: number | null
          Stage2RehabLevel?: number | null
          Stage3Arv?: number | null
          Stage3ConstructionBudget?: number | null
          Stage3ConstructionProfitRatio?: number | null
          Stage3CostOfMoneyPercent?: number | null
          Stage3LocationGrade?: number | null
          Stage3MaxOffer?: number | null
          Stage3MaxRiskFactorPercent?: number | null
          Stage3Mortgage_Calculated_Payoff?: number | null
          Stage3Mortgage2_Calculated_Payoff?: number | null
          Stage3Mortgage2Amount?: number | null
          Stage3Mortgage2KnownInterestRate?: number | null
          Stage3Mortgage2StartDate?: string | null
          Stage3Mortgage2Term?: number | null
          Stage3MortgageAmount?: number | null
          Stage3MortgageKnownInterestRate?: number | null
          Stage3MortgageStartDate?: string | null
          Stage3MortgageTerm?: number | null
          Stage3Notes?: string | null
          Stage3Price?: number | null
          Stage3RiskFactor?: number | null
          State?: string | null
          Status?: string | null
          Streetname?: string | null
          TaxOverallGrade?: string | null
          TerritorySlug?: string
          TrusteeDoNotSend?: boolean | null
          UsdaQualified?: string | null
          utmCampaign?: string | null
          utmContent?: string | null
          utmMedium?: string | null
          utmSource?: string | null
          Vacant?: string | null
          Windows?: number | null
          ZillowPropertyId?: string | null
          Zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_properties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_property_agent_feedback: {
        Row: {
          AgentFeedback: string | null
          AgentRecommendedArvHigh: number | null
          AgentRecommendedArvLow: number | null
          AgentRecommendedFinalValuation: number | null
          ms_synced_at: string | null
          NoteToAgent: string | null
          PropertyId: number
        }
        Insert: {
          AgentFeedback?: string | null
          AgentRecommendedArvHigh?: number | null
          AgentRecommendedArvLow?: number | null
          AgentRecommendedFinalValuation?: number | null
          ms_synced_at?: string | null
          NoteToAgent?: string | null
          PropertyId: number
        }
        Update: {
          AgentFeedback?: string | null
          AgentRecommendedArvHigh?: number | null
          AgentRecommendedArvLow?: number | null
          AgentRecommendedFinalValuation?: number | null
          ms_synced_at?: string | null
          NoteToAgent?: string | null
          PropertyId?: number
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_agent_feedback_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_calculations: {
        Row: {
          Calculated_AbsenteeSeller: boolean | null
          Calculated_AdjustedRiskFactor: number | null
          Calculated_AdjustedSqFt: number | null
          Calculated_AmountFinanced: number | null
          Calculated_Arv: number | null
          Calculated_Arv_MarketRiskAdjusted: number | null
          Calculated_ArvCeilingSqFt: number | null
          Calculated_ArvPerAdjustedSqFt: number | null
          Calculated_ArvRiskFactor: number | null
          Calculated_AuctionMinimumPrice: number | null
          Calculated_AuctionMinimumPriceMeta: string | null
          Calculated_BuiltAge: number | null
          Calculated_BuyingCost: number | null
          Calculated_CashRequired: number | null
          Calculated_ClosingCost: number | null
          Calculated_CompRiskAdjustment: number | null
          Calculated_ConstructionBudget: number | null
          Calculated_ConstructionBudgetStage1: number | null
          Calculated_ConstructionBudgetStage2: number | null
          Calculated_ConstructionDaysComplete: number | null
          Calculated_ConstructionDaysOver: number | null
          Calculated_ConstructionDaysRemaining: number | null
          Calculated_ConstructionEstimatedDays: number | null
          Calculated_ConstructionStage3RehabGrade: number | null
          Calculated_EffectiveAge: number | null
          Calculated_EstimatedPayoff2: number | null
          Calculated_FinanceCost: number | null
          Calculated_FinanceCostCycleTimeDays: number | null
          Calculated_FullPropertyAddress: string | null
          Calculated_HighEndTotalPrice: number | null
          Calculated_HoldingCost: number | null
          Calculated_IntangibleRiskAdjustment: number | null
          Calculated_IntangibleScore: number | null
          Calculated_Inv_CashInvested: number | null
          Calculated_Inv_CBGrade: number | null
          Calculated_Inv_ConstructionProfitRatio: number | null
          Calculated_Inv_DaysOnMarket: number | null
          Calculated_Inv_DaysOwned: number | null
          Calculated_Inv_Item19Year: number | null
          Calculated_Inv_MonthsOwned: number | null
          Calculated_Inv_OverBudget: number | null
          Calculated_Inv_Proceeds: number | null
          Calculated_Inv_Profit: number | null
          Calculated_Inv_ProjectProfit: number | null
          Calculated_Inv_RiskFactor: number | null
          Calculated_Inv_Royalty: number | null
          Calculated_Inv_TotalNotesPayable: number | null
          Calculated_Inv_YearsOwned: number | null
          Calculated_LastSoldDate: string | null
          Calculated_LeadScore: number | null
          Calculated_LocationGrade: number | null
          Calculated_LocationRiskAdjustment: number | null
          Calculated_LowEndTotalPrice: number | null
          Calculated_MaxOffer: number | null
          Calculated_MaxOffer_Auction_Price_Ratio: number | null
          Calculated_MaxOffer_Original: number | null
          Calculated_MaxOffer_Price_Ratio: number | null
          Calculated_MlsConstructionProfitRatio: number | null
          Calculated_MlsListCost: number | null
          Calculated_MlsProfit: number | null
          Calculated_MlsProfitMarketAdjusted: number | null
          Calculated_NahConstructionProfitRatio: number | null
          Calculated_NahProfit: number | null
          Calculated_NahProfitMarketAdjusted: number | null
          Calculated_Price: number | null
          Calculated_RehabGrade: number | null
          Calculated_ReportingStatus: string | null
          Calculated_ReturnOnInvestment: number | null
          Calculated_RiskFactor: number | null
          Calculated_RiskFactor_Original: number | null
          Calculated_RiskFactorStage1: number | null
          Calculated_RiskFactorStage2: number | null
          Calculated_RiskFactorStage3: number | null
          Calculated_SellerAddress: string | null
          Calculated_SellerAddressDistance: number | null
          Calculated_SellerCity: string | null
          Calculated_SellerEmail: string | null
          Calculated_SellerFirstName: string | null
          Calculated_SellerLastName: string | null
          Calculated_SellerMailingAddress: string | null
          Calculated_SellerMarketingWeek: number | null
          Calculated_SellerName: string | null
          Calculated_SellerPhone: string | null
          Calculated_SellerState: string | null
          Calculated_SellerType: string | null
          Calculated_SellerZip: string | null
          Calculated_Stage1ArvSqFt: number | null
          Calculated_Stage1MaxOfferPriceRatio: number | null
          Calculated_Stage2Arv: number | null
          Calculated_StageMaturity: number | null
          Calculated_StarredCompsAveragePriceSqFt: number | null
          Calculated_StarredCompsMedianPriceSqFt: number | null
          Calculated_TotalCbGrade: number | null
          Calculated_TotalCostOfMoney: number | null
          Calculated_TotalQuietCosts: number | null
          Calculated_YearsOwned: number | null
          ConstructionCostPerSquareFoot: number | null
          CycleTimeConstructionCompleteToSell: number | null
          CycleTimeConstructionStartToConstructionComplete: number | null
          CycleTimeListToSell: number | null
          CycleTimePurchaseToConstructionComplete: number | null
          CycleTimePurchaseToConstructionStart: number | null
          CycleTimePurchaseToContractedSell: number | null
          CycleTimePurchaseToList: number | null
          CycleTimePurchaseToSell: number | null
          CycleTimeS1ToFinalOutcome: number | null
          FollowUpScore: number | null
          FollowUpScore_LeadCategory_Points: number | null
          FollowUpScore_MarketingWeek_Points: number | null
          FollowUpScore_Status_Points: number | null
          HasActiveInventory: boolean | null
          HasInventory: boolean | null
          LeadScore_AbsenteeOwnerScore_Percent: number | null
          LeadScore_AbsenteeOwnerScore_Points: number | null
          LeadScore_ConditionScore_Percent: number | null
          LeadScore_ConditionScore_Points: number | null
          LeadScore_MaxOfferPriceScore_Percent: number | null
          LeadScore_MaxOfferPriceScore_Points: number | null
          LeadScore_SoldAmountArvScore_Percent: number | null
          LeadScore_SoldAmountArvScore_Points: number | null
          LeadScore_SquareFootageScore_Percent: number | null
          LeadScore_SquareFootageScore_Points: number | null
          LeadScore_YearBuiltScore_Percent: number | null
          LeadScore_YearBuiltScore_Points: number | null
          Modified: string | null
          ms_synced_at: string | null
          ProjectedRoyaltyDate: string | null
          PropertyId: number
          Stage1ArvEstatedCombined: number | null
          StatusSnapshot: string | null
        }
        Insert: {
          Calculated_AbsenteeSeller?: boolean | null
          Calculated_AdjustedRiskFactor?: number | null
          Calculated_AdjustedSqFt?: number | null
          Calculated_AmountFinanced?: number | null
          Calculated_Arv?: number | null
          Calculated_Arv_MarketRiskAdjusted?: number | null
          Calculated_ArvCeilingSqFt?: number | null
          Calculated_ArvPerAdjustedSqFt?: number | null
          Calculated_ArvRiskFactor?: number | null
          Calculated_AuctionMinimumPrice?: number | null
          Calculated_AuctionMinimumPriceMeta?: string | null
          Calculated_BuiltAge?: number | null
          Calculated_BuyingCost?: number | null
          Calculated_CashRequired?: number | null
          Calculated_ClosingCost?: number | null
          Calculated_CompRiskAdjustment?: number | null
          Calculated_ConstructionBudget?: number | null
          Calculated_ConstructionBudgetStage1?: number | null
          Calculated_ConstructionBudgetStage2?: number | null
          Calculated_ConstructionDaysComplete?: number | null
          Calculated_ConstructionDaysOver?: number | null
          Calculated_ConstructionDaysRemaining?: number | null
          Calculated_ConstructionEstimatedDays?: number | null
          Calculated_ConstructionStage3RehabGrade?: number | null
          Calculated_EffectiveAge?: number | null
          Calculated_EstimatedPayoff2?: number | null
          Calculated_FinanceCost?: number | null
          Calculated_FinanceCostCycleTimeDays?: number | null
          Calculated_FullPropertyAddress?: string | null
          Calculated_HighEndTotalPrice?: number | null
          Calculated_HoldingCost?: number | null
          Calculated_IntangibleRiskAdjustment?: number | null
          Calculated_IntangibleScore?: number | null
          Calculated_Inv_CashInvested?: number | null
          Calculated_Inv_CBGrade?: number | null
          Calculated_Inv_ConstructionProfitRatio?: number | null
          Calculated_Inv_DaysOnMarket?: number | null
          Calculated_Inv_DaysOwned?: number | null
          Calculated_Inv_Item19Year?: number | null
          Calculated_Inv_MonthsOwned?: number | null
          Calculated_Inv_OverBudget?: number | null
          Calculated_Inv_Proceeds?: number | null
          Calculated_Inv_Profit?: number | null
          Calculated_Inv_ProjectProfit?: number | null
          Calculated_Inv_RiskFactor?: number | null
          Calculated_Inv_Royalty?: number | null
          Calculated_Inv_TotalNotesPayable?: number | null
          Calculated_Inv_YearsOwned?: number | null
          Calculated_LastSoldDate?: string | null
          Calculated_LeadScore?: number | null
          Calculated_LocationGrade?: number | null
          Calculated_LocationRiskAdjustment?: number | null
          Calculated_LowEndTotalPrice?: number | null
          Calculated_MaxOffer?: number | null
          Calculated_MaxOffer_Auction_Price_Ratio?: number | null
          Calculated_MaxOffer_Original?: number | null
          Calculated_MaxOffer_Price_Ratio?: number | null
          Calculated_MlsConstructionProfitRatio?: number | null
          Calculated_MlsListCost?: number | null
          Calculated_MlsProfit?: number | null
          Calculated_MlsProfitMarketAdjusted?: number | null
          Calculated_NahConstructionProfitRatio?: number | null
          Calculated_NahProfit?: number | null
          Calculated_NahProfitMarketAdjusted?: number | null
          Calculated_Price?: number | null
          Calculated_RehabGrade?: number | null
          Calculated_ReportingStatus?: string | null
          Calculated_ReturnOnInvestment?: number | null
          Calculated_RiskFactor?: number | null
          Calculated_RiskFactor_Original?: number | null
          Calculated_RiskFactorStage1?: number | null
          Calculated_RiskFactorStage2?: number | null
          Calculated_RiskFactorStage3?: number | null
          Calculated_SellerAddress?: string | null
          Calculated_SellerAddressDistance?: number | null
          Calculated_SellerCity?: string | null
          Calculated_SellerEmail?: string | null
          Calculated_SellerFirstName?: string | null
          Calculated_SellerLastName?: string | null
          Calculated_SellerMailingAddress?: string | null
          Calculated_SellerMarketingWeek?: number | null
          Calculated_SellerName?: string | null
          Calculated_SellerPhone?: string | null
          Calculated_SellerState?: string | null
          Calculated_SellerType?: string | null
          Calculated_SellerZip?: string | null
          Calculated_Stage1ArvSqFt?: number | null
          Calculated_Stage1MaxOfferPriceRatio?: number | null
          Calculated_Stage2Arv?: number | null
          Calculated_StageMaturity?: number | null
          Calculated_StarredCompsAveragePriceSqFt?: number | null
          Calculated_StarredCompsMedianPriceSqFt?: number | null
          Calculated_TotalCbGrade?: number | null
          Calculated_TotalCostOfMoney?: number | null
          Calculated_TotalQuietCosts?: number | null
          Calculated_YearsOwned?: number | null
          ConstructionCostPerSquareFoot?: number | null
          CycleTimeConstructionCompleteToSell?: number | null
          CycleTimeConstructionStartToConstructionComplete?: number | null
          CycleTimeListToSell?: number | null
          CycleTimePurchaseToConstructionComplete?: number | null
          CycleTimePurchaseToConstructionStart?: number | null
          CycleTimePurchaseToContractedSell?: number | null
          CycleTimePurchaseToList?: number | null
          CycleTimePurchaseToSell?: number | null
          CycleTimeS1ToFinalOutcome?: number | null
          FollowUpScore?: number | null
          FollowUpScore_LeadCategory_Points?: number | null
          FollowUpScore_MarketingWeek_Points?: number | null
          FollowUpScore_Status_Points?: number | null
          HasActiveInventory?: boolean | null
          HasInventory?: boolean | null
          LeadScore_AbsenteeOwnerScore_Percent?: number | null
          LeadScore_AbsenteeOwnerScore_Points?: number | null
          LeadScore_ConditionScore_Percent?: number | null
          LeadScore_ConditionScore_Points?: number | null
          LeadScore_MaxOfferPriceScore_Percent?: number | null
          LeadScore_MaxOfferPriceScore_Points?: number | null
          LeadScore_SoldAmountArvScore_Percent?: number | null
          LeadScore_SoldAmountArvScore_Points?: number | null
          LeadScore_SquareFootageScore_Percent?: number | null
          LeadScore_SquareFootageScore_Points?: number | null
          LeadScore_YearBuiltScore_Percent?: number | null
          LeadScore_YearBuiltScore_Points?: number | null
          Modified?: string | null
          ms_synced_at?: string | null
          ProjectedRoyaltyDate?: string | null
          PropertyId: number
          Stage1ArvEstatedCombined?: number | null
          StatusSnapshot?: string | null
        }
        Update: {
          Calculated_AbsenteeSeller?: boolean | null
          Calculated_AdjustedRiskFactor?: number | null
          Calculated_AdjustedSqFt?: number | null
          Calculated_AmountFinanced?: number | null
          Calculated_Arv?: number | null
          Calculated_Arv_MarketRiskAdjusted?: number | null
          Calculated_ArvCeilingSqFt?: number | null
          Calculated_ArvPerAdjustedSqFt?: number | null
          Calculated_ArvRiskFactor?: number | null
          Calculated_AuctionMinimumPrice?: number | null
          Calculated_AuctionMinimumPriceMeta?: string | null
          Calculated_BuiltAge?: number | null
          Calculated_BuyingCost?: number | null
          Calculated_CashRequired?: number | null
          Calculated_ClosingCost?: number | null
          Calculated_CompRiskAdjustment?: number | null
          Calculated_ConstructionBudget?: number | null
          Calculated_ConstructionBudgetStage1?: number | null
          Calculated_ConstructionBudgetStage2?: number | null
          Calculated_ConstructionDaysComplete?: number | null
          Calculated_ConstructionDaysOver?: number | null
          Calculated_ConstructionDaysRemaining?: number | null
          Calculated_ConstructionEstimatedDays?: number | null
          Calculated_ConstructionStage3RehabGrade?: number | null
          Calculated_EffectiveAge?: number | null
          Calculated_EstimatedPayoff2?: number | null
          Calculated_FinanceCost?: number | null
          Calculated_FinanceCostCycleTimeDays?: number | null
          Calculated_FullPropertyAddress?: string | null
          Calculated_HighEndTotalPrice?: number | null
          Calculated_HoldingCost?: number | null
          Calculated_IntangibleRiskAdjustment?: number | null
          Calculated_IntangibleScore?: number | null
          Calculated_Inv_CashInvested?: number | null
          Calculated_Inv_CBGrade?: number | null
          Calculated_Inv_ConstructionProfitRatio?: number | null
          Calculated_Inv_DaysOnMarket?: number | null
          Calculated_Inv_DaysOwned?: number | null
          Calculated_Inv_Item19Year?: number | null
          Calculated_Inv_MonthsOwned?: number | null
          Calculated_Inv_OverBudget?: number | null
          Calculated_Inv_Proceeds?: number | null
          Calculated_Inv_Profit?: number | null
          Calculated_Inv_ProjectProfit?: number | null
          Calculated_Inv_RiskFactor?: number | null
          Calculated_Inv_Royalty?: number | null
          Calculated_Inv_TotalNotesPayable?: number | null
          Calculated_Inv_YearsOwned?: number | null
          Calculated_LastSoldDate?: string | null
          Calculated_LeadScore?: number | null
          Calculated_LocationGrade?: number | null
          Calculated_LocationRiskAdjustment?: number | null
          Calculated_LowEndTotalPrice?: number | null
          Calculated_MaxOffer?: number | null
          Calculated_MaxOffer_Auction_Price_Ratio?: number | null
          Calculated_MaxOffer_Original?: number | null
          Calculated_MaxOffer_Price_Ratio?: number | null
          Calculated_MlsConstructionProfitRatio?: number | null
          Calculated_MlsListCost?: number | null
          Calculated_MlsProfit?: number | null
          Calculated_MlsProfitMarketAdjusted?: number | null
          Calculated_NahConstructionProfitRatio?: number | null
          Calculated_NahProfit?: number | null
          Calculated_NahProfitMarketAdjusted?: number | null
          Calculated_Price?: number | null
          Calculated_RehabGrade?: number | null
          Calculated_ReportingStatus?: string | null
          Calculated_ReturnOnInvestment?: number | null
          Calculated_RiskFactor?: number | null
          Calculated_RiskFactor_Original?: number | null
          Calculated_RiskFactorStage1?: number | null
          Calculated_RiskFactorStage2?: number | null
          Calculated_RiskFactorStage3?: number | null
          Calculated_SellerAddress?: string | null
          Calculated_SellerAddressDistance?: number | null
          Calculated_SellerCity?: string | null
          Calculated_SellerEmail?: string | null
          Calculated_SellerFirstName?: string | null
          Calculated_SellerLastName?: string | null
          Calculated_SellerMailingAddress?: string | null
          Calculated_SellerMarketingWeek?: number | null
          Calculated_SellerName?: string | null
          Calculated_SellerPhone?: string | null
          Calculated_SellerState?: string | null
          Calculated_SellerType?: string | null
          Calculated_SellerZip?: string | null
          Calculated_Stage1ArvSqFt?: number | null
          Calculated_Stage1MaxOfferPriceRatio?: number | null
          Calculated_Stage2Arv?: number | null
          Calculated_StageMaturity?: number | null
          Calculated_StarredCompsAveragePriceSqFt?: number | null
          Calculated_StarredCompsMedianPriceSqFt?: number | null
          Calculated_TotalCbGrade?: number | null
          Calculated_TotalCostOfMoney?: number | null
          Calculated_TotalQuietCosts?: number | null
          Calculated_YearsOwned?: number | null
          ConstructionCostPerSquareFoot?: number | null
          CycleTimeConstructionCompleteToSell?: number | null
          CycleTimeConstructionStartToConstructionComplete?: number | null
          CycleTimeListToSell?: number | null
          CycleTimePurchaseToConstructionComplete?: number | null
          CycleTimePurchaseToConstructionStart?: number | null
          CycleTimePurchaseToContractedSell?: number | null
          CycleTimePurchaseToList?: number | null
          CycleTimePurchaseToSell?: number | null
          CycleTimeS1ToFinalOutcome?: number | null
          FollowUpScore?: number | null
          FollowUpScore_LeadCategory_Points?: number | null
          FollowUpScore_MarketingWeek_Points?: number | null
          FollowUpScore_Status_Points?: number | null
          HasActiveInventory?: boolean | null
          HasInventory?: boolean | null
          LeadScore_AbsenteeOwnerScore_Percent?: number | null
          LeadScore_AbsenteeOwnerScore_Points?: number | null
          LeadScore_ConditionScore_Percent?: number | null
          LeadScore_ConditionScore_Points?: number | null
          LeadScore_MaxOfferPriceScore_Percent?: number | null
          LeadScore_MaxOfferPriceScore_Points?: number | null
          LeadScore_SoldAmountArvScore_Percent?: number | null
          LeadScore_SoldAmountArvScore_Points?: number | null
          LeadScore_SquareFootageScore_Percent?: number | null
          LeadScore_SquareFootageScore_Points?: number | null
          LeadScore_YearBuiltScore_Percent?: number | null
          LeadScore_YearBuiltScore_Points?: number | null
          Modified?: string | null
          ms_synced_at?: string | null
          ProjectedRoyaltyDate?: string | null
          PropertyId?: number
          Stage1ArvEstatedCombined?: number | null
          StatusSnapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_calculations_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_comparables: {
        Row: {
          AdjustedPricePerSqFt: number | null
          AdjustedSqFt: number | null
          AgentNotes: string | null
          AgentSelected: boolean | null
          AuxSqFt: number | null
          BasementAtticPercentage: number | null
          Bathrooms: number | null
          Bedrooms: number | null
          Calculated_DaysOnMarket: number | null
          Category: string | null
          ComparableId: string | null
          Condition: string | null
          ConditionScore: string | null
          ConfidenceScore: number | null
          DaysOnMarket: number | null
          Description: string | null
          Distance: number | null
          Inserted: string | null
          Latitude: number | null
          ListDate: string | null
          Location: string | null
          LocationScore: string | null
          Longitude: number | null
          LotSizeAcres: number | null
          ModifiedBy: string | null
          ms_synced_at: string | null
          Notes: string | null
          PropertyId: number
          RestbScore: number | null
          SoldDate: string | null
          SortOrder: number | null
          SqFt: number | null
          Starred: boolean
          UnfinishedSqFt: number | null
          UnfinishedSqFtPercentage: number | null
          Updated: string | null
          UrlLink: string | null
          Value: number | null
          YearBuilt: string | null
        }
        Insert: {
          AdjustedPricePerSqFt?: number | null
          AdjustedSqFt?: number | null
          AgentNotes?: string | null
          AgentSelected?: boolean | null
          AuxSqFt?: number | null
          BasementAtticPercentage?: number | null
          Bathrooms?: number | null
          Bedrooms?: number | null
          Calculated_DaysOnMarket?: number | null
          Category?: string | null
          ComparableId?: string | null
          Condition?: string | null
          ConditionScore?: string | null
          ConfidenceScore?: number | null
          DaysOnMarket?: number | null
          Description?: string | null
          Distance?: number | null
          Inserted?: string | null
          Latitude?: number | null
          ListDate?: string | null
          Location?: string | null
          LocationScore?: string | null
          Longitude?: number | null
          LotSizeAcres?: number | null
          ModifiedBy?: string | null
          ms_synced_at?: string | null
          Notes?: string | null
          PropertyId: number
          RestbScore?: number | null
          SoldDate?: string | null
          SortOrder?: number | null
          SqFt?: number | null
          Starred?: boolean
          UnfinishedSqFt?: number | null
          UnfinishedSqFtPercentage?: number | null
          Updated?: string | null
          UrlLink?: string | null
          Value?: number | null
          YearBuilt?: string | null
        }
        Update: {
          AdjustedPricePerSqFt?: number | null
          AdjustedSqFt?: number | null
          AgentNotes?: string | null
          AgentSelected?: boolean | null
          AuxSqFt?: number | null
          BasementAtticPercentage?: number | null
          Bathrooms?: number | null
          Bedrooms?: number | null
          Calculated_DaysOnMarket?: number | null
          Category?: string | null
          ComparableId?: string | null
          Condition?: string | null
          ConditionScore?: string | null
          ConfidenceScore?: number | null
          DaysOnMarket?: number | null
          Description?: string | null
          Distance?: number | null
          Inserted?: string | null
          Latitude?: number | null
          ListDate?: string | null
          Location?: string | null
          LocationScore?: string | null
          Longitude?: number | null
          LotSizeAcres?: number | null
          ModifiedBy?: string | null
          ms_synced_at?: string | null
          Notes?: string | null
          PropertyId?: number
          RestbScore?: number | null
          SoldDate?: string | null
          SortOrder?: number | null
          SqFt?: number | null
          Starred?: boolean
          UnfinishedSqFt?: number | null
          UnfinishedSqFtPercentage?: number | null
          Updated?: string | null
          UrlLink?: string | null
          Value?: number | null
          YearBuilt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_comparables_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_contacts: {
        Row: {
          Address: string | null
          City: string | null
          Email: string | null
          FirstName: string | null
          GoHighLevelContactId: string | null
          Inserted: string | null
          LastName: string | null
          ms_synced_at: string | null
          Phone: string | null
          PropertyId: number
          SkipTraceLandLinePhone1: string | null
          SkipTraceLandLinePhone2: string | null
          SkipTraceLandLinePhone3: string | null
          SkipTraceLandLinePhone4: string | null
          SkipTraceLandLinePhone5: string | null
          SkipTraceLandLinePhone6: string | null
          SkipTraceMobilePhone1: string | null
          SkipTraceMobilePhone2: string | null
          SkipTraceMobilePhone3: string | null
          SkipTraceMobilePhone4: string | null
          SkipTraceMobilePhone5: string | null
          SkipTraceMobilePhone6: string | null
          SkipTraceVoipPhone1: string | null
          SkipTraceVoipPhone2: string | null
          SkipTraceVoipPhone3: string | null
          SkipTraceVoipPhone4: string | null
          SkipTraceVoipPhone5: string | null
          SkipTraceVoipPhone6: string | null
          State: string | null
          utmCampaign: string | null
          utmContent: string | null
          utmMedium: string | null
          utmSource: string | null
          Zip: string | null
        }
        Insert: {
          Address?: string | null
          City?: string | null
          Email?: string | null
          FirstName?: string | null
          GoHighLevelContactId?: string | null
          Inserted?: string | null
          LastName?: string | null
          ms_synced_at?: string | null
          Phone?: string | null
          PropertyId: number
          SkipTraceLandLinePhone1?: string | null
          SkipTraceLandLinePhone2?: string | null
          SkipTraceLandLinePhone3?: string | null
          SkipTraceLandLinePhone4?: string | null
          SkipTraceLandLinePhone5?: string | null
          SkipTraceLandLinePhone6?: string | null
          SkipTraceMobilePhone1?: string | null
          SkipTraceMobilePhone2?: string | null
          SkipTraceMobilePhone3?: string | null
          SkipTraceMobilePhone4?: string | null
          SkipTraceMobilePhone5?: string | null
          SkipTraceMobilePhone6?: string | null
          SkipTraceVoipPhone1?: string | null
          SkipTraceVoipPhone2?: string | null
          SkipTraceVoipPhone3?: string | null
          SkipTraceVoipPhone4?: string | null
          SkipTraceVoipPhone5?: string | null
          SkipTraceVoipPhone6?: string | null
          State?: string | null
          utmCampaign?: string | null
          utmContent?: string | null
          utmMedium?: string | null
          utmSource?: string | null
          Zip?: string | null
        }
        Update: {
          Address?: string | null
          City?: string | null
          Email?: string | null
          FirstName?: string | null
          GoHighLevelContactId?: string | null
          Inserted?: string | null
          LastName?: string | null
          ms_synced_at?: string | null
          Phone?: string | null
          PropertyId?: number
          SkipTraceLandLinePhone1?: string | null
          SkipTraceLandLinePhone2?: string | null
          SkipTraceLandLinePhone3?: string | null
          SkipTraceLandLinePhone4?: string | null
          SkipTraceLandLinePhone5?: string | null
          SkipTraceLandLinePhone6?: string | null
          SkipTraceMobilePhone1?: string | null
          SkipTraceMobilePhone2?: string | null
          SkipTraceMobilePhone3?: string | null
          SkipTraceMobilePhone4?: string | null
          SkipTraceMobilePhone5?: string | null
          SkipTraceMobilePhone6?: string | null
          SkipTraceVoipPhone1?: string | null
          SkipTraceVoipPhone2?: string | null
          SkipTraceVoipPhone3?: string | null
          SkipTraceVoipPhone4?: string | null
          SkipTraceVoipPhone5?: string | null
          SkipTraceVoipPhone6?: string | null
          State?: string | null
          utmCampaign?: string | null
          utmContent?: string | null
          utmMedium?: string | null
          utmSource?: string | null
          Zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_contacts_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_corporate_notes: {
        Row: {
          Id: number
          Inserted: string | null
          Message: string
          Name: string | null
          PropertyId: number
          Updated: string | null
          Username: string | null
        }
        Insert: {
          Id: number
          Inserted?: string | null
          Message: string
          Name?: string | null
          PropertyId: number
          Updated?: string | null
          Username?: string | null
        }
        Update: {
          Id?: number
          Inserted?: string | null
          Message?: string
          Name?: string | null
          PropertyId?: number
          Updated?: string | null
          Username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_corporate_notes_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_dispositions: {
        Row: {
          AlternateAssignmentFeeExpense: number | null
          AlternateBuyingCosts: number | null
          AlternateCB: number | null
          AlternateClosingCosts: number | null
          AlternateConcessions: number | null
          AlternateCostOfMoney: number | null
          AlternateCostOfProperty: number | null
          AlternateCycleMonths: number | null
          AlternateHoldingCosts: number | null
          AlternateOtherCosts: number | null
          AlternatePercentSplitOfProfitTo3rdParty: number | null
          AlternateSellingCosts: number | null
          AlternativeArv: number | null
          AssignmentFeeRevenue: number | null
          ms_synced_at: string | null
          Profit: number | null
          PropertyId: number
          Type: string
        }
        Insert: {
          AlternateAssignmentFeeExpense?: number | null
          AlternateBuyingCosts?: number | null
          AlternateCB?: number | null
          AlternateClosingCosts?: number | null
          AlternateConcessions?: number | null
          AlternateCostOfMoney?: number | null
          AlternateCostOfProperty?: number | null
          AlternateCycleMonths?: number | null
          AlternateHoldingCosts?: number | null
          AlternateOtherCosts?: number | null
          AlternatePercentSplitOfProfitTo3rdParty?: number | null
          AlternateSellingCosts?: number | null
          AlternativeArv?: number | null
          AssignmentFeeRevenue?: number | null
          ms_synced_at?: string | null
          Profit?: number | null
          PropertyId: number
          Type: string
        }
        Update: {
          AlternateAssignmentFeeExpense?: number | null
          AlternateBuyingCosts?: number | null
          AlternateCB?: number | null
          AlternateClosingCosts?: number | null
          AlternateConcessions?: number | null
          AlternateCostOfMoney?: number | null
          AlternateCostOfProperty?: number | null
          AlternateCycleMonths?: number | null
          AlternateHoldingCosts?: number | null
          AlternateOtherCosts?: number | null
          AlternatePercentSplitOfProfitTo3rdParty?: number | null
          AlternateSellingCosts?: number | null
          AlternativeArv?: number | null
          AssignmentFeeRevenue?: number | null
          ms_synced_at?: string | null
          Profit?: number | null
          PropertyId?: number
          Type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_dispositions_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_inventory: {
        Row: {
          Inv_AnnualProForma_RentalCapEx_Actual: number | null
          Inv_AnnualProForma_RentalHoa_Actual: number | null
          Inv_AnnualProForma_RentalInsurance_Actual: number | null
          Inv_AnnualProForma_RentalInterestRate_Actual: number | null
          Inv_AnnualProForma_RentalMaintenance_Actual: number | null
          Inv_AnnualProForma_RentalManagement_Actual: number | null
          Inv_AnnualProForma_RentalMaxLoanToValue_Actual: number | null
          Inv_AnnualProForma_RentalMisc_Actual: number | null
          Inv_AnnualProForma_RentalMowing_Actual: number | null
          Inv_AnnualProForma_RentalPrevailingCapRate_Actual: number | null
          Inv_AnnualProForma_RentalPropertyTax_Actual: number | null
          Inv_AnnualProForma_RentalRent_Actual: number | null
          Inv_AnnualProForma_RentalUtilities_Actual: number | null
          Inv_AnnualProForma_RentalVacancy_Actual: number | null
          Inv_AssignmentFee: number | null
          Inv_BuyingCostActual: number | null
          Inv_BuyingCostMostMature: number | null
          Inv_BuyingCostOriginal: number | null
          Inv_BuyingCostRevised: number | null
          Inv_BuyingCostStage0: number | null
          Inv_CityTaxesActual: number | null
          Inv_CityTaxesMostMature: number | null
          Inv_CityTaxesOriginal: number | null
          Inv_CityTaxesRevised: number | null
          Inv_CityTaxesStage0: number | null
          Inv_CompletionDate: string | null
          Inv_ConcessionsActual: number | null
          Inv_ConcessionsMostMature: number | null
          Inv_ConcessionsOriginal: number | null
          Inv_ConcessionsRevised: number | null
          Inv_ConcessionsStage0: number | null
          Inv_ConstructionBudgetActual: number | null
          Inv_ConstructionBudgetMostMature: number | null
          Inv_ConstructionBudgetOriginal: number | null
          Inv_ConstructionBudgetRevised: number | null
          Inv_ConstructionBudgetStage0: number | null
          Inv_ConstructionStartDate: string | null
          Inv_ContractedPurchaseDate: string | null
          Inv_ContractedSellDate: string | null
          Inv_CostOfPropertyActual: number | null
          Inv_CostOfPropertyMostMature: number | null
          Inv_CostOfPropertyOriginal: number | null
          Inv_CostOfPropertyRevised: number | null
          Inv_CostOfPropertyStage0: number | null
          Inv_CountyTaxesActual: number | null
          Inv_CountyTaxesMostMature: number | null
          Inv_CountyTaxesOriginal: number | null
          Inv_CountyTaxesRevised: number | null
          Inv_CountyTaxesStage0: number | null
          Inv_CurrentArvActual: number | null
          Inv_CurrentArvMostMature: number | null
          Inv_CurrentArvMostMaturePriceSqFt: number | null
          Inv_CurrentArvOriginal: number | null
          Inv_CurrentArvRevised: number | null
          Inv_CurrentArvStage0: number | null
          Inv_Electric: string | null
          Inv_ExpectedListPrice: string | null
          Inv_FinanceStrategy: string | null
          Inv_Gas: string | null
          Inv_HoldingCostsActual: number | null
          Inv_HoldingCostsMostMature: number | null
          Inv_HoldingCostsOriginal: number | null
          Inv_HoldingCostsRevised: number | null
          Inv_HoldingCostsStage0: number | null
          Inv_InterestPaymentsActual: number | null
          Inv_InterestPaymentsMostMature: number | null
          Inv_InterestPaymentsOriginal: number | null
          Inv_InterestPaymentsRevised: number | null
          Inv_InterestPaymentsStage0: number | null
          Inv_ListDate: string | null
          Inv_LocationGradeActual: number | null
          Inv_LocationGradeMostMature: number | null
          Inv_LocationGradeOriginal: number | null
          Inv_LocationGradeRevised: number | null
          Inv_LocationGradeStage0: number | null
          Inv_MaintenanceActual: number | null
          Inv_MaintenanceMostMature: number | null
          Inv_MaintenanceOriginal: number | null
          Inv_MaintenanceRevised: number | null
          Inv_MaintenanceStage0: number | null
          Inv_MonthlyMortgagePaymentActual: number | null
          Inv_MonthlyMortgagePaymentMostMature: number | null
          Inv_MonthlyMortgagePaymentOriginal: number | null
          Inv_MonthlyMortgagePaymentRevised: number | null
          Inv_MonthlyMortgagePaymentStage0: number | null
          Inv_MortgagePrincipalActual: number | null
          Inv_MortgagePrincipalMostMature: number | null
          Inv_MortgagePrincipalOriginal: number | null
          Inv_MortgagePrincipalRevised: number | null
          Inv_MortgagePrincipalStage0: number | null
          Inv_MowCostActual: number | null
          Inv_MowCostMostMature: number | null
          Inv_MowCostOriginal: number | null
          Inv_MowCostRevised: number | null
          Inv_MowCostStage0: number | null
          Inv_OccupiedDate: string | null
          Inv_Phase5CostsActual: number | null
          Inv_Phase5CostsMostMature: number | null
          Inv_Phase5CostsOriginal: number | null
          Inv_Phase5CostsRevised: number | null
          Inv_Phase5CostsStage0: number | null
          Inv_PriceActual: number | null
          Inv_PriceMostMature: number | null
          Inv_PriceOriginal: number | null
          Inv_PriceRevised: number | null
          Inv_PriceStage0: number | null
          Inv_PurchaseDate: string | null
          Inv_RefiCostsActual: number | null
          Inv_RefiCostsMostMature: number | null
          Inv_RefiCostsOriginal: number | null
          Inv_RefiCostsRevised: number | null
          Inv_RefiCostsStage0: number | null
          Inv_RentalIncomeActual: number | null
          Inv_RentalIncomeMostMature: number | null
          Inv_RentalIncomeOriginal: number | null
          Inv_RentalIncomeRevised: number | null
          Inv_RentalIncomeStage0: number | null
          Inv_SalesTeamInfo: string | null
          Inv_SellDate: string | null
          Inv_SellingCostsActual: number | null
          Inv_SellingCostsMostMature: number | null
          Inv_SellingCostsOriginal: number | null
          Inv_SellingCostsRevised: number | null
          Inv_SellingCostsStage0: number | null
          Inv_Septic: string | null
          Inv_Status: string | null
          Inv_Type: string | null
          Inv_UtilityProviders: string | null
          Inv_Water: string | null
          ms_synced_at: string | null
          PropertyId: number
        }
        Insert: {
          Inv_AnnualProForma_RentalCapEx_Actual?: number | null
          Inv_AnnualProForma_RentalHoa_Actual?: number | null
          Inv_AnnualProForma_RentalInsurance_Actual?: number | null
          Inv_AnnualProForma_RentalInterestRate_Actual?: number | null
          Inv_AnnualProForma_RentalMaintenance_Actual?: number | null
          Inv_AnnualProForma_RentalManagement_Actual?: number | null
          Inv_AnnualProForma_RentalMaxLoanToValue_Actual?: number | null
          Inv_AnnualProForma_RentalMisc_Actual?: number | null
          Inv_AnnualProForma_RentalMowing_Actual?: number | null
          Inv_AnnualProForma_RentalPrevailingCapRate_Actual?: number | null
          Inv_AnnualProForma_RentalPropertyTax_Actual?: number | null
          Inv_AnnualProForma_RentalRent_Actual?: number | null
          Inv_AnnualProForma_RentalUtilities_Actual?: number | null
          Inv_AnnualProForma_RentalVacancy_Actual?: number | null
          Inv_AssignmentFee?: number | null
          Inv_BuyingCostActual?: number | null
          Inv_BuyingCostMostMature?: number | null
          Inv_BuyingCostOriginal?: number | null
          Inv_BuyingCostRevised?: number | null
          Inv_BuyingCostStage0?: number | null
          Inv_CityTaxesActual?: number | null
          Inv_CityTaxesMostMature?: number | null
          Inv_CityTaxesOriginal?: number | null
          Inv_CityTaxesRevised?: number | null
          Inv_CityTaxesStage0?: number | null
          Inv_CompletionDate?: string | null
          Inv_ConcessionsActual?: number | null
          Inv_ConcessionsMostMature?: number | null
          Inv_ConcessionsOriginal?: number | null
          Inv_ConcessionsRevised?: number | null
          Inv_ConcessionsStage0?: number | null
          Inv_ConstructionBudgetActual?: number | null
          Inv_ConstructionBudgetMostMature?: number | null
          Inv_ConstructionBudgetOriginal?: number | null
          Inv_ConstructionBudgetRevised?: number | null
          Inv_ConstructionBudgetStage0?: number | null
          Inv_ConstructionStartDate?: string | null
          Inv_ContractedPurchaseDate?: string | null
          Inv_ContractedSellDate?: string | null
          Inv_CostOfPropertyActual?: number | null
          Inv_CostOfPropertyMostMature?: number | null
          Inv_CostOfPropertyOriginal?: number | null
          Inv_CostOfPropertyRevised?: number | null
          Inv_CostOfPropertyStage0?: number | null
          Inv_CountyTaxesActual?: number | null
          Inv_CountyTaxesMostMature?: number | null
          Inv_CountyTaxesOriginal?: number | null
          Inv_CountyTaxesRevised?: number | null
          Inv_CountyTaxesStage0?: number | null
          Inv_CurrentArvActual?: number | null
          Inv_CurrentArvMostMature?: number | null
          Inv_CurrentArvMostMaturePriceSqFt?: number | null
          Inv_CurrentArvOriginal?: number | null
          Inv_CurrentArvRevised?: number | null
          Inv_CurrentArvStage0?: number | null
          Inv_Electric?: string | null
          Inv_ExpectedListPrice?: string | null
          Inv_FinanceStrategy?: string | null
          Inv_Gas?: string | null
          Inv_HoldingCostsActual?: number | null
          Inv_HoldingCostsMostMature?: number | null
          Inv_HoldingCostsOriginal?: number | null
          Inv_HoldingCostsRevised?: number | null
          Inv_HoldingCostsStage0?: number | null
          Inv_InterestPaymentsActual?: number | null
          Inv_InterestPaymentsMostMature?: number | null
          Inv_InterestPaymentsOriginal?: number | null
          Inv_InterestPaymentsRevised?: number | null
          Inv_InterestPaymentsStage0?: number | null
          Inv_ListDate?: string | null
          Inv_LocationGradeActual?: number | null
          Inv_LocationGradeMostMature?: number | null
          Inv_LocationGradeOriginal?: number | null
          Inv_LocationGradeRevised?: number | null
          Inv_LocationGradeStage0?: number | null
          Inv_MaintenanceActual?: number | null
          Inv_MaintenanceMostMature?: number | null
          Inv_MaintenanceOriginal?: number | null
          Inv_MaintenanceRevised?: number | null
          Inv_MaintenanceStage0?: number | null
          Inv_MonthlyMortgagePaymentActual?: number | null
          Inv_MonthlyMortgagePaymentMostMature?: number | null
          Inv_MonthlyMortgagePaymentOriginal?: number | null
          Inv_MonthlyMortgagePaymentRevised?: number | null
          Inv_MonthlyMortgagePaymentStage0?: number | null
          Inv_MortgagePrincipalActual?: number | null
          Inv_MortgagePrincipalMostMature?: number | null
          Inv_MortgagePrincipalOriginal?: number | null
          Inv_MortgagePrincipalRevised?: number | null
          Inv_MortgagePrincipalStage0?: number | null
          Inv_MowCostActual?: number | null
          Inv_MowCostMostMature?: number | null
          Inv_MowCostOriginal?: number | null
          Inv_MowCostRevised?: number | null
          Inv_MowCostStage0?: number | null
          Inv_OccupiedDate?: string | null
          Inv_Phase5CostsActual?: number | null
          Inv_Phase5CostsMostMature?: number | null
          Inv_Phase5CostsOriginal?: number | null
          Inv_Phase5CostsRevised?: number | null
          Inv_Phase5CostsStage0?: number | null
          Inv_PriceActual?: number | null
          Inv_PriceMostMature?: number | null
          Inv_PriceOriginal?: number | null
          Inv_PriceRevised?: number | null
          Inv_PriceStage0?: number | null
          Inv_PurchaseDate?: string | null
          Inv_RefiCostsActual?: number | null
          Inv_RefiCostsMostMature?: number | null
          Inv_RefiCostsOriginal?: number | null
          Inv_RefiCostsRevised?: number | null
          Inv_RefiCostsStage0?: number | null
          Inv_RentalIncomeActual?: number | null
          Inv_RentalIncomeMostMature?: number | null
          Inv_RentalIncomeOriginal?: number | null
          Inv_RentalIncomeRevised?: number | null
          Inv_RentalIncomeStage0?: number | null
          Inv_SalesTeamInfo?: string | null
          Inv_SellDate?: string | null
          Inv_SellingCostsActual?: number | null
          Inv_SellingCostsMostMature?: number | null
          Inv_SellingCostsOriginal?: number | null
          Inv_SellingCostsRevised?: number | null
          Inv_SellingCostsStage0?: number | null
          Inv_Septic?: string | null
          Inv_Status?: string | null
          Inv_Type?: string | null
          Inv_UtilityProviders?: string | null
          Inv_Water?: string | null
          ms_synced_at?: string | null
          PropertyId: number
        }
        Update: {
          Inv_AnnualProForma_RentalCapEx_Actual?: number | null
          Inv_AnnualProForma_RentalHoa_Actual?: number | null
          Inv_AnnualProForma_RentalInsurance_Actual?: number | null
          Inv_AnnualProForma_RentalInterestRate_Actual?: number | null
          Inv_AnnualProForma_RentalMaintenance_Actual?: number | null
          Inv_AnnualProForma_RentalManagement_Actual?: number | null
          Inv_AnnualProForma_RentalMaxLoanToValue_Actual?: number | null
          Inv_AnnualProForma_RentalMisc_Actual?: number | null
          Inv_AnnualProForma_RentalMowing_Actual?: number | null
          Inv_AnnualProForma_RentalPrevailingCapRate_Actual?: number | null
          Inv_AnnualProForma_RentalPropertyTax_Actual?: number | null
          Inv_AnnualProForma_RentalRent_Actual?: number | null
          Inv_AnnualProForma_RentalUtilities_Actual?: number | null
          Inv_AnnualProForma_RentalVacancy_Actual?: number | null
          Inv_AssignmentFee?: number | null
          Inv_BuyingCostActual?: number | null
          Inv_BuyingCostMostMature?: number | null
          Inv_BuyingCostOriginal?: number | null
          Inv_BuyingCostRevised?: number | null
          Inv_BuyingCostStage0?: number | null
          Inv_CityTaxesActual?: number | null
          Inv_CityTaxesMostMature?: number | null
          Inv_CityTaxesOriginal?: number | null
          Inv_CityTaxesRevised?: number | null
          Inv_CityTaxesStage0?: number | null
          Inv_CompletionDate?: string | null
          Inv_ConcessionsActual?: number | null
          Inv_ConcessionsMostMature?: number | null
          Inv_ConcessionsOriginal?: number | null
          Inv_ConcessionsRevised?: number | null
          Inv_ConcessionsStage0?: number | null
          Inv_ConstructionBudgetActual?: number | null
          Inv_ConstructionBudgetMostMature?: number | null
          Inv_ConstructionBudgetOriginal?: number | null
          Inv_ConstructionBudgetRevised?: number | null
          Inv_ConstructionBudgetStage0?: number | null
          Inv_ConstructionStartDate?: string | null
          Inv_ContractedPurchaseDate?: string | null
          Inv_ContractedSellDate?: string | null
          Inv_CostOfPropertyActual?: number | null
          Inv_CostOfPropertyMostMature?: number | null
          Inv_CostOfPropertyOriginal?: number | null
          Inv_CostOfPropertyRevised?: number | null
          Inv_CostOfPropertyStage0?: number | null
          Inv_CountyTaxesActual?: number | null
          Inv_CountyTaxesMostMature?: number | null
          Inv_CountyTaxesOriginal?: number | null
          Inv_CountyTaxesRevised?: number | null
          Inv_CountyTaxesStage0?: number | null
          Inv_CurrentArvActual?: number | null
          Inv_CurrentArvMostMature?: number | null
          Inv_CurrentArvMostMaturePriceSqFt?: number | null
          Inv_CurrentArvOriginal?: number | null
          Inv_CurrentArvRevised?: number | null
          Inv_CurrentArvStage0?: number | null
          Inv_Electric?: string | null
          Inv_ExpectedListPrice?: string | null
          Inv_FinanceStrategy?: string | null
          Inv_Gas?: string | null
          Inv_HoldingCostsActual?: number | null
          Inv_HoldingCostsMostMature?: number | null
          Inv_HoldingCostsOriginal?: number | null
          Inv_HoldingCostsRevised?: number | null
          Inv_HoldingCostsStage0?: number | null
          Inv_InterestPaymentsActual?: number | null
          Inv_InterestPaymentsMostMature?: number | null
          Inv_InterestPaymentsOriginal?: number | null
          Inv_InterestPaymentsRevised?: number | null
          Inv_InterestPaymentsStage0?: number | null
          Inv_ListDate?: string | null
          Inv_LocationGradeActual?: number | null
          Inv_LocationGradeMostMature?: number | null
          Inv_LocationGradeOriginal?: number | null
          Inv_LocationGradeRevised?: number | null
          Inv_LocationGradeStage0?: number | null
          Inv_MaintenanceActual?: number | null
          Inv_MaintenanceMostMature?: number | null
          Inv_MaintenanceOriginal?: number | null
          Inv_MaintenanceRevised?: number | null
          Inv_MaintenanceStage0?: number | null
          Inv_MonthlyMortgagePaymentActual?: number | null
          Inv_MonthlyMortgagePaymentMostMature?: number | null
          Inv_MonthlyMortgagePaymentOriginal?: number | null
          Inv_MonthlyMortgagePaymentRevised?: number | null
          Inv_MonthlyMortgagePaymentStage0?: number | null
          Inv_MortgagePrincipalActual?: number | null
          Inv_MortgagePrincipalMostMature?: number | null
          Inv_MortgagePrincipalOriginal?: number | null
          Inv_MortgagePrincipalRevised?: number | null
          Inv_MortgagePrincipalStage0?: number | null
          Inv_MowCostActual?: number | null
          Inv_MowCostMostMature?: number | null
          Inv_MowCostOriginal?: number | null
          Inv_MowCostRevised?: number | null
          Inv_MowCostStage0?: number | null
          Inv_OccupiedDate?: string | null
          Inv_Phase5CostsActual?: number | null
          Inv_Phase5CostsMostMature?: number | null
          Inv_Phase5CostsOriginal?: number | null
          Inv_Phase5CostsRevised?: number | null
          Inv_Phase5CostsStage0?: number | null
          Inv_PriceActual?: number | null
          Inv_PriceMostMature?: number | null
          Inv_PriceOriginal?: number | null
          Inv_PriceRevised?: number | null
          Inv_PriceStage0?: number | null
          Inv_PurchaseDate?: string | null
          Inv_RefiCostsActual?: number | null
          Inv_RefiCostsMostMature?: number | null
          Inv_RefiCostsOriginal?: number | null
          Inv_RefiCostsRevised?: number | null
          Inv_RefiCostsStage0?: number | null
          Inv_RentalIncomeActual?: number | null
          Inv_RentalIncomeMostMature?: number | null
          Inv_RentalIncomeOriginal?: number | null
          Inv_RentalIncomeRevised?: number | null
          Inv_RentalIncomeStage0?: number | null
          Inv_SalesTeamInfo?: string | null
          Inv_SellDate?: string | null
          Inv_SellingCostsActual?: number | null
          Inv_SellingCostsMostMature?: number | null
          Inv_SellingCostsOriginal?: number | null
          Inv_SellingCostsRevised?: number | null
          Inv_SellingCostsStage0?: number | null
          Inv_Septic?: string | null
          Inv_Status?: string | null
          Inv_Type?: string | null
          Inv_UtilityProviders?: string | null
          Inv_Water?: string | null
          ms_synced_at?: string | null
          PropertyId?: number
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_inventory_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_media: {
        Row: {
          Error: boolean | null
          FileExtension: string | null
          Inserted: string | null
          MediaCategory: string | null
          OriginalFileName: string | null
          PropertyId: number
          ThumbnailUrl: string | null
          Type: string | null
          Url: string
          YoutubeUrl: string | null
        }
        Insert: {
          Error?: boolean | null
          FileExtension?: string | null
          Inserted?: string | null
          MediaCategory?: string | null
          OriginalFileName?: string | null
          PropertyId: number
          ThumbnailUrl?: string | null
          Type?: string | null
          Url: string
          YoutubeUrl?: string | null
        }
        Update: {
          Error?: boolean | null
          FileExtension?: string | null
          Inserted?: string | null
          MediaCategory?: string | null
          OriginalFileName?: string | null
          PropertyId?: number
          ThumbnailUrl?: string | null
          Type?: string | null
          Url?: string
          YoutubeUrl?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_media_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_mortgages: {
        Row: {
          Amount: number | null
          Calculated_EstimatedPayoff: number | null
          Date: string | null
          DeedType: string | null
          DetailsJson: string | null
          DueDate: string | null
          Enabled: boolean | null
          KnownInterestRate: number | null
          LenderName: string | null
          LoanType: string | null
          ms_synced_at: string | null
          PropertyId: number
          PropertyMortgageId: number
          RateType: string | null
          Term: number | null
        }
        Insert: {
          Amount?: number | null
          Calculated_EstimatedPayoff?: number | null
          Date?: string | null
          DeedType?: string | null
          DetailsJson?: string | null
          DueDate?: string | null
          Enabled?: boolean | null
          KnownInterestRate?: number | null
          LenderName?: string | null
          LoanType?: string | null
          ms_synced_at?: string | null
          PropertyId: number
          PropertyMortgageId: number
          RateType?: string | null
          Term?: number | null
        }
        Update: {
          Amount?: number | null
          Calculated_EstimatedPayoff?: number | null
          Date?: string | null
          DeedType?: string | null
          DetailsJson?: string | null
          DueDate?: string | null
          Enabled?: boolean | null
          KnownInterestRate?: number | null
          LenderName?: string | null
          LoanType?: string | null
          ms_synced_at?: string | null
          PropertyId?: number
          PropertyMortgageId?: number
          RateType?: string | null
          Term?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_mortgages_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_notes: {
        Row: {
          ms_synced_at: string | null
          Note_AprPercentage: number | null
          Note_Calculated_NoteBalance: number | null
          Note_Calculated_NotePayable: number | null
          Note_CommittedForDate: string | null
          Note_Date: string | null
          Note_Fees: number | null
          Note_Holder: string | null
          Note_Id: number
          Note_InterestCompounded: boolean | null
          Note_InterestPayable: number | null
          Note_InterestPayableMessage: string | null
          Note_MaturityDate: string | null
          Note_MinimumFlatPercentage: number | null
          Note_Points: number | null
          Note_Principal: number | null
          Note_Type: string | null
          PropertyId: number
        }
        Insert: {
          ms_synced_at?: string | null
          Note_AprPercentage?: number | null
          Note_Calculated_NoteBalance?: number | null
          Note_Calculated_NotePayable?: number | null
          Note_CommittedForDate?: string | null
          Note_Date?: string | null
          Note_Fees?: number | null
          Note_Holder?: string | null
          Note_Id: number
          Note_InterestCompounded?: boolean | null
          Note_InterestPayable?: number | null
          Note_InterestPayableMessage?: string | null
          Note_MaturityDate?: string | null
          Note_MinimumFlatPercentage?: number | null
          Note_Points?: number | null
          Note_Principal?: number | null
          Note_Type?: string | null
          PropertyId: number
        }
        Update: {
          ms_synced_at?: string | null
          Note_AprPercentage?: number | null
          Note_Calculated_NoteBalance?: number | null
          Note_Calculated_NotePayable?: number | null
          Note_CommittedForDate?: string | null
          Note_Date?: string | null
          Note_Fees?: number | null
          Note_Holder?: string | null
          Note_Id?: number
          Note_InterestCompounded?: boolean | null
          Note_InterestPayable?: number | null
          Note_InterestPayableMessage?: string | null
          Note_MaturityDate?: string | null
          Note_MinimumFlatPercentage?: number | null
          Note_Points?: number | null
          Note_Principal?: number | null
          Note_Type?: string | null
          PropertyId?: number
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_notes_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_royalty: {
        Row: {
          AcquisitionRoyaltyOverride: number | null
          AcquisitionRoyaltyPaid: number | null
          AcquisitionRoyaltyPaidDate: string | null
          Calculated_AcquisitionRoyalty: number | null
          Calculated_AcquisitionRoyaltyDue: number | null
          Calculated_AcquisitionRoyaltyDueDate: string | null
          Calculated_DelayedRoyaltyFee: number | null
          Calculated_DelayedRoyaltyFeeDue: number | null
          Calculated_DelayedRoyaltyFeeDueDate: string | null
          Calculated_DispositionRoyalty: number | null
          Calculated_DispositionRoyaltyDue: number | null
          Calculated_DispositionRoyaltyDueDate: string | null
          Calculated_RoyaltyTrueUp: number | null
          Calculated_RoyaltyTrueUpDue: number | null
          Calculated_RoyaltyTrueUpDueDate: string | null
          DelayedRoyaltyFeeOverride: number | null
          DelayedRoyaltyFeePaid: number | null
          DelayedRoyaltyFeePaidDate: string | null
          DispositionRoyaltyOverride: number | null
          DispositionRoyaltyPaid: number | null
          DispositionRoyaltyPaidDate: string | null
          LockedInMedianSalePriceMax: number | null
          LockedInMedianSalePriceMaxSetDate: string | null
          ms_synced_at: string | null
          PropertyId: number
          RoyaltyPaidAtOverride: string | null
          RoyaltyTrueUpOverride: number | null
          RoyaltyTrueUpPaid: number | null
          RoyaltyTrueUpPaidDate: string | null
          RoyaltyVersionOverride: number | null
        }
        Insert: {
          AcquisitionRoyaltyOverride?: number | null
          AcquisitionRoyaltyPaid?: number | null
          AcquisitionRoyaltyPaidDate?: string | null
          Calculated_AcquisitionRoyalty?: number | null
          Calculated_AcquisitionRoyaltyDue?: number | null
          Calculated_AcquisitionRoyaltyDueDate?: string | null
          Calculated_DelayedRoyaltyFee?: number | null
          Calculated_DelayedRoyaltyFeeDue?: number | null
          Calculated_DelayedRoyaltyFeeDueDate?: string | null
          Calculated_DispositionRoyalty?: number | null
          Calculated_DispositionRoyaltyDue?: number | null
          Calculated_DispositionRoyaltyDueDate?: string | null
          Calculated_RoyaltyTrueUp?: number | null
          Calculated_RoyaltyTrueUpDue?: number | null
          Calculated_RoyaltyTrueUpDueDate?: string | null
          DelayedRoyaltyFeeOverride?: number | null
          DelayedRoyaltyFeePaid?: number | null
          DelayedRoyaltyFeePaidDate?: string | null
          DispositionRoyaltyOverride?: number | null
          DispositionRoyaltyPaid?: number | null
          DispositionRoyaltyPaidDate?: string | null
          LockedInMedianSalePriceMax?: number | null
          LockedInMedianSalePriceMaxSetDate?: string | null
          ms_synced_at?: string | null
          PropertyId: number
          RoyaltyPaidAtOverride?: string | null
          RoyaltyTrueUpOverride?: number | null
          RoyaltyTrueUpPaid?: number | null
          RoyaltyTrueUpPaidDate?: string | null
          RoyaltyVersionOverride?: number | null
        }
        Update: {
          AcquisitionRoyaltyOverride?: number | null
          AcquisitionRoyaltyPaid?: number | null
          AcquisitionRoyaltyPaidDate?: string | null
          Calculated_AcquisitionRoyalty?: number | null
          Calculated_AcquisitionRoyaltyDue?: number | null
          Calculated_AcquisitionRoyaltyDueDate?: string | null
          Calculated_DelayedRoyaltyFee?: number | null
          Calculated_DelayedRoyaltyFeeDue?: number | null
          Calculated_DelayedRoyaltyFeeDueDate?: string | null
          Calculated_DispositionRoyalty?: number | null
          Calculated_DispositionRoyaltyDue?: number | null
          Calculated_DispositionRoyaltyDueDate?: string | null
          Calculated_RoyaltyTrueUp?: number | null
          Calculated_RoyaltyTrueUpDue?: number | null
          Calculated_RoyaltyTrueUpDueDate?: string | null
          DelayedRoyaltyFeeOverride?: number | null
          DelayedRoyaltyFeePaid?: number | null
          DelayedRoyaltyFeePaidDate?: string | null
          DispositionRoyaltyOverride?: number | null
          DispositionRoyaltyPaid?: number | null
          DispositionRoyaltyPaidDate?: string | null
          LockedInMedianSalePriceMax?: number | null
          LockedInMedianSalePriceMaxSetDate?: string | null
          ms_synced_at?: string | null
          PropertyId?: number
          RoyaltyPaidAtOverride?: string | null
          RoyaltyTrueUpOverride?: number | null
          RoyaltyTrueUpPaid?: number | null
          RoyaltyTrueUpPaidDate?: string | null
          RoyaltyVersionOverride?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_royalty_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_stage0: {
        Row: {
          AuxFinishedSqFt: number | null
          Bathrooms: number | null
          Bedrooms: number | null
          CensusTract: string | null
          EffectiveYear: string | null
          LastSoldDate: string | null
          LastSoldPrice: number | null
          Latitude: string | null
          LatLongSource: string | null
          Longitude: string | null
          LotSizeAcres: number | null
          OwnerAddress: string | null
          OwnerCity: string | null
          OwnerEmail: string | null
          OwnerName: string | null
          OwnerPhone: string | null
          OwnerPhoneNormalized: string | null
          OwnerState: string | null
          OwnerZip: string | null
          PropertyId: number
          PropertyType: string | null
          SqFtBase: number | null
          Stage0Type: string
          TaxValue: number | null
          TrusteeAddress: string | null
          TrusteeCity: string | null
          TrusteeEmail: string | null
          TrusteeName: string | null
          TrusteePhone: string | null
          TrusteeState: string | null
          TrusteeZip: string | null
          UnfinishedSqFt: number | null
          Valuation: number | null
          ValuationHigh: number | null
          ValuationLow: number | null
          YearBuilt: string | null
        }
        Insert: {
          AuxFinishedSqFt?: number | null
          Bathrooms?: number | null
          Bedrooms?: number | null
          CensusTract?: string | null
          EffectiveYear?: string | null
          LastSoldDate?: string | null
          LastSoldPrice?: number | null
          Latitude?: string | null
          LatLongSource?: string | null
          Longitude?: string | null
          LotSizeAcres?: number | null
          OwnerAddress?: string | null
          OwnerCity?: string | null
          OwnerEmail?: string | null
          OwnerName?: string | null
          OwnerPhone?: string | null
          OwnerPhoneNormalized?: string | null
          OwnerState?: string | null
          OwnerZip?: string | null
          PropertyId: number
          PropertyType?: string | null
          SqFtBase?: number | null
          Stage0Type: string
          TaxValue?: number | null
          TrusteeAddress?: string | null
          TrusteeCity?: string | null
          TrusteeEmail?: string | null
          TrusteeName?: string | null
          TrusteePhone?: string | null
          TrusteeState?: string | null
          TrusteeZip?: string | null
          UnfinishedSqFt?: number | null
          Valuation?: number | null
          ValuationHigh?: number | null
          ValuationLow?: number | null
          YearBuilt?: string | null
        }
        Update: {
          AuxFinishedSqFt?: number | null
          Bathrooms?: number | null
          Bedrooms?: number | null
          CensusTract?: string | null
          EffectiveYear?: string | null
          LastSoldDate?: string | null
          LastSoldPrice?: number | null
          Latitude?: string | null
          LatLongSource?: string | null
          Longitude?: string | null
          LotSizeAcres?: number | null
          OwnerAddress?: string | null
          OwnerCity?: string | null
          OwnerEmail?: string | null
          OwnerName?: string | null
          OwnerPhone?: string | null
          OwnerPhoneNormalized?: string | null
          OwnerState?: string | null
          OwnerZip?: string | null
          PropertyId?: number
          PropertyType?: string | null
          SqFtBase?: number | null
          Stage0Type?: string
          TaxValue?: number | null
          TrusteeAddress?: string | null
          TrusteeCity?: string | null
          TrusteeEmail?: string | null
          TrusteeName?: string | null
          TrusteePhone?: string | null
          TrusteeState?: string | null
          TrusteeZip?: string | null
          UnfinishedSqFt?: number | null
          Valuation?: number | null
          ValuationHigh?: number | null
          ValuationLow?: number | null
          YearBuilt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_stage0_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_stage0_origins: {
        Row: {
          evidence_source: string
          evidence_status: string | null
          ms_synced_at: string
          original_stage0_inserted_at: string
          PropertyId: number
          TerritorySlug: string | null
        }
        Insert: {
          evidence_source: string
          evidence_status?: string | null
          ms_synced_at?: string
          original_stage0_inserted_at: string
          PropertyId: number
          TerritorySlug?: string | null
        }
        Update: {
          evidence_source?: string
          evidence_status?: string | null
          ms_synced_at?: string
          original_stage0_inserted_at?: string
          PropertyId?: number
          TerritorySlug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_stage0_origins_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
          {
            foreignKeyName: "ms_property_stage0_origins_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_property_stage0_origins_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_property_stage0_origins_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_property_stage0_origins_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_property_stage0_origins_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_property_stage1: {
        Row: {
          PropertyId: number
          S1_AuxFinishedSqFt: number | null
          S1_Bathrooms: number | null
          S1_Bedrooms: number | null
          S1_CensusTract: string | null
          S1_EffectiveYear: string | null
          S1_LastSoldDate: string | null
          S1_LastSoldPrice: number | null
          S1_LotSizeAcres: number | null
          S1_OwnerAddress: string | null
          S1_OwnerCity: string | null
          S1_OwnerEmail: string | null
          S1_OwnerName: string | null
          S1_OwnerPhone: string | null
          S1_OwnerPhoneNormalized: string | null
          S1_OwnerState: string | null
          S1_OwnerZip: string | null
          S1_PropertyType: string | null
          S1_SqFtBase: number | null
          S1_TaxValue: number | null
          S1_TrusteeAddress: string | null
          S1_TrusteeCity: string | null
          S1_TrusteeEmail: string | null
          S1_TrusteeName: string | null
          S1_TrusteePhone: string | null
          S1_TrusteeState: string | null
          S1_TrusteeZip: string | null
          S1_UnfinishedSqFt: number | null
          S1_YearBuilt: string | null
        }
        Insert: {
          PropertyId: number
          S1_AuxFinishedSqFt?: number | null
          S1_Bathrooms?: number | null
          S1_Bedrooms?: number | null
          S1_CensusTract?: string | null
          S1_EffectiveYear?: string | null
          S1_LastSoldDate?: string | null
          S1_LastSoldPrice?: number | null
          S1_LotSizeAcres?: number | null
          S1_OwnerAddress?: string | null
          S1_OwnerCity?: string | null
          S1_OwnerEmail?: string | null
          S1_OwnerName?: string | null
          S1_OwnerPhone?: string | null
          S1_OwnerPhoneNormalized?: string | null
          S1_OwnerState?: string | null
          S1_OwnerZip?: string | null
          S1_PropertyType?: string | null
          S1_SqFtBase?: number | null
          S1_TaxValue?: number | null
          S1_TrusteeAddress?: string | null
          S1_TrusteeCity?: string | null
          S1_TrusteeEmail?: string | null
          S1_TrusteeName?: string | null
          S1_TrusteePhone?: string | null
          S1_TrusteeState?: string | null
          S1_TrusteeZip?: string | null
          S1_UnfinishedSqFt?: number | null
          S1_YearBuilt?: string | null
        }
        Update: {
          PropertyId?: number
          S1_AuxFinishedSqFt?: number | null
          S1_Bathrooms?: number | null
          S1_Bedrooms?: number | null
          S1_CensusTract?: string | null
          S1_EffectiveYear?: string | null
          S1_LastSoldDate?: string | null
          S1_LastSoldPrice?: number | null
          S1_LotSizeAcres?: number | null
          S1_OwnerAddress?: string | null
          S1_OwnerCity?: string | null
          S1_OwnerEmail?: string | null
          S1_OwnerName?: string | null
          S1_OwnerPhone?: string | null
          S1_OwnerPhoneNormalized?: string | null
          S1_OwnerState?: string | null
          S1_OwnerZip?: string | null
          S1_PropertyType?: string | null
          S1_SqFtBase?: number | null
          S1_TaxValue?: number | null
          S1_TrusteeAddress?: string | null
          S1_TrusteeCity?: string | null
          S1_TrusteeEmail?: string | null
          S1_TrusteeName?: string | null
          S1_TrusteePhone?: string | null
          S1_TrusteeState?: string | null
          S1_TrusteeZip?: string | null
          S1_UnfinishedSqFt?: number | null
          S1_YearBuilt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_stage1_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_status_history: {
        Row: {
          Inserted: string
          NewStatus: string | null
          PreviousStatus: string | null
          PropertyId: number
        }
        Insert: {
          Inserted: string
          NewStatus?: string | null
          PreviousStatus?: string | null
          PropertyId: number
        }
        Update: {
          Inserted?: string
          NewStatus?: string | null
          PreviousStatus?: string | null
          PropertyId?: number
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_status_history_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: false
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_property_status_timelines: {
        Row: {
          DaysBetweenFirstStageToStage4: number | null
          DaysBetweenInsertedToFirstStage: number | null
          FirstStageDate: string | null
          PropertyId: number
          Stage4Date: string | null
        }
        Insert: {
          DaysBetweenFirstStageToStage4?: number | null
          DaysBetweenInsertedToFirstStage?: number | null
          FirstStageDate?: string | null
          PropertyId: number
          Stage4Date?: string | null
        }
        Update: {
          DaysBetweenFirstStageToStage4?: number | null
          DaysBetweenInsertedToFirstStage?: number | null
          FirstStageDate?: string | null
          PropertyId?: number
          Stage4Date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_property_status_timelines_PropertyId_fkey"
            columns: ["PropertyId"]
            isOneToOne: true
            referencedRelation: "ms_properties"
            referencedColumns: ["PropertyId"]
          },
        ]
      }
      ms_report_variable_configuration: {
        Row: {
          Description: string | null
          Hidden: boolean | null
          Name: string
          SortOrder: number | null
          TutorialTextToken: string | null
          UserFriendlyName: string | null
          UserInterfaceFormatter: string | null
          UserInterfaceFormatterArgument1: string | null
        }
        Insert: {
          Description?: string | null
          Hidden?: boolean | null
          Name: string
          SortOrder?: number | null
          TutorialTextToken?: string | null
          UserFriendlyName?: string | null
          UserInterfaceFormatter?: string | null
          UserInterfaceFormatterArgument1?: string | null
        }
        Update: {
          Description?: string | null
          Hidden?: boolean | null
          Name?: string
          SortOrder?: number | null
          TutorialTextToken?: string | null
          UserFriendlyName?: string | null
          UserInterfaceFormatter?: string | null
          UserInterfaceFormatterArgument1?: string | null
        }
        Relationships: []
      }
      ms_report_variables: {
        Row: {
          ArvPercentAuxSqFt: number | null
          ArvPercentSqFt: number | null
          ArvPercentUnfinishedSqFt: number | null
          ConstructionBudgetDefaultRehabGrade: number | null
          ConstructionBudgetDefaultRehabGradeForeclosure: number | null
          ConstructionBudgetDefaultRehabGradeTax: number | null
          ConstructionBudgetS1: number | null
          DefaultLocationGrade: number | null
          EstimatedDaysBetweenConstructionEndAndSell: number | null
          EstimatedDaysBetweenPurchaseAndConstructionStart: number | null
          InvRentalCapEx: number | null
          InvRentalHoa: number | null
          InvRentalInsurance: number | null
          InvRentalInterestRate: number | null
          InvRentalMaintenance: number | null
          InvRentalManagement: number | null
          InvRentalMaxLtvPercent: number | null
          InvRentalMisc: number | null
          InvRentalMowing: number | null
          InvRentalMowingMonthsPerYear: number | null
          InvRentalNoteTerm: number | null
          InvRentalPrevailingCapRate: number | null
          InvRentalPropertyTax: number | null
          InvRentalRentAsf: number | null
          InvRentalTargetRentAllIn: number | null
          InvRentalUtilities: number | null
          InvRentalVacancy: number | null
          LeadScoreIdealSquareFootage: number | null
          LeadScoreIdealSquareFootageHigh: number | null
          LeadScoreIdealSquareFootageLow: number | null
          LeadScoreIdealYearBuilt: number | null
          LeadScoreIdealYearBuiltHigh: number | null
          LeadScoreIdealYearBuiltLow: number | null
          NarRegion: string | null
          QuietCostsAgentSellCommissions: number | null
          QuietCostsBuyingCost: number | null
          QuietCostsClosingCostPercentage: number | null
          QuietCostsEstimatedCycleMonths: number | null
          QuietCostsHoldingCost: number | null
          QuietCostsInterestRate: number | null
          QuietCostsMaxClosingCost: number | null
          QuietCostsMoneyFees: number | null
          QuietCostsMoneyPoints: number | null
          QuietCostsPercentOfConstructionFinanced: number | null
          QuietCostsPercentOfPurchaseFinanced: number | null
          RiskFactorArvMaxPercentage: number | null
          RiskFactorArvPercentageIncrement: number | null
          RiskFactorBasePercentage: number | null
          RiskFactorComparableRiskPercentageAdjustment: number | null
          RiskFactorIntangibleScoreAdjustment: number | null
          RiskFactorLocationPercentageAdjustment: number | null
          RiskFactorMaxPercentage: number | null
          RoyaltyPaidAt: string | null
          RoyaltyVersion: number | null
          TargetCbSpendPerDay: number | null
          TerritorySlug: string
        }
        Insert: {
          ArvPercentAuxSqFt?: number | null
          ArvPercentSqFt?: number | null
          ArvPercentUnfinishedSqFt?: number | null
          ConstructionBudgetDefaultRehabGrade?: number | null
          ConstructionBudgetDefaultRehabGradeForeclosure?: number | null
          ConstructionBudgetDefaultRehabGradeTax?: number | null
          ConstructionBudgetS1?: number | null
          DefaultLocationGrade?: number | null
          EstimatedDaysBetweenConstructionEndAndSell?: number | null
          EstimatedDaysBetweenPurchaseAndConstructionStart?: number | null
          InvRentalCapEx?: number | null
          InvRentalHoa?: number | null
          InvRentalInsurance?: number | null
          InvRentalInterestRate?: number | null
          InvRentalMaintenance?: number | null
          InvRentalManagement?: number | null
          InvRentalMaxLtvPercent?: number | null
          InvRentalMisc?: number | null
          InvRentalMowing?: number | null
          InvRentalMowingMonthsPerYear?: number | null
          InvRentalNoteTerm?: number | null
          InvRentalPrevailingCapRate?: number | null
          InvRentalPropertyTax?: number | null
          InvRentalRentAsf?: number | null
          InvRentalTargetRentAllIn?: number | null
          InvRentalUtilities?: number | null
          InvRentalVacancy?: number | null
          LeadScoreIdealSquareFootage?: number | null
          LeadScoreIdealSquareFootageHigh?: number | null
          LeadScoreIdealSquareFootageLow?: number | null
          LeadScoreIdealYearBuilt?: number | null
          LeadScoreIdealYearBuiltHigh?: number | null
          LeadScoreIdealYearBuiltLow?: number | null
          NarRegion?: string | null
          QuietCostsAgentSellCommissions?: number | null
          QuietCostsBuyingCost?: number | null
          QuietCostsClosingCostPercentage?: number | null
          QuietCostsEstimatedCycleMonths?: number | null
          QuietCostsHoldingCost?: number | null
          QuietCostsInterestRate?: number | null
          QuietCostsMaxClosingCost?: number | null
          QuietCostsMoneyFees?: number | null
          QuietCostsMoneyPoints?: number | null
          QuietCostsPercentOfConstructionFinanced?: number | null
          QuietCostsPercentOfPurchaseFinanced?: number | null
          RiskFactorArvMaxPercentage?: number | null
          RiskFactorArvPercentageIncrement?: number | null
          RiskFactorBasePercentage?: number | null
          RiskFactorComparableRiskPercentageAdjustment?: number | null
          RiskFactorIntangibleScoreAdjustment?: number | null
          RiskFactorLocationPercentageAdjustment?: number | null
          RiskFactorMaxPercentage?: number | null
          RoyaltyPaidAt?: string | null
          RoyaltyVersion?: number | null
          TargetCbSpendPerDay?: number | null
          TerritorySlug: string
        }
        Update: {
          ArvPercentAuxSqFt?: number | null
          ArvPercentSqFt?: number | null
          ArvPercentUnfinishedSqFt?: number | null
          ConstructionBudgetDefaultRehabGrade?: number | null
          ConstructionBudgetDefaultRehabGradeForeclosure?: number | null
          ConstructionBudgetDefaultRehabGradeTax?: number | null
          ConstructionBudgetS1?: number | null
          DefaultLocationGrade?: number | null
          EstimatedDaysBetweenConstructionEndAndSell?: number | null
          EstimatedDaysBetweenPurchaseAndConstructionStart?: number | null
          InvRentalCapEx?: number | null
          InvRentalHoa?: number | null
          InvRentalInsurance?: number | null
          InvRentalInterestRate?: number | null
          InvRentalMaintenance?: number | null
          InvRentalManagement?: number | null
          InvRentalMaxLtvPercent?: number | null
          InvRentalMisc?: number | null
          InvRentalMowing?: number | null
          InvRentalMowingMonthsPerYear?: number | null
          InvRentalNoteTerm?: number | null
          InvRentalPrevailingCapRate?: number | null
          InvRentalPropertyTax?: number | null
          InvRentalRentAsf?: number | null
          InvRentalTargetRentAllIn?: number | null
          InvRentalUtilities?: number | null
          InvRentalVacancy?: number | null
          LeadScoreIdealSquareFootage?: number | null
          LeadScoreIdealSquareFootageHigh?: number | null
          LeadScoreIdealSquareFootageLow?: number | null
          LeadScoreIdealYearBuilt?: number | null
          LeadScoreIdealYearBuiltHigh?: number | null
          LeadScoreIdealYearBuiltLow?: number | null
          NarRegion?: string | null
          QuietCostsAgentSellCommissions?: number | null
          QuietCostsBuyingCost?: number | null
          QuietCostsClosingCostPercentage?: number | null
          QuietCostsEstimatedCycleMonths?: number | null
          QuietCostsHoldingCost?: number | null
          QuietCostsInterestRate?: number | null
          QuietCostsMaxClosingCost?: number | null
          QuietCostsMoneyFees?: number | null
          QuietCostsMoneyPoints?: number | null
          QuietCostsPercentOfConstructionFinanced?: number | null
          QuietCostsPercentOfPurchaseFinanced?: number | null
          RiskFactorArvMaxPercentage?: number | null
          RiskFactorArvPercentageIncrement?: number | null
          RiskFactorBasePercentage?: number | null
          RiskFactorComparableRiskPercentageAdjustment?: number | null
          RiskFactorIntangibleScoreAdjustment?: number | null
          RiskFactorLocationPercentageAdjustment?: number | null
          RiskFactorMaxPercentage?: number | null
          RoyaltyPaidAt?: string | null
          RoyaltyVersion?: number | null
          TargetCbSpendPerDay?: number | null
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_report_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_report_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_report_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_report_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_report_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_stage0_types: {
        Row: {
          Type: string
        }
        Insert: {
          Type: string
        }
        Update: {
          Type?: string
        }
        Relationships: []
      }
      ms_territory_associated_counties: {
        Row: {
          CountyName: string
          State: string
          TerritorySlug: string
        }
        Insert: {
          CountyName: string
          State: string
          TerritorySlug: string
        }
        Update: {
          CountyName?: string
          State?: string
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_territory_associated_counties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_counties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_counties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_counties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_counties_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_territory_associated_zip_codes: {
        Row: {
          TerritorySlug: string
          ZipCode: string
        }
        Insert: {
          TerritorySlug: string
          ZipCode: string
        }
        Update: {
          TerritorySlug?: string
          ZipCode?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_territory_associated_zip_codes_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_zip_codes_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_zip_codes_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_zip_codes_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_associated_zip_codes_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_territory_badges: {
        Row: {
          DisplayName: string
          GroupName: string
          ImageUrl: string
          Levels: number
          TerritoryBadgeId: number
        }
        Insert: {
          DisplayName: string
          GroupName: string
          ImageUrl: string
          Levels: number
          TerritoryBadgeId: number
        }
        Update: {
          DisplayName?: string
          GroupName?: string
          ImageUrl?: string
          Levels?: number
          TerritoryBadgeId?: number
        }
        Relationships: []
      }
      ms_territory_badges_earned: {
        Row: {
          CurrentLevel: number
          Id: number
          TerritoryBadgeId: number
          TerritorySlug: string
        }
        Insert: {
          CurrentLevel: number
          Id: number
          TerritoryBadgeId: number
          TerritorySlug: string
        }
        Update: {
          CurrentLevel?: number
          Id?: number
          TerritoryBadgeId?: number
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_territory_badges_earned_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_badges_earned_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_badges_earned_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_badges_earned_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_badges_earned_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_territory_dashboard_links: {
        Row: {
          Name: string | null
          TerritorySlug: string
          Url: string | null
        }
        Insert: {
          Name?: string | null
          TerritorySlug: string
          Url?: string | null
        }
        Update: {
          Name?: string | null
          TerritorySlug?: string
          Url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_territory_dashboard_links_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_dashboard_links_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_dashboard_links_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_dashboard_links_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_dashboard_links_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_territory_inbox: {
        Row: {
          FormSubmissionId: number | null
          FormType: string | null
          From: string | null
          Inserted: string
          Message: string | null
          PropertyId: number | null
          TerritoryInboxId: number
          TerritorySlug: string | null
        }
        Insert: {
          FormSubmissionId?: number | null
          FormType?: string | null
          From?: string | null
          Inserted: string
          Message?: string | null
          PropertyId?: number | null
          TerritoryInboxId: number
          TerritorySlug?: string | null
        }
        Update: {
          FormSubmissionId?: number | null
          FormType?: string | null
          From?: string | null
          Inserted?: string
          Message?: string | null
          PropertyId?: number | null
          TerritoryInboxId?: number
          TerritorySlug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ms_territory_inbox_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_inbox_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_inbox_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_inbox_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_inbox_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_territory_variables: {
        Row: {
          InvRentalCapEx: number | null
          InvRentalHoa: number | null
          InvRentalInsurance: number | null
          InvRentalInterestRate: number | null
          InvRentalMaintenance: number | null
          InvRentalManagement: number | null
          InvRentalMaxLtvPercent: number | null
          InvRentalMisc: number | null
          InvRentalMowing: number | null
          InvRentalMowingMonthsPerYear: number | null
          InvRentalNoteTerm: number | null
          InvRentalPrevailingCapRate: number | null
          InvRentalPropertyTax: number | null
          InvRentalRentAsf: number | null
          InvRentalTargetRentAllIn: number | null
          InvRentalUtilities: number | null
          InvRentalVacancy: number | null
          LeadScoreIdealSquareFootage: number | null
          LeadScoreIdealSquareFootageHigh: number | null
          LeadScoreIdealSquareFootageLow: number | null
          LeadScoreIdealYearBuilt: number | null
          LeadScoreIdealYearBuiltHigh: number | null
          LeadScoreIdealYearBuiltLow: number | null
          PropertyId: number | null
          RoyaltyPaidAt: string | null
          RoyaltyVersion: number | null
          TerritorySlug: string
        }
        Insert: {
          InvRentalCapEx?: number | null
          InvRentalHoa?: number | null
          InvRentalInsurance?: number | null
          InvRentalInterestRate?: number | null
          InvRentalMaintenance?: number | null
          InvRentalManagement?: number | null
          InvRentalMaxLtvPercent?: number | null
          InvRentalMisc?: number | null
          InvRentalMowing?: number | null
          InvRentalMowingMonthsPerYear?: number | null
          InvRentalNoteTerm?: number | null
          InvRentalPrevailingCapRate?: number | null
          InvRentalPropertyTax?: number | null
          InvRentalRentAsf?: number | null
          InvRentalTargetRentAllIn?: number | null
          InvRentalUtilities?: number | null
          InvRentalVacancy?: number | null
          LeadScoreIdealSquareFootage?: number | null
          LeadScoreIdealSquareFootageHigh?: number | null
          LeadScoreIdealSquareFootageLow?: number | null
          LeadScoreIdealYearBuilt?: number | null
          LeadScoreIdealYearBuiltHigh?: number | null
          LeadScoreIdealYearBuiltLow?: number | null
          PropertyId?: number | null
          RoyaltyPaidAt?: string | null
          RoyaltyVersion?: number | null
          TerritorySlug: string
        }
        Update: {
          InvRentalCapEx?: number | null
          InvRentalHoa?: number | null
          InvRentalInsurance?: number | null
          InvRentalInterestRate?: number | null
          InvRentalMaintenance?: number | null
          InvRentalManagement?: number | null
          InvRentalMaxLtvPercent?: number | null
          InvRentalMisc?: number | null
          InvRentalMowing?: number | null
          InvRentalMowingMonthsPerYear?: number | null
          InvRentalNoteTerm?: number | null
          InvRentalPrevailingCapRate?: number | null
          InvRentalPropertyTax?: number | null
          InvRentalRentAsf?: number | null
          InvRentalTargetRentAllIn?: number | null
          InvRentalUtilities?: number | null
          InvRentalVacancy?: number | null
          LeadScoreIdealSquareFootage?: number | null
          LeadScoreIdealSquareFootageHigh?: number | null
          LeadScoreIdealSquareFootageLow?: number | null
          LeadScoreIdealYearBuilt?: number | null
          LeadScoreIdealYearBuiltHigh?: number | null
          LeadScoreIdealYearBuiltLow?: number | null
          PropertyId?: number | null
          RoyaltyPaidAt?: string | null
          RoyaltyVersion?: number | null
          TerritorySlug?: string
        }
        Relationships: [
          {
            foreignKeyName: "ms_territory_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_territory_variables_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_user_territories: {
        Row: {
          TerritorySlug: string
          UserId: number
        }
        Insert: {
          TerritorySlug: string
          UserId: number
        }
        Update: {
          TerritorySlug?: string
          UserId?: number
        }
        Relationships: [
          {
            foreignKeyName: "ms_user_territories_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_user_territories_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_user_territories_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_user_territories_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "ms_user_territories_TerritorySlug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      ms_zillow_home_value_forecast_county: {
        Row: {
          County: string
          ForecastYoYPctChange: number | null
          State: string
        }
        Insert: {
          County: string
          ForecastYoYPctChange?: number | null
          State: string
        }
        Update: {
          County?: string
          ForecastYoYPctChange?: number | null
          State?: string
        }
        Relationships: []
      }
      ms_zillow_home_value_forecast_zip: {
        Row: {
          ForecastYoYPctChange: number | null
          Zip: string
        }
        Insert: {
          ForecastYoYPctChange?: number | null
          Zip: string
        }
        Update: {
          ForecastYoYPctChange?: number | null
          Zip?: string
        }
        Relationships: []
      }
      ms_zillow_median_sales_price_county: {
        Row: {
          County: string
          MedianSalesPrice: number | null
          SizeRank: number | null
          State: string
        }
        Insert: {
          County: string
          MedianSalesPrice?: number | null
          SizeRank?: number | null
          State: string
        }
        Update: {
          County?: string
          MedianSalesPrice?: number | null
          SizeRank?: number | null
          State?: string
        }
        Relationships: []
      }
      ms_zillow_median_sales_price_zip: {
        Row: {
          MedianSalesPrice: number | null
          SizeRank: number | null
          Zip: string
        }
        Insert: {
          MedianSalesPrice?: number | null
          SizeRank?: number | null
          Zip: string
        }
        Update: {
          MedianSalesPrice?: number | null
          SizeRank?: number | null
          Zip?: string
        }
        Relationships: []
      }
      ms_zillow_sfh_time_series_county: {
        Row: {
          County: string
          HomeValueIndex: number | null
          SizeRank: number | null
          State: string
        }
        Insert: {
          County: string
          HomeValueIndex?: number | null
          SizeRank?: number | null
          State: string
        }
        Update: {
          County?: string
          HomeValueIndex?: number | null
          SizeRank?: number | null
          State?: string
        }
        Relationships: []
      }
      ms_zillow_sfh_time_series_zip: {
        Row: {
          HomeValueIndex: number | null
          SizeRank: number | null
          Zip: string
        }
        Insert: {
          HomeValueIndex?: number | null
          SizeRank?: number | null
          Zip: string
        }
        Update: {
          HomeValueIndex?: number | null
          SizeRank?: number | null
          Zip?: string
        }
        Relationships: []
      }
      ms_zip_code_avg_price_sqft: {
        Row: {
          LastUpdatedUtc: string | null
          PriceSqFt: number | null
          R1: number | null
          R1Count: number | null
          R1DaysOnMarket: number | null
          R1DaysOnMarketCount: number | null
          R1n: number | null
          R1nCount: number | null
          R1nDaysOnMarket: number | null
          R1nDaysOnMarketCount: number | null
          R2: number | null
          R2Count: number | null
          R2DaysOnMarket: number | null
          R2DaysOnMarketCount: number | null
          R2n: number | null
          R2nCount: number | null
          R2nDaysOnMarket: number | null
          R2nDaysOnMarketCount: number | null
          R3: number | null
          R3Count: number | null
          R3DaysOnMarket: number | null
          R3DaysOnMarketCount: number | null
          R3n: number | null
          R3nCount: number | null
          R3nDaysOnMarket: number | null
          R3nDaysOnMarketCount: number | null
          R4: number | null
          R4Count: number | null
          R4DaysOnMarket: number | null
          R4DaysOnMarketCount: number | null
          R4n: number | null
          R4nCount: number | null
          R4nDaysOnMarket: number | null
          R4nDaysOnMarketCount: number | null
          R5: number | null
          R5Count: number | null
          R5DaysOnMarket: number | null
          R5DaysOnMarketCount: number | null
          R5n: number | null
          R5nCount: number | null
          R5nDaysOnMarket: number | null
          R5nDaysOnMarketCount: number | null
          R6: number | null
          R6Count: number | null
          R6DaysOnMarket: number | null
          R6DaysOnMarketCount: number | null
          R6n: number | null
          R6nCount: number | null
          R6nDaysOnMarket: number | null
          R6nDaysOnMarketCount: number | null
          ZipCode: string
        }
        Insert: {
          LastUpdatedUtc?: string | null
          PriceSqFt?: number | null
          R1?: number | null
          R1Count?: number | null
          R1DaysOnMarket?: number | null
          R1DaysOnMarketCount?: number | null
          R1n?: number | null
          R1nCount?: number | null
          R1nDaysOnMarket?: number | null
          R1nDaysOnMarketCount?: number | null
          R2?: number | null
          R2Count?: number | null
          R2DaysOnMarket?: number | null
          R2DaysOnMarketCount?: number | null
          R2n?: number | null
          R2nCount?: number | null
          R2nDaysOnMarket?: number | null
          R2nDaysOnMarketCount?: number | null
          R3?: number | null
          R3Count?: number | null
          R3DaysOnMarket?: number | null
          R3DaysOnMarketCount?: number | null
          R3n?: number | null
          R3nCount?: number | null
          R3nDaysOnMarket?: number | null
          R3nDaysOnMarketCount?: number | null
          R4?: number | null
          R4Count?: number | null
          R4DaysOnMarket?: number | null
          R4DaysOnMarketCount?: number | null
          R4n?: number | null
          R4nCount?: number | null
          R4nDaysOnMarket?: number | null
          R4nDaysOnMarketCount?: number | null
          R5?: number | null
          R5Count?: number | null
          R5DaysOnMarket?: number | null
          R5DaysOnMarketCount?: number | null
          R5n?: number | null
          R5nCount?: number | null
          R5nDaysOnMarket?: number | null
          R5nDaysOnMarketCount?: number | null
          R6?: number | null
          R6Count?: number | null
          R6DaysOnMarket?: number | null
          R6DaysOnMarketCount?: number | null
          R6n?: number | null
          R6nCount?: number | null
          R6nDaysOnMarket?: number | null
          R6nDaysOnMarketCount?: number | null
          ZipCode: string
        }
        Update: {
          LastUpdatedUtc?: string | null
          PriceSqFt?: number | null
          R1?: number | null
          R1Count?: number | null
          R1DaysOnMarket?: number | null
          R1DaysOnMarketCount?: number | null
          R1n?: number | null
          R1nCount?: number | null
          R1nDaysOnMarket?: number | null
          R1nDaysOnMarketCount?: number | null
          R2?: number | null
          R2Count?: number | null
          R2DaysOnMarket?: number | null
          R2DaysOnMarketCount?: number | null
          R2n?: number | null
          R2nCount?: number | null
          R2nDaysOnMarket?: number | null
          R2nDaysOnMarketCount?: number | null
          R3?: number | null
          R3Count?: number | null
          R3DaysOnMarket?: number | null
          R3DaysOnMarketCount?: number | null
          R3n?: number | null
          R3nCount?: number | null
          R3nDaysOnMarket?: number | null
          R3nDaysOnMarketCount?: number | null
          R4?: number | null
          R4Count?: number | null
          R4DaysOnMarket?: number | null
          R4DaysOnMarketCount?: number | null
          R4n?: number | null
          R4nCount?: number | null
          R4nDaysOnMarket?: number | null
          R4nDaysOnMarketCount?: number | null
          R5?: number | null
          R5Count?: number | null
          R5DaysOnMarket?: number | null
          R5DaysOnMarketCount?: number | null
          R5n?: number | null
          R5nCount?: number | null
          R5nDaysOnMarket?: number | null
          R5nDaysOnMarketCount?: number | null
          R6?: number | null
          R6Count?: number | null
          R6DaysOnMarket?: number | null
          R6DaysOnMarketCount?: number | null
          R6n?: number | null
          R6nCount?: number | null
          R6nDaysOnMarket?: number | null
          R6nDaysOnMarketCount?: number | null
          ZipCode?: string
        }
        Relationships: []
      }
      ms_zip_code_locations: {
        Row: {
          City: string | null
          CountyName: string | null
          Metro: string | null
          State: string | null
          ZipCode: string
        }
        Insert: {
          City?: string | null
          CountyName?: string | null
          Metro?: string | null
          State?: string | null
          ZipCode: string
        }
        Update: {
          City?: string | null
          CountyName?: string | null
          Metro?: string | null
          State?: string | null
          ZipCode?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          recipient_user_id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["notification_source_type"]
          title: string | null
          type: string | null
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient_user_id: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["notification_source_type"]
          title?: string | null
          type?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient_user_id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["notification_source_type"]
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          call_log_id?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          objection_detail?: string | null
          objection_type: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          score_impact?: number | null
          stage_at_time: string
        }
        Update: {
          call_log_id?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          objection_detail?: string | null
          objection_type?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          score_impact?: number | null
          stage_at_time?: string
        }
        Relationships: []
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
          ghl_sync_enabled?: boolean
          ghl_sync_queue_alert_threshold?: number
          id?: number
          time_in_stage_red_days?: number
          time_in_stage_yellow_days?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          ghl_sync_enabled?: boolean
          ghl_sync_queue_alert_threshold?: number
          id?: number
          time_in_stage_red_days?: number
          time_in_stage_yellow_days?: number
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_app_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          from_stage_id?: string | null
          id?: string
          journey_pipeline_state_id: string
          moved_by_user_id?: string | null
          reason?: string | null
          to_stage_id: string
          was_auto?: boolean
          was_revert?: boolean
          was_skip?: boolean
        }
        Update: {
          created_at?: string
          from_stage_id?: string | null
          id?: string
          journey_pipeline_state_id?: string
          moved_by_user_id?: string | null
          reason?: string | null
          to_stage_id?: string
          was_auto?: boolean
          was_revert?: boolean
          was_skip?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_history_journey_pipeline_state_id_fkey"
            columns: ["journey_pipeline_state_id"]
            isOneToOne: false
            referencedRelation: "journey_pipeline_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_history_moved_by_user_id_fkey"
            columns: ["moved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
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
          auto_advance_enabled?: boolean
          auto_spawn_pipeline_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_terminal?: boolean
          name: string
          pipeline_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_advance_enabled?: boolean
          auto_spawn_pipeline_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_terminal?: boolean
          name?: string
          pipeline_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_auto_spawn_pipeline_id_fkey"
            columns: ["auto_spawn_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_sub_tasks: {
        Row: {
          created_at: string
          default_logger_type: Database["public"]["Enums"]["sub_task_logger_type"]
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
          state_type: Database["public"]["Enums"]["sub_task_state_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_logger_type?: Database["public"]["Enums"]["sub_task_logger_type"]
          default_logger_user_id?: string | null
          description?: string | null
          first_state_label?: string | null
          id?: string
          is_required?: boolean
          name: string
          second_state_label?: string | null
          slug: string
          sort_order?: number
          stage_id: string
          state_type?: Database["public"]["Enums"]["sub_task_state_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_logger_type?: Database["public"]["Enums"]["sub_task_logger_type"]
          default_logger_user_id?: string | null
          description?: string | null
          first_state_label?: string | null
          id?: string
          is_required?: boolean
          name?: string
          second_state_label?: string | null
          slug?: string
          sort_order?: number
          stage_id?: string
          state_type?: Database["public"]["Enums"]["sub_task_state_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_sub_tasks_default_logger_user_id_fkey"
            columns: ["default_logger_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_sub_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          description?: string | null
          entity_type?: string
          ghl_field_id?: string | null
          id?: string
          is_active?: boolean
          is_visible_in_nav?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: string
          ghl_field_id?: string | null
          id?: string
          is_active?: boolean
          is_visible_in_nav?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          call_type?: string | null
          classified_at?: string | null
          created_at?: string | null
          end_time?: string | null
          error_message?: string | null
          linked_call_id?: string | null
          owner_email?: string | null
          participant_emails?: string[] | null
          platform?: string | null
          processed_at?: string | null
          processing_status?: string | null
          raw_payload?: Json | null
          session_id: string
          start_time?: string | null
          title?: string | null
        }
        Update: {
          call_type?: string | null
          classified_at?: string | null
          created_at?: string | null
          end_time?: string | null
          error_message?: string | null
          linked_call_id?: string | null
          owner_email?: string | null
          participant_emails?: string[] | null
          platform?: string | null
          processed_at?: string | null
          processing_status?: string | null
          raw_payload?: Json | null
          session_id?: string
          start_time?: string | null
          title?: string | null
        }
        Relationships: []
      }
      read_ai_webhook_keys: {
        Row: {
          created_at: string | null
          signing_key: string
          user_email: string
        }
        Insert: {
          created_at?: string | null
          signing_key: string
          user_email: string
        }
        Update: {
          created_at?: string | null
          signing_key?: string
          user_email?: string
        }
        Relationships: []
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
          calls_completed?: number
          coaching_notes?: string | null
          contacts_touched?: number
          created_at?: string
          focus_tomorrow?: string | null
          ghl_actions_fired?: number
          id?: string
          journal_date: string
          sub_tasks_logged?: number
          summary: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          calls_completed?: number
          coaching_notes?: string | null
          contacts_touched?: number
          created_at?: string
          focus_tomorrow?: string | null
          ghl_actions_fired?: number
          id?: string
          journal_date?: string
          sub_tasks_logged?: number
          summary?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_journals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          description?: string | null
          example_phrases_negative?: string[] | null
          example_phrases_positive?: string[] | null
          id?: string
          kb_document_ids?: string[] | null
          name: string
          negative_examples?: string[] | null
          positive_examples?: string[] | null
          rubric_id: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          example_phrases_negative?: string[] | null
          example_phrases_positive?: string[] | null
          id?: string
          kb_document_ids?: string[] | null
          name?: string
          negative_examples?: string[] | null
          positive_examples?: string[] | null
          rubric_id?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
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
          created_at?: string
          criterion_id?: string | null
          criterion_name: string
          current_state?: Json | null
          id?: string
          issue_type: string
          review_month: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_change?: string | null
          supporting_data?: Json | null
        }
        Update: {
          created_at?: string
          criterion_id?: string | null
          criterion_name?: string
          current_state?: Json | null
          id?: string
          issue_type?: string
          review_month?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_change?: string | null
          supporting_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_review_suggestions_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_review_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          call_type_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          call_type_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_call_type_id_fkey"
            columns: ["call_type_id"]
            isOneToOne: false
            referencedRelation: "call_types"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_action_logs: {
        Row: {
          action_status: string
          action_type: string
          approval_source: string | null
          approved_by_user_id: string | null
          confirmed_at: string | null
          created_at: string | null
          draft_content: Json
          error_message: string | null
          executed_at: string | null
          final_content: Json | null
          ghl_contact_id: string | null
          ghl_response: Json | null
          id: string
          output_schema_version: string
          risk_tier: string | null
          safety_checks: Json
          session_id: string
          user_id: string
        }
        Insert: {
          action_status: string
          action_type: string
          approval_source?: string | null
          approved_by_user_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          draft_content: Json
          error_message?: string | null
          executed_at?: string | null
          final_content?: Json | null
          ghl_contact_id?: string | null
          ghl_response?: Json | null
          id?: string
          output_schema_version?: string
          risk_tier?: string | null
          safety_checks?: Json
          session_id: string
          user_id: string
        }
        Update: {
          action_status?: string
          action_type?: string
          approval_source?: string | null
          approved_by_user_id?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          draft_content?: Json
          error_message?: string | null
          executed_at?: string | null
          final_content?: Json | null
          ghl_contact_id?: string | null
          ghl_response?: Json | null
          id?: string
          output_schema_version?: string
          risk_tier?: string | null
          safety_checks?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_action_logs_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_action_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_action_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          acceptance_rate?: number | null
          action_type_breakdown?: Json | null
          created_at?: string
          edit_rate?: number | null
          id?: string
          kb_gap_signals?: Json | null
          kb_retrieval_count?: number
          most_edited_fields?: Json | null
          rejection_rate?: number | null
          rep_breakdown?: Json | null
          top_rejected_types?: Json | null
          total_suggestions?: number
          week_end: string
          week_start: string
        }
        Update: {
          acceptance_rate?: number | null
          action_type_breakdown?: Json | null
          created_at?: string
          edit_rate?: number | null
          id?: string
          kb_gap_signals?: Json | null
          kb_retrieval_count?: number
          most_edited_fields?: Json | null
          rejection_rate?: number | null
          rep_breakdown?: Json | null
          top_rejected_types?: Json | null
          total_suggestions?: number
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      scout_retrieval_logs: {
        Row: {
          chunks_retrieved: number
          created_at: string
          id: string
          latency_ms: number | null
          prefetch_chunks: Json | null
          question_type: string
          session_id: string | null
          token_budget: number
          tool_retrieval_chunks: Json | null
          user_id: string | null
          user_message: string | null
        }
        Insert: {
          chunks_retrieved?: number
          created_at?: string
          id?: string
          latency_ms?: number | null
          prefetch_chunks?: Json | null
          question_type?: string
          session_id?: string | null
          token_budget?: number
          tool_retrieval_chunks?: Json | null
          user_id?: string | null
          user_message?: string | null
        }
        Update: {
          chunks_retrieved?: number
          created_at?: string
          id?: string
          latency_ms?: number | null
          prefetch_chunks?: Json | null
          question_type?: string
          session_id?: string | null
          token_budget?: number
          tool_retrieval_chunks?: Json | null
          user_id?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_retrieval_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_user_memory: {
        Row: {
          content: string
          turn_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          turn_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          turn_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scout_user_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          context_summary?: string | null
          conversation_history?: Json | null
          ended_at?: string | null
          ghl_contact_focus?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          context_summary?: string | null
          conversation_history?: Json | null
          ended_at?: string | null
          ghl_contact_focus?: string | null
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_conversation_reads: {
        Row: {
          conversation_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          conversation_key: string
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversation_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string | null
          carrier: string | null
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          failed_at: string | null
          from_number: string | null
          ghl_contact_id: string | null
          id: string
          message_type: string
          owner_user_id: string | null
          provider: string
          provider_message_id: string
          raw_payload: Json
          read_at: string | null
          received_at: string | null
          segment_count: number | null
          sent_at: string | null
          status: string | null
          to_number: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          carrier?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          failed_at?: string | null
          from_number?: string | null
          ghl_contact_id?: string | null
          id?: string
          message_type?: string
          owner_user_id?: string | null
          provider?: string
          provider_message_id: string
          raw_payload?: Json
          read_at?: string | null
          received_at?: string | null
          segment_count?: number | null
          sent_at?: string | null
          status?: string | null
          to_number?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          carrier?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          failed_at?: string | null
          from_number?: string | null
          ghl_contact_id?: string | null
          id?: string
          message_type?: string
          owner_user_id?: string | null
          provider?: string
          provider_message_id?: string
          raw_payload?: Json
          read_at?: string | null
          received_at?: string | null
          segment_count?: number | null
          sent_at?: string | null
          status?: string | null
          to_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          TerritorySlug: string | null
        }
        Insert: {
          accepted_value?: Json | null
          call_id?: string | null
          call_type?: string | null
          confidence?: string | null
          contact_id?: string | null
          created_at?: string
          edit_delta?: Json | null
          field_name?: string | null
          final_value?: string | null
          id?: string
          original_value?: Json | null
          outcome: string
          pipeline_stage?: string | null
          rep_id: string
          resolved_at?: string | null
          reviewer_id?: string | null
          suggested_value?: string | null
          suggestion_id?: string | null
          suggestion_type: string
          TerritorySlug?: string | null
        }
        Update: {
          accepted_value?: Json | null
          call_id?: string | null
          call_type?: string | null
          confidence?: string | null
          contact_id?: string | null
          created_at?: string
          edit_delta?: Json | null
          field_name?: string | null
          final_value?: string | null
          id?: string
          original_value?: Json | null
          outcome?: string
          pipeline_stage?: string | null
          rep_id?: string
          resolved_at?: string | null
          reviewer_id?: string | null
          suggested_value?: string | null
          suggestion_id?: string | null
          suggestion_type?: string
          TerritorySlug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_feedback_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_feedback_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_feedback_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      sync_watermarks: {
        Row: {
          created_at: string
          last_attempt_at: string | null
          last_attempt_cursor: string | null
          last_success_at: string | null
          last_success_cursor: string | null
          metadata: Json
          stream_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_attempt_at?: string | null
          last_attempt_cursor?: string | null
          last_success_at?: string | null
          last_success_cursor?: string | null
          metadata?: Json
          stream_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_attempt_at?: string | null
          last_attempt_cursor?: string | null
          last_success_at?: string | null
          last_success_cursor?: string | null
          metadata?: Json
          stream_name?: string
          updated_at?: string
        }
        Relationships: []
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
          action_type: string
          contact_id?: string | null
          created_at?: string
          id?: string
          input_params?: Json | null
          log_date?: string
          result_summary?: string | null
          tenant_id?: string | null
          user_id?: string | null
          was_auto?: boolean
        }
        Update: {
          action_type?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          input_params?: Json | null
          log_date?: string
          result_summary?: string | null
          tenant_id?: string | null
          user_id?: string | null
          was_auto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_ghl_user_id: string | null
          assigned_to_user_id: string | null
          body: string | null
          completed: boolean
          completed_at: string | null
          contact_id: string | null
          created_at: string
          due_date: string | null
          ghl_contact_id: string | null
          ghl_synced_at: string | null
          ghl_task_id: string | null
          id: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_ghl_user_id?: string | null
          assigned_to_user_id?: string | null
          body?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          ghl_contact_id?: string | null
          ghl_synced_at?: string | null
          ghl_task_id?: string | null
          id?: string
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_ghl_user_id?: string | null
          assigned_to_user_id?: string | null
          body?: string | null
          completed?: boolean
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          ghl_contact_id?: string | null
          ghl_synced_at?: string | null
          ghl_task_id?: string | null
          id?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      territories: {
        Row: {
          Broker: string | null
          ComplianceScore: number | null
          ComplianceScoreManualDescription: string | null
          created_at: string
          ct_email: string | null
          ct_id: string | null
          DocumentUrlBusinessLicense: string | null
          DocumentUrlCOILiabilityInsurance: string | null
          DocumentUrlCOIOther: string | null
          DocumentUrlCOIProfessionalLiability: string | null
          DocumentUrlFranchiseAgreement: string | null
          DocumentUrlOther: string | null
          DocumentUrlOther2: string | null
          DocumentUrlRealEstateLicense: string | null
          EmergencyContact: string | null
          ExcludeFromGlobalCalculations: boolean
          FirstPurchaseDate: string | null
          FranchiseAgreementDate: string | null
          FranchiseClosedDate: string | null
          FranchiseEmail: string | null
          FullTimeOperator: boolean
          ghl_contact_id: string | null
          GoHighLevelLocationId: string | null
          GoogleLicense1Account: string | null
          GoogleLicense1Active: boolean
          GoogleLicense2Account: string | null
          GoogleLicense2Active: boolean
          GoogleLicense3Account: string | null
          GoogleLicense3Active: boolean
          GoogleLicense4Account: string | null
          GoogleLicense4Active: boolean
          InitialApplicationDate: string | null
          IsFranchise: boolean
          IsFullTime: boolean
          LegalEntityName: string | null
          LicenseeBroker: string | null
          LicenseeBrokerNumber: string | null
          MarketingCallCenterForwardingNumber: string | null
          MarketingEmailAddress: string | null
          MarketingFacebookPage: string | null
          MarketingInstagramProfile: string | null
          MarketingLeadGenPhoneNumber: string | null
          MarketingName: string | null
          MarketingPhoneNumber: string | null
          MarketingReturnAddress: string | null
          ms_synced_at: string | null
          NahCity: string | null
          NahState: string | null
          NahZip: string | null
          NexaAccount: string | null
          NexaActive: boolean
          Nickname: string
          Notes: string | null
          Owner2: string | null
          Owner3: string | null
          PersonalName: string | null
          PersonalPhoneNumber: string | null
          PrimaryCoach: string | null
          RealEstateLicensee: string | null
          region: string | null
          status: string
          StreetAddress: string | null
          TerritoryId: number | null
          TerritorySlug: string
          TrainingCompleteDate: string | null
          updated_at: string
          Vonage1Account: string | null
          Vonage1Active: boolean
          Vonage2Account: string | null
          Vonage2Active: boolean
        }
        Insert: {
          Broker?: string | null
          ComplianceScore?: number | null
          ComplianceScoreManualDescription?: string | null
          created_at?: string
          ct_email?: string | null
          ct_id?: string | null
          DocumentUrlBusinessLicense?: string | null
          DocumentUrlCOILiabilityInsurance?: string | null
          DocumentUrlCOIOther?: string | null
          DocumentUrlCOIProfessionalLiability?: string | null
          DocumentUrlFranchiseAgreement?: string | null
          DocumentUrlOther?: string | null
          DocumentUrlOther2?: string | null
          DocumentUrlRealEstateLicense?: string | null
          EmergencyContact?: string | null
          ExcludeFromGlobalCalculations?: boolean
          FirstPurchaseDate?: string | null
          FranchiseAgreementDate?: string | null
          FranchiseClosedDate?: string | null
          FranchiseEmail?: string | null
          FullTimeOperator?: boolean
          ghl_contact_id?: string | null
          GoHighLevelLocationId?: string | null
          GoogleLicense1Account?: string | null
          GoogleLicense1Active?: boolean
          GoogleLicense2Account?: string | null
          GoogleLicense2Active?: boolean
          GoogleLicense3Account?: string | null
          GoogleLicense3Active?: boolean
          GoogleLicense4Account?: string | null
          GoogleLicense4Active?: boolean
          InitialApplicationDate?: string | null
          IsFranchise?: boolean
          IsFullTime?: boolean
          LegalEntityName?: string | null
          LicenseeBroker?: string | null
          LicenseeBrokerNumber?: string | null
          MarketingCallCenterForwardingNumber?: string | null
          MarketingEmailAddress?: string | null
          MarketingFacebookPage?: string | null
          MarketingInstagramProfile?: string | null
          MarketingLeadGenPhoneNumber?: string | null
          MarketingName?: string | null
          MarketingPhoneNumber?: string | null
          MarketingReturnAddress?: string | null
          ms_synced_at?: string | null
          NahCity?: string | null
          NahState?: string | null
          NahZip?: string | null
          NexaAccount?: string | null
          NexaActive?: boolean
          Nickname: string
          Notes?: string | null
          Owner2?: string | null
          Owner3?: string | null
          PersonalName?: string | null
          PersonalPhoneNumber?: string | null
          PrimaryCoach?: string | null
          RealEstateLicensee?: string | null
          region?: string | null
          status?: string
          StreetAddress?: string | null
          TerritoryId?: number | null
          TerritorySlug: string
          TrainingCompleteDate?: string | null
          updated_at?: string
          Vonage1Account?: string | null
          Vonage1Active?: boolean
          Vonage2Account?: string | null
          Vonage2Active?: boolean
        }
        Update: {
          Broker?: string | null
          ComplianceScore?: number | null
          ComplianceScoreManualDescription?: string | null
          created_at?: string
          ct_email?: string | null
          ct_id?: string | null
          DocumentUrlBusinessLicense?: string | null
          DocumentUrlCOILiabilityInsurance?: string | null
          DocumentUrlCOIOther?: string | null
          DocumentUrlCOIProfessionalLiability?: string | null
          DocumentUrlFranchiseAgreement?: string | null
          DocumentUrlOther?: string | null
          DocumentUrlOther2?: string | null
          DocumentUrlRealEstateLicense?: string | null
          EmergencyContact?: string | null
          ExcludeFromGlobalCalculations?: boolean
          FirstPurchaseDate?: string | null
          FranchiseAgreementDate?: string | null
          FranchiseClosedDate?: string | null
          FranchiseEmail?: string | null
          FullTimeOperator?: boolean
          ghl_contact_id?: string | null
          GoHighLevelLocationId?: string | null
          GoogleLicense1Account?: string | null
          GoogleLicense1Active?: boolean
          GoogleLicense2Account?: string | null
          GoogleLicense2Active?: boolean
          GoogleLicense3Account?: string | null
          GoogleLicense3Active?: boolean
          GoogleLicense4Account?: string | null
          GoogleLicense4Active?: boolean
          InitialApplicationDate?: string | null
          IsFranchise?: boolean
          IsFullTime?: boolean
          LegalEntityName?: string | null
          LicenseeBroker?: string | null
          LicenseeBrokerNumber?: string | null
          MarketingCallCenterForwardingNumber?: string | null
          MarketingEmailAddress?: string | null
          MarketingFacebookPage?: string | null
          MarketingInstagramProfile?: string | null
          MarketingLeadGenPhoneNumber?: string | null
          MarketingName?: string | null
          MarketingPhoneNumber?: string | null
          MarketingReturnAddress?: string | null
          ms_synced_at?: string | null
          NahCity?: string | null
          NahState?: string | null
          NahZip?: string | null
          NexaAccount?: string | null
          NexaActive?: boolean
          Nickname?: string
          Notes?: string | null
          Owner2?: string | null
          Owner3?: string | null
          PersonalName?: string | null
          PersonalPhoneNumber?: string | null
          PrimaryCoach?: string | null
          RealEstateLicensee?: string | null
          region?: string | null
          status?: string
          StreetAddress?: string | null
          TerritoryId?: number | null
          TerritorySlug?: string
          TrainingCompleteDate?: string | null
          updated_at?: string
          Vonage1Account?: string | null
          Vonage1Active?: boolean
          Vonage2Account?: string | null
          Vonage2Active?: boolean
        }
        Relationships: []
      }
      territory_briefs: {
        Row: {
          brief: Json
          created_at: string
          stale: boolean
          summary: string | null
          territory_slug: string
          updated_at: string
        }
        Insert: {
          brief?: Json
          created_at?: string
          stale?: boolean
          summary?: string | null
          territory_slug: string
          updated_at?: string
        }
        Update: {
          brief?: Json
          created_at?: string
          stale?: boolean
          summary?: string | null
          territory_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      territory_candidates: {
        Row: {
          created_at: string
          ghl_contact_id: string
          id: string
          status: string
          TerritorySlug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ghl_contact_id: string
          id?: string
          status?: string
          TerritorySlug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ghl_contact_id?: string
          id?: string
          status?: string
          TerritorySlug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_candidates_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      territory_grades: {
        Row: {
          created_at: string
          houses_purchased: number | null
          id: string
          john_grade: number | null
          notes: string | null
          quarter: number
          self_grade: number | null
          TerritorySlug: string
          year: number
        }
        Insert: {
          created_at?: string
          houses_purchased?: number | null
          id?: string
          john_grade?: number | null
          notes?: string | null
          quarter: number
          self_grade?: number | null
          TerritorySlug: string
          year: number
        }
        Update: {
          created_at?: string
          houses_purchased?: number | null
          id?: string
          john_grade?: number | null
          notes?: string | null
          quarter?: number
          self_grade?: number | null
          TerritorySlug?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "territory_grades_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      territory_market_data: {
        Row: {
          field_name: string
          field_value: string | null
          id: string
          source: string | null
          source_date: string | null
          TerritorySlug: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          field_name: string
          field_value?: string | null
          id?: string
          source?: string | null
          source_date?: string | null
          TerritorySlug: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          field_name?: string
          field_value?: string | null
          id?: string
          source?: string | null
          source_date?: string | null
          TerritorySlug?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_market_data_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_owners: {
        Row: {
          contact_id: string | null
          created_at: string
          end_date: string | null
          ghl_contact_id: string | null
          id: string
          role: string
          start_date: string
          TerritorySlug: string
          transfer_notes: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          end_date?: string | null
          ghl_contact_id?: string | null
          id?: string
          role?: string
          start_date?: string
          TerritorySlug: string
          transfer_notes?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          end_date?: string | null
          ghl_contact_id?: string | null
          id?: string
          role?: string
          start_date?: string
          TerritorySlug?: string
          transfer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_owners_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
      territory_profile: {
        Row: {
          coaching_notes: string | null
          competitor_presence: string | null
          created_at: string
          flip_activity_score: number | null
          last_checkin_date: string | null
          local_market_notes: string | null
          market_type: string | null
          stage3_pct: number | null
          stage5_pct: number | null
          territory_value_est: number | null
          TerritorySlug: string
          updated_at: string
        }
        Insert: {
          coaching_notes?: string | null
          competitor_presence?: string | null
          created_at?: string
          flip_activity_score?: number | null
          last_checkin_date?: string | null
          local_market_notes?: string | null
          market_type?: string | null
          stage3_pct?: number | null
          stage5_pct?: number | null
          territory_value_est?: number | null
          TerritorySlug: string
          updated_at?: string
        }
        Update: {
          coaching_notes?: string | null
          competitor_presence?: string | null
          created_at?: string
          flip_activity_score?: number | null
          last_checkin_date?: string | null
          local_market_notes?: string | null
          market_type?: string | null
          stage3_pct?: number | null
          stage5_pct?: number | null
          territory_value_est?: number | null
          TerritorySlug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_profile_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: true
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
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
          notes: string | null
          phone: string | null
          role: string
          TerritorySlug: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          role?: string
          TerritorySlug: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          role?: string
          TerritorySlug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_stakeholders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
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
          attempts?: number
          audio_url: string
          call_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          transcript_id?: string | null
        }
        Update: {
          attempts?: number
          audio_url?: string
          call_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          transcript_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcript_jobs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_aliases: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_aliases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          memory_key: string
          memory_type: string
          memory_value: string
          source: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          memory_key?: string
          memory_type?: string
          memory_value?: string
          source?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          assigned_signalhouse_number: string | null
          created_at: string | null
          email: string
          full_name: string
          ghl_user_id: string | null
          id: string
          is_active: boolean | null
          is_real_user: boolean
          label_color: string | null
          last_login_at: string | null
          ms_user_id: number | null
          role: string
          signalhouse_phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_signalhouse_number?: string | null
          created_at?: string | null
          email: string
          full_name: string
          ghl_user_id?: string | null
          id?: string
          is_active?: boolean | null
          is_real_user?: boolean
          label_color?: string | null
          last_login_at?: string | null
          ms_user_id?: number | null
          role: string
          signalhouse_phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_signalhouse_number?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          ghl_user_id?: string | null
          id?: string
          is_active?: boolean | null
          is_real_user?: boolean
          label_color?: string | null
          last_login_at?: string | null
          ms_user_id?: number | null
          role?: string
          signalhouse_phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      work_queue_items: {
        Row: {
          assigned_user_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          ghl_contact_id: string | null
          id: string
          last_seen_at: string
          priority: string
          source_id: string
          source_payload: Json
          source_table: string
          source_type: string
          stale_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          ghl_contact_id?: string | null
          id?: string
          last_seen_at?: string
          priority?: string
          source_id: string
          source_payload?: Json
          source_table: string
          source_type: string
          stale_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          ghl_contact_id?: string | null
          id?: string
          last_seen_at?: string
          priority?: string
          source_id?: string
          source_payload?: Json
          source_table?: string
          source_type?: string
          stale_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_queue_items_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_queue_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          declared_by?: string | null
          id?: string
          min_sample_size?: number | null
          status?: string
          test_type: string
          variant_a_count?: number | null
          variant_a_metric?: number | null
          variant_a_step_id?: string | null
          variant_a_version_id?: string | null
          variant_b_count?: number | null
          variant_b_metric?: number | null
          variant_b_step_id?: string | null
          variant_b_version_id?: string | null
          winner?: string | null
          winner_explanation?: string | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          declared_by?: string | null
          id?: string
          min_sample_size?: number | null
          status?: string
          test_type?: string
          variant_a_count?: number | null
          variant_a_metric?: number | null
          variant_a_step_id?: string | null
          variant_a_version_id?: string | null
          variant_b_count?: number | null
          variant_b_metric?: number | null
          variant_b_step_id?: string | null
          variant_b_version_id?: string | null
          winner?: string | null
          winner_explanation?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_ab_tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ab_tests_declared_by_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_a_step_id_fkey"
            columns: ["variant_a_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_a_version_id_fkey"
            columns: ["variant_a_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_b_step_id_fkey"
            columns: ["variant_b_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_b_version_id_fkey"
            columns: ["variant_b_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_ab_tests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
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
          ab_test_id?: string | null
          approval_type: string
          approved_by?: string | null
          id?: string
          notes?: string | null
          resolved_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by: string
          workflow_id: string
          workflow_version_id?: string | null
        }
        Update: {
          ab_test_id?: string | null
          approval_type?: string
          approved_by?: string | null
          id?: string
          notes?: string | null
          resolved_at?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          workflow_id?: string
          workflow_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "workflow_ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_workflow_version_id_fkey"
            columns: ["workflow_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
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
          completed_at?: string | null
          contact_name?: string | null
          current_day?: number | null
          current_step_id?: string | null
          enrolled_at?: string | null
          exit_reason?: string | null
          ghl_contact_id: string
          goal_achieved?: boolean | null
          id?: string
          last_step_at?: string | null
          paused_at?: string | null
          status?: string
          workflow_id: string
          workflow_version_id: string
        }
        Update: {
          completed_at?: string | null
          contact_name?: string | null
          current_day?: number | null
          current_step_id?: string | null
          enrolled_at?: string | null
          exit_reason?: string | null
          ghl_contact_id?: string
          goal_achieved?: boolean | null
          id?: string
          last_step_at?: string | null
          paused_at?: string | null
          status?: string
          workflow_id?: string
          workflow_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_enrollments_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_enrollments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_enrollments_workflow_version_id_fkey"
            columns: ["workflow_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
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
          clicked?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          content_sent?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivery_data?: Json | null
          enrollment_id: string
          executed_at?: string | null
          ghl_contact_id: string
          ghl_message_id?: string | null
          id?: string
          opened?: boolean | null
          responded?: boolean | null
          step_id: string
          step_type: string
        }
        Update: {
          clicked?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          content_sent?: string | null
          created_at?: string | null
          delivered?: boolean | null
          delivery_data?: Json | null
          enrollment_id?: string
          executed_at?: string | null
          ghl_contact_id?: string
          ghl_message_id?: string | null
          id?: string
          opened?: boolean | null
          responded?: boolean | null
          step_id?: string
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_logs_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_step_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "workflow_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_step_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
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
          click_rate?: number | null
          condition_config?: Json | null
          content?: string | null
          created_at?: string | null
          day_number: number
          id?: string
          open_rate?: number | null
          performance_status?: string | null
          requires_confirmation?: boolean | null
          response_rate?: number | null
          send_time?: string | null
          step_number: number
          step_type: string
          subject?: string | null
          workflow_version_id: string
        }
        Update: {
          click_rate?: number | null
          condition_config?: Json | null
          content?: string | null
          created_at?: string | null
          day_number?: number
          id?: string
          open_rate?: number | null
          performance_status?: string | null
          requires_confirmation?: boolean | null
          response_rate?: number | null
          send_time?: string | null
          step_number?: number
          step_type?: string
          subject?: string | null
          workflow_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_version_id_fkey"
            columns: ["workflow_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
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
          approved_at?: string | null
          approved_by?: string | null
          change_description?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          update_mode?: string | null
          version_number: number
          workflow_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_description?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          update_mode?: string | null
          version_number?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
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
          active_enrollee_count?: number | null
          created_at?: string | null
          created_by: string
          current_version_id?: string | null
          description?: string | null
          exit_conditions?: Json | null
          health_score?: string | null
          id?: string
          name: string
          pause_conditions?: Json | null
          primary_metric_name?: string | null
          primary_metric_value?: number | null
          status?: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
          workflow_type: string
        }
        Update: {
          active_enrollee_count?: number | null
          created_at?: string | null
          created_by?: string
          current_version_id?: string | null
          description?: string | null
          exit_conditions?: Json | null
          health_score?: string | null
          id?: string
          name?: string
          pause_conditions?: Json | null
          primary_metric_name?: string | null
          primary_metric_value?: number | null
          status?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workflows_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          sales_score: number | null
          spoton_drive_id: string | null
          stages_score: number | null
          TerritorySlug: string | null
          values_score: number | null
          values_type: string | null
          work_style: string | null
        }
        Insert: {
          batch?: string | null
          biz_path_score?: number | null
          contact_id?: string | null
          created_at?: string
          cultural_score?: number | null
          culture?: string | null
          eclipse_drive_id?: string | null
          eclipse_overall?: number | null
          full_name: string
          id?: string
          sales_score?: number | null
          spoton_drive_id?: string | null
          stages_score?: number | null
          TerritorySlug?: string | null
          values_score?: number | null
          values_type?: string | null
          work_style?: string | null
        }
        Update: {
          batch?: string | null
          biz_path_score?: number | null
          contact_id?: string | null
          created_at?: string
          cultural_score?: number | null
          culture?: string | null
          eclipse_drive_id?: string | null
          eclipse_overall?: number | null
          full_name?: string
          id?: string
          sales_score?: number | null
          spoton_drive_id?: string | null
          stages_score?: number | null
          TerritorySlug?: string | null
          values_score?: number | null
          values_type?: string | null
          work_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zorakle_assessments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
          risk_flag: string | null
          sales_score: number | null
          spoton_drive_id: string | null
          stages_score: number | null
          TerritorySlug: string | null
          values_score: number | null
          values_type: string | null
          work_style: string | null
        }
        Insert: {
          batch?: string | null
          biz_path_score?: number | null
          created_at?: string
          cultural_score?: number | null
          culture?: string | null
          eclipse_drive_id?: string | null
          eclipse_overall?: number | null
          fit_score?: number | null
          full_name: string
          id?: string
          risk_flag?: string | null
          sales_score?: number | null
          spoton_drive_id?: string | null
          stages_score?: number | null
          TerritorySlug?: string | null
          values_score?: number | null
          values_type?: string | null
          work_style?: string | null
        }
        Update: {
          batch?: string | null
          biz_path_score?: number | null
          created_at?: string
          cultural_score?: number | null
          culture?: string | null
          eclipse_drive_id?: string | null
          eclipse_overall?: number | null
          fit_score?: number | null
          full_name?: string
          id?: string
          risk_flag?: string | null
          sales_score?: number | null
          spoton_drive_id?: string | null
          stages_score?: number | null
          TerritorySlug?: string | null
          values_score?: number | null
          values_type?: string | null
          work_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "contact_territory_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "current_territory_owners"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_ownership_history"
            referencedColumns: ["TerritorySlug"]
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey"
            columns: ["TerritorySlug"]
            isOneToOne: false
            referencedRelation: "territory_performance"
            referencedColumns: ["TerritorySlug"]
          },
        ]
      }
    }
    Views: {
      contact_territory_history: {
        Row: {
          contact_name: string | null
          end_date: string | null
          ghl_contact_id: string | null
          is_current: boolean | null
          Nickname: string | null
          role: string | null
          start_date: string | null
          TerritorySlug: string | null
          transfer_notes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
      }
      current_territory_owners: {
        Row: {
          email: string | null
          first_name: string | null
          ghl_contact_id: string | null
          last_name: string | null
          Nickname: string | null
          owner_record_id: string | null
          phone: string | null
          region: string | null
          role: string | null
          start_date: string | null
          territory_status: string | null
          TerritorySlug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
      }
      territory_ownership_history: {
        Row: {
          days_owned: number | null
          end_date: string | null
          ghl_contact_id: string | null
          Nickname: string | null
          owner_name: string | null
          role: string | null
          start_date: string | null
          TerritorySlug: string | null
          transfer_notes: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey"
            columns: ["ghl_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
      }
      territory_performance: {
        Row: {
          current_owner_contact_id: string | null
          current_owner_name: string | null
          Nickname: string | null
          status: string | null
          TerritorySlug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey"
            columns: ["current_owner_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["ghl_contact_id"]
          },
        ]
      }
    }
    Functions: {
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_operator: { Args: never; Returns: boolean }
      match_embeddings: {
        Args: {
          contact_id_filter?: string
          content_type_filter?: string
          match_limit?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          contact_id: string
          content: string
          content_type: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      search_contacts_fuzzy: {
        Args: {
          max_results?: number
          search_query: string
          similarity_threshold?: number
        }
        Returns: {
          city: string
          email: string
          first_name: string
          ghl_contact_id: string
          id: string
          last_name: string
          NonRetirementCapitalAvailable: string
          opportunity_source: string
          phone: string
          scout_lead_score: number
          similarity_score: number
          state: string
          territory_interest: string
        }[]
      }
      search_embeddings_bm25: {
        Args: {
          contact_id_filter?: string
          content_type_filter?: string
          match_limit?: number
          search_query: string
        }
        Returns: {
          contact_id: string
          content: string
          content_type: string
          id: string
          metadata: Json
          rank: number
        }[]
      }
      seed_eos_territory: { Args: { p_slug: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      cron_job_status: "running" | "success" | "failed"
      ghl_sync_status: "pending" | "success" | "failed"
      log_content_type:
        | "note"
        | "file"
        | "link"
        | "transcript"
        | "appointment"
        | "email"
        | "sms"
        | "call"
      log_source: "manual" | "api" | "ai"
      log_state_advance: "first" | "second"
      notification_source_type: "activity_mention"
      pipeline_close_reason:
        | "won"
        | "dropped_to_followup"
        | "dropped_to_nurture"
        | "split"
      sub_task_logger_type: "user" | "api" | "ai" | "null"
      sub_task_state_type: "single" | "two_state"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cron_job_status: ["running", "success", "failed"],
      ghl_sync_status: ["pending", "success", "failed"],
      log_content_type: [
        "note",
        "file",
        "link",
        "transcript",
        "appointment",
        "email",
        "sms",
        "call",
      ],
      log_source: ["manual", "api", "ai"],
      log_state_advance: ["first", "second"],
      notification_source_type: ["activity_mention"],
      pipeline_close_reason: [
        "won",
        "dropped_to_followup",
        "dropped_to_nurture",
        "split",
      ],
      sub_task_logger_type: ["user", "api", "ai", "null"],
      sub_task_state_type: ["single", "two_state"],
    },
  },
} as const
