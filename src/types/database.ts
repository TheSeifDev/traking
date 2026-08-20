import type { UserRole } from "./auth";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

