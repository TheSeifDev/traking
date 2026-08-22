import type { UserRole } from "./auth";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type VideoSourceType = "youtube" | "google_drive" | "vimeo" | "telegram" | "direct_url";
export type WatchEventType = "play" | "pause" | "seek" | "heartbeat" | "complete" | "ended";

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
        };
        Relationships: [];
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
      watch_links: {
        Row: {
          id: string;
          video_id: string;
          token: string;
          created_by: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          token?: string;
          created_by?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          token?: string;
          created_by?: string | null;
          expires_at?: string | null;
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
        ];
      };
      watch_events: {
        Row: {
          id: string;
          session_id: string;
          event_type: WatchEventType;
          position: number;
          duration: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          event_type: WatchEventType;
          position?: number;
          duration?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          event_type?: WatchEventType;
          position?: number;
          duration?: number | null;
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
    };
    Enums: {
      user_role: UserRole;
      video_source_type: VideoSourceType;
      watch_event_type: WatchEventType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
