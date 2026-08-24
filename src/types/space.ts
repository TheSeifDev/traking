import type { AuthenticatedUser, UserRole } from "./auth";
import type { OrganizationMemberRole, OrganizationMemberStatus, SpaceMemberRole, SpaceMemberStatus } from "./database";
import type { ViewerSessionAnalytics } from "./video";

export const SPACE_ROLES = {
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export type SpaceRole = SpaceMemberRole;
export type OrganizationRole = OrganizationMemberRole;
export type SpaceStatus = "active" | "archived";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  clickup_workspace_id: string | null;
  created_by: string | null;
  settings: Record<string, unknown>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  profile_id: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessibleOrganization extends Organization {
  membership_role: OrganizationRole | null;
  membership_status: OrganizationMemberStatus | null;
  is_platform_owner: boolean;
}

export interface PersonalSpaceAnalytics {
  total_sessions: number;
  videos_watched: number;
  total_measurable_watch_time_seconds: number | null;
  avg_watch_time_seconds: number | null;
  completion_rate: number | null;
  measured_sessions: number;
  unsupported_sessions: number;
  sessions: ViewerSessionAnalytics[];
}

export interface Space {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  clickup_workspace_id: string | null;
  created_by: string | null;
  settings: Record<string, unknown>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  profile_id: string;
  role: SpaceRole;
  status: SpaceMemberStatus;
  joined_at: string | null;
  source: "manual" | "clickup";
  clickup_user_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessibleSpace extends Space {
  membership_role: SpaceRole | null;
  membership_status: SpaceMemberStatus | null;
  is_platform_owner: boolean;
}

export interface OrganizationAccess {
  user: AuthenticatedUser;
  organization: Organization;
  membership: OrganizationMember | null;
  effective_role: UserRole | OrganizationRole;
  is_platform_owner: boolean;
}

export interface SpaceAccess {
  user: AuthenticatedUser;
  organization: Organization | null;
  organization_membership: OrganizationMember | null;
  space: Space;
  membership: SpaceMember | null;
  effective_role: UserRole | OrganizationRole | SpaceRole;
  is_platform_owner: boolean;
}
