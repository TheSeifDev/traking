/**
 * TrackUp Domain Types: Videos, Watch Links, Sessions, Events
 */

export type VideoSourceType =
  | "youtube"
  | "google_drive"
  | "vimeo"
  | "telegram"
  | "direct_url";

export const VIDEO_SOURCE_TYPES: readonly VideoSourceType[] = [
  "youtube",
  "google_drive",
  "vimeo",
  "telegram",
  "direct_url",
] as const;

export function isValidSourceType(v: unknown): v is VideoSourceType {
  return typeof v === "string" && (VIDEO_SOURCE_TYPES as readonly string[]).includes(v);
}

export interface Workspace {
  id: string;
  clickup_team_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Video {
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
  // Joined fields (optional – only present when explicitly fetched)
  clickup_tasks?: VideoClickUpTask[];
  watch_links?: WatchLink[];
  view_count?: number;
  avg_completion?: number;
}

export interface VideoClickUpTask {
  id: string;
  video_id: string;
  clickup_task_id: string;
  clickup_task_name: string | null;
  created_at: string;
}

export interface WatchLink {
  id: string;
  video_id: string;
  token: string;
  created_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface WatchSession {
  id: string;
  watch_link_id: string;
  viewer_identifier: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  watch_time_seconds: number;
  completion_percentage: number;
}

export interface WatchEvent {
  id: string;
  session_id: string;
  event_type: WatchEventType;
  position: number;
  duration: number | null;
  created_at: string;
}

export type WatchEventType =
  | "play"
  | "pause"
  | "seek"
  | "heartbeat"
  | "complete"
  | "ended";

// Input types for creation
export interface CreateVideoInput {
  title: string;
  description?: string | null;
  source_type: VideoSourceType;
  source_url: string;
  duration?: number | null;
}

export interface UpdateVideoInput {
  title?: string;
  description?: string | null;
  source_type?: VideoSourceType;
  source_url?: string;
  duration?: number | null;
}

// Analytics types
export interface VideoAnalytics {
  video_id: string;
  total_views: number;
  unique_viewers: number;
  avg_watch_time_seconds: number;
  avg_completion_percentage: number;
  completion_rate: number; // % of sessions that reached 90%+
  drop_off_point: number | null; // position in seconds where most viewers leave
  recent_sessions: WatchSessionSummary[];
}

export interface WatchSessionSummary {
  id: string;
  viewer_identifier: string | null;
  started_at: string;
  ended_at: string | null;
  watch_time_seconds: number;
  completion_percentage: number;
}

export interface WorkspaceAnalytics {
  total_videos: number;
  total_views: number;
  unique_viewers: number;
  avg_completion_percentage: number;
  completion_rate: number;
}
