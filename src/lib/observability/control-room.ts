import { createAdminClient } from "@/utils/supabase/admin";
import type { Database } from "@/src/types/database";

const MAX_ORGANIZATIONS = 500;
const MAX_SPACES = 1000;
const MAX_USERS = 2000;
const MAX_VIDEOS = 2000;
const MAX_LINKS = 5000;
const MAX_SESSIONS = 5000;
const MAX_LOGS = 3000;

export type ControlRoomRange = "1h" | "today" | "yesterday" | "7d" | "30d";

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
    total_videos: number;
    active_watch_links: number;
    total_sessions: number;
    sessions_today: number;
    views_today: number;
    views_last_7_days: number;
    measured_watch_time_seconds: number | null;
    average_completion_percentage: number | null;
    active_viewers: number;
    failed_sessions: number;
    provider_errors: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: "active" | "archived";
    clickup_workspace_id: string | null;
    created_at: string;
    member_count: number;
    admin_count: number;
    space_count: number;
    video_count: number;
    sessions: number;
    views: number;
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
    created_at: string;
    member_count: number;
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
    execution_status: "not_observed";
    last_execution_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    next_expected_at: string | null;
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
  if (range === "today") start.setHours(0, 0, 0, 0);
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
  }
  if (range === "7d") start.setDate(start.getDate() - 7);
  if (range === "30d") start.setDate(start.getDate() - 30);
  return start;
}

