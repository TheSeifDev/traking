import { createAdminClient } from "@/utils/supabase/admin";
import type { Database } from "@/src/types/database";
import { CRON_JOB_NAME, CRON_SCHEDULE, getCronExecutionSnapshot } from "@/src/lib/health/cron-executions";
import { hasReliablePlaybackTelemetry, type ReliablePlaybackEventEvidence } from "@/src/lib/videos/service";

const MAX_ORGANIZATIONS = 500;
const MAX_SPACES = 1000;
const MAX_USERS = 2000;
const MAX_VIDEOS = 2000;
const MAX_LINKS = 5000;
const MAX_SESSIONS = 5000;
const MAX_EVENTS = 10000;
const MAX_LOGS = 3000;

export type ControlRoomRange = "1h" | "24h" | "today" | "yesterday" | "7d" | "30d" | "90d" | "all";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type VideoRow = Database["public"]["Tables"]["videos"]["Row"];
type OwnerLogRow = Database["public"]["Tables"]["owner_logs"]["Row"];

type LogProjection = Pick<OwnerLogRow, "id" | "created_at" | "level" | "category" | "action" | "user_id" | "video_id" | "session_id" | "route" | "status" | "duration_ms" | "metadata">;

type SessionView = {
  id: string;
  viewer_profile_id: string | null;
  video_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  watch_time_seconds: number | null;
  completion_percentage: number | null;
};

export type ControlRoomData = {
  generated_at: string;
  range: ControlRoomRange;
  range_start: string;
  metrics: {
    total_organizations: number;
    active_organizations: number;
    total_spaces: number;
    active_spaces: number;
    total_users: number;
    active_users: number;
    active_organization_members: number;
    active_space_members: number;
    total_videos: number;
    active_watch_links: number;
    total_sessions: number;
    measured_sessions: number;
    unmeasured_sessions: number;
    sessions_today: number;
    sessions_this_week: number;
    views_today: number;
    views_last_7_days: number;
    measured_watch_time_seconds: number | null;
    average_watch_time_seconds: number | null;
    average_completion_percentage: number | null;
    completion_rate: number | null;
    tracking_events_today: number;
    active_viewers: number;
    failed_sessions: number;
    provider_errors: number;
    cron_execution_status: "observed" | "not_observed";
    database_health: "healthy" | "degraded" | "unknown";
    clickup_sync_health: "healthy" | "degraded" | "unknown";
  };
  comparison: {
    previous_sessions: number | null;
    previous_views: number | null;
    sessions_delta_percentage: number | null;
    views_delta_percentage: number | null;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: "active" | "archived";
    clickup_workspace_id: string | null;
    clickup_sync_status: "never" | "running" | "success" | "partial" | "failed";
    clickup_last_synced_at: string | null;
    clickup_sync_error: string | null;
    created_at: string;
    member_count: number;
    active_member_count: number;
    admin_count: number;
    space_count: number;
    active_space_count: number;
    video_count: number;
    active_watch_links: number;
    sessions: number;
    measured_sessions: number;
    watch_time_seconds: number | null;
    last_activity_at: string | null;
  }>;
  spaces: Array<{
    id: string;
    name: string;
    slug: string;
    organization_id: string;
    organization_name: string;
    status: "active" | "archived";
    clickup_workspace_id: string | null;
    clickup_space_id: string | null;
    clickup_sync_status: "never" | "running" | "success" | "partial" | "failed";
    clickup_last_synced_at: string | null;
    clickup_sync_error: string | null;
    created_at: string;
    member_count: number;
    active_member_count: number;
    admin_count: number;
    video_count: number;
    active_watch_links: number;
    sessions: number;
    unique_viewers: number;
    watch_time_seconds: number | null;
    average_completion_percentage: number | null;
    latest_activity_at: string | null;
  }>;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    clickup_user_id: string | null;
    role: ProfileRow["role"];
    is_active: boolean;
    created_at: string;
    last_seen_at: string | null;
    organization_count: number;
    space_count: number;
    sessions: number;
    videos_watched: number;
    watch_time_seconds: number | null;
    average_completion_percentage: number | null;
    last_watched_at: string | null;
  }>;
  videos: Array<{
    id: string;
    title: string;
    source_type: VideoRow["source_type"];
    organization_id: string;
    organization_name: string;
    space_id: string;
    space_name: string;
    duration: number | null;
    created_at: string;
    total_views: number;
    unique_viewers: number;
    sessions: number;
    measured_sessions: number;
    unavailable_sessions: number;
    watch_time_seconds: number | null;
    average_completion_percentage: number | null;
    last_activity_at: string | null;
  }>;
  recent_activity: Array<{
    id: string;
    created_at: string;
    level: OwnerLogRow["level"];
    category: OwnerLogRow["category"];
    action: string;
    user_id: string | null;
    video_id: string | null;
    session_id: string | null;
    status: number | null;
    organization_id: string | null;
    organization_name: string | null;
    space_id: string | null;
    space_name: string | null;
    resource_label: string | null;
    result: string;
  }>;
  security: {
    unauthorized: number;
    forbidden: number;
    authentication_failures: number;
    invalid_tokens: number;
    suspicious: number;
    cross_tenant: number;
  };
  jobs: {
    name: string;
    schedule: string;
    configured: boolean;
    execution_status: "observed" | "not_observed";
    last_execution_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_latency_ms: number | null;
    last_result: "succeeded" | "failed" | "started" | null;
    current_health_status: "healthy" | "degraded" | "unknown";
    history: Array<{ started_at: string; finished_at: string | null; status: "started" | "succeeded" | "failed"; http_status: number | null; latency_ms: number | null; health_status: "healthy" | "degraded" | "unknown" | null; error_code: string | null }>;
  };
  incidents: Array<{
    id: string;
    detected_at: string;
    severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
    evidence: string;
    status: "observed";
  }>;
};

