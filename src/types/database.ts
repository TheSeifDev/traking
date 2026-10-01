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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auth_rate_limits: {
        Row: {
          attempts: number
          expires_at: string
          first_attempt_at: string
          key: string
        }
        Insert: {
          attempts?: number
          expires_at: string
          first_attempt_at?: string
          key: string
        }
        Update: {
          attempts?: number
          expires_at?: string
          first_attempt_at?: string
          key?: string
        }
        Relationships: []
      }
      cron_executions: {
        Row: {
          created_at: string
          error_code: string | null
          execution_key: string
          finished_at: string | null
          health_status: string | null
          http_status: number | null
          id: string
          job_name: string
          latency_ms: number | null
          schedule: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          execution_key: string
          finished_at?: string | null
          health_status?: string | null
          http_status?: number | null
          id?: string
          job_name: string
          latency_ms?: number | null
          schedule: string
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          execution_key?: string
          finished_at?: string | null
          health_status?: string | null
          http_status?: number | null
          id?: string
          job_name?: string
          latency_ms?: number | null
          schedule?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          last_sent_at: string | null
          profile_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          id?: string
          last_sent_at?: string | null
          profile_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          last_sent_at?: string | null
          profile_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          organization_id: string
          profile_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          status: Database["public"]["Enums"]["organization_member_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          organization_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_member_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          organization_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          status?: Database["public"]["Enums"]["organization_member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          duration_ms: number | null
          id: string
          level: string
          metadata: Json
          route: string | null
          session_id: string | null
          status: number | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          action: string
          category: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          level: string
          metadata?: Json
          route?: string | null
          session_id?: string | null
          status?: number | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          level?: string
          metadata?: Json
          route?: string | null
          session_id?: string | null
          status?: number | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "watch_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_logs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          failed_login_attempts: number
          id: string
          is_active: boolean
          last_login_at: string | null
          last_seen_at: string | null
          locked_until: string | null
          must_change_password: boolean
          name: string | null
          password_changed_at: string
          password_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failed_login_attempts?: number
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          locked_until?: string | null
          must_change_password?: boolean
          name?: string | null
          password_changed_at?: string
          password_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failed_login_attempts?: number
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_seen_at?: string | null
          locked_until?: string | null
          must_change_password?: boolean
          name?: string | null
          password_changed_at?: string
          password_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      role_change_audit: {
        Row: {
          changed_at: string
          changed_by_user_id: string
          id: string
          new_role: Database["public"]["Enums"]["user_role"]
          previous_role: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id: string
          id?: string
          new_role: Database["public"]["Enums"]["user_role"]
          previous_role: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string
          id?: string
          new_role?: Database["public"]["Enums"]["user_role"]
          previous_role?: Database["public"]["Enums"]["user_role"]
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_change_audit_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_change_audit_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          profile_id: string
          role: Database["public"]["Enums"]["space_member_role"]
          space_id: string
          status: Database["public"]["Enums"]["space_member_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["space_member_role"]
          space_id: string
          status?: Database["public"]["Enums"]["space_member_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["space_member_role"]
          space_id?: string
          status?: Database["public"]["Enums"]["space_member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          is_revoked: boolean
          last_used_at: string
          revoked_at: string | null
          session_token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean
          last_used_at?: string
          revoked_at?: string | null
          session_token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          is_revoked?: boolean
          last_used_at?: string
          revoked_at?: string | null
          session_token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration: number | null
          id: string
          organization_id: string | null
          source_type: Database["public"]["Enums"]["video_source_type"]
          source_url: string
          space_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          organization_id?: string | null
          source_type: Database["public"]["Enums"]["video_source_type"]
          source_url: string
          space_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          organization_id?: string | null
          source_type?: Database["public"]["Enums"]["video_source_type"]
          source_url?: string
          space_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_identities: {
        Row: {
          created_at: string
          email: string
          id: string
          last_seen_at: string
          name: string
          normalized_email: string
          watch_link_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_seen_at?: string
          name: string
          normalized_email: string
          watch_link_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_seen_at?: string
          name?: string
          normalized_email?: string
          watch_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewer_identities_watch_link_id_fkey"
            columns: ["watch_link_id"]
            isOneToOne: false
            referencedRelation: "watch_links"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_events: {
        Row: {
          client_event_id: string | null
          created_at: string
          duration: number | null
          event_type: Database["public"]["Enums"]["watch_event_type"]
          from_position: number | null
          from_rate: number | null
          id: string
          metadata: Json
          occurred_at: string | null
          playback_rate: number | null
          position: number
          received_at: string
          sequence_number: number | null
          session_id: string
          to_rate: number | null
        }
        Insert: {
          client_event_id?: string | null
          created_at?: string
          duration?: number | null
          event_type: Database["public"]["Enums"]["watch_event_type"]
          from_position?: number | null
          from_rate?: number | null
          id?: string
          metadata?: Json
          occurred_at?: string | null
          playback_rate?: number | null
          position?: number
          received_at?: string
          sequence_number?: number | null
          session_id: string
          to_rate?: number | null
        }
        Update: {
          client_event_id?: string | null
          created_at?: string
          duration?: number | null
          event_type?: Database["public"]["Enums"]["watch_event_type"]
          from_position?: number | null
          from_rate?: number | null
          id?: string
          metadata?: Json
          occurred_at?: string | null
          playback_rate?: number | null
          position?: number
          received_at?: string
          sequence_number?: number | null
          session_id?: string
          to_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "watch_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          revoked_at: string | null
          token: string
          video_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          token?: string
          video_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          token?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_links_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_sessions: {
        Row: {
          browser: string | null
          completion_percentage: number
          device_type: string | null
          ended_at: string | null
          id: string
          last_seen_at: string
          os: string | null
          session_token: string
          started_at: string
          viewer_identifier: string | null
          viewer_identity_id: string | null
          viewer_profile_id: string | null
          watch_link_id: string
          watch_time_seconds: number
        }
        Insert: {
          browser?: string | null
          completion_percentage?: number
          device_type?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          os?: string | null
          session_token: string
          started_at?: string
          viewer_identifier?: string | null
          viewer_identity_id?: string | null
          viewer_profile_id?: string | null
          watch_link_id: string
          watch_time_seconds?: number
        }
        Update: {
          browser?: string | null
          completion_percentage?: number
          device_type?: string | null
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          os?: string | null
          session_token?: string
          started_at?: string
          viewer_identifier?: string | null
          viewer_identity_id?: string | null
          viewer_profile_id?: string | null
          watch_link_id?: string
          watch_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "watch_sessions_viewer_identity_id_fkey"
            columns: ["viewer_identity_id"]
            isOneToOne: false
            referencedRelation: "viewer_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_sessions_viewer_profile_id_fkey"
            columns: ["viewer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_sessions_watch_link_id_fkey"
            columns: ["watch_link_id"]
            isOneToOne: false
            referencedRelation: "watch_links"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_user_sessions: { Args: never; Returns: number }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin_or_owner: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      touch_profile_last_seen: {
        Args: { p_profile_id: string }
        Returns: string
      }
    }
    Enums: {
      organization_member_role: "admin" | "member"
      organization_member_status: "active" | "suspended" | "removed"
      space_member_role: "admin" | "member"
      space_member_status: "active" | "suspended" | "removed"
      user_role: "owner" | "admin" | "viewer"
      video_source_type:
        | "youtube"
        | "google_drive"
        | "vimeo"
        | "telegram"
        | "direct_url"
      watch_event_type:
        | "play"
        | "resume"
        | "pause"
        | "seek"
        | "heartbeat"
        | "complete"
        | "ended"
        | "buffer"
        | "rate_change"
        | "visibility_change"
        | "session_started"
        | "player_ready"
        | "metadata_loaded"
        | "seek_started"
        | "seek_completed"
        | "playback_progress"
        | "session_ended"
        | "buffering_started"
        | "buffering_ended"
        | "playback_rate_changed"
        | "volume_changed"
        | "mute_changed"
        | "fullscreen_entered"
        | "fullscreen_exited"
        | "visibility_hidden"
        | "visibility_visible"
        | "quality_changed"
        | "player_error"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      organization_member_role: ["admin", "member"],
      organization_member_status: ["active", "suspended", "removed"],
      space_member_role: ["admin", "member"],
      space_member_status: ["active", "suspended", "removed"],
      user_role: ["owner", "admin", "viewer"],
      video_source_type: [
        "youtube",
        "google_drive",
        "vimeo",
        "telegram",
        "direct_url",
      ],
      watch_event_type: [
        "play",
        "resume",
        "pause",
        "seek",
        "heartbeat",
        "complete",
        "ended",
        "buffer",
        "rate_change",
        "visibility_change",
        "session_started",
        "player_ready",
        "metadata_loaded",
        "seek_started",
        "seek_completed",
        "playback_progress",
        "session_ended",
        "buffering_started",
        "buffering_ended",
        "playback_rate_changed",
        "volume_changed",
        "mute_changed",
        "fullscreen_entered",
        "fullscreen_exited",
        "visibility_hidden",
        "visibility_visible",
        "quality_changed",
        "player_error",
      ],
    },
  },
} as const;

export type OrganizationMemberRole = Database["public"]["Enums"]["organization_member_role"];
export type OrganizationMemberStatus = Database["public"]["Enums"]["organization_member_status"];
export type SpaceMemberRole = Database["public"]["Enums"]["space_member_role"];
export type SpaceMemberStatus = Database["public"]["Enums"]["space_member_status"];
export type VideoSourceType = Database["public"]["Enums"]["video_source_type"];
export type WatchEventType = Database["public"]["Enums"]["watch_event_type"];