function validRange(value: string | null | undefined): ControlRoomRange {
  return value === "1h" || value === "today" || value === "yesterday" || value === "7d" || value === "30d" ? value : "7d";
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
  const startIso = start.toISOString();
  const endIso = rangeEnd.toISOString();
  const queryText = input.query?.trim().toLocaleLowerCase() ?? "";
  const providerFilter = input.provider?.trim().toLocaleLowerCase() ?? "";
  const supabase = createAdminClient();

  const [organizationsResult, spacesResult, profilesResult, videosResult, linksResult, sessionsResult, logsResult, organizationMembershipsResult, spaceMembershipsResult] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, clickup_workspace_id, created_by, settings, archived_at, created_at, updated_at").order("created_at", { ascending: true }).limit(MAX_ORGANIZATIONS),
    supabase.from("spaces").select("id, organization_id, name, slug, clickup_workspace_id, created_by, settings, archived_at, created_at, updated_at").order("created_at", { ascending: true }).limit(MAX_SPACES),
    supabase.from("profiles").select("id, clickup_user_id, name, email, role, is_active, created_at, last_seen_at").order("created_at", { ascending: true }).limit(MAX_USERS),
    supabase.from("videos").select("id, workspace_id, space_id, created_by, title, description, source_type, source_url, duration, created_at, updated_at").order("created_at", { ascending: true }).limit(MAX_VIDEOS),
    supabase.from("watch_links").select("id, video_id, created_by, expires_at, revoked_at, created_at").order("created_at", { ascending: false }).limit(MAX_LINKS),
    supabase.from("watch_sessions").select("id, watch_link_id, viewer_profile_id, started_at, last_seen_at, ended_at, watch_time_seconds, completion_percentage").gte("started_at", startIso).lt("started_at", endIso).order("started_at", { ascending: false }).limit(MAX_SESSIONS),
    supabase.from("owner_logs").select("id, created_at, level, category, action, user_id, video_id, session_id, route, status, duration_ms, metadata").gte("created_at", startIso).lt("created_at", endIso).order("created_at", { ascending: false }).limit(MAX_LOGS),
    supabase.from("organization_members").select("organization_id, profile_id, role, status").neq("status", "removed").limit(MAX_USERS * 2),
    supabase.from("space_members").select("space_id, profile_id, role, status").neq("status", "removed").limit(MAX_USERS * 2),
  ]);
  if (organizationsResult.error || spacesResult.error || profilesResult.error || videosResult.error || linksResult.error || sessionsResult.error || logsResult.error || organizationMembershipsResult.error || spaceMembershipsResult.error) throw new Error("control_room_query_failed");

  const organizations = organizationsResult.data ?? [];
  const spaces = spacesResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const videos = videosResult.data ?? [];
  const links = linksResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const logs: LogProjection[] = logsResult.data ?? [];
  const orgMemberships = organizationMembershipsResult.data ?? [];
  const spaceMemberships = spaceMembershipsResult.data ?? [];

  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const spaceById = new Map(spaces.map((space) => [space.id, space]));
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const linkById = new Map(links.map((link) => [link.id, link]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const sessionsView: SessionView[] = sessions.map((session) => ({ id: session.id, viewer_profile_id: session.viewer_profile_id, video_id: linkById.get(session.watch_link_id)?.video_id ?? "", started_at: session.started_at, last_seen_at: session.last_seen_at, ended_at: session.ended_at, watch_time_seconds: session.watch_time_seconds, completion_percentage: session.completion_percentage })).filter((session) => session.video_id.length > 0);
  const organizationFilterActive = Boolean(input.organizationId);
  const spaceFilterActive = Boolean(input.spaceId);
  const visibleOrg = input.organizationId ? organizationById.get(input.organizationId) : undefined;
  const visibleSpace = input.spaceId ? spaceById.get(input.spaceId) : undefined;
  const scopeSpace = (space: SpaceRow): boolean => (!organizationFilterActive || space.organization_id === visibleOrg?.id) && (!spaceFilterActive || space.id === visibleSpace?.id);
  const scopedVideos = videos.filter((video) => {
    const space = video.space_id ? spaceById.get(video.space_id) : undefined;
    return Boolean(space && scopeSpace(space) && (!providerFilter || video.source_type === providerFilter));
  });
  const scopedVideoIds = new Set(scopedVideos.map((video) => video.id));
  const scopedSessions = sessionsView.filter((session) => scopedVideoIds.has(session.video_id));
  const todayStart = rangeStart("today", now).getTime();
  const sevenDayStart = rangeStart("7d", now).getTime();
  const measuredSessions = scopedSessions.filter((session) => session.watch_time_seconds !== null);
  const completionValues = measuredSessions.map((session) => session.completion_percentage).filter((value): value is number => typeof value === "number");
  const totalMeasuredWatchTime = measuredSessions.length > 0 ? Math.round(measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null;
  const sessionByVideo = new Map<string, SessionView[]>();
  for (const session of scopedSessions) sessionByVideo.set(session.video_id, [...(sessionByVideo.get(session.video_id) ?? []), session]);
  const linksByVideo = new Map<string, typeof links>();
  for (const link of links) linksByVideo.set(link.video_id, [...(linksByVideo.get(link.video_id) ?? []), link]);
  const orgStats = new Map<string, { member_count: number; admin_count: number; space_count: number; video_count: number; sessions: number; views: number; watch: number; measured: boolean; last: string | null }>();
  const spaceStats = new Map<string, { member_count: number; admin_count: number; video_count: number; active_watch_links: number; sessions: number; viewers: Set<string>; watch: number; measured: boolean; completions: number[]; last: string | null }>();
  for (const organization of organizations) orgStats.set(organization.id, { member_count: 0, admin_count: 0, space_count: 0, video_count: 0, sessions: 0, views: 0, watch: 0, measured: false, last: null });
  for (const space of spaces) {
    const stats = spaceStats.get(space.id) ?? { member_count: 0, admin_count: 0, video_count: 0, active_watch_links: 0, sessions: 0, viewers: new Set<string>(), watch: 0, measured: false, completions: [], last: null };
    const org = orgStats.get(space.organization_id);
    if (org) org.space_count += 1;
    spaceMemberships.filter((membership) => membership.space_id === space.id && membership.status === "active").forEach((membership) => { stats.member_count += 1; if (membership.role === "admin") stats.admin_count += 1; });
    spaceStats.set(space.id, stats);
  }
  for (const membership of orgMemberships) { const stats = orgStats.get(membership.organization_id); if (stats && membership.status === "active") { stats.member_count += 1; if (membership.role === "admin") stats.admin_count += 1; } }
  for (const video of scopedVideos) {
    if (!video.space_id) continue;
    const space = spaceById.get(video.space_id);
    if (!space) continue;
    const org = orgStats.get(space.organization_id);
    const spaceStat = spaceStats.get(space.id);
    if (org) org.video_count += 1;
    if (spaceStat) { spaceStat.video_count += 1; spaceStat.active_watch_links += (linksByVideo.get(video.id) ?? []).filter((link) => link.revoked_at === null && (!link.expires_at || new Date(link.expires_at).getTime() > now.getTime())).length; }
    for (const session of sessionByVideo.get(video.id) ?? []) {
      const targetOrg = orgStats.get(space.organization_id);
      if (targetOrg) { targetOrg.sessions += 1; targetOrg.views += 1; if (session.watch_time_seconds !== null) { targetOrg.watch += session.watch_time_seconds; targetOrg.measured = true; } targetOrg.last = !targetOrg.last || session.last_seen_at > targetOrg.last ? session.last_seen_at : targetOrg.last; }
      if (spaceStat) { spaceStat.sessions += 1; const viewer = session.viewer_profile_id ?? session.id; spaceStat.viewers.add(viewer); if (session.watch_time_seconds !== null) { spaceStat.watch += session.watch_time_seconds; spaceStat.measured = true; } if (session.completion_percentage !== null) spaceStat.completions.push(session.completion_percentage); spaceStat.last = !spaceStat.last || session.last_seen_at > spaceStat.last ? session.last_seen_at : spaceStat.last; }
    }
  }
  const sessionCountForProfile = new Map<string, SessionView[]>();
  for (const session of scopedSessions) if (session.viewer_profile_id) sessionCountForProfile.set(session.viewer_profile_id, [...(sessionCountForProfile.get(session.viewer_profile_id) ?? []), session]);
  const users = profiles.map((profile) => {
    const userSessions = sessionCountForProfile.get(profile.id) ?? [];
    const userVideos = new Set(userSessions.map((session) => session.video_id));
    const completions = userSessions.map((session) => session.completion_percentage).filter((value): value is number => typeof value === "number");
    const userOrgs = new Set(orgMemberships.filter((membership) => membership.profile_id === profile.id && membership.status === "active").map((membership) => membership.organization_id));
    const userSpaces = new Set(spaceMemberships.filter((membership) => membership.profile_id === profile.id && membership.status === "active").map((membership) => membership.space_id));
    return { id: profile.id, name: profile.name, email: profile.email, clickup_user_id: profile.clickup_user_id, role: profile.role, is_active: profile.is_active, created_at: profile.created_at, last_seen_at: profile.last_seen_at, organization_count: userOrgs.size, space_count: userSpaces.size, sessions: userSessions.length, videos_watched: userVideos.size, watch_time_seconds: userSessions.length > 0 ? Math.round(userSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null, average_completion_percentage: completions.length > 0 ? Math.round(completions.reduce((sum, value) => sum + value, 0) / completions.length) : null, last_watched_at: userSessions.slice().sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))[0]?.last_seen_at ?? null };
  }).filter((user) => !queryText || [user.name, user.email, user.clickup_user_id].some((value) => value?.toLocaleLowerCase().includes(queryText)));
  const videoViews = scopedVideos.map((video) => {
    const space = video.space_id ? spaceById.get(video.space_id) : null;
    const org = space ? organizationById.get(space.organization_id) : null;
    const videoSessions = sessionByVideo.get(video.id) ?? [];
    const completions = videoSessions.map((session) => session.completion_percentage).filter((value): value is number => typeof value === "number");
    const viewers = new Set(videoSessions.map((session) => session.viewer_profile_id ?? session.id));
    return { id: video.id, title: video.title, source_type: video.source_type, organization_id: org?.id ?? "", organization_name: org?.name ?? "Unknown Organization", space_id: space?.id ?? "", space_name: space?.name ?? "Unknown Space", duration: video.duration, created_at: video.created_at, total_views: videoSessions.length, unique_viewers: viewers.size, sessions: videoSessions.length, measured_sessions: videoSessions.filter((session) => session.watch_time_seconds !== null).length, unavailable_sessions: videoSessions.filter((session) => session.watch_time_seconds === null).length, watch_time_seconds: videoSessions.length > 0 ? Math.round(videoSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null, average_completion_percentage: completions.length > 0 ? Math.round(completions.reduce((sum, value) => sum + value, 0) / completions.length) : null, last_activity_at: videoSessions.slice().sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))[0]?.last_seen_at ?? null };
  }).filter((video) => !queryText || [video.title, video.organization_name, video.space_name, video.id].some((value) => value.toLocaleLowerCase().includes(queryText))).sort((left, right) => right.total_views - left.total_views);
  const activity = logs.map((log) => {
    const video = log.video_id ? videoById.get(log.video_id) : null;
    const space = video?.space_id ? spaceById.get(video.space_id) : null;
    const organization = space ? organizationById.get(space.organization_id) : null;
    return { id: log.id, created_at: log.created_at, level: log.level, category: log.category, action: log.action, user_id: log.user_id, video_id: log.video_id, session_id: log.session_id, status: log.status, organization_id: organization?.id ?? null, organization_name: organization?.name ?? null, space_id: space?.id ?? null, space_name: space?.name ?? null, resource_label: video?.title ?? (log.user_id ? profileById.get(log.user_id)?.email ?? null : null), result: resultLabel(log) };
  }).filter((log) => !queryText || [log.action, log.organization_name, log.space_name, log.resource_label, log.session_id].some((value) => value?.toLocaleLowerCase().includes(queryText)));
  const scopedOrganizations = organizations.filter((organization) => !organizationFilterActive || organization.id === visibleOrg?.id).map((organization) => { const stats = orgStats.get(organization.id); return { id: organization.id, name: organization.name, slug: organization.slug, status: organization.archived_at ? "archived" as const : "active" as const, clickup_workspace_id: organization.clickup_workspace_id, created_at: organization.created_at, member_count: stats?.member_count ?? 0, admin_count: stats?.admin_count ?? 0, space_count: stats?.space_count ?? 0, video_count: stats?.video_count ?? 0, sessions: stats?.sessions ?? 0, views: stats?.views ?? 0, watch_time_seconds: stats?.measured ? Math.round(stats.watch) : null, last_activity_at: stats?.last ?? null }; });
  const scopedSpaces = spaces.filter(scopeSpace).filter((space) => !queryText || [space.name, space.slug, organizationById.get(space.organization_id)?.name].some((value) => value?.toLocaleLowerCase().includes(queryText))).map((space) => { const stats = spaceStats.get(space.id); const organization = organizationById.get(space.organization_id); return { id: space.id, name: space.name, slug: space.slug, organization_id: space.organization_id, organization_name: organization?.name ?? "Unknown Organization", status: space.archived_at ? "archived" as const : "active" as const, clickup_workspace_id: space.clickup_workspace_id, created_at: space.created_at, member_count: stats?.member_count ?? 0, admin_count: stats?.admin_count ?? 0, video_count: stats?.video_count ?? 0, active_watch_links: stats?.active_watch_links ?? 0, sessions: stats?.sessions ?? 0, unique_viewers: stats?.viewers.size ?? 0, watch_time_seconds: stats?.measured ? Math.round(stats.watch) : null, average_completion_percentage: stats && stats.completions.length > 0 ? Math.round(stats.completions.reduce((sum, value) => sum + value, 0) / stats.completions.length) : null, latest_activity_at: stats?.last ?? null }; });
  const scopedUsers = users.filter((user) => !organizationFilterActive || orgMemberships.some((membership) => membership.profile_id === user.id && membership.organization_id === visibleOrg?.id && membership.status === "active"));
  const scopedLogs = logs.filter((log) => !organizationFilterActive || activity.find((item) => item.id === log.id)?.organization_id === visibleOrg?.id).filter((log) => !spaceFilterActive || activity.find((item) => item.id === log.id)?.space_id === visibleSpace?.id);
  const providerErrors = scopedLogs.filter((log) => log.category === "PROVIDER" && (log.level === "WARN" || log.level === "ERROR")).length;
  const security = { unauthorized: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("unauthorized")).length, forbidden: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("forbidden")).length, authentication_failures: scopedLogs.filter((log) => log.category === "AUTH" && (log.action.includes("failure") || log.level === "ERROR")).length, invalid_tokens: scopedLogs.filter((log) => log.action.includes("invalid_token") || log.action.includes("invalid_token")).length, suspicious: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("suspicious")).length, cross_tenant: scopedLogs.filter((log) => log.category === "SECURITY" && log.action.includes("cross")).length };
  const incidents = scopedLogs.filter((log) => log.level === "ERROR" || (log.category === "PROVIDER" && log.level === "WARN")).slice(0, 20).map((log) => ({ id: log.id, detected_at: log.created_at, severity: logSeverity(log), reason: `${log.category} · ${log.action}`, evidence: `${resultLabel(log)}${log.route ? ` · ${log.route}` : ""}`, status: "observed" as const }));
  const activeViewers = new Set(scopedSessions.filter((session) => new Date(session.last_seen_at).getTime() >= now.getTime() - 15 * 60 * 1000).map((session) => session.viewer_profile_id ?? session.id));
  return { generated_at: now.toISOString(), range: selectedRange, range_start: startIso, metrics: { total_organizations: scopedOrganizations.length, active_organizations: scopedOrganizations.filter((organization) => organization.status === "active").length, total_spaces: scopedSpaces.length, active_spaces: scopedSpaces.filter((space) => space.status === "active").length, total_users: scopedUsers.length, active_users: scopedUsers.filter((user) => user.is_active).length, total_videos: videoViews.length, active_watch_links: links.filter((link) => scopedVideoIds.has(link.video_id) && link.revoked_at === null && (!link.expires_at || new Date(link.expires_at).getTime() > now.getTime())).length, total_sessions: scopedSessions.length, sessions_today: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= todayStart).length, views_today: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= todayStart).length, views_last_7_days: scopedSessions.filter((session) => new Date(session.started_at).getTime() >= sevenDayStart).length, measured_watch_time_seconds: totalMeasuredWatchTime, average_completion_percentage: completionValues.length > 0 ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length) : null, active_viewers: activeViewers.size, failed_sessions: scopedLogs.filter((log) => log.category === "SESSION" && (log.level === "ERROR" || log.action.includes("failed"))).length, provider_errors: providerErrors }, organizations: scopedOrganizations, spaces: scopedSpaces, users: scopedUsers, videos: videoViews, recent_activity: activity.filter((log) => !organizationFilterActive || log.organization_id === visibleOrg?.id).filter((log) => !spaceFilterActive || log.space_id === visibleSpace?.id).slice(0, 100), security, jobs: { name: "Health DB Cron", schedule: "0 3 * * * UTC", configured: true, execution_status: "not_observed" as const, last_execution_at: null, last_success_at: null, last_failure_at: null, next_expected_at: null }, incidents };
}
