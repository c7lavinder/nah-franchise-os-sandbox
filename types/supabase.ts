/**
 * AUTO-GENERATED — do not edit manually.
 * Regenerate: npx supabase gen types typescript --project-id llnrvophuvrqcqducgrr > types/supabase.ts
 * Generated: 2026-04-30
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          is_encrypted: boolean | null;
          setting_key: string;
          setting_value: Json;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_encrypted?: boolean | null;
          setting_key: string;
          setting_value: Json;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          is_encrypted?: boolean | null;
          setting_key?: string;
          setting_value?: Json;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      call_action_feedback: {
        Row: {
          action: string;
          call_action_item_id: string | null;
          created_at: string;
          edit_diff: string | null;
          extraction_id: string | null;
          id: string;
          payload: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          call_action_item_id?: string | null;
          created_at?: string;
          edit_diff?: string | null;
          extraction_id?: string | null;
          id?: string;
          payload?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          call_action_item_id?: string | null;
          created_at?: string;
          edit_diff?: string | null;
          extraction_id?: string | null;
          id?: string;
          payload?: Json | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_action_feedback_call_action_item_id_fkey";
            columns: ["call_action_item_id"];
            isOneToOne: false;
            referencedRelation: "call_action_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_action_feedback_extraction_id_fkey";
            columns: ["extraction_id"];
            isOneToOne: false;
            referencedRelation: "call_data_extractions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_action_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      call_action_items: {
        Row: {
          assigned_to_name: string | null;
          call_id: string;
          category: string;
          contact_id: string | null;
          contact_name: string | null;
          created_at: string;
          description: string | null;
          ghl_action: boolean;
          id: string;
          journey_id: string | null;
          metadata: Json | null;
          original_description: string | null;
          original_title: string | null;
          pushed_at: string | null;
          skipped_at: string | null;
          source: string;
          status: string;
          title: string;
          updated_at: string;
          why: string | null;
        };
        Insert: {
          assigned_to_name?: string | null;
          call_id: string;
          category: string;
          contact_id?: string | null;
          contact_name?: string | null;
          created_at?: string;
          description?: string | null;
          ghl_action?: boolean;
          id?: string;
          journey_id?: string | null;
          metadata?: Json | null;
          original_description?: string | null;
          original_title?: string | null;
          pushed_at?: string | null;
          skipped_at?: string | null;
          source?: string;
          status?: string;
          title: string;
          updated_at?: string;
          why?: string | null;
        };
        Update: {
          assigned_to_name?: string | null;
          call_id?: string;
          category?: string;
          contact_id?: string | null;
          contact_name?: string | null;
          created_at?: string;
          description?: string | null;
          ghl_action?: boolean;
          id?: string;
          journey_id?: string | null;
          metadata?: Json | null;
          original_description?: string | null;
          original_title?: string | null;
          pushed_at?: string | null;
          skipped_at?: string | null;
          source?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          why?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_action_items_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_action_items_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_action_items_journey_id_fkey";
            columns: ["journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
        ];
      };
      call_coaching: {
        Row: {
          call_id: string;
          coaching_notes: string | null;
          coaching_plan: string | null;
          created_at: string;
          created_by: string;
          id: string;
          kb_snippets_used: string[] | null;
          scout_model: string | null;
        };
        Insert: {
          call_id: string;
          coaching_notes?: string | null;
          coaching_plan?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          kb_snippets_used?: string[] | null;
          scout_model?: string | null;
        };
        Update: {
          call_id?: string;
          coaching_notes?: string | null;
          coaching_plan?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          kb_snippets_used?: string[] | null;
          scout_model?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_coaching_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      call_data_extractions: {
        Row: {
          call_id: string;
          confidence: string | null;
          contact_id: string | null;
          created_at: string;
          dismissed: boolean;
          extracted_value: string | null;
          field_category: string;
          field_key: string;
          id: string;
          journey_id: string | null;
          saved_to_profile: boolean;
          source: string;
          target_scope: string | null;
          territory_ms_slug: string | null;
        };
        Insert: {
          call_id: string;
          confidence?: string | null;
          contact_id?: string | null;
          created_at?: string;
          dismissed?: boolean;
          extracted_value?: string | null;
          field_category: string;
          field_key: string;
          id?: string;
          journey_id?: string | null;
          saved_to_profile?: boolean;
          source?: string;
          target_scope?: string | null;
          territory_ms_slug?: string | null;
        };
        Update: {
          call_id?: string;
          confidence?: string | null;
          contact_id?: string | null;
          created_at?: string;
          dismissed?: boolean;
          extracted_value?: string | null;
          field_category?: string;
          field_key?: string;
          id?: string;
          journey_id?: string | null;
          saved_to_profile?: boolean;
          source?: string;
          target_scope?: string | null;
          territory_ms_slug?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_data_extractions_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_data_extractions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_data_extractions_journey_id_fkey";
            columns: ["journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_data_extractions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      call_grades: {
        Row: {
          call_id: string;
          created_at: string;
          criterion_scores: Json | null;
          graded_by: string;
          id: string;
          improvements: string[] | null;
          overall_grade: string | null;
          overall_score: number | null;
          rubric_id: string | null;
          scout_model: string | null;
          strengths: string[] | null;
          suggested_next_action: string | null;
        };
        Insert: {
          call_id: string;
          created_at?: string;
          criterion_scores?: Json | null;
          graded_by?: string;
          id?: string;
          improvements?: string[] | null;
          overall_grade?: string | null;
          overall_score?: number | null;
          rubric_id?: string | null;
          scout_model?: string | null;
          strengths?: string[] | null;
          suggested_next_action?: string | null;
        };
        Update: {
          call_id?: string;
          created_at?: string;
          criterion_scores?: Json | null;
          graded_by?: string;
          id?: string;
          improvements?: string[] | null;
          overall_grade?: string | null;
          overall_score?: number | null;
          rubric_id?: string | null;
          scout_model?: string | null;
          strengths?: string[] | null;
          suggested_next_action?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_grades_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_grades_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "rubrics";
            referencedColumns: ["id"];
          },
        ];
      };
      call_journeys: {
        Row: {
          call_id: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          journey_id: string;
          journey_pipeline_state_id: string;
        };
        Insert: {
          call_id: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          journey_id: string;
          journey_pipeline_state_id: string;
        };
        Update: {
          call_id?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          journey_id?: string;
          journey_pipeline_state_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_journeys_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_journeys_journey_id_fkey";
            columns: ["journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_journeys_journey_pipeline_state_id_fkey";
            columns: ["journey_pipeline_state_id"];
            isOneToOne: false;
            referencedRelation: "journey_pipeline_state";
            referencedColumns: ["id"];
          },
        ];
      };
      call_logs: {
        Row: {
          ai_prefilled: boolean | null;
          call_type: string;
          called_at: string | null;
          contact_id: string;
          created_at: string | null;
          fields: Json;
          human_confirmed: boolean | null;
          id: string;
          logged_at: string | null;
          logged_by: string;
          notes: string | null;
          red_flags_raised: string | null;
          rep_confidence: string | null;
          transcript_url: string | null;
        };
        Insert: {
          ai_prefilled?: boolean | null;
          call_type: string;
          called_at?: string | null;
          contact_id: string;
          created_at?: string | null;
          fields: Json;
          human_confirmed?: boolean | null;
          id?: string;
          logged_at?: string | null;
          logged_by: string;
          notes?: string | null;
          red_flags_raised?: string | null;
          rep_confidence?: string | null;
          transcript_url?: string | null;
        };
        Update: {
          ai_prefilled?: boolean | null;
          call_type?: string;
          called_at?: string | null;
          contact_id?: string;
          created_at?: string | null;
          fields?: Json;
          human_confirmed?: boolean | null;
          id?: string;
          logged_at?: string | null;
          logged_by?: string;
          notes?: string | null;
          red_flags_raised?: string | null;
          rep_confidence?: string | null;
          transcript_url?: string | null;
        };
        Relationships: [];
      };
      call_participants: {
        Row: {
          call_id: string;
          contact_id: string | null;
          created_at: string | null;
          display_name: string | null;
          email: string | null;
          id: string;
          journey_pipeline_state_id: string | null;
          role: string;
          user_id: string | null;
        };
        Insert: {
          call_id: string;
          contact_id?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          journey_pipeline_state_id?: string | null;
          role: string;
          user_id?: string | null;
        };
        Update: {
          call_id?: string;
          contact_id?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          journey_pipeline_state_id?: string | null;
          role?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_participants_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_participants_journey_pipeline_state_id_fkey";
            columns: ["journey_pipeline_state_id"];
            isOneToOne: false;
            referencedRelation: "journey_pipeline_state";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      call_review_packages: {
        Row: {
          call_id: string;
          coaching_citations: Json | null;
          coaching_feedback: string | null;
          contact_id: string | null;
          created_at: string;
          grade: string | null;
          grade_detail: Json | null;
          id: string;
          next_step_cards: Json | null;
          profile_suggestions: Json | null;
          rep_id: string | null;
          status: string;
        };
        Insert: {
          call_id: string;
          coaching_citations?: Json | null;
          coaching_feedback?: string | null;
          contact_id?: string | null;
          created_at?: string;
          grade?: string | null;
          grade_detail?: Json | null;
          id?: string;
          next_step_cards?: Json | null;
          profile_suggestions?: Json | null;
          rep_id?: string | null;
          status?: string;
        };
        Update: {
          call_id?: string;
          coaching_citations?: Json | null;
          coaching_feedback?: string | null;
          contact_id?: string | null;
          created_at?: string;
          grade?: string | null;
          grade_detail?: Json | null;
          id?: string;
          next_step_cards?: Json | null;
          profile_suggestions?: Json | null;
          rep_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_review_packages_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_review_packages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_review_packages_rep_id_fkey";
            columns: ["rep_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      call_territories: {
        Row: {
          call_id: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          territory_ms_slug: string;
        };
        Insert: {
          call_id: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          territory_ms_slug: string;
        };
        Update: {
          call_id?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          territory_ms_slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "call_territories_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "call_territories_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      call_transcripts: {
        Row: {
          call_id: string;
          created_at: string;
          full_text: string;
          id: string;
          language: string | null;
          metadata: Json | null;
          source: string;
          word_count: number | null;
        };
        Insert: {
          call_id: string;
          created_at?: string;
          full_text: string;
          id?: string;
          language?: string | null;
          metadata?: Json | null;
          source: string;
          word_count?: number | null;
        };
        Update: {
          call_id?: string;
          created_at?: string;
          full_text?: string;
          id?: string;
          language?: string | null;
          metadata?: Json | null;
          source?: string;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_transcripts_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      call_types: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calls: {
        Row: {
          action_items: Json | null;
          ai_summary: string | null;
          ai_summary_generated_at: string | null;
          brief_context: string | null;
          brief_generated_at: string | null;
          call_type_id: string;
          classification_reason: string | null;
          coach_user_id: string | null;
          coaching_data: Json | null;
          coaching_generated_at: string | null;
          coaching_score: number | null;
          contact_id: string | null;
          created_at: string;
          deleted_at: string | null;
          duration_seconds: number | null;
          ended_at: string | null;
          ghl_event_id: string | null;
          hosted_by_user_id: string | null;
          id: string;
          journey_pipeline_state_id: string | null;
          kb_intel_items: Json | null;
          match_confidence: number | null;
          match_reason: string | null;
          meeting_link: string | null;
          participant_count: number | null;
          raw_transcript: string | null;
          read_ai_session_id: string | null;
          recording_url: string | null;
          scheduled_at: string | null;
          source: string | null;
          started_at: string | null;
          status: string;
          sub_task_id: string | null;
          summary: string | null;
          summary_bullets: string[] | null;
          territory_ms_slug: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          action_items?: Json | null;
          ai_summary?: string | null;
          ai_summary_generated_at?: string | null;
          brief_context?: string | null;
          brief_generated_at?: string | null;
          call_type_id: string;
          classification_reason?: string | null;
          coach_user_id?: string | null;
          coaching_data?: Json | null;
          coaching_generated_at?: string | null;
          coaching_score?: number | null;
          contact_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          ghl_event_id?: string | null;
          hosted_by_user_id?: string | null;
          id?: string;
          journey_pipeline_state_id?: string | null;
          kb_intel_items?: Json | null;
          match_confidence?: number | null;
          match_reason?: string | null;
          meeting_link?: string | null;
          participant_count?: number | null;
          raw_transcript?: string | null;
          read_ai_session_id?: string | null;
          recording_url?: string | null;
          scheduled_at?: string | null;
          source?: string | null;
          started_at?: string | null;
          status?: string;
          sub_task_id?: string | null;
          summary?: string | null;
          summary_bullets?: string[] | null;
          territory_ms_slug?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          action_items?: Json | null;
          ai_summary?: string | null;
          ai_summary_generated_at?: string | null;
          brief_context?: string | null;
          brief_generated_at?: string | null;
          call_type_id?: string;
          classification_reason?: string | null;
          coach_user_id?: string | null;
          coaching_data?: Json | null;
          coaching_generated_at?: string | null;
          coaching_score?: number | null;
          contact_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          ghl_event_id?: string | null;
          hosted_by_user_id?: string | null;
          id?: string;
          journey_pipeline_state_id?: string | null;
          kb_intel_items?: Json | null;
          match_confidence?: number | null;
          match_reason?: string | null;
          meeting_link?: string | null;
          participant_count?: number | null;
          raw_transcript?: string | null;
          read_ai_session_id?: string | null;
          recording_url?: string | null;
          scheduled_at?: string | null;
          source?: string | null;
          started_at?: string | null;
          status?: string;
          sub_task_id?: string | null;
          summary?: string | null;
          summary_bullets?: string[] | null;
          territory_ms_slug?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calls_call_type_id_fkey";
            columns: ["call_type_id"];
            isOneToOne: false;
            referencedRelation: "call_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_coach_user_id_fkey";
            columns: ["coach_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_hosted_by_user_id_fkey";
            columns: ["hosted_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_journey_pipeline_state_id_fkey";
            columns: ["journey_pipeline_state_id"];
            isOneToOne: false;
            referencedRelation: "journey_pipeline_state";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_sub_task_id_fkey";
            columns: ["sub_task_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_sub_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "calls_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      candidate_intelligence: {
        Row: {
          active_flags: Json | null;
          avg_response_time_hours: number | null;
          construction_comfort: string | null;
          contact_id: string;
          created_at: string | null;
          current_score: number | null;
          disc_profile: string | null;
          financial_red_flags: Json | null;
          funding_path: string | null;
          ghl_location_id: string;
          homework_completion_rate: number | null;
          id: string;
          illiquid_capital: number | null;
          liquid_capital: number | null;
          net_worth_bucket: string | null;
          outstanding_liabilities: string | null;
          personality_flags: Json | null;
          pfs_received: boolean | null;
          pfs_uploaded_url: string | null;
          prior_business_owner: boolean | null;
          prior_business_type: string | null;
          risk_tolerance_score: number | null;
          score_engagement: number | null;
          score_financial: number | null;
          score_momentum: number | null;
          score_operational: number | null;
          spouse_supportive: string | null;
          stated_motivation: string | null;
          trainual_completion_pct: number | null;
          trainual_last_activity: string | null;
          updated_at: string | null;
          urgency: string | null;
          zorakle_completed: boolean | null;
          zorakle_results: Json | null;
        };
        Insert: {
          active_flags?: Json | null;
          avg_response_time_hours?: number | null;
          construction_comfort?: string | null;
          contact_id: string;
          created_at?: string | null;
          current_score?: number | null;
          disc_profile?: string | null;
          financial_red_flags?: Json | null;
          funding_path?: string | null;
          ghl_location_id: string;
          homework_completion_rate?: number | null;
          id?: string;
          illiquid_capital?: number | null;
          liquid_capital?: number | null;
          net_worth_bucket?: string | null;
          outstanding_liabilities?: string | null;
          personality_flags?: Json | null;
          pfs_received?: boolean | null;
          pfs_uploaded_url?: string | null;
          prior_business_owner?: boolean | null;
          prior_business_type?: string | null;
          risk_tolerance_score?: number | null;
          score_engagement?: number | null;
          score_financial?: number | null;
          score_momentum?: number | null;
          score_operational?: number | null;
          spouse_supportive?: string | null;
          stated_motivation?: string | null;
          trainual_completion_pct?: number | null;
          trainual_last_activity?: string | null;
          updated_at?: string | null;
          urgency?: string | null;
          zorakle_completed?: boolean | null;
          zorakle_results?: Json | null;
        };
        Update: {
          active_flags?: Json | null;
          avg_response_time_hours?: number | null;
          construction_comfort?: string | null;
          contact_id?: string;
          created_at?: string | null;
          current_score?: number | null;
          disc_profile?: string | null;
          financial_red_flags?: Json | null;
          funding_path?: string | null;
          ghl_location_id?: string;
          homework_completion_rate?: number | null;
          id?: string;
          illiquid_capital?: number | null;
          liquid_capital?: number | null;
          net_worth_bucket?: string | null;
          outstanding_liabilities?: string | null;
          personality_flags?: Json | null;
          pfs_received?: boolean | null;
          pfs_uploaded_url?: string | null;
          prior_business_owner?: boolean | null;
          prior_business_type?: string | null;
          risk_tolerance_score?: number | null;
          score_engagement?: number | null;
          score_financial?: number | null;
          score_momentum?: number | null;
          score_operational?: number | null;
          spouse_supportive?: string | null;
          stated_motivation?: string | null;
          trainual_completion_pct?: number | null;
          trainual_last_activity?: string | null;
          updated_at?: string | null;
          urgency?: string | null;
          zorakle_completed?: boolean | null;
          zorakle_results?: Json | null;
        };
        Relationships: [];
      };
      candidate_score_history: {
        Row: {
          changes_explained: Json | null;
          contact_id: string;
          created_at: string | null;
          engagement_after: number | null;
          engagement_before: number | null;
          financial_after: number | null;
          financial_before: number | null;
          id: string;
          momentum_after: number | null;
          momentum_before: number | null;
          operational_after: number | null;
          operational_before: number | null;
          score_after: number | null;
          score_before: number | null;
          trigger_id: string | null;
          triggered_by: string;
        };
        Insert: {
          changes_explained?: Json | null;
          contact_id: string;
          created_at?: string | null;
          engagement_after?: number | null;
          engagement_before?: number | null;
          financial_after?: number | null;
          financial_before?: number | null;
          id?: string;
          momentum_after?: number | null;
          momentum_before?: number | null;
          operational_after?: number | null;
          operational_before?: number | null;
          score_after?: number | null;
          score_before?: number | null;
          trigger_id?: string | null;
          triggered_by: string;
        };
        Update: {
          changes_explained?: Json | null;
          contact_id?: string;
          created_at?: string | null;
          engagement_after?: number | null;
          engagement_before?: number | null;
          financial_after?: number | null;
          financial_before?: number | null;
          id?: string;
          momentum_after?: number | null;
          momentum_before?: number | null;
          operational_after?: number | null;
          operational_before?: number | null;
          score_after?: number | null;
          score_before?: number | null;
          trigger_id?: string | null;
          triggered_by?: string;
        };
        Relationships: [];
      };
      coach_assignments: {
        Row: {
          assigned_at: string | null;
          coach_user_id: string;
          ended_at: string | null;
          id: string;
          specialty: string | null;
          territory_ms_slug: string;
        };
        Insert: {
          assigned_at?: string | null;
          coach_user_id: string;
          ended_at?: string | null;
          id?: string;
          specialty?: string | null;
          territory_ms_slug: string;
        };
        Update: {
          assigned_at?: string | null;
          coach_user_id?: string;
          ended_at?: string | null;
          id?: string;
          specialty?: string | null;
          territory_ms_slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "coach_assignments_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      contact_activity_messages: {
        Row: {
          author_user_id: string;
          body: string;
          contact_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          mentioned_user_ids: string[] | null;
          updated_at: string;
        };
        Insert: {
          author_user_id: string;
          body: string;
          contact_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          mentioned_user_ids?: string[] | null;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string;
          body?: string;
          contact_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          mentioned_user_ids?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_activity_messages_author_user_id_fkey";
            columns: ["author_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_activity_messages_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_emails: {
        Row: {
          contact_id: string;
          created_at: string;
          email: string;
          id: string;
          is_primary: boolean;
          label: string | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          email: string;
          id?: string;
          is_primary?: boolean;
          label?: string | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          email?: string;
          id?: string;
          is_primary?: boolean;
          label?: string | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_emails_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_journals: {
        Row: {
          contact_id: string;
          created_at: string;
          embedding_id: string | null;
          id: string;
          interactions: Json;
          journal_date: string;
          signals_extracted: Json;
          summary: string;
          tenant_id: string | null;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          embedding_id?: string | null;
          id?: string;
          interactions?: Json;
          journal_date: string;
          signals_extracted?: Json;
          summary: string;
          tenant_id?: string | null;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          embedding_id?: string | null;
          id?: string;
          interactions?: Json;
          journal_date?: string;
          signals_extracted?: Json;
          summary?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_journals_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_journals_embedding_id_fkey";
            columns: ["embedding_id"];
            isOneToOne: false;
            referencedRelation: "embeddings";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_profile_data: {
        Row: {
          competitor_notes: string | null;
          created_at: string;
          decision_style: string | null;
          definition_of_success: string | null;
          desired_territory: string | null;
          financing_type: string | null;
          ghl_contact_id: string;
          guidant_robs_active: boolean | null;
          liquid_capital: number | null;
          local_market_notes: string | null;
          market_area: string | null;
          net_worth_estimate: number | null;
          objections_raised: string | null;
          pfs_received: boolean | null;
          primary_motivation: string | null;
          prior_re_experience: string | null;
          secondary_territory: string | null;
          skill_set_notes: string | null;
          territory_value_est: number | null;
          updated_at: string;
          zip_codes_of_interest: string | null;
        };
        Insert: {
          competitor_notes?: string | null;
          created_at?: string;
          decision_style?: string | null;
          definition_of_success?: string | null;
          desired_territory?: string | null;
          financing_type?: string | null;
          ghl_contact_id: string;
          guidant_robs_active?: boolean | null;
          liquid_capital?: number | null;
          local_market_notes?: string | null;
          market_area?: string | null;
          net_worth_estimate?: number | null;
          objections_raised?: string | null;
          pfs_received?: boolean | null;
          primary_motivation?: string | null;
          prior_re_experience?: string | null;
          secondary_territory?: string | null;
          skill_set_notes?: string | null;
          territory_value_est?: number | null;
          updated_at?: string;
          zip_codes_of_interest?: string | null;
        };
        Update: {
          competitor_notes?: string | null;
          created_at?: string;
          decision_style?: string | null;
          definition_of_success?: string | null;
          desired_territory?: string | null;
          financing_type?: string | null;
          ghl_contact_id?: string;
          guidant_robs_active?: boolean | null;
          liquid_capital?: number | null;
          local_market_notes?: string | null;
          market_area?: string | null;
          net_worth_estimate?: number | null;
          objections_raised?: string | null;
          pfs_received?: boolean | null;
          primary_motivation?: string | null;
          prior_re_experience?: string | null;
          secondary_territory?: string | null;
          skill_set_notes?: string | null;
          territory_value_est?: number | null;
          updated_at?: string;
          zip_codes_of_interest?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_profile_data_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: true;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
      contact_profile_fields: {
        Row: {
          contact_id: string;
          created_at: string;
          field_name: string;
          field_value: Json | null;
          id: string;
          last_updated_at: string;
          last_updated_by: string;
          source_history: Json;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          field_name: string;
          field_value?: Json | null;
          id?: string;
          last_updated_at?: string;
          last_updated_by?: string;
          source_history?: Json;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          field_name?: string;
          field_value?: Json | null;
          id?: string;
          last_updated_at?: string;
          last_updated_by?: string;
          source_history?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "contact_profile_fields_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_related_people: {
        Row: {
          contact_id: string;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          first_name: string | null;
          id: string;
          is_primary_decision_maker: boolean;
          last_name: string | null;
          linked_contact_id: string | null;
          phone: string | null;
          relationship_notes: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          is_primary_decision_maker?: boolean;
          last_name?: string | null;
          linked_contact_id?: string | null;
          phone?: string | null;
          relationship_notes?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          is_primary_decision_maker?: boolean;
          last_name?: string | null;
          linked_contact_id?: string | null;
          phone?: string | null;
          relationship_notes?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_related_people_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_related_people_linked_contact_id_fkey";
            columns: ["linked_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_scores: {
        Row: {
          confidence: string | null;
          created_at: string;
          expires_at: string | null;
          ghl_contact_id: string;
          id: string;
          reason: string | null;
          score_type: string;
          score_value: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          confidence?: string | null;
          created_at?: string;
          expires_at?: string | null;
          ghl_contact_id: string;
          id?: string;
          reason?: string | null;
          score_type: string;
          score_value: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          confidence?: string | null;
          created_at?: string;
          expires_at?: string | null;
          ghl_contact_id?: string;
          id?: string;
          reason?: string | null;
          score_type?: string;
          score_value?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_scores_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
      contact_sub_task_logs: {
        Row: {
          content_file_url: string | null;
          content_link_url: string | null;
          content_text: string | null;
          content_type: Database["public"]["Enums"]["log_content_type"];
          created_at: string;
          deleted_at: string | null;
          id: string;
          journey_pipeline_state_id: string;
          logger_user_id: string | null;
          metadata: Json | null;
          source: Database["public"]["Enums"]["log_source"];
          state_advance: Database["public"]["Enums"]["log_state_advance"] | null;
          sub_task_id: string;
          updated_at: string;
        };
        Insert: {
          content_file_url?: string | null;
          content_link_url?: string | null;
          content_text?: string | null;
          content_type?: Database["public"]["Enums"]["log_content_type"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          journey_pipeline_state_id: string;
          logger_user_id?: string | null;
          metadata?: Json | null;
          source?: Database["public"]["Enums"]["log_source"];
          state_advance?: Database["public"]["Enums"]["log_state_advance"] | null;
          sub_task_id: string;
          updated_at?: string;
        };
        Update: {
          content_file_url?: string | null;
          content_link_url?: string | null;
          content_text?: string | null;
          content_type?: Database["public"]["Enums"]["log_content_type"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          journey_pipeline_state_id?: string;
          logger_user_id?: string | null;
          metadata?: Json | null;
          source?: Database["public"]["Enums"]["log_source"];
          state_advance?: Database["public"]["Enums"]["log_state_advance"] | null;
          sub_task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_sub_task_logs_journey_pipeline_state_id_fkey";
            columns: ["journey_pipeline_state_id"];
            isOneToOne: false;
            referencedRelation: "journey_pipeline_state";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_sub_task_logs_logger_user_id_fkey";
            columns: ["logger_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_sub_task_logs_sub_task_id_fkey";
            columns: ["sub_task_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_sub_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_team_members: {
        Row: {
          contact_id: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_team_members_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_team_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_zorakle_data: {
        Row: {
          created_at: string;
          culture: string | null;
          eclipse_drive_id: string | null;
          eclipse_overall: number | null;
          fit_score: number | null;
          ghl_contact_id: string;
          id: string;
          risk_flag: string | null;
          source: string;
          spoton_drive_id: string | null;
          updated_at: string;
          values_type: string | null;
          work_style: string | null;
          zorakle_completed_at: string | null;
        };
        Insert: {
          created_at?: string;
          culture?: string | null;
          eclipse_drive_id?: string | null;
          eclipse_overall?: number | null;
          fit_score?: number | null;
          ghl_contact_id: string;
          id?: string;
          risk_flag?: string | null;
          source?: string;
          spoton_drive_id?: string | null;
          updated_at?: string;
          values_type?: string | null;
          work_style?: string | null;
          zorakle_completed_at?: string | null;
        };
        Update: {
          created_at?: string;
          culture?: string | null;
          eclipse_drive_id?: string | null;
          eclipse_overall?: number | null;
          fit_score?: number | null;
          ghl_contact_id?: string;
          id?: string;
          risk_flag?: string | null;
          source?: string;
          spoton_drive_id?: string | null;
          updated_at?: string;
          values_type?: string | null;
          work_style?: string | null;
          zorakle_completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_zorakle_data_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: true;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
      contacts: {
        Row: {
          address: string | null;
          business_ownership_experience: string | null;
          capital_availability: string | null;
          city: string | null;
          clickx_package: string | null;
          converted_at: string | null;
          counties_priority: string | null;
          created_at: string;
          ecosystem_partners: string | null;
          email: string | null;
          fb_url: string | null;
          first_name: string | null;
          framing_call_logged: boolean | null;
          franchise_fee: number | null;
          franchise_start_date: string | null;
          franchisee_2_email: string | null;
          franchisee_2_name: string | null;
          franchisee_2_phone: string | null;
          ghl_contact_id: string;
          happyfox_url: string | null;
          id: string;
          incoming_lead_email: string | null;
          investment_timeline: string | null;
          is_converted_franchisee: boolean;
          last_name: string | null;
          last_synced_at: string | null;
          lead_manager_email: string | null;
          lead_manager_name: string | null;
          lead_source_detail: string | null;
          legal_entity: string | null;
          marketing_phone: string | null;
          merged_at: string | null;
          merged_into_contact_id: string | null;
          motivation_clarity: string | null;
          nda_status: string | null;
          needs_review: boolean | null;
          nexa_phone: string | null;
          notes: string | null;
          number_of_franchisees: number | null;
          onboarding_completion_date: string | null;
          openclaw_enriched: boolean | null;
          opportunity_source: string | null;
          phone: string | null;
          property_submission_status: string | null;
          real_estate_agent_broker: string | null;
          real_estate_agent_email: string | null;
          real_estate_partner: string | null;
          real_estate_phone: string | null;
          return_mail_address: string | null;
          royalty_pct: number | null;
          scout_lead_score: number | null;
          source: string | null;
          state: string | null;
          sub_source: string | null;
          term_months: number | null;
          territory_email: string | null;
          territory_interest: string | null;
          territory_status: string | null;
          trainual_access_sent: boolean | null;
          trainual_completion_pct: number | null;
          updated_at: string;
          website: string | null;
          zip: string | null;
        };
        Insert: {
          address?: string | null;
          business_ownership_experience?: string | null;
          capital_availability?: string | null;
          city?: string | null;
          clickx_package?: string | null;
          converted_at?: string | null;
          counties_priority?: string | null;
          created_at?: string;
          ecosystem_partners?: string | null;
          email?: string | null;
          fb_url?: string | null;
          first_name?: string | null;
          framing_call_logged?: boolean | null;
          franchise_fee?: number | null;
          franchise_start_date?: string | null;
          franchisee_2_email?: string | null;
          franchisee_2_name?: string | null;
          franchisee_2_phone?: string | null;
          ghl_contact_id: string;
          happyfox_url?: string | null;
          id?: string;
          incoming_lead_email?: string | null;
          investment_timeline?: string | null;
          is_converted_franchisee?: boolean;
          last_name?: string | null;
          last_synced_at?: string | null;
          lead_manager_email?: string | null;
          lead_manager_name?: string | null;
          lead_source_detail?: string | null;
          legal_entity?: string | null;
          marketing_phone?: string | null;
          merged_at?: string | null;
          merged_into_contact_id?: string | null;
          motivation_clarity?: string | null;
          nda_status?: string | null;
          needs_review?: boolean | null;
          nexa_phone?: string | null;
          notes?: string | null;
          number_of_franchisees?: number | null;
          onboarding_completion_date?: string | null;
          openclaw_enriched?: boolean | null;
          opportunity_source?: string | null;
          phone?: string | null;
          property_submission_status?: string | null;
          real_estate_agent_broker?: string | null;
          real_estate_agent_email?: string | null;
          real_estate_partner?: string | null;
          real_estate_phone?: string | null;
          return_mail_address?: string | null;
          royalty_pct?: number | null;
          scout_lead_score?: number | null;
          source?: string | null;
          state?: string | null;
          sub_source?: string | null;
          term_months?: number | null;
          territory_email?: string | null;
          territory_interest?: string | null;
          territory_status?: string | null;
          trainual_access_sent?: boolean | null;
          trainual_completion_pct?: number | null;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Update: {
          address?: string | null;
          business_ownership_experience?: string | null;
          capital_availability?: string | null;
          city?: string | null;
          clickx_package?: string | null;
          converted_at?: string | null;
          counties_priority?: string | null;
          created_at?: string;
          ecosystem_partners?: string | null;
          email?: string | null;
          fb_url?: string | null;
          first_name?: string | null;
          framing_call_logged?: boolean | null;
          franchise_fee?: number | null;
          franchise_start_date?: string | null;
          franchisee_2_email?: string | null;
          franchisee_2_name?: string | null;
          franchisee_2_phone?: string | null;
          ghl_contact_id?: string;
          happyfox_url?: string | null;
          id?: string;
          incoming_lead_email?: string | null;
          investment_timeline?: string | null;
          is_converted_franchisee?: boolean;
          last_name?: string | null;
          last_synced_at?: string | null;
          lead_manager_email?: string | null;
          lead_manager_name?: string | null;
          lead_source_detail?: string | null;
          legal_entity?: string | null;
          marketing_phone?: string | null;
          merged_at?: string | null;
          merged_into_contact_id?: string | null;
          motivation_clarity?: string | null;
          nda_status?: string | null;
          needs_review?: boolean | null;
          nexa_phone?: string | null;
          notes?: string | null;
          number_of_franchisees?: number | null;
          onboarding_completion_date?: string | null;
          openclaw_enriched?: boolean | null;
          opportunity_source?: string | null;
          phone?: string | null;
          property_submission_status?: string | null;
          real_estate_agent_broker?: string | null;
          real_estate_agent_email?: string | null;
          real_estate_partner?: string | null;
          real_estate_phone?: string | null;
          return_mail_address?: string | null;
          royalty_pct?: number | null;
          scout_lead_score?: number | null;
          source?: string | null;
          state?: string | null;
          sub_source?: string | null;
          term_months?: number | null;
          territory_email?: string | null;
          territory_interest?: string | null;
          territory_status?: string | null;
          trainual_access_sent?: boolean | null;
          trainual_completion_pct?: number | null;
          updated_at?: string;
          website?: string | null;
          zip?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_merged_into_contact_id_fkey";
            columns: ["merged_into_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      cron_job_log: {
        Row: {
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          job_name: string;
          result: Json | null;
          started_at: string;
          status: Database["public"]["Enums"]["cron_job_status"];
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          job_name: string;
          result?: Json | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["cron_job_status"];
        };
        Update: {
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          job_name?: string;
          result?: Json | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["cron_job_status"];
        };
        Relationships: [];
      };
      data_update_suggestions: {
        Row: {
          combination_note: string | null;
          combined_sources: string[] | null;
          confidence: string | null;
          contact_id: string | null;
          created_at: string | null;
          current_value: string | null;
          evidence: string | null;
          field_name: string;
          field_table: string;
          final_value: string | null;
          id: string;
          resolved_at: string | null;
          reviewer_id: string | null;
          source: string;
          source_id: string | null;
          status: string;
          suggested_value: string;
          superseded_by: string | null;
          territory_ms_slug: string | null;
          updated_at: string | null;
        };
        Insert: {
          combination_note?: string | null;
          combined_sources?: string[] | null;
          confidence?: string | null;
          contact_id?: string | null;
          created_at?: string | null;
          current_value?: string | null;
          evidence?: string | null;
          field_name: string;
          field_table: string;
          final_value?: string | null;
          id?: string;
          resolved_at?: string | null;
          reviewer_id?: string | null;
          source: string;
          source_id?: string | null;
          status?: string;
          suggested_value: string;
          superseded_by?: string | null;
          territory_ms_slug?: string | null;
          updated_at?: string | null;
        };
        Update: {
          combination_note?: string | null;
          combined_sources?: string[] | null;
          confidence?: string | null;
          contact_id?: string | null;
          created_at?: string | null;
          current_value?: string | null;
          evidence?: string | null;
          field_name?: string;
          field_table?: string;
          final_value?: string | null;
          id?: string;
          resolved_at?: string | null;
          reviewer_id?: string | null;
          source?: string;
          source_id?: string | null;
          status?: string;
          suggested_value?: string;
          superseded_by?: string | null;
          territory_ms_slug?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_update_suggestions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
          {
            foreignKeyName: "data_update_suggestions_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "data_update_suggestions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "data_update_suggestions_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      embeddings: {
        Row: {
          contact_id: string | null;
          content: string;
          content_type: string;
          created_at: string;
          embedding: string;
          id: string;
          metadata: Json;
          tenant_id: string | null;
          updated_at: string;
        };
        Insert: {
          contact_id?: string | null;
          content: string;
          content_type: string;
          created_at?: string;
          embedding: string;
          id?: string;
          metadata?: Json;
          tenant_id?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_id?: string | null;
          content?: string;
          content_type?: string;
          created_at?: string;
          embedding?: string;
          id?: string;
          metadata?: Json;
          tenant_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "embeddings_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      eos_contact_goals: {
        Row: {
          contact_id: string;
          id: string;
          income_goal: string | null;
          lifestyle_goal: string | null;
          qol_goal: string | null;
          source: string | null;
          updated_at: string | null;
        };
        Insert: {
          contact_id: string;
          id?: string;
          income_goal?: string | null;
          lifestyle_goal?: string | null;
          qol_goal?: string | null;
          source?: string | null;
          updated_at?: string | null;
        };
        Update: {
          contact_id?: string;
          id?: string;
          income_goal?: string | null;
          lifestyle_goal?: string | null;
          qol_goal?: string | null;
          source?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eos_contact_goals_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: true;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      eos_contact_habits: {
        Row: {
          cadence: string;
          contact_id: string;
          created_at: string | null;
          grade: string | null;
          habit_text: string;
          id: string;
          sort_order: number | null;
          source: string | null;
          updated_at: string | null;
        };
        Insert: {
          cadence?: string;
          contact_id: string;
          created_at?: string | null;
          grade?: string | null;
          habit_text: string;
          id?: string;
          sort_order?: number | null;
          source?: string | null;
          updated_at?: string | null;
        };
        Update: {
          cadence?: string;
          contact_id?: string;
          created_at?: string | null;
          grade?: string | null;
          habit_text?: string;
          id?: string;
          sort_order?: number | null;
          source?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eos_contact_habits_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      eos_contact_issues: {
        Row: {
          contact_id: string;
          created_at: string | null;
          id: string;
          is_done: boolean | null;
          issue_text: string;
          source: string | null;
          updated_at: string | null;
        };
        Insert: {
          contact_id: string;
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          issue_text: string;
          source?: string | null;
          updated_at?: string | null;
        };
        Update: {
          contact_id?: string;
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          issue_text?: string;
          source?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eos_contact_issues_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      eos_contact_todos: {
        Row: {
          contact_id: string;
          created_at: string | null;
          id: string;
          is_done: boolean | null;
          owner_user_id: string | null;
          source: string | null;
          todo_text: string;
          updated_at: string | null;
        };
        Insert: {
          contact_id: string;
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          owner_user_id?: string | null;
          source?: string | null;
          todo_text: string;
          updated_at?: string | null;
        };
        Update: {
          contact_id?: string;
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          owner_user_id?: string | null;
          source?: string | null;
          todo_text?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eos_contact_todos_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "eos_contact_todos_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      eos_territory_budgets: {
        Row: {
          amount: number | null;
          description: string;
          id: string;
          sort_order: number | null;
          territory_slug: string;
          updated_at: string | null;
        };
        Insert: {
          amount?: number | null;
          description: string;
          id?: string;
          sort_order?: number | null;
          territory_slug: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number | null;
          description?: string;
          id?: string;
          sort_order?: number | null;
          territory_slug?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      eos_territory_goals: {
        Row: {
          actual: string | null;
          current_year_goal: string | null;
          goal_type: string;
          id: string;
          territory_slug: string;
          updated_at: string | null;
          year_25_goal: string | null;
          year_5_goal: string | null;
        };
        Insert: {
          actual?: string | null;
          current_year_goal?: string | null;
          goal_type: string;
          id?: string;
          territory_slug: string;
          updated_at?: string | null;
          year_25_goal?: string | null;
          year_5_goal?: string | null;
        };
        Update: {
          actual?: string | null;
          current_year_goal?: string | null;
          goal_type?: string;
          id?: string;
          territory_slug?: string;
          updated_at?: string | null;
          year_25_goal?: string | null;
          year_5_goal?: string | null;
        };
        Relationships: [];
      };
      eos_territory_habits: {
        Row: {
          grade: string | null;
          habit_key: string;
          habit_label: string;
          id: string;
          sort_order: number | null;
          territory_slug: string;
          updated_at: string | null;
        };
        Insert: {
          grade?: string | null;
          habit_key: string;
          habit_label: string;
          id?: string;
          sort_order?: number | null;
          territory_slug: string;
          updated_at?: string | null;
        };
        Update: {
          grade?: string | null;
          habit_key?: string;
          habit_label?: string;
          id?: string;
          sort_order?: number | null;
          territory_slug?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      eos_territory_issues: {
        Row: {
          created_at: string | null;
          id: string;
          is_done: boolean | null;
          issue_text: string;
          origin_contact_id: string | null;
          source: string | null;
          territory_slug: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          issue_text: string;
          origin_contact_id?: string | null;
          source?: string | null;
          territory_slug: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          issue_text?: string;
          origin_contact_id?: string | null;
          source?: string | null;
          territory_slug?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eos_territory_issues_origin_contact_id_fkey";
            columns: ["origin_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      eos_territory_lead_channels: {
        Row: {
          channel_name: string;
          id: string;
          is_active: boolean | null;
          sort_order: number | null;
          territory_slug: string;
          updated_at: string | null;
        };
        Insert: {
          channel_name: string;
          id?: string;
          is_active?: boolean | null;
          sort_order?: number | null;
          territory_slug: string;
          updated_at?: string | null;
        };
        Update: {
          channel_name?: string;
          id?: string;
          is_active?: boolean | null;
          sort_order?: number | null;
          territory_slug?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      eos_territory_rocks: {
        Row: {
          created_at: string | null;
          id: string;
          quarter: number | null;
          rock_text: string;
          status: string | null;
          territory_slug: string;
          updated_at: string | null;
          year: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          quarter?: number | null;
          rock_text: string;
          status?: string | null;
          territory_slug: string;
          updated_at?: string | null;
          year?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          quarter?: number | null;
          rock_text?: string;
          status?: string | null;
          territory_slug?: string;
          updated_at?: string | null;
          year?: number | null;
        };
        Relationships: [];
      };
      eos_territory_scorecard: {
        Row: {
          goal_value: string | null;
          id: string;
          metric_key: string;
          metric_label: string;
          sort_order: number | null;
          territory_slug: string;
          updated_at: string | null;
        };
        Insert: {
          goal_value?: string | null;
          id?: string;
          metric_key: string;
          metric_label: string;
          sort_order?: number | null;
          territory_slug: string;
          updated_at?: string | null;
        };
        Update: {
          goal_value?: string | null;
          id?: string;
          metric_key?: string;
          metric_label?: string;
          sort_order?: number | null;
          territory_slug?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      eos_territory_todos: {
        Row: {
          created_at: string | null;
          id: string;
          is_done: boolean | null;
          origin_contact_id: string | null;
          owner_user_id: string | null;
          source: string | null;
          territory_slug: string;
          todo_text: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          origin_contact_id?: string | null;
          owner_user_id?: string | null;
          source?: string | null;
          territory_slug: string;
          todo_text: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_done?: boolean | null;
          origin_contact_id?: string | null;
          owner_user_id?: string | null;
          source?: string | null;
          territory_slug?: string;
          todo_text?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eos_territory_todos_origin_contact_id_fkey";
            columns: ["origin_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "eos_territory_todos_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      franchise_owners: {
        Row: {
          created_at: string;
          ct_email: string | null;
          ct_id: string | null;
          full_name: string;
          ghl_contact_id: string | null;
          ms_slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ct_email?: string | null;
          ct_id?: string | null;
          full_name: string;
          ghl_contact_id?: string | null;
          ms_slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ct_email?: string | null;
          ct_id?: string | null;
          full_name?: string;
          ghl_contact_id?: string | null;
          ms_slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "franchise_owners_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "franchise_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      franchisee_performance: {
        Row: {
          active_status: string | null;
          contact_id: string;
          created_at: string | null;
          data_source: string | null;
          franchise_agreement_signed: boolean | null;
          franchise_software_id: string | null;
          franchisee_name: string;
          funds_received_at: string | null;
          houses_purchased_total: number | null;
          houses_purchased_year1: number | null;
          houses_purchased_year2: number | null;
          houses_purchased_year3: number | null;
          id: string;
          last_synced_at: string | null;
          nps_score: number | null;
          revenue_year1: number | null;
          revenue_year2: number | null;
          revenue_year3: number | null;
          royalty_payment_consistent: boolean | null;
          signed_at: string | null;
          staff_hired: number | null;
          support_calls_year1: number | null;
          territory: string | null;
          territory_utilization_pct: number | null;
          time_to_first_flip_days: number | null;
          updated_at: string | null;
        };
        Insert: {
          active_status?: string | null;
          contact_id: string;
          created_at?: string | null;
          data_source?: string | null;
          franchise_agreement_signed?: boolean | null;
          franchise_software_id?: string | null;
          franchisee_name: string;
          funds_received_at?: string | null;
          houses_purchased_total?: number | null;
          houses_purchased_year1?: number | null;
          houses_purchased_year2?: number | null;
          houses_purchased_year3?: number | null;
          id?: string;
          last_synced_at?: string | null;
          nps_score?: number | null;
          revenue_year1?: number | null;
          revenue_year2?: number | null;
          revenue_year3?: number | null;
          royalty_payment_consistent?: boolean | null;
          signed_at?: string | null;
          staff_hired?: number | null;
          support_calls_year1?: number | null;
          territory?: string | null;
          territory_utilization_pct?: number | null;
          time_to_first_flip_days?: number | null;
          updated_at?: string | null;
        };
        Update: {
          active_status?: string | null;
          contact_id?: string;
          created_at?: string | null;
          data_source?: string | null;
          franchise_agreement_signed?: boolean | null;
          franchise_software_id?: string | null;
          franchisee_name?: string;
          funds_received_at?: string | null;
          houses_purchased_total?: number | null;
          houses_purchased_year1?: number | null;
          houses_purchased_year2?: number | null;
          houses_purchased_year3?: number | null;
          id?: string;
          last_synced_at?: string | null;
          nps_score?: number | null;
          revenue_year1?: number | null;
          revenue_year2?: number | null;
          revenue_year3?: number | null;
          royalty_payment_consistent?: boolean | null;
          signed_at?: string | null;
          staff_hired?: number | null;
          support_calls_year1?: number | null;
          territory?: string | null;
          territory_utilization_pct?: number | null;
          time_to_first_flip_days?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ghl_action_drafts: {
        Row: {
          action_type: string;
          confirmed_at: string | null;
          contact_id: string | null;
          created_at: string;
          drafted_by_source: string;
          drafted_by_user_id: string | null;
          edited_params: Json | null;
          error_message: string | null;
          executed_at: string | null;
          id: string;
          outcome: Json | null;
          params: Json;
          status: string;
        };
        Insert: {
          action_type: string;
          confirmed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          drafted_by_source?: string;
          drafted_by_user_id?: string | null;
          edited_params?: Json | null;
          error_message?: string | null;
          executed_at?: string | null;
          id?: string;
          outcome?: Json | null;
          params?: Json;
          status?: string;
        };
        Update: {
          action_type?: string;
          confirmed_at?: string | null;
          contact_id?: string | null;
          created_at?: string;
          drafted_by_source?: string;
          drafted_by_user_id?: string | null;
          edited_params?: Json | null;
          error_message?: string | null;
          executed_at?: string | null;
          id?: string;
          outcome?: Json | null;
          params?: Json;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ghl_action_drafts_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ghl_action_drafts_drafted_by_user_id_fkey";
            columns: ["drafted_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ghl_pipeline_stages: {
        Row: {
          created_at: string | null;
          id: string;
          pipeline_id: string;
          position: number | null;
          stage_id: string;
          stage_name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          pipeline_id: string;
          position?: number | null;
          stage_id: string;
          stage_name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          pipeline_id?: string;
          position?: number | null;
          stage_id?: string;
          stage_name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ghl_sync_queue: {
        Row: {
          attempts: number;
          contact_id: string;
          created_at: string;
          ghl_field_id: string;
          id: string;
          last_error: string | null;
          status: Database["public"]["Enums"]["ghl_sync_status"];
          updated_at: string;
          value: string;
        };
        Insert: {
          attempts?: number;
          contact_id: string;
          created_at?: string;
          ghl_field_id: string;
          id?: string;
          last_error?: string | null;
          status?: Database["public"]["Enums"]["ghl_sync_status"];
          updated_at?: string;
          value: string;
        };
        Update: {
          attempts?: number;
          contact_id?: string;
          created_at?: string;
          ghl_field_id?: string;
          id?: string;
          last_error?: string | null;
          status?: Database["public"]["Enums"]["ghl_sync_status"];
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ghl_sync_queue_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      ghl_workflows: {
        Row: {
          created_at: string | null;
          description: string | null;
          ghl_workflow_id: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          updated_at: string | null;
          webhook_url: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          ghl_workflow_id?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          updated_at?: string | null;
          webhook_url: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          ghl_workflow_id?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          updated_at?: string | null;
          webhook_url?: string;
        };
        Relationships: [];
      };
      inactivity_alerts: {
        Row: {
          alert_type: string;
          created_at: string | null;
          details: Json | null;
          ghl_contact_id: string | null;
          id: string;
          is_resolved: boolean | null;
          message: string;
          pipeline_stage: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          user_id: string | null;
        };
        Insert: {
          alert_type: string;
          created_at?: string | null;
          details?: Json | null;
          ghl_contact_id?: string | null;
          id?: string;
          is_resolved?: boolean | null;
          message: string;
          pipeline_stage?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: string;
          user_id?: string | null;
        };
        Update: {
          alert_type?: string;
          created_at?: string | null;
          details?: Json | null;
          ghl_contact_id?: string | null;
          id?: string;
          is_resolved?: boolean | null;
          message?: string;
          pipeline_stage?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inactivity_alerts_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inactivity_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_logs: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          event_type: string;
          id: string;
          integration_name: string;
          payload_summary: string | null;
          related_contact_id: string | null;
          related_ms_slug: string | null;
          status: string;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          event_type: string;
          id?: string;
          integration_name: string;
          payload_summary?: string | null;
          related_contact_id?: string | null;
          related_ms_slug?: string | null;
          status: string;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          integration_name?: string;
          payload_summary?: string | null;
          related_contact_id?: string | null;
          related_ms_slug?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_logs_related_contact_id_fkey";
            columns: ["related_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey";
            columns: ["related_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey";
            columns: ["related_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey";
            columns: ["related_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey";
            columns: ["related_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "integration_logs_related_ms_slug_fkey";
            columns: ["related_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      journey_contacts: {
        Row: {
          contact_id: string;
          created_at: string;
          id: string;
          is_primary_decision_maker: boolean;
          joined_at: string;
          journey_id: string;
          left_at: string | null;
          role: string;
          role_notes: string | null;
          updated_at: string;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          id?: string;
          is_primary_decision_maker?: boolean;
          joined_at?: string;
          journey_id: string;
          left_at?: string | null;
          role: string;
          role_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          id?: string;
          is_primary_decision_maker?: boolean;
          joined_at?: string;
          journey_id?: string;
          left_at?: string | null;
          role?: string;
          role_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_contacts_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_contacts_journey_id_fkey";
            columns: ["journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
        ];
      };
      journey_pipeline_state: {
        Row: {
          assigned_user_id: string | null;
          closed_at: string | null;
          closed_reason: Database["public"]["Enums"]["pipeline_close_reason"] | null;
          created_at: string;
          current_stage_id: string;
          current_sub_task_id: string | null;
          current_sub_task_started_at: string | null;
          entered_current_stage_at: string;
          entered_pipeline_at: string;
          id: string;
          is_active: boolean;
          journey_id: string;
          pipeline_id: string;
          territory_ms_slug: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_user_id?: string | null;
          closed_at?: string | null;
          closed_reason?: Database["public"]["Enums"]["pipeline_close_reason"] | null;
          created_at?: string;
          current_stage_id: string;
          current_sub_task_id?: string | null;
          current_sub_task_started_at?: string | null;
          entered_current_stage_at?: string;
          entered_pipeline_at?: string;
          id?: string;
          is_active?: boolean;
          journey_id: string;
          pipeline_id: string;
          territory_ms_slug?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_user_id?: string | null;
          closed_at?: string | null;
          closed_reason?: Database["public"]["Enums"]["pipeline_close_reason"] | null;
          created_at?: string;
          current_stage_id?: string;
          current_sub_task_id?: string | null;
          current_sub_task_started_at?: string | null;
          entered_current_stage_at?: string;
          entered_pipeline_at?: string;
          id?: string;
          is_active?: boolean;
          journey_id?: string;
          pipeline_id?: string;
          territory_ms_slug?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journey_pipeline_state_assigned_user_id_fkey";
            columns: ["assigned_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pipeline_state_current_stage_id_fkey";
            columns: ["current_stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pipeline_state_current_sub_task_id_fkey";
            columns: ["current_sub_task_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_sub_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pipeline_state_journey_id_fkey";
            columns: ["journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pipeline_state_pipeline_id_fkey";
            columns: ["pipeline_id"];
            isOneToOne: false;
            referencedRelation: "pipelines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "journey_pipeline_state_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      journeys: {
        Row: {
          close_reason: Database["public"]["Enums"]["pipeline_close_reason"] | null;
          created_at: string;
          id: string;
          name: string;
          parent_journey_id: string | null;
          primary_contact_id: string;
          slug: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          close_reason?: Database["public"]["Enums"]["pipeline_close_reason"] | null;
          created_at?: string;
          id?: string;
          name: string;
          parent_journey_id?: string | null;
          primary_contact_id: string;
          slug?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          close_reason?: Database["public"]["Enums"]["pipeline_close_reason"] | null;
          created_at?: string;
          id?: string;
          name?: string;
          parent_journey_id?: string | null;
          primary_contact_id?: string;
          slug?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journeys_parent_journey_id_fkey";
            columns: ["parent_journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journeys_primary_contact_id_fkey";
            columns: ["primary_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      kb_gap_signals: {
        Row: {
          id: string;
          query: string;
          resolved: boolean;
          resolved_by_doc_id: string | null;
          results_found: number;
          searched_at: string;
          suggested_category: string | null;
        };
        Insert: {
          id?: string;
          query: string;
          resolved?: boolean;
          resolved_by_doc_id?: string | null;
          results_found?: number;
          searched_at?: string;
          suggested_category?: string | null;
        };
        Update: {
          id?: string;
          query?: string;
          resolved?: boolean;
          resolved_by_doc_id?: string | null;
          results_found?: number;
          searched_at?: string;
          suggested_category?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "kb_gap_signals_resolved_by_doc_id_fkey";
            columns: ["resolved_by_doc_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_documents: {
        Row: {
          category: string;
          content: string;
          created_at: string | null;
          flagged_as_stale: boolean;
          gap_signal: string | null;
          id: string;
          is_active: boolean | null;
          last_retrieved_at: string | null;
          priority: number | null;
          retrieval_count: number;
          retrieval_quality_score: number | null;
          seeded_from: string | null;
          status: string | null;
          title: string;
          token_count: number | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          category: string;
          content: string;
          created_at?: string | null;
          flagged_as_stale?: boolean;
          gap_signal?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_retrieved_at?: string | null;
          priority?: number | null;
          retrieval_count?: number;
          retrieval_quality_score?: number | null;
          seeded_from?: string | null;
          status?: string | null;
          title: string;
          token_count?: number | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string | null;
          flagged_as_stale?: boolean;
          gap_signal?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_retrieved_at?: string | null;
          priority?: number | null;
          retrieval_count?: number;
          retrieval_quality_score?: number | null;
          seeded_from?: string | null;
          status?: string | null;
          title?: string;
          token_count?: number | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_sources: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      lead_sub_sources: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          lead_source_id: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lead_source_id: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lead_source_id?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lead_sub_sources_lead_source_id_fkey";
            columns: ["lead_source_id"];
            isOneToOne: false;
            referencedRelation: "lead_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      llm_call_logs: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          id: string;
          input_messages: Json;
          input_tokens: number | null;
          iteration: number | null;
          latency_ms: number | null;
          model: string;
          output_content: Json;
          output_tokens: number | null;
          stop_reason: string | null;
          tool_calls: Json | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          input_messages: Json;
          input_tokens?: number | null;
          iteration?: number | null;
          latency_ms?: number | null;
          model: string;
          output_content: Json;
          output_tokens?: number | null;
          stop_reason?: string | null;
          tool_calls?: Json | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          input_messages?: Json;
          input_tokens?: number | null;
          iteration?: number | null;
          latency_ms?: number | null;
          model?: string;
          output_content?: Json;
          output_tokens?: number | null;
          stop_reason?: string | null;
          tool_calls?: Json | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      market_signals: {
        Row: {
          id: string;
          observed_at: string | null;
          signal_key: string;
          signal_type: string;
          signal_value: Json;
          source: string | null;
        };
        Insert: {
          id?: string;
          observed_at?: string | null;
          signal_key: string;
          signal_type: string;
          signal_value: Json;
          source?: string | null;
        };
        Update: {
          id?: string;
          observed_at?: string | null;
          signal_key?: string;
          signal_type?: string;
          signal_value?: Json;
          source?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          contact_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          recipient_user_id: string;
          source_id: string;
          source_type: Database["public"]["Enums"]["notification_source_type"];
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          recipient_user_id: string;
          source_id: string;
          source_type?: Database["public"]["Enums"]["notification_source_type"];
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          recipient_user_id?: string;
          source_id?: string;
          source_type?: Database["public"]["Enums"]["notification_source_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      objection_registry: {
        Row: {
          call_log_id: string | null;
          contact_id: string;
          created_at: string | null;
          id: string;
          objection_detail: string | null;
          objection_type: string;
          resolution_notes: string | null;
          resolved: boolean | null;
          resolved_at: string | null;
          score_impact: number | null;
          stage_at_time: string;
        };
        Insert: {
          call_log_id?: string | null;
          contact_id: string;
          created_at?: string | null;
          id?: string;
          objection_detail?: string | null;
          objection_type: string;
          resolution_notes?: string | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          score_impact?: number | null;
          stage_at_time: string;
        };
        Update: {
          call_log_id?: string | null;
          contact_id?: string;
          created_at?: string | null;
          id?: string;
          objection_detail?: string | null;
          objection_type?: string;
          resolution_notes?: string | null;
          resolved?: boolean | null;
          resolved_at?: string | null;
          score_impact?: number | null;
          stage_at_time?: string;
        };
        Relationships: [];
      };
      pipeline_app_settings: {
        Row: {
          ghl_sync_enabled: boolean;
          ghl_sync_queue_alert_threshold: number;
          id: number;
          time_in_stage_red_days: number;
          time_in_stage_yellow_days: number;
          updated_at: string;
          updated_by_user_id: string | null;
        };
        Insert: {
          ghl_sync_enabled?: boolean;
          ghl_sync_queue_alert_threshold?: number;
          id?: number;
          time_in_stage_red_days?: number;
          time_in_stage_yellow_days?: number;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Update: {
          ghl_sync_enabled?: boolean;
          ghl_sync_queue_alert_threshold?: number;
          id?: number;
          time_in_stage_red_days?: number;
          time_in_stage_yellow_days?: number;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_app_settings_updated_by_user_id_fkey";
            columns: ["updated_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_stage_history: {
        Row: {
          created_at: string;
          from_stage_id: string | null;
          id: string;
          journey_pipeline_state_id: string;
          moved_by_user_id: string | null;
          reason: string | null;
          to_stage_id: string;
          was_auto: boolean;
          was_revert: boolean;
          was_skip: boolean;
        };
        Insert: {
          created_at?: string;
          from_stage_id?: string | null;
          id?: string;
          journey_pipeline_state_id: string;
          moved_by_user_id?: string | null;
          reason?: string | null;
          to_stage_id: string;
          was_auto?: boolean;
          was_revert?: boolean;
          was_skip?: boolean;
        };
        Update: {
          created_at?: string;
          from_stage_id?: string | null;
          id?: string;
          journey_pipeline_state_id?: string;
          moved_by_user_id?: string | null;
          reason?: string | null;
          to_stage_id?: string;
          was_auto?: boolean;
          was_revert?: boolean;
          was_skip?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_history_from_stage_id_fkey";
            columns: ["from_stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_stage_history_journey_pipeline_state_id_fkey";
            columns: ["journey_pipeline_state_id"];
            isOneToOne: false;
            referencedRelation: "journey_pipeline_state";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_stage_history_moved_by_user_id_fkey";
            columns: ["moved_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_stage_history_to_stage_id_fkey";
            columns: ["to_stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_stages: {
        Row: {
          auto_advance_enabled: boolean;
          auto_spawn_pipeline_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_terminal: boolean;
          name: string;
          pipeline_id: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          auto_advance_enabled?: boolean;
          auto_spawn_pipeline_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_terminal?: boolean;
          name: string;
          pipeline_id: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          auto_advance_enabled?: boolean;
          auto_spawn_pipeline_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_terminal?: boolean;
          name?: string;
          pipeline_id?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_auto_spawn_pipeline_id_fkey";
            columns: ["auto_spawn_pipeline_id"];
            isOneToOne: false;
            referencedRelation: "pipelines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey";
            columns: ["pipeline_id"];
            isOneToOne: false;
            referencedRelation: "pipelines";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_sub_tasks: {
        Row: {
          created_at: string;
          default_logger_type: Database["public"]["Enums"]["sub_task_logger_type"];
          default_logger_user_id: string | null;
          description: string | null;
          first_state_label: string | null;
          id: string;
          is_required: boolean;
          name: string;
          second_state_label: string | null;
          slug: string;
          sort_order: number;
          stage_id: string;
          state_type: Database["public"]["Enums"]["sub_task_state_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_logger_type?: Database["public"]["Enums"]["sub_task_logger_type"];
          default_logger_user_id?: string | null;
          description?: string | null;
          first_state_label?: string | null;
          id?: string;
          is_required?: boolean;
          name: string;
          second_state_label?: string | null;
          slug: string;
          sort_order?: number;
          stage_id: string;
          state_type?: Database["public"]["Enums"]["sub_task_state_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_logger_type?: Database["public"]["Enums"]["sub_task_logger_type"];
          default_logger_user_id?: string | null;
          description?: string | null;
          first_state_label?: string | null;
          id?: string;
          is_required?: boolean;
          name?: string;
          second_state_label?: string | null;
          slug?: string;
          sort_order?: number;
          stage_id?: string;
          state_type?: Database["public"]["Enums"]["sub_task_state_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_sub_tasks_default_logger_user_id_fkey";
            columns: ["default_logger_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_sub_tasks_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["id"];
          },
        ];
      };
      pipelines: {
        Row: {
          created_at: string;
          description: string | null;
          entity_type: string;
          ghl_field_id: string | null;
          id: string;
          is_active: boolean;
          is_visible_in_nav: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          entity_type?: string;
          ghl_field_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_visible_in_nav?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          entity_type?: string;
          ghl_field_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_visible_in_nav?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      read_ai_sessions: {
        Row: {
          call_type: string | null;
          classified_at: string | null;
          created_at: string | null;
          end_time: string | null;
          error_message: string | null;
          linked_call_id: string | null;
          owner_email: string | null;
          participant_emails: string[] | null;
          platform: string | null;
          processed_at: string | null;
          processing_status: string | null;
          raw_payload: Json | null;
          session_id: string;
          start_time: string | null;
          title: string | null;
        };
        Insert: {
          call_type?: string | null;
          classified_at?: string | null;
          created_at?: string | null;
          end_time?: string | null;
          error_message?: string | null;
          linked_call_id?: string | null;
          owner_email?: string | null;
          participant_emails?: string[] | null;
          platform?: string | null;
          processed_at?: string | null;
          processing_status?: string | null;
          raw_payload?: Json | null;
          session_id: string;
          start_time?: string | null;
          title?: string | null;
        };
        Update: {
          call_type?: string | null;
          classified_at?: string | null;
          created_at?: string | null;
          end_time?: string | null;
          error_message?: string | null;
          linked_call_id?: string | null;
          owner_email?: string | null;
          participant_emails?: string[] | null;
          platform?: string | null;
          processed_at?: string | null;
          processing_status?: string | null;
          raw_payload?: Json | null;
          session_id?: string;
          start_time?: string | null;
          title?: string | null;
        };
        Relationships: [];
      };
      read_ai_webhook_keys: {
        Row: {
          created_at: string | null;
          signing_key: string;
          user_email: string;
        };
        Insert: {
          created_at?: string | null;
          signing_key: string;
          user_email: string;
        };
        Update: {
          created_at?: string | null;
          signing_key?: string;
          user_email?: string;
        };
        Relationships: [];
      };
      rep_journals: {
        Row: {
          calls_completed: number;
          coaching_notes: string | null;
          contacts_touched: number;
          created_at: string;
          focus_tomorrow: string | null;
          ghl_actions_fired: number;
          id: string;
          journal_date: string;
          sub_tasks_logged: number;
          summary: string;
          tenant_id: string | null;
          user_id: string;
        };
        Insert: {
          calls_completed?: number;
          coaching_notes?: string | null;
          contacts_touched?: number;
          created_at?: string;
          focus_tomorrow?: string | null;
          ghl_actions_fired?: number;
          id?: string;
          journal_date: string;
          sub_tasks_logged?: number;
          summary: string;
          tenant_id?: string | null;
          user_id: string;
        };
        Update: {
          calls_completed?: number;
          coaching_notes?: string | null;
          contacts_touched?: number;
          created_at?: string;
          focus_tomorrow?: string | null;
          ghl_actions_fired?: number;
          id?: string;
          journal_date?: string;
          sub_tasks_logged?: number;
          summary?: string;
          tenant_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rep_journals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rubric_criteria: {
        Row: {
          created_at: string;
          description: string | null;
          example_phrases_negative: string[] | null;
          example_phrases_positive: string[] | null;
          id: string;
          kb_document_ids: string[] | null;
          name: string;
          negative_examples: string[] | null;
          positive_examples: string[] | null;
          rubric_id: string;
          sort_order: number;
          updated_at: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          example_phrases_negative?: string[] | null;
          example_phrases_positive?: string[] | null;
          id?: string;
          kb_document_ids?: string[] | null;
          name: string;
          negative_examples?: string[] | null;
          positive_examples?: string[] | null;
          rubric_id: string;
          sort_order?: number;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          example_phrases_negative?: string[] | null;
          example_phrases_positive?: string[] | null;
          id?: string;
          kb_document_ids?: string[] | null;
          name?: string;
          negative_examples?: string[] | null;
          positive_examples?: string[] | null;
          rubric_id?: string;
          sort_order?: number;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "rubrics";
            referencedColumns: ["id"];
          },
        ];
      };
      rubric_review_suggestions: {
        Row: {
          created_at: string;
          criterion_id: string | null;
          criterion_name: string;
          current_state: Json | null;
          id: string;
          issue_type: string;
          review_month: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          suggested_change: string | null;
          supporting_data: Json | null;
        };
        Insert: {
          created_at?: string;
          criterion_id?: string | null;
          criterion_name: string;
          current_state?: Json | null;
          id?: string;
          issue_type: string;
          review_month: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          suggested_change?: string | null;
          supporting_data?: Json | null;
        };
        Update: {
          created_at?: string;
          criterion_id?: string | null;
          criterion_name?: string;
          current_state?: Json | null;
          id?: string;
          issue_type?: string;
          review_month?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          suggested_change?: string | null;
          supporting_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "rubric_review_suggestions_criterion_id_fkey";
            columns: ["criterion_id"];
            isOneToOne: false;
            referencedRelation: "rubric_criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rubric_review_suggestions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rubrics: {
        Row: {
          call_type_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          call_type_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          call_type_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rubrics_call_type_id_fkey";
            columns: ["call_type_id"];
            isOneToOne: false;
            referencedRelation: "call_types";
            referencedColumns: ["id"];
          },
        ];
      };
      scout_action_logs: {
        Row: {
          action_status: string;
          action_type: string;
          confirmed_at: string | null;
          created_at: string | null;
          draft_content: Json;
          error_message: string | null;
          executed_at: string | null;
          final_content: Json | null;
          ghl_contact_id: string | null;
          ghl_response: Json | null;
          id: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          action_status: string;
          action_type: string;
          confirmed_at?: string | null;
          created_at?: string | null;
          draft_content: Json;
          error_message?: string | null;
          executed_at?: string | null;
          final_content?: Json | null;
          ghl_contact_id?: string | null;
          ghl_response?: Json | null;
          id?: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          action_status?: string;
          action_type?: string;
          confirmed_at?: string | null;
          created_at?: string | null;
          draft_content?: Json;
          error_message?: string | null;
          executed_at?: string | null;
          final_content?: Json | null;
          ghl_contact_id?: string | null;
          ghl_response?: Json | null;
          id?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scout_action_logs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scout_action_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      scout_performance_reports: {
        Row: {
          acceptance_rate: number | null;
          action_type_breakdown: Json | null;
          created_at: string;
          edit_rate: number | null;
          id: string;
          kb_gap_signals: Json | null;
          kb_retrieval_count: number;
          most_edited_fields: Json | null;
          rejection_rate: number | null;
          rep_breakdown: Json | null;
          top_rejected_types: Json | null;
          total_suggestions: number;
          week_end: string;
          week_start: string;
        };
        Insert: {
          acceptance_rate?: number | null;
          action_type_breakdown?: Json | null;
          created_at?: string;
          edit_rate?: number | null;
          id?: string;
          kb_gap_signals?: Json | null;
          kb_retrieval_count?: number;
          most_edited_fields?: Json | null;
          rejection_rate?: number | null;
          rep_breakdown?: Json | null;
          top_rejected_types?: Json | null;
          total_suggestions?: number;
          week_end: string;
          week_start: string;
        };
        Update: {
          acceptance_rate?: number | null;
          action_type_breakdown?: Json | null;
          created_at?: string;
          edit_rate?: number | null;
          id?: string;
          kb_gap_signals?: Json | null;
          kb_retrieval_count?: number;
          most_edited_fields?: Json | null;
          rejection_rate?: number | null;
          rep_breakdown?: Json | null;
          top_rejected_types?: Json | null;
          total_suggestions?: number;
          week_end?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      scout_user_memory: {
        Row: {
          content: string;
          turn_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: string;
          turn_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          turn_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scout_user_memory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          context_summary: string | null;
          conversation_history: Json | null;
          ended_at: string | null;
          ghl_contact_focus: string | null;
          id: string;
          is_active: boolean | null;
          last_activity_at: string | null;
          started_at: string | null;
          user_id: string;
        };
        Insert: {
          context_summary?: string | null;
          conversation_history?: Json | null;
          ended_at?: string | null;
          ghl_contact_focus?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_activity_at?: string | null;
          started_at?: string | null;
          user_id: string;
        };
        Update: {
          context_summary?: string | null;
          conversation_history?: Json | null;
          ended_at?: string | null;
          ghl_contact_focus?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_activity_at?: string | null;
          started_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      suggestion_feedback: {
        Row: {
          accepted_value: Json | null;
          call_id: string | null;
          call_type: string | null;
          confidence: string | null;
          contact_id: string | null;
          created_at: string;
          edit_delta: Json | null;
          field_name: string | null;
          final_value: string | null;
          id: string;
          original_value: Json | null;
          outcome: string;
          pipeline_stage: string | null;
          rep_id: string;
          resolved_at: string | null;
          reviewer_id: string | null;
          suggested_value: string | null;
          suggestion_id: string | null;
          suggestion_type: string;
          territory_ms_slug: string | null;
        };
        Insert: {
          accepted_value?: Json | null;
          call_id?: string | null;
          call_type?: string | null;
          confidence?: string | null;
          contact_id?: string | null;
          created_at?: string;
          edit_delta?: Json | null;
          field_name?: string | null;
          final_value?: string | null;
          id?: string;
          original_value?: Json | null;
          outcome: string;
          pipeline_stage?: string | null;
          rep_id: string;
          resolved_at?: string | null;
          reviewer_id?: string | null;
          suggested_value?: string | null;
          suggestion_id?: string | null;
          suggestion_type: string;
          territory_ms_slug?: string | null;
        };
        Update: {
          accepted_value?: Json | null;
          call_id?: string | null;
          call_type?: string | null;
          confidence?: string | null;
          contact_id?: string | null;
          created_at?: string;
          edit_delta?: Json | null;
          field_name?: string | null;
          final_value?: string | null;
          id?: string;
          original_value?: Json | null;
          outcome?: string;
          pipeline_stage?: string | null;
          rep_id?: string;
          resolved_at?: string | null;
          reviewer_id?: string | null;
          suggested_value?: string | null;
          suggestion_id?: string | null;
          suggestion_type?: string;
          territory_ms_slug?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suggestion_feedback_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggestion_feedback_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggestion_feedback_rep_id_fkey";
            columns: ["rep_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "suggestion_feedback_territory_ms_slug_fkey";
            columns: ["territory_ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      system_logs: {
        Row: {
          action_type: string;
          contact_id: string | null;
          created_at: string;
          id: string;
          input_params: Json | null;
          log_date: string;
          result_summary: string | null;
          tenant_id: string | null;
          user_id: string | null;
          was_auto: boolean;
        };
        Insert: {
          action_type: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          input_params?: Json | null;
          log_date?: string;
          result_summary?: string | null;
          tenant_id?: string | null;
          user_id?: string | null;
          was_auto?: boolean;
        };
        Update: {
          action_type?: string;
          contact_id?: string | null;
          created_at?: string;
          id?: string;
          input_params?: Json | null;
          log_date?: string;
          result_summary?: string | null;
          tenant_id?: string | null;
          user_id?: string | null;
          was_auto?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "system_logs_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      territories: {
        Row: {
          awarded_date: string | null;
          created_at: string;
          ms_slug: string;
          region: string | null;
          status: string;
          territory_name: string;
          updated_at: string;
        };
        Insert: {
          awarded_date?: string | null;
          created_at?: string;
          ms_slug: string;
          region?: string | null;
          status?: string;
          territory_name: string;
          updated_at?: string;
        };
        Update: {
          awarded_date?: string | null;
          created_at?: string;
          ms_slug?: string;
          region?: string | null;
          status?: string;
          territory_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      territory_candidates: {
        Row: {
          created_at: string;
          ghl_contact_id: string;
          id: string;
          ms_slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ghl_contact_id: string;
          id?: string;
          ms_slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ghl_contact_id?: string;
          id?: string;
          ms_slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "territory_candidates_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_candidates_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      territory_grades: {
        Row: {
          created_at: string;
          houses_purchased: number | null;
          id: string;
          john_grade: number | null;
          ms_slug: string;
          notes: string | null;
          quarter: number;
          self_grade: number | null;
          year: number;
        };
        Insert: {
          created_at?: string;
          houses_purchased?: number | null;
          id?: string;
          john_grade?: number | null;
          ms_slug: string;
          notes?: string | null;
          quarter: number;
          self_grade?: number | null;
          year: number;
        };
        Update: {
          created_at?: string;
          houses_purchased?: number | null;
          id?: string;
          john_grade?: number | null;
          ms_slug?: string;
          notes?: string | null;
          quarter?: number;
          self_grade?: number | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "territory_grades_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_grades_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      territory_market_data: {
        Row: {
          field_name: string;
          field_value: string | null;
          id: string;
          source: string | null;
          source_date: string | null;
          territory_slug: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          field_name: string;
          field_value?: string | null;
          id?: string;
          source?: string | null;
          source_date?: string | null;
          territory_slug: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          field_name?: string;
          field_value?: string | null;
          id?: string;
          source?: string | null;
          source_date?: string | null;
          territory_slug?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "territory_market_data_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      territory_owners: {
        Row: {
          created_at: string;
          end_date: string | null;
          ghl_contact_id: string | null;
          id: string;
          ms_slug: string;
          role: string;
          start_date: string;
          transfer_notes: string | null;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          ghl_contact_id?: string | null;
          id?: string;
          ms_slug: string;
          role?: string;
          start_date?: string;
          transfer_notes?: string | null;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          ghl_contact_id?: string | null;
          id?: string;
          ms_slug?: string;
          role?: string;
          start_date?: string;
          transfer_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_owners_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      territory_profile: {
        Row: {
          active_deals: number | null;
          actual_purchases: number | null;
          avg_profit_per_flip: number | null;
          avg_time_to_flip_days: number | null;
          coaching_notes: string | null;
          competitor_presence: string | null;
          created_at: string;
          flip_activity_score: number | null;
          houses_purchased_ytd: number | null;
          houses_sold_ytd: number | null;
          last_checkin_date: string | null;
          lead_conversion_rate: number | null;
          leads_received_ytd: number | null;
          local_market_notes: string | null;
          market_type: string | null;
          ms_slug: string;
          projected_purchases: number | null;
          revenue_ytd: number | null;
          stage3_pct: number | null;
          stage5_pct: number | null;
          territory_value_est: number | null;
          total_invested: number | null;
          updated_at: string;
        };
        Insert: {
          active_deals?: number | null;
          actual_purchases?: number | null;
          avg_profit_per_flip?: number | null;
          avg_time_to_flip_days?: number | null;
          coaching_notes?: string | null;
          competitor_presence?: string | null;
          created_at?: string;
          flip_activity_score?: number | null;
          houses_purchased_ytd?: number | null;
          houses_sold_ytd?: number | null;
          last_checkin_date?: string | null;
          lead_conversion_rate?: number | null;
          leads_received_ytd?: number | null;
          local_market_notes?: string | null;
          market_type?: string | null;
          ms_slug: string;
          projected_purchases?: number | null;
          revenue_ytd?: number | null;
          stage3_pct?: number | null;
          stage5_pct?: number | null;
          territory_value_est?: number | null;
          total_invested?: number | null;
          updated_at?: string;
        };
        Update: {
          active_deals?: number | null;
          actual_purchases?: number | null;
          avg_profit_per_flip?: number | null;
          avg_time_to_flip_days?: number | null;
          coaching_notes?: string | null;
          competitor_presence?: string | null;
          created_at?: string;
          flip_activity_score?: number | null;
          houses_purchased_ytd?: number | null;
          houses_sold_ytd?: number | null;
          last_checkin_date?: string | null;
          lead_conversion_rate?: number | null;
          leads_received_ytd?: number | null;
          local_market_notes?: string | null;
          market_type?: string | null;
          ms_slug?: string;
          projected_purchases?: number | null;
          revenue_ytd?: number | null;
          stage3_pct?: number | null;
          stage5_pct?: number | null;
          territory_value_est?: number | null;
          total_invested?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "territory_profile_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_profile_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: true;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      territory_stakeholders: {
        Row: {
          company: string | null;
          contact_id: string | null;
          created_at: string;
          email: string | null;
          first_name: string | null;
          id: string;
          is_active: boolean;
          last_name: string | null;
          ms_slug: string;
          notes: string | null;
          phone: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          company?: string | null;
          contact_id?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          is_active?: boolean;
          last_name?: string | null;
          ms_slug: string;
          notes?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          company?: string | null;
          contact_id?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          id?: string;
          is_active?: boolean;
          last_name?: string | null;
          ms_slug?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "territory_stakeholders_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "territory_stakeholders_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
      transcript_jobs: {
        Row: {
          attempts: number;
          audio_url: string;
          call_id: string;
          completed_at: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          started_at: string | null;
          status: string;
          transcript_id: string | null;
        };
        Insert: {
          attempts?: number;
          audio_url: string;
          call_id: string;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          transcript_id?: string | null;
        };
        Update: {
          attempts?: number;
          audio_url?: string;
          call_id?: string;
          completed_at?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          transcript_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transcript_jobs_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      user_email_aliases: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_email_aliases_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_memory: {
        Row: {
          confidence: number | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          memory_key: string;
          memory_type: string;
          memory_value: string;
          source: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          memory_key: string;
          memory_type: string;
          memory_value: string;
          source: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          confidence?: number | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          memory_key?: string;
          memory_type?: string;
          memory_value?: string;
          source?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_memory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string;
          full_name: string;
          ghl_user_id: string | null;
          id: string;
          is_active: boolean | null;
          is_real_user: boolean;
          label_color: string | null;
          last_login_at: string | null;
          role: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          full_name: string;
          ghl_user_id?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_real_user?: boolean;
          label_color?: string | null;
          last_login_at?: string | null;
          role: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          full_name?: string;
          ghl_user_id?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_real_user?: boolean;
          label_color?: string | null;
          last_login_at?: string | null;
          role?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      workflow_ab_tests: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          created_by: string;
          declared_by: string | null;
          id: string;
          min_sample_size: number | null;
          status: string;
          test_type: string;
          variant_a_count: number | null;
          variant_a_metric: number | null;
          variant_a_step_id: string | null;
          variant_a_version_id: string | null;
          variant_b_count: number | null;
          variant_b_metric: number | null;
          variant_b_step_id: string | null;
          variant_b_version_id: string | null;
          winner: string | null;
          winner_explanation: string | null;
          workflow_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          created_by: string;
          declared_by?: string | null;
          id?: string;
          min_sample_size?: number | null;
          status?: string;
          test_type: string;
          variant_a_count?: number | null;
          variant_a_metric?: number | null;
          variant_a_step_id?: string | null;
          variant_a_version_id?: string | null;
          variant_b_count?: number | null;
          variant_b_metric?: number | null;
          variant_b_step_id?: string | null;
          variant_b_version_id?: string | null;
          winner?: string | null;
          winner_explanation?: string | null;
          workflow_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string;
          declared_by?: string | null;
          id?: string;
          min_sample_size?: number | null;
          status?: string;
          test_type?: string;
          variant_a_count?: number | null;
          variant_a_metric?: number | null;
          variant_a_step_id?: string | null;
          variant_a_version_id?: string | null;
          variant_b_count?: number | null;
          variant_b_metric?: number | null;
          variant_b_step_id?: string | null;
          variant_b_version_id?: string | null;
          winner?: string | null;
          winner_explanation?: string | null;
          workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_ab_tests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_ab_tests_declared_by_fkey";
            columns: ["declared_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_a_step_id_fkey";
            columns: ["variant_a_step_id"];
            isOneToOne: false;
            referencedRelation: "workflow_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_a_version_id_fkey";
            columns: ["variant_a_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_b_step_id_fkey";
            columns: ["variant_b_step_id"];
            isOneToOne: false;
            referencedRelation: "workflow_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_ab_tests_variant_b_version_id_fkey";
            columns: ["variant_b_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_ab_tests_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_approvals: {
        Row: {
          ab_test_id: string | null;
          approval_type: string;
          approved_by: string | null;
          id: string;
          notes: string | null;
          resolved_at: string | null;
          status: string;
          submitted_at: string | null;
          submitted_by: string;
          workflow_id: string;
          workflow_version_id: string | null;
        };
        Insert: {
          ab_test_id?: string | null;
          approval_type: string;
          approved_by?: string | null;
          id?: string;
          notes?: string | null;
          resolved_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by: string;
          workflow_id: string;
          workflow_version_id?: string | null;
        };
        Update: {
          ab_test_id?: string | null;
          approval_type?: string;
          approved_by?: string | null;
          id?: string;
          notes?: string | null;
          resolved_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string;
          workflow_id?: string;
          workflow_version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_ab_test_id_fkey";
            columns: ["ab_test_id"];
            isOneToOne: false;
            referencedRelation: "workflow_ab_tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_approvals_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_approvals_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_approvals_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_approvals_workflow_version_id_fkey";
            columns: ["workflow_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_enrollments: {
        Row: {
          completed_at: string | null;
          contact_name: string | null;
          current_day: number | null;
          current_step_id: string | null;
          enrolled_at: string | null;
          exit_reason: string | null;
          ghl_contact_id: string;
          goal_achieved: boolean | null;
          id: string;
          last_step_at: string | null;
          paused_at: string | null;
          status: string;
          workflow_id: string;
          workflow_version_id: string;
        };
        Insert: {
          completed_at?: string | null;
          contact_name?: string | null;
          current_day?: number | null;
          current_step_id?: string | null;
          enrolled_at?: string | null;
          exit_reason?: string | null;
          ghl_contact_id: string;
          goal_achieved?: boolean | null;
          id?: string;
          last_step_at?: string | null;
          paused_at?: string | null;
          status?: string;
          workflow_id: string;
          workflow_version_id: string;
        };
        Update: {
          completed_at?: string | null;
          contact_name?: string | null;
          current_day?: number | null;
          current_step_id?: string | null;
          enrolled_at?: string | null;
          exit_reason?: string | null;
          ghl_contact_id?: string;
          goal_achieved?: boolean | null;
          id?: string;
          last_step_at?: string | null;
          paused_at?: string | null;
          status?: string;
          workflow_id?: string;
          workflow_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_enrollments_current_step_id_fkey";
            columns: ["current_step_id"];
            isOneToOne: false;
            referencedRelation: "workflow_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_enrollments_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_enrollments_workflow_version_id_fkey";
            columns: ["workflow_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_step_logs: {
        Row: {
          clicked: boolean | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          content_sent: string | null;
          created_at: string | null;
          delivered: boolean | null;
          delivery_data: Json | null;
          enrollment_id: string;
          executed_at: string | null;
          ghl_contact_id: string;
          ghl_message_id: string | null;
          id: string;
          opened: boolean | null;
          responded: boolean | null;
          step_id: string;
          step_type: string;
        };
        Insert: {
          clicked?: boolean | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          content_sent?: string | null;
          created_at?: string | null;
          delivered?: boolean | null;
          delivery_data?: Json | null;
          enrollment_id: string;
          executed_at?: string | null;
          ghl_contact_id: string;
          ghl_message_id?: string | null;
          id?: string;
          opened?: boolean | null;
          responded?: boolean | null;
          step_id: string;
          step_type: string;
        };
        Update: {
          clicked?: boolean | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          content_sent?: string | null;
          created_at?: string | null;
          delivered?: boolean | null;
          delivery_data?: Json | null;
          enrollment_id?: string;
          executed_at?: string | null;
          ghl_contact_id?: string;
          ghl_message_id?: string | null;
          id?: string;
          opened?: boolean | null;
          responded?: boolean | null;
          step_id?: string;
          step_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_step_logs_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_step_logs_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "workflow_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_step_logs_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "workflow_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_steps: {
        Row: {
          click_rate: number | null;
          condition_config: Json | null;
          content: string | null;
          created_at: string | null;
          day_number: number;
          id: string;
          open_rate: number | null;
          performance_status: string | null;
          requires_confirmation: boolean | null;
          response_rate: number | null;
          send_time: string | null;
          step_number: number;
          step_type: string;
          subject: string | null;
          workflow_version_id: string;
        };
        Insert: {
          click_rate?: number | null;
          condition_config?: Json | null;
          content?: string | null;
          created_at?: string | null;
          day_number: number;
          id?: string;
          open_rate?: number | null;
          performance_status?: string | null;
          requires_confirmation?: boolean | null;
          response_rate?: number | null;
          send_time?: string | null;
          step_number: number;
          step_type: string;
          subject?: string | null;
          workflow_version_id: string;
        };
        Update: {
          click_rate?: number | null;
          condition_config?: Json | null;
          content?: string | null;
          created_at?: string | null;
          day_number?: number;
          id?: string;
          open_rate?: number | null;
          performance_status?: string | null;
          requires_confirmation?: boolean | null;
          response_rate?: number | null;
          send_time?: string | null;
          step_number?: number;
          step_type?: string;
          subject?: string | null;
          workflow_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_version_id_fkey";
            columns: ["workflow_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_versions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          change_description: string | null;
          created_at: string | null;
          created_by: string;
          id: string;
          update_mode: string | null;
          version_number: number;
          workflow_id: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          change_description?: string | null;
          created_at?: string | null;
          created_by: string;
          id?: string;
          update_mode?: string | null;
          version_number: number;
          workflow_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          change_description?: string | null;
          created_at?: string | null;
          created_by?: string;
          id?: string;
          update_mode?: string | null;
          version_number?: number;
          workflow_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_versions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflows: {
        Row: {
          active_enrollee_count: number | null;
          created_at: string | null;
          created_by: string;
          current_version_id: string | null;
          description: string | null;
          exit_conditions: Json | null;
          health_score: string | null;
          id: string;
          name: string;
          pause_conditions: Json | null;
          primary_metric_name: string | null;
          primary_metric_value: number | null;
          status: string;
          trigger_config: Json | null;
          trigger_type: string;
          updated_at: string | null;
          workflow_type: string;
        };
        Insert: {
          active_enrollee_count?: number | null;
          created_at?: string | null;
          created_by: string;
          current_version_id?: string | null;
          description?: string | null;
          exit_conditions?: Json | null;
          health_score?: string | null;
          id?: string;
          name: string;
          pause_conditions?: Json | null;
          primary_metric_name?: string | null;
          primary_metric_value?: number | null;
          status?: string;
          trigger_config?: Json | null;
          trigger_type: string;
          updated_at?: string | null;
          workflow_type: string;
        };
        Update: {
          active_enrollee_count?: number | null;
          created_at?: string | null;
          created_by?: string;
          current_version_id?: string | null;
          description?: string | null;
          exit_conditions?: Json | null;
          health_score?: string | null;
          id?: string;
          name?: string;
          pause_conditions?: Json | null;
          primary_metric_name?: string | null;
          primary_metric_value?: number | null;
          status?: string;
          trigger_config?: Json | null;
          trigger_type?: string;
          updated_at?: string | null;
          workflow_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_workflows_current_version";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "workflow_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      zorakle_assessments: {
        Row: {
          batch: string | null;
          biz_path_score: number | null;
          contact_id: string | null;
          created_at: string;
          cultural_score: number | null;
          culture: string | null;
          eclipse_drive_id: string | null;
          eclipse_overall: number | null;
          full_name: string;
          id: string;
          ms_slug: string | null;
          sales_score: number | null;
          spoton_drive_id: string | null;
          stages_score: number | null;
          values_score: number | null;
          values_type: string | null;
          work_style: string | null;
        };
        Insert: {
          batch?: string | null;
          biz_path_score?: number | null;
          contact_id?: string | null;
          created_at?: string;
          cultural_score?: number | null;
          culture?: string | null;
          eclipse_drive_id?: string | null;
          eclipse_overall?: number | null;
          full_name: string;
          id?: string;
          ms_slug?: string | null;
          sales_score?: number | null;
          spoton_drive_id?: string | null;
          stages_score?: number | null;
          values_score?: number | null;
          values_type?: string | null;
          work_style?: string | null;
        };
        Update: {
          batch?: string | null;
          biz_path_score?: number | null;
          contact_id?: string | null;
          created_at?: string;
          cultural_score?: number | null;
          culture?: string | null;
          eclipse_drive_id?: string | null;
          eclipse_overall?: number | null;
          full_name?: string;
          id?: string;
          ms_slug?: string | null;
          sales_score?: number | null;
          spoton_drive_id?: string | null;
          stages_score?: number | null;
          values_score?: number | null;
          values_type?: string | null;
          work_style?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "zorakle_assessments_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      zorakle_profiles: {
        Row: {
          batch: string | null;
          biz_path_score: number | null;
          created_at: string;
          cultural_score: number | null;
          culture: string | null;
          eclipse_drive_id: string | null;
          eclipse_overall: number | null;
          fit_score: number | null;
          full_name: string;
          id: string;
          ms_slug: string | null;
          risk_flag: string | null;
          sales_score: number | null;
          spoton_drive_id: string | null;
          stages_score: number | null;
          values_score: number | null;
          values_type: string | null;
          work_style: string | null;
        };
        Insert: {
          batch?: string | null;
          biz_path_score?: number | null;
          created_at?: string;
          cultural_score?: number | null;
          culture?: string | null;
          eclipse_drive_id?: string | null;
          eclipse_overall?: number | null;
          fit_score?: number | null;
          full_name: string;
          id?: string;
          ms_slug?: string | null;
          risk_flag?: string | null;
          sales_score?: number | null;
          spoton_drive_id?: string | null;
          stages_score?: number | null;
          values_score?: number | null;
          values_type?: string | null;
          work_style?: string | null;
        };
        Update: {
          batch?: string | null;
          biz_path_score?: number | null;
          created_at?: string;
          cultural_score?: number | null;
          culture?: string | null;
          eclipse_drive_id?: string | null;
          eclipse_overall?: number | null;
          fit_score?: number | null;
          full_name?: string;
          id?: string;
          ms_slug?: string | null;
          risk_flag?: string | null;
          sales_score?: number | null;
          spoton_drive_id?: string | null;
          stages_score?: number | null;
          values_score?: number | null;
          values_type?: string | null;
          work_style?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "contact_territory_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "current_territory_owners";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territories";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_ownership_history";
            referencedColumns: ["ms_slug"];
          },
          {
            foreignKeyName: "zorakle_profiles_ms_slug_fkey";
            columns: ["ms_slug"];
            isOneToOne: false;
            referencedRelation: "territory_performance";
            referencedColumns: ["ms_slug"];
          },
        ];
      };
    };
    Views: {
      contact_territory_history: {
        Row: {
          contact_name: string | null;
          end_date: string | null;
          ghl_contact_id: string | null;
          is_current: boolean | null;
          ms_slug: string | null;
          role: string | null;
          start_date: string | null;
          territory_name: string | null;
          transfer_notes: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
      current_territory_owners: {
        Row: {
          email: string | null;
          first_name: string | null;
          ghl_contact_id: string | null;
          last_name: string | null;
          ms_slug: string | null;
          owner_record_id: string | null;
          phone: string | null;
          region: string | null;
          role: string | null;
          start_date: string | null;
          territory_name: string | null;
          territory_status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
      territory_ownership_history: {
        Row: {
          days_owned: number | null;
          end_date: string | null;
          ghl_contact_id: string | null;
          ms_slug: string | null;
          owner_name: string | null;
          role: string | null;
          start_date: string | null;
          territory_name: string | null;
          transfer_notes: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey";
            columns: ["ghl_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
      territory_performance: {
        Row: {
          active_deals: number | null;
          avg_profit_per_flip: number | null;
          current_owner_contact_id: string | null;
          current_owner_name: string | null;
          houses_purchased_ytd: number | null;
          houses_sold_ytd: number | null;
          lead_conversion_rate: number | null;
          ms_slug: string | null;
          status: string | null;
          territory_name: string | null;
          velocity_status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "territory_owners_ghl_contact_id_fkey";
            columns: ["current_owner_contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["ghl_contact_id"];
          },
        ];
      };
    };
    Functions: {
      current_user_role: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      is_admin_or_operator: { Args: never; Returns: boolean };
      match_embeddings: {
        Args: {
          contact_id_filter?: string;
          content_type_filter?: string;
          match_limit?: number;
          query_embedding: string;
          similarity_threshold?: number;
        };
        Returns: {
          contact_id: string;
          content: string;
          content_type: string;
          id: string;
          metadata: Json;
          similarity: number;
        }[];
      };
      seed_eos_territory: { Args: { p_slug: string }; Returns: undefined };
    };
    Enums: {
      cron_job_status: "running" | "success" | "failed";
      ghl_sync_status: "pending" | "success" | "failed";
      log_content_type: "note" | "file" | "link" | "transcript" | "appointment" | "email" | "sms" | "call";
      log_source: "manual" | "api" | "ai";
      log_state_advance: "first" | "second";
      notification_source_type: "activity_mention";
      pipeline_close_reason: "won" | "dropped_to_followup" | "dropped_to_nurture" | "split";
      sub_task_logger_type: "user" | "api" | "ai" | "null";
      sub_task_state_type: "single" | "two_state";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cron_job_status: ["running", "success", "failed"],
      ghl_sync_status: ["pending", "success", "failed"],
      log_content_type: ["note", "file", "link", "transcript", "appointment", "email", "sms", "call"],
      log_source: ["manual", "api", "ai"],
      log_state_advance: ["first", "second"],
      notification_source_type: ["activity_mention"],
      pipeline_close_reason: ["won", "dropped_to_followup", "dropped_to_nurture", "split"],
      sub_task_logger_type: ["user", "api", "ai", "null"],
      sub_task_state_type: ["single", "two_state"],
    },
  },
} as const;