function rangeStart(range: ControlRoomRange, now: Date): Date {
  const start = new Date(now);
  if (range === "1h") start.setHours(start.getHours() - 1);
  if (range === "24h") start.setHours(start.getHours() - 24);
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
  }
  if (range === "7d") start.setDate(start.getDate() - 7);
  if (range === "30d") start.setDate(start.getDate() - 30);
  if (range === "90d") start.setDate(start.getDate() - 90);
  if (range === "all") return new Date("1970-01-01T00:00:00.000Z");
  return start;
}

function validRange(value: string | null | undefined): ControlRoomRange {
  return value === "1h" || value === "24h" || value === "today" || value === "yesterday" || value === "7d" || value === "30d" || value === "90d" || value === "all" ? value : "7d";
}

function resultLabel(log: Pick<OwnerLogRow, "status" | "level">): string {
  if (log.status !== null && log.status >= 400) return `HTTP ${log.status}`;
  if (log.level === "ERROR") return "error";
  if (log.level === "WARN") return "warning";
  return "ok";
}

function logSeverity(log: Pick<OwnerLogRow, "level" | "category">): "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (log.level === "ERROR" && log.category === "DATABASE") return "CRITICAL";
  if (log.level === "ERROR") return "HIGH";
  if (log.level === "WARN") return "MEDIUM";
  return "INFO";
}

