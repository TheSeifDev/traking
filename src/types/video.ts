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
  avg_completion?: number | null;
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
  from_position: number | null;
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
export type PlaybackMetricsScope = "direct_url_native_html5" | "youtube_iframe_api" | "session_only";

export interface WatchEventSummary {
  id: string;
  event_type: WatchEventType;
  position: number;
  from_position: number | null;
  duration: number | null;
  created_at: string;
}

/**
 * A truthful per-session record. viewer_identifier is already a one-way hash
 * for anonymous viewers; it is never a raw email or name.
 */
export interface ViewerSessionAnalytics {
  session_id: string;
  viewer_identifier: string | null;
  video_id: string;
  video_title: string;
  source_type: VideoSourceType;
  session_number: number;
  session_count_for_viewer: number;
  started_at: string;
  first_play_at: string | null;
  last_activity_at: string;
  ended_at: string | null;
  watch_time_seconds: number | null;
  completion_percentage: number | null;
  playback_events: WatchEventSummary[];
  last_position: number | null;
  last_duration: number | null;
  playback_metrics_scope: PlaybackMetricsScope;
}

export interface VideoAnalytics {
  video_id: string;
  total_views: number;
  total_sessions: number;
  unique_viewers: number;
  playback_metrics_scope: PlaybackMetricsScope;
  total_measurable_watch_time_seconds: number | null;
  avg_watch_time_seconds: number | null;
  avg_completion_percentage: number | null;
  completion_rate: number | null; // % of measured sessions that reached 90%+
  drop_off_point: number | null; // position in seconds where most measured viewers leave
  last_activity_at: string | null;
  recent_sessions: WatchSessionSummary[];
  viewer_sessions: ViewerSessionAnalytics[];
}

export interface WatchSessionSummary {
  id: string;
  viewer_identifier: string | null;
  started_at: string;
  ended_at: string | null;
  watch_time_seconds: number | null;
  completion_percentage: number | null;
}

export interface AnalyticsActivityPoint {
  date: string;
  views: number;
  sessions: number;
}

export interface AnalyticsVideoSummary {
  video_id: string;
  title: string;
  source_type: VideoSourceType;
  total_views: number;
  measurable_watch_time_seconds: number | null;
}

export interface WorkspaceAnalytics {
  total_videos: number;
  total_views: number;
  total_sessions: number;
  unique_viewers: number;
  total_measurable_watch_time_seconds: number | null;
  avg_watch_time_seconds: number | null;
  avg_completion_percentage: number | null;
  completion_rate: number | null;
  playback_metrics_available: boolean;
  activity_over_time: AnalyticsActivityPoint[];
  top_videos_by_views: AnalyticsVideoSummary[];
  top_videos_by_watch_time: AnalyticsVideoSummary[];
  recent_activity: ViewerSessionAnalytics[];
  viewer_sessions: ViewerSessionAnalytics[];
}
