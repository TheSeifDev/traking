import { createAdminClient } from "@/utils/supabase/admin";
import { getWorkspaceAnalytics } from "@/src/lib/videos/service";
import { sanitizeOwnerMetadata, type SafeOwnerLog, type ObservabilityCategory, type ObservabilityLevel } from "./logger";
import type { ViewerSessionAnalytics, WorkspaceAnalytics } from "@/src/types/video";

export const OWNER_QUERY_LIMIT = 100;
export const OWNER_QUERY_MAX_OFFSET = 5000;
export const OWNER_SESSION_SOURCE_LIMIT = 2000;

export interface OwnerLogFilters {
  level?: ObservabilityLevel;
  category?: ObservabilityCategory;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface OwnerSessionFilters {
  videoId?: string;
  viewerId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface OwnerSessionListItem {
  session_id: string;
  viewer_profile_id: string | null;
  viewer_name: string | null;
  viewer_email: string | null;
  viewer_status: ViewerSessionAnalytics["viewer_status"];
  video_id: string;
  video_title: string;
  source_type: ViewerSessionAnalytics["source_type"];
  started_at: string;
  first_play_at: string | null;
  last_activity_at: string;
  ended_at: string | null;
  watch_time_seconds: number | null;
  completion_percentage: number | null;
  last_position: number | null;
  playback_metrics_scope: ViewerSessionAnalytics["playback_metrics_scope"];
  has_playback_telemetry: boolean;
  telemetry_event_count: number;
  telemetry_state: ViewerSessionAnalytics["telemetry_state"];
}

export interface OwnerSessionDetail extends OwnerSessionListItem {
  session_number: number;
  session_count_for_viewer: number;
  viewer_identifier: string | null;
  viewer_is_active: boolean | null;
  last_duration: number | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  playback_events: Array<{
    id: string;
    event_type: string;
    position: number;
    from_position: number | null;
    duration: number | null;
    created_at: string;
    sequence_number: number | null | undefined;
    occurred_at: string | null | undefined;
    metadata: Record<string, unknown>;
  }>;
  heatmap: ViewerSessionAnalytics["heatmap"];
}

function boundedLimit(value: number | undefined): number {
  return Number.isInteger(value) ? Math.min(OWNER_QUERY_LIMIT, Math.max(1, value as number)) : OWNER_QUERY_LIMIT;
}

function boundedOffset(value: number | undefined): number {
  return Number.isInteger(value) ? Math.min(OWNER_QUERY_MAX_OFFSET, Math.max(0, value as number)) : 0;
}

function validIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

function mapSessionListItem(session: ViewerSessionAnalytics): OwnerSessionListItem {
  return {
    session_id: session.session_id,
    viewer_profile_id: session.viewer_profile_id ?? null,
    viewer_name: session.viewer_name ?? null,
    viewer_email: session.viewer_email ?? null,
    viewer_status: session.viewer_status ?? "anonymous",
    video_id: session.video_id,
    video_title: session.video_title,
    source_type: session.source_type,
    started_at: session.started_at,
    first_play_at: session.first_play_at,
    last_activity_at: session.last_activity_at,
    ended_at: session.ended_at,
    watch_time_seconds: session.watch_time_seconds,
    completion_percentage: session.completion_percentage,
    last_position: session.last_position,
    playback_metrics_scope: session.playback_metrics_scope,
    has_playback_telemetry: session.has_playback_telemetry,
    telemetry_event_count: session.telemetry_event_count,
    telemetry_state: session.telemetry_state,
  };
}

function mapSessionDetail(session: ViewerSessionAnalytics): OwnerSessionDetail {
  return {
    ...mapSessionListItem(session),
    session_number: session.session_number,
    session_count_for_viewer: session.session_count_for_viewer,
    viewer_identifier: session.viewer_identifier,
    viewer_is_active: session.viewer_is_active ?? null,
    last_duration: session.last_duration,
    device_type: session.device_type ?? null,
    browser: session.browser ?? null,
    os: session.os ?? null,
    playback_events: session.playback_events.map((event) => ({
      id: event.id,
      event_type: event.event_type,
      position: event.position,
      from_position: event.from_position,
      duration: event.duration,
      created_at: event.created_at,
      sequence_number: event.sequence_number,
      occurred_at: event.occurred_at,
      metadata: sanitizeOwnerMetadata(event.metadata),
    })),
    heatmap: session.heatmap,
  };
}

function filterSessions(sessions: ViewerSessionAnalytics[], filters: OwnerSessionFilters): ViewerSessionAnalytics[] {
  const from = validIso(filters.from);
  const to = validIso(filters.to);
  return sessions.filter((session) => {
    if (filters.videoId && session.video_id !== filters.videoId) return false;
    if (filters.viewerId && session.viewer_profile_id !== filters.viewerId && session.viewer_identifier !== filters.viewerId) return false;
    if (from && new Date(session.started_at).getTime() < new Date(from).getTime()) return false;
    if (to && new Date(session.started_at).getTime() > new Date(to).getTime()) return false;
    return true;
  });
}

export async function getOwnerWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalytics> {
  return getWorkspaceAnalytics(workspaceId);
}

export async function listOwnerSessions(workspaceId: string, filters: OwnerSessionFilters = {}) {
  const analytics = await getWorkspaceAnalytics(workspaceId);
  const filtered = filterSessions(analytics.viewer_sessions.slice(0, OWNER_SESSION_SOURCE_LIMIT), filters);
  const offset = boundedOffset(filters.offset);
  const limit = boundedLimit(filters.limit);
  const page = filtered.slice(offset, offset + limit);
  return {
    sessions: page.map(mapSessionListItem),
    total: filtered.length,
    limit,
    offset,
    source_limit: OWNER_SESSION_SOURCE_LIMIT,
  };
}

export async function getOwnerSession(workspaceId: string, sessionId: string): Promise<OwnerSessionDetail | null> {
  const analytics = await getWorkspaceAnalytics(workspaceId);
  const session = analytics.viewer_sessions.find((item) => item.session_id === sessionId);
  return session ? mapSessionDetail(session) : null;
}

export async function listOwnerLogs(filters: OwnerLogFilters = {}) {
  const limit = boundedLimit(filters.limit);
  const offset = boundedOffset(filters.offset);
  const supabase = createAdminClient();
  let query = supabase
    .from("owner_logs")
    .select("id, created_at, level, category, action, user_id, video_id, session_id, route, status, duration_ms, metadata")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.level) query = query.eq("level", filters.level);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.action) query = query.ilike("action", `%${filters.action.slice(0, 80)}%`);
  const from = validIso(filters.from);
  const to = validIso(filters.to);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw new Error("owner_logs_query_failed");

  const logs: SafeOwnerLog[] = (data ?? []).map((log) => ({
    id: log.id,
    created_at: log.created_at,
    level: log.level,
    category: log.category,
    action: log.action,
    user_id: log.user_id,
    video_id: log.video_id,
    session_id: log.session_id,
    route: log.route,
    status: log.status,
    duration_ms: log.duration_ms,
    metadata: sanitizeOwnerMetadata(log.metadata),
  }));
  return { logs, limit, offset, has_more: logs.length === limit };
}

export async function getOwnerSystemState() {
  const supabase = createAdminClient();
  const checkedAt = new Date().toISOString();
  const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  return {
    checked_at: checkedAt,
    environment: process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
    deployment_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    region: process.env.VERCEL_REGION ?? null,
    database: error ? "error" as const : "connected" as const,
  };
}