export async function getControlRoomData(input: { range?: string | null; query?: string | null; organizationId?: string | null; spaceId?: string | null; provider?: string | null } = {}): Promise<ControlRoomData> {
  const now = new Date();
  const selectedRange = validRange(input.range);
  const start = rangeStart(selectedRange, now);
  const rangeEnd = selectedRange === "yesterday" ? rangeStart("today", now) : now;
  const previousStart = selectedRange === "all" ? null : new Date(start.getTime() - Math.max(1, rangeEnd.getTime() - start.getTime()));
  const previousStartIso = previousStart?.toISOString() ?? null;
  const startIso = start.toISOString();
  const endIso = rangeEnd.toISOString();
  const queryText = input.query?.trim().toLocaleLowerCase() ?? "";
  const providerFilter = input.provider?.trim().toLocaleLowerCase() ?? "";
  const supabase = createAdminClient();

  const [organizationsResult, spacesResult, profilesResult, videosResult, linksResult, sessionsResult, previousSessionsResult, eventsResult, logsResult, organizationMembershipsResult, spaceMembershipsResult, cronSnapshot] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, clickup_workspace_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by, settings, archived_at, created_at, updated_at").order("created_at", { ascending: true }).limit(MAX_ORGANIZATIONS),
    supabase.from("spaces").select("id, organization_id, name, slug, clickup_workspace_id, clickup_space_id, clickup_sync_status, clickup_last_synced_at, clickup_sync_error, created_by, settings, archived_at, created_at, updated_at").order("created_at", { ascending: true }).limit(MAX_SPACES),
    supabase.from("profiles").select("id, clickup_user_id, name, email, role, is_active, created_at, last_seen_at").order("created_at", { ascending: true }).limit(MAX_USERS),
    supabase.from("videos").select("id, workspace_id, space_id, created_by, title, description, source_type, source_url, duration, created_at, updated_at").order("created_at", { ascending: true }).limit(MAX_VIDEOS),
    supabase.from("watch_links").select("id, video_id, created_by, expires_at, revoked_at, created_at").order("created_at", { ascending: false }).limit(MAX_LINKS),
    supabase.from("watch_sessions").select("id, watch_link_id, viewer_profile_id, started_at, last_seen_at, ended_at, watch_time_seconds, completion_percentage").gte("started_at", startIso).lt("started_at", endIso).order("started_at", { ascending: false }).limit(MAX_SESSIONS),
    previousStartIso ? supabase.from("watch_sessions").select("id, watch_link_id, viewer_profile_id, started_at, last_seen_at, ended_at, watch_time_seconds, completion_percentage").gte("started_at", previousStartIso).lt("started_at", startIso).order("started_at", { ascending: false }).limit(MAX_SESSIONS) : Promise.resolve({ data: [], error: null }),
    supabase.from("watch_events").select("id, session_id, event_type, position, duration, received_at").gte("received_at", startIso).lt("received_at", endIso).limit(MAX_EVENTS),
    supabase.from("owner_logs").select("id, created_at, level, category, action, user_id, video_id, session_id, route, status, duration_ms, metadata").gte("created_at", startIso).lt("created_at", endIso).order("created_at", { ascending: false }).limit(MAX_LOGS),
    supabase.from("organization_members").select("organization_id, profile_id, role, status").neq("status", "removed").limit(MAX_USERS * 2),
    supabase.from("space_members").select("space_id, profile_id, role, status").neq("status", "removed").limit(MAX_USERS * 2),
    getCronExecutionSnapshot(),
  ]);
  if (organizationsResult.error || spacesResult.error || profilesResult.error || videosResult.error || linksResult.error || sessionsResult.error || previousSessionsResult.error || eventsResult.error || logsResult.error || organizationMembershipsResult.error || spaceMembershipsResult.error) throw new Error("control_room_query_failed");

  const organizations = organizationsResult.data ?? [];
  const spaces = spacesResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const videos = videosResult.data ?? [];
  const links = linksResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const previousSessions = previousSessionsResult.data ?? [];
  const trackingEvents = eventsResult.data ?? [];
  const logs: LogProjection[] = logsResult.data ?? [];
  const orgMemberships = organizationMembershipsResult.data ?? [];
  const spaceMemberships = spaceMembershipsResult.data ?? [];

  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const spaceById = new Map(spaces.map((space) => [space.id, space]));
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const linkById = new Map(links.map((link) => [link.id, link]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const toSessionViews = (rows: typeof sessions): SessionView[] => rows.map((session) => ({ id: session.id, viewer_profile_id: session.viewer_profile_id, video_id: linkById.get(session.watch_link_id)?.video_id ?? "", started_at: session.started_at, last_seen_at: session.last_seen_at, ended_at: session.ended_at, watch_time_seconds: session.watch_time_seconds, completion_percentage: session.completion_percentage })).filter((session) => session.video_id.length > 0);
  const sessionsView = toSessionViews(sessions);
  const previousSessionsView = toSessionViews(previousSessions);
  const organizationFilterActive = Boolean(input.organizationId);
  const spaceFilterActive = Boolean(input.spaceId);
  const visibleOrg = input.organizationId ? organizationById.get(input.organizationId) : undefined;
  const visibleSpace = input.spaceId ? spaceById.get(input.spaceId) : undefined;
  const scopeSpace = (space: SpaceRow): boolean => (!organizationFilterActive || space.organization_id === visibleOrg?.id) && (!spaceFilterActive || space.id === visibleSpace?.id);
  const scopedSpaceRows = spaces.filter(scopeSpace);
  const scopedSpaceIds = new Set(scopedSpaceRows.map((space) => space.id));
  const scopedOrganizationIds = organizationFilterActive
    ? new Set(visibleOrg ? [visibleOrg.id] : [])
    : spaceFilterActive
      ? new Set(visibleSpace ? [visibleSpace.organization_id] : [])
      : new Set(organizations.map((organization) => organization.id));
  const scopedVideos = videos.filter((video) => {
    const space = video.space_id ? spaceById.get(video.space_id) : undefined;
    return Boolean(space && scopedSpaceIds.has(space.id) && (!providerFilter || video.source_type === providerFilter));
  });
  const scopedVideoIds = new Set(scopedVideos.map((video) => video.id));
  const scopedSessions = sessionsView.filter((session) => scopedVideoIds.has(session.video_id));
  const scopedPreviousSessions = previousSessionsView.filter((session) => scopedVideoIds.has(session.video_id));
  const playbackEventsBySession = new Map<string, ReliablePlaybackEventEvidence[]>();
  for (const event of trackingEvents) {
    const evidence: ReliablePlaybackEventEvidence = { event_type: event.event_type, position: event.position, duration: event.duration };
    playbackEventsBySession.set(event.session_id, [...(playbackEventsBySession.get(event.session_id) ?? []), evidence]);
  }
  const isMeasuredSession = (session: SessionView): boolean => {
    const video = videoById.get(session.video_id);
    if (!video || (video.source_type !== "direct_url" && video.source_type !== "youtube")) return false;
    return hasReliablePlaybackTelemetry(video.source_type, playbackEventsBySession.get(session.id) ?? []);
  };
  const todayStart = rangeStart("today", now).getTime();
  const sevenDayStart = rangeStart("7d", now).getTime();
  const measuredSessions = scopedSessions.filter(isMeasuredSession);
  const completionValues = measuredSessions.map((session) => session.completion_percentage).filter((value): value is number => typeof value === "number");
  const totalMeasuredWatchTime = measuredSessions.length > 0 ? Math.round(measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null;
  const sessionByVideo = new Map<string, SessionView[]>();
  for (const session of scopedSessions) sessionByVideo.set(session.video_id, [...(sessionByVideo.get(session.video_id) ?? []), session]);
  const linksByVideo = new Map<string, typeof links>();
  for (const link of links) linksByVideo.set(link.video_id, [...(linksByVideo.get(link.video_id) ?? []), link]);
  const orgStats = new Map<string, { member_count: number; active_member_count: number; admin_count: number; space_count: number; active_space_count: number; video_count: number; active_watch_links: number; sessions: number; views: number; watch: number; measured: boolean; measured_sessions: number; last: string | null }>();
  const spaceStats = new Map<string, { member_count: number; active_member_count: number; admin_count: number; video_count: number; active_watch_links: number; sessions: number; viewers: Set<string>; watch: number; measured: boolean; measured_sessions: number; completions: number[]; last: string | null }>();
  for (const organization of organizations) orgStats.set(organization.id, { member_count: 0, active_member_count: 0, admin_count: 0, space_count: 0, active_space_count: 0, video_count: 0, active_watch_links: 0, sessions: 0, views: 0, watch: 0, measured: false, measured_sessions: 0, last: null });
  for (const space of spaces) {
    const stats = spaceStats.get(space.id) ?? { member_count: 0, active_member_count: 0, admin_count: 0, video_count: 0, active_watch_links: 0, sessions: 0, viewers: new Set<string>(), watch: 0, measured: false, measured_sessions: 0, completions: [], last: null };
    const org = orgStats.get(space.organization_id);
    if (org) { org.space_count += 1; if (!space.archived_at) org.active_space_count += 1; }
    spaceMemberships.filter((membership) => membership.space_id === space.id).forEach((membership) => { stats.member_count += 1; if (membership.status === "active") { stats.active_member_count += 1; if (membership.role === "admin") stats.admin_count += 1; } });
    spaceStats.set(space.id, stats);
  }
  for (const membership of orgMemberships) { const stats = orgStats.get(membership.organization_id); if (stats) { stats.member_count += 1; if (membership.status === "active") { stats.active_member_count += 1; if (membership.role === "admin") stats.admin_count += 1; } } }
  for (const video of scopedVideos) {
    if (!video.space_id) continue;
    const space = spaceById.get(video.space_id);
    if (!space) continue;
    const org = orgStats.get(space.organization_id);
    const spaceStat = spaceStats.get(space.id);
    const activeLinksForVideo = (linksByVideo.get(video.id) ?? []).filter((link) => link.revoked_at === null && (!link.expires_at || new Date(link.expires_at).getTime() > now.getTime())).length;
    if (org) { org.video_count += 1; org.active_watch_links += activeLinksForVideo; }
    if (spaceStat) { spaceStat.video_count += 1; spaceStat.active_watch_links += activeLinksForVideo; }
    for (const session of sessionByVideo.get(video.id) ?? []) {
      const targetOrg = orgStats.get(space.organization_id);
      if (targetOrg) { targetOrg.sessions += 1; targetOrg.views += 1; if (isMeasuredSession(session) && session.watch_time_seconds !== null) { targetOrg.watch += session.watch_time_seconds; targetOrg.measured = true; targetOrg.measured_sessions += 1; } targetOrg.last = !targetOrg.last || session.last_seen_at > targetOrg.last ? session.last_seen_at : targetOrg.last; }
      if (spaceStat) { spaceStat.sessions += 1; const viewer = session.viewer_profile_id ?? session.id; spaceStat.viewers.add(viewer); if (isMeasuredSession(session) && session.watch_time_seconds !== null) { spaceStat.watch += session.watch_time_seconds; spaceStat.measured = true; spaceStat.measured_sessions += 1; } if (isMeasuredSession(session) && session.completion_percentage !== null) spaceStat.completions.push(session.completion_percentage); spaceStat.last = !spaceStat.last || session.last_seen_at > spaceStat.last ? session.last_seen_at : spaceStat.last; }
    }
  }
  const sessionCountForProfile = new Map<string, SessionView[]>();
  for (const session of scopedSessions) if (session.viewer_profile_id) sessionCountForProfile.set(session.viewer_profile_id, [...(sessionCountForProfile.get(session.viewer_profile_id) ?? []), session]);
  const users = profiles.map((profile) => {
    const userSessions = sessionCountForProfile.get(profile.id) ?? [];
    const userVideos = new Set(userSessions.map((session) => session.video_id));
    const userOrgs = new Set(orgMemberships.filter((membership) => membership.profile_id === profile.id && membership.status === "active").map((membership) => membership.organization_id));
    const userSpaces = new Set(spaceMemberships.filter((membership) => membership.profile_id === profile.id && membership.status === "active").map((membership) => membership.space_id));
    const measuredUserSessions = userSessions.filter(isMeasuredSession);
    const measuredCompletions = measuredUserSessions.map((session) => session.completion_percentage).filter((value): value is number => typeof value === "number");
    return { id: profile.id, name: profile.name, email: profile.email, clickup_user_id: profile.clickup_user_id, role: profile.role, is_active: profile.is_active, created_at: profile.created_at, last_seen_at: profile.last_seen_at, organization_count: userOrgs.size, space_count: userSpaces.size, sessions: userSessions.length, videos_watched: userVideos.size, watch_time_seconds: measuredUserSessions.length > 0 ? Math.round(measuredUserSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null, average_completion_percentage: measuredCompletions.length > 0 ? Math.round(measuredCompletions.reduce((sum, value) => sum + value, 0) / measuredCompletions.length) : null, last_watched_at: userSessions.slice().sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))[0]?.last_seen_at ?? null };
  }).filter((user) => !queryText || [user.name, user.email, user.clickup_user_id].some((value) => value?.toLocaleLowerCase().includes(queryText)));
  const videoViews = scopedVideos.map((video) => {
    const space = video.space_id ? spaceById.get(video.space_id) : null;
    const org = space ? organizationById.get(space.organization_id) : null;
    const videoSessions = sessionByVideo.get(video.id) ?? [];
    const viewers = new Set(videoSessions.map((session) => session.viewer_profile_id ?? session.id));
    const measuredVideoSessions = videoSessions.filter(isMeasuredSession);
    const measuredCompletions = measuredVideoSessions.map((session) => session.completion_percentage).filter((value): value is number => typeof value === "number");
    return { id: video.id, title: video.title, source_type: video.source_type, organization_id: org?.id ?? "", organization_name: org?.name ?? "Unknown Organization", space_id: space?.id ?? "", space_name: space?.name ?? "Unknown Space", duration: video.duration, created_at: video.created_at, total_views: videoSessions.length, unique_viewers: viewers.size, sessions: videoSessions.length, measured_sessions: measuredVideoSessions.length, unavailable_sessions: videoSessions.length - measuredVideoSessions.length, watch_time_seconds: measuredVideoSessions.length > 0 ? Math.round(measuredVideoSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null, average_completion_percentage: measuredCompletions.length > 0 ? Math.round(measuredCompletions.reduce((sum, value) => sum + value, 0) / measuredCompletions.length) : null, last_activity_at: videoSessions.slice().sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))[0]?.last_seen_at ?? null };
  }).filter((video) => !queryText || [video.title, video.organization_name, video.space_name, video.id].some((value) => value.toLocaleLowerCase().includes(queryText))).sort((left, right) => right.total_views - left.total_views);
  const activity = logs.map((log) => {
    const video = log.video_id ? videoById.get(log.video_id) : null;
    const space = video?.space_id ? spaceById.get(video.space_id) : null;
    const organization = space ? organizationById.get(space.organization_id) : null;
    return { id: log.id, created_at: log.created_at, level: log.level, category: log.category, action: log.action, user_id: log.user_id, video_id: log.video_id, session_id: log.session_id, status: log.status, organization_id: organization?.id ?? null, organization_name: organization?.name ?? null, space_id: space?.id ?? null, space_name: space?.name ?? null, resource_label: video?.title ?? (log.user_id ? profileById.get(log.user_id)?.email ?? null : null), result: resultLabel(log) };
  }).filter((log) => !queryText || [log.action, log.organization_name, log.space_name, log.resource_label, log.session_id].some((value) => value?.toLocaleLowerCase().includes(queryText)));
  const scopedOrgMemberships = orgMemberships.filter((membership) => scopedOrganizationIds.has(membership.organization_id));
  const scopedSpaceMemberships = spaceMemberships.filter((membership) => scopedSpaceIds.has(membership.space_id));
  const scopedOrganizations = organizations.filter((organization) => scopedOrganizationIds.has(organization.id) && (!organizationFilterActive || organization.id === visibleOrg?.id)).map((organization) => { const stats = orgStats.get(organization.id); return { id: organization.id, name: organization.name, slug: organization.slug, status: organization.archived_at ? "archived" as const : "active" as const, clickup_workspace_id: organization.clickup_workspace_id, clickup_sync_status: organization.clickup_sync_status, clickup_last_synced_at: organization.clickup_last_synced_at, clickup_sync_error: organization.clickup_sync_error, created_at: organization.created_at, member_count: stats?.member_count ?? 0, active_member_count: stats?.active_member_count ?? 0, admin_count: stats?.admin_count ?? 0, space_count: stats?.space_count ?? 0, active_space_count: stats?.active_space_count ?? 0, video_count: stats?.video_count ?? 0, active_watch_links: stats?.active_watch_links ?? 0, sessions: stats?.sessions ?? 0, measured_sessions: stats?.measured_sessions ?? 0, views: stats?.views ?? 0, watch_time_seconds: stats?.measured ? Math.round(stats.watch) : null, last_activity_at: stats?.last ?? null }; });
  const scopedSpaces = scopedSpaceRows.filter((space) => !queryText || [space.name, space.slug, organizationById.get(space.organization_id)?.name].some((value) => value?.toLocaleLowerCase().includes(queryText))).map((space) => { const stats = spaceStats.get(space.id); const organization = organizationById.get(space.organization_id); return { id: space.id, name: space.name, slug: space.slug, organization_id: space.organization_id, organization_name: organization?.name ?? "Unknown Organization", status: space.archived_at ? "archived" as const : "active" as const, clickup_workspace_id: space.clickup_workspace_id, clickup_space_id: space.clickup_space_id, clickup_sync_status: space.clickup_sync_status, clickup_last_synced_at: space.clickup_last_synced_at, clickup_sync_error: space.clickup_sync_error, created_at: space.created_at, member_count: stats?.member_count ?? 0, active_member_count: stats?.active_member_count ?? 0, admin_count: stats?.admin_count ?? 0, video_count: stats?.video_count ?? 0, active_watch_links: stats?.active_watch_links ?? 0, sessions: stats?.sessions ?? 0, unique_viewers: stats?.viewers.size ?? 0, watch_time_seconds: stats?.measured ? Math.round(stats.watch) : null, average_completion_percentage: stats && stats.completions.length > 0 ? Math.round(stats.completions.reduce((sum, value) => sum + value, 0) / stats.completions.length) : null, latest_activity_at: stats?.last ?? null }; });
  const scopedUsers = users.filter((user) => {
    if (!organizationFilterActive && !spaceFilterActive) return true;
    return scopedOrgMemberships.some((membership) => membership.profile_id === user.id && membership.status === "active")
      || scopedSpaceMemberships.some((membership) => membership.profile_id === user.id && membership.status === "active")
      || user.role === "owner";
  });
  const scopedLogs = logs.filter((log) => !organizationFilterActive || activity.find((item) => item.id === log.id)?.organization_id === visibleOrg?.id).filter((log) => !spaceFilterActive || activity.find((item) => item.id === log.id)?.space_id === visibleSpace?.id);
  const providerErrors = scopedLogs.filter((log) => log.category === "PROVIDER" && (log.level === "WARN" || log.level === "ERROR")).length;
  const security = { unauthorized: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("unauthorized")).length, forbidden: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("forbidden")).length, authentication_failures: scopedLogs.filter((log) => log.category === "AUTH" && (log.action.includes("failure") || log.level === "ERROR")).length, invalid_tokens: scopedLogs.filter((log) => log.action.includes("invalid_token")).length, suspicious: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("suspicious")).length, cross_tenant: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("cross")).length };
  const incidents = scopedLogs.filter((log) => log.level === "ERROR" || (log.category === "PROVIDER" && log.level === "WARN")).slice(0, 20).map((log) => ({ id: log.id, detected_at: log.created_at, severity: logSeverity(log), reason: `${log.category} · ${log.action}`, evidence: `${resultLabel(log)}${log.route ? ` · ${log.route}` : ""}`, status: "observed" as const }));
  const activeViewers = new Set(scopedSessions.filter((session) => new Date(session.last_seen_at).getTime() >= now.getTime() - 15 * 60 * 1000).map((session) => session.viewer_profile_id ?? session.id));
  const scopedSessionIds = new Set(scopedSessions.map((session) => session.id));
  const scopedTrackingEvents = trackingEvents.filter((event) => scopedSessionIds.has(event.session_id));
  const previousViews = scopedPreviousSessions.length;
  const percentageDelta = (current: number, previous: number): number | null => previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 100);
  const clickupStatuses = scopedOrganizations.map((organization) => organization.clickup_sync_status);
  const clickupSyncHealth: "healthy" | "degraded" | "unknown" = clickupStatuses.some((status) => status === "failed" || status === "partial") ? "degraded" : clickupStatuses.some((status) => status === "success") ? "healthy" : "unknown";
  const measuredWatchTimes = measuredSessions.map((session) => session.watch_time_seconds ?? 0);
  const averageWatchTime = measuredWatchTimes.length > 0 ? Math.round(measuredWatchTimes.reduce((sum, value) => sum + value, 0) / measuredWatchTimes.length) : null;
  const jobs = { name: CRON_JOB_NAME, schedule: CRON_SCHEDULE, configured: true, ...cronSnapshot };
  return {
    generated_at: now.toISOString(),
    range: selectedRange,
    range_start: startIso,
    metrics: {
      total_organizations: scopedOrganizations.length,
      active_organizations: scopedOrganizations.filter((organization) => organization.status === "active").length,
      total_spaces: scopedSpaces.length,
      active_spaces: scopedSpaces.filter((space) => space.status === "active").length,
      total_users: scopedUsers.length,
      active_users: scopedUsers.filter((user) => user.is_active).length,
      active_organization_members: scopedOrgMemberships.filter((membership) => membership.status === "active").length,
      active_space_members: scopedSpaceMemberships.filter((membership) => membership.status === "active").length,
      total_videos: videoViews.length,
      active_watch_links: links.filter((link) => scopedVideoIds.has(link.video_id) && link.revoked_at === null && (!link.expires_at || new Date(link.expires_at).getTime() > now.getTime())).length,
      total_sessions: scopedSessions.length,
      measured_sessions: measuredSessions.length,
      unmeasured_sessions: scopedSessions.length - measuredSessions.length,
      sessions_today: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= todayStart).length,
      sessions_this_week: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= sevenDayStart).length,
      views_today: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= todayStart).length,
      views_last_7_days: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= sevenDayStart).length,
      measured_watch_time_seconds: totalMeasuredWatchTime,
      average_watch_time_seconds: averageWatchTime,
      average_completion_percentage: completionValues.length > 0 ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length) : null,
      completion_rate: completionValues.length > 0 ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length) : null,
      tracking_events_today: scopedTrackingEvents.length,
      active_viewers: activeViewers.size,
      failed_sessions: scopedLogs.filter((log) => log.category === "SESSION" && (log.level === "ERROR" || log.action.includes("failed"))).length,
      provider_errors: providerErrors,
      cron_execution_status: jobs.execution_status,
      database_health: cronSnapshot.current_health_status,
      clickup_sync_health: clickupSyncHealth,
    },
    comparison: { previous_sessions: previousStartIso ? previousViews : null, previous_views: previousStartIso ? previousViews : null, sessions_delta_percentage: previousStartIso ? percentageDelta(scopedSessions.length, previousViews) : null, views_delta_percentage: previousStartIso ? percentageDelta(scopedSessions.length, previousViews) : null },
    organizations: scopedOrganizations,
    spaces: scopedSpaces,
    users: scopedUsers,
    videos: videoViews,
    recent_activity: activity.filter((log) => !organizationFilterActive || log.organization_id === visibleOrg?.id).filter((log) => !spaceFilterActive || log.space_id === visibleSpace?.id).slice(0, 100),
    security,
    jobs,
    incidents,
  };
}
