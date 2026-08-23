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
  unique_viewer_count?: number | null;
  measurable_watch_time_seconds?: number | null;
  avg_watch_time_seconds?: number | null;
  playback_metrics_available?: boolean;
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
  /** Derived usage fields included by workspace link listings when available. */
  session_count?: number;
  unique_viewer_count?: number;
  first_opened_at?: string | null;
  last_accessed_at?: string | null;
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
  | "resume"
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
  sequence_number?: number | null;
  occurred_at?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface WatchedRange {
  start: number;
  end: number;
}

export interface HeatmapBucket extends WatchedRange {
  watched_seconds: number;
  coverage_percentage: number;
}

export type HeatmapAvailability = "measured" | "no_telemetry" | "insufficient_data" | "not_available_from_provider";

export interface PlaybackHeatmap {
  available: boolean;
  availability: HeatmapAvailability;
  duration_seconds: number | null;
  bucket_size_seconds: number | null;
  ranges: WatchedRange[];
  buckets: HeatmapBucket[];
}

export type TelemetryState = "measured" | "missing" | "unsupported";

export interface AnalyticsViewerSummary {
  viewer_id: string;
  viewer_identifier: string | null;
  viewer_name: string | null;
  viewer_email: string | null;
  viewer_status: "identified" | "anonymous";
  viewer_is_active: boolean | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  total_sessions: number;
  total_watch_time_seconds: number | null;
  avg_watch_time_seconds: number | null;
  avg_completion_percentage: number | null;
  last_position: number | null;
  videos_watched: number;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  telemetry_state: TelemetryState;
}

/**
 * A truthful per-session record. viewer_identifier is already a one-way hash
 * for anonymous viewers; it is never a raw email or name.
 */
export interface ViewerSessionAnalytics {
  session_id: string;
  viewer_identifier: string | null;
  viewer_profile_id?: string | null;
  viewer_name?: string | null;
  viewer_email?: string | null;
  viewer_status?: "identified" | "anonymous";
  viewer_is_active?: boolean | null;
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
  has_playback_telemetry: boolean;
  telemetry_event_count: number;
  device_type?: string | null;
  browser?: string | null;
  os?: string | null;
  telemetry_state?: TelemetryState;
  heatmap?: PlaybackHeatmap;
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
  viewers?: AnalyticsViewerSummary[];
  heatmap?: PlaybackHeatmap;
  telemetry_health?: { measured_sessions: number; missing_sessions: number; unsupported_sessions: number };
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
  viewers?: AnalyticsViewerSummary[];
  telemetry_health?: { measured_sessions: number; missing_sessions: number; unsupported_sessions: number };
}
