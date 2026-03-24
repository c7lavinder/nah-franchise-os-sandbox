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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
          created_at?: string | null
          dropdown_options?: Json | null
          entity_type: string
          field_key: string
          field_name: string
          field_type: string
          ghl_field_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dropdown_options?: Json | null
          entity_type?: string
          field_key?: string
          field_name?: string
          field_type?: string
          ghl_field_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
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
      knowledge_documents: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          title: string
          token_count: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          title: string
          token_count?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
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
          stop_reason?: string | null
          tool_calls?: Json | null
          user_id?: string | null
        }
        Relationships: []
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
          action_status: string
          action_type: string
          confirmed_at?: string | null
          created_at?: string | null
          draft_content: Json
          error_message?: string | null
          executed_at?: string | null
          final_content?: Json | null
          ghl_contact_id?: string | null
          ghl_response?: Json | null
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          action_status?: string
          action_type?: string
          confirmed_at?: string | null
          created_at?: string | null
          draft_content?: Json
          error_message?: string | null
          executed_at?: string | null
          final_content?: Json | null
          ghl_contact_id?: string | null
          ghl_response?: Json | null
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string | null
          email: string
          full_name: string
          ghl_user_id: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          ghl_user_id?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          ghl_user_id?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
