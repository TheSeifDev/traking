import type { ManagedRole, UserRole } from "./auth";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VideoSourceType = "youtube" | "google_drive" | "vimeo" | "telegram" | "direct_url";
export type WatchEventType = "play" | "resume" | "pause" | "seek" | "heartbeat" | "complete" | "ended" | "buffer" | "rate_change" | "visibility_change";
export type SpaceMemberRole = "admin" | "member";
export type SpaceMemberStatus = "active" | "suspended" | "removed";
export type OrganizationMemberRole = "admin" | "member";
export type OrganizationMemberStatus = "active" | "suspended" | "removed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clickup_user_id: string | null;
          name: string | null;
          email: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_seen_at: string | null;
        };
        Insert: {
          id?: string;
          clickup_user_id?: string | null;
          name?: string | null;
          email: string;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          clickup_user_id?: string | null;
          name?: string | null;
          email?: string;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string | null;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          profile_id: string;
          email: string;
          role: ManagedRole;
          token_hash: string;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          last_sent_at: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          email: string;
          role: ManagedRole;
          token_hash: string;
          created_at?: string;
          expires_at: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          last_sent_at?: string | null;
          created_by: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          email?: string;
          role?: ManagedRole;
          token_hash?: string;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          last_sent_at?: string | null;
          created_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      role_change_audit: {
        Row: {
          id: string;
          target_user_id: string;
          changed_by_user_id: string;
          previous_role: UserRole;
          new_role: UserRole;
          changed_at: string;
        };
        Insert: {
          id?: string;
          target_user_id: string;
          changed_by_user_id: string;
          previous_role: UserRole;
          new_role: UserRole;
          changed_at?: string;
        };
        Update: {
          id?: string;
          target_user_id?: string;
          changed_by_user_id?: string;
          previous_role?: UserRole;
          new_role?: UserRole;
          changed_at?: string;
        };
        Relationships: [];
      };
      owner_logs: {
        Row: {
          id: string;
          created_at: string;
          level: "INFO" | "WARN" | "ERROR";
          category: "AUTH" | "TRACKING" | "SESSION" | "VIDEO" | "ANALYTICS" | "API" | "DATABASE" | "SYSTEM" | "PROVIDER" | "SECURITY";
          action: string;
          user_id: string | null;
          video_id: string | null;
          session_id: string | null;
          route: string | null;
          status: number | null;
          duration_ms: number | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          level: "INFO" | "WARN" | "ERROR";
          category: "AUTH" | "TRACKING" | "SESSION" | "VIDEO" | "ANALYTICS" | "API" | "DATABASE" | "SYSTEM" | "PROVIDER" | "SECURITY";
          action: string;
          user_id?: string | null;
          video_id?: string | null;
          session_id?: string | null;
          route?: string | null;
          status?: number | null;
          duration_ms?: number | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          level?: "INFO" | "WARN" | "ERROR";
          category?: "AUTH" | "TRACKING" | "SESSION" | "VIDEO" | "ANALYTICS" | "API" | "DATABASE" | "SYSTEM" | "PROVIDER" | "SECURITY";
          action?: string;
          user_id?: string | null;
          video_id?: string | null;
          session_id?: string | null;
          route?: string | null;
          status?: number | null;
          duration_ms?: number | null;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "owner_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_logs_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "owner_logs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "watch_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          clickup_workspace_id: string | null;
          created_by: string | null;
          settings: Json;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          clickup_workspace_id?: string | null;
          created_by?: string | null;
          settings?: Json;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          clickup_workspace_id?: string | null;
          created_by?: string | null;
          settings?: Json;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_clickup_workspace_id_fkey";
            columns: ["clickup_workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          role: OrganizationMemberRole;
          status: OrganizationMemberStatus;
          joined_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          role?: OrganizationMemberRole;
          status?: OrganizationMemberStatus;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          profile_id?: string;
          role?: OrganizationMemberRole;
          status?: OrganizationMemberStatus;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          clickup_workspace_id: string | null;
          created_by: string | null;
          settings: Json;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          clickup_workspace_id?: string | null;
          created_by?: string | null;
          settings?: Json;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          slug?: string;
          clickup_workspace_id?: string | null;
          created_by?: string | null;
          settings?: Json;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spaces_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spaces_clickup_workspace_id_fkey";
            columns: ["clickup_workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spaces_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      space_members: {
        Row: {
          id: string;
          space_id: string;
          profile_id: string;
          role: SpaceMemberRole;
          status: SpaceMemberStatus;
          joined_at: string | null;
          source: "manual" | "clickup";
          clickup_user_id: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          profile_id: string;
          role?: SpaceMemberRole;
          status?: SpaceMemberStatus;
          joined_at?: string | null;
          source?: "manual" | "clickup";
          clickup_user_id?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          profile_id?: string;
          role?: SpaceMemberRole;
          status?: SpaceMemberStatus;
          joined_at?: string | null;
          source?: "manual" | "clickup";
          clickup_user_id?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey";
            columns: ["space_id"];
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "space_members_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          id: string;
          clickup_team_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clickup_team_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clickup_team_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clickup_connections: {
        Row: {
          id: string;
          profile_id: string;
          workspace_id: string;
          access_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          workspace_id: string;
          access_token: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          workspace_id?: string;
          access_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clickup_connections_profile_id_fkey";
            columns: ["profile_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clickup_connections_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      videos: {
        Row: {
          id: string;
          workspace_id: string;
          space_id: string | null;
          created_by: string | null;
          title: string;
          description: string | null;
          source_type: VideoSourceType;
          source_url: string;
          duration: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          space_id?: string | null;
          created_by?: string | null;
          title: string;
          description?: string | null;
          source_type: VideoSourceType;
          source_url: string;
          duration?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          space_id?: string | null;
          created_by?: string | null;
          title?: string;
          description?: string | null;
          source_type?: VideoSourceType;
          source_url?: string;
          duration?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "videos_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_space_id_fkey";
            columns: ["space_id"];
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      video_clickup_tasks: {
        Row: {
          id: string;
          video_id: string;
          clickup_task_id: string;
          clickup_task_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          clickup_task_id: string;
          clickup_task_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          clickup_task_id?: string;
          clickup_task_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "video_clickup_tasks_video_id_fkey";
            columns: ["video_id"];
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      viewer_identities: {
        Row: {
          id: string;
          watch_link_id: string;
          name: string;
          email: string;
          normalized_email: string;
          created_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          watch_link_id: string;
          name: string;
          email: string;
          normalized_email: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          watch_link_id?: string;
          name?: string;
          email?: string;
          normalized_email?: string;
          created_at?: string;
          last_seen_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "viewer_identities_watch_link_id_fkey";
            columns: ["watch_link_id"];
            referencedRelation: "watch_links";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_links: {
        Row: {
          id: string;
          video_id: string;
          token: string;
          created_by: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          token?: string;
          created_by?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          token?: string;
          created_by?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_links_video_id_fkey";
            columns: ["video_id"];
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_links_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_sessions: {
        Row: {
          id: string;
          watch_link_id: string;
          session_token: string;
          viewer_identifier: string | null;
          viewer_profile_id: string | null;
          viewer_identity_id: string | null;
          device_type: string | null;
          browser: string | null;
          os: string | null;
          started_at: string;
          last_seen_at: string;
          ended_at: string | null;
          watch_time_seconds: number;
          completion_percentage: number;
        };
        Insert: {
          id?: string;
          watch_link_id: string;
          session_token: string;
          viewer_identifier?: string | null;
          viewer_profile_id?: string | null;
          viewer_identity_id?: string | null;
          device_type?: string | null;
          browser?: string | null;
          os?: string | null;
          started_at?: string;
          last_seen_at?: string;
          ended_at?: string | null;
          watch_time_seconds?: number;
          completion_percentage?: number;
        };
        Update: {
          id?: string;
          watch_link_id?: string;
          session_token?: string;
          viewer_identifier?: string | null;
          viewer_profile_id?: string | null;
          viewer_identity_id?: string | null;
          device_type?: string | null;
          browser?: string | null;
          os?: string | null;
          started_at?: string;
          last_seen_at?: string;
          ended_at?: string | null;
          watch_time_seconds?: number;
          completion_percentage?: number;
        };
        Relationships: [
          {
            foreignKeyName: "watch_sessions_watch_link_id_fkey";
            columns: ["watch_link_id"];
            referencedRelation: "watch_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_sessions_viewer_identity_id_fkey";
            columns: ["viewer_identity_id"];
            referencedRelation: "viewer_identities";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_events: {
        Row: {
          id: string;
          session_id: string;
          event_type: WatchEventType;
          position: number;
          duration: number | null;
          from_position: number | null;
          client_event_id: string | null;
          sequence_number: number | null;
          occurred_at: string | null;
          playback_rate: number | null;
          from_rate: number | null;
          to_rate: number | null;
          metadata: Json;
          received_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          event_type: WatchEventType;
          position?: number;
          duration?: number | null;
          from_position?: number | null;
          client_event_id?: string | null;
          sequence_number?: number | null;
          occurred_at?: string | null;
          playback_rate?: number | null;
          from_rate?: number | null;
          to_rate?: number | null;
          metadata?: Json;
          received_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          event_type?: WatchEventType;
          position?: number;
          duration?: number | null;
          from_position?: number | null;
          client_event_id?: string | null;
          sequence_number?: number | null;
          occurred_at?: string | null;
          playback_rate?: number | null;
          from_rate?: number | null;
          to_rate?: number | null;
          metadata?: Json;
          received_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_events_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "watch_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      is_admin_or_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      accept_invitation: {
        Args: {
          p_invitation_id: string;
          p_token_hash: string;
          p_email: string;
          p_clickup_user_id: string;
          p_name: string | null;
        };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      touch_profile_last_seen: {
        Args: { p_profile_id: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      space_member_role: SpaceMemberRole;
      space_member_status: SpaceMemberStatus;
      organization_member_role: OrganizationMemberRole;
      organization_member_status: OrganizationMemberStatus;
      video_source_type: VideoSourceType;
      watch_event_type: WatchEventType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
