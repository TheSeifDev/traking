import { authorizeOrganizationAdmin, authorizeSpaceAdmin } from "@/src/lib/spaces/access";
import { isOwner } from "@/src/lib/auth/rbac";
import type { AuthenticatedUser } from "@/src/types/auth";
import type { Database } from "@/src/types/database";
import { buildPlaybackHeatmap } from "@/src/lib/analytics/ranges";
import { createAdminClient } from "@/utils/supabase/admin";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type Scope = { kind: "owner" } | { kind: "organization"; id: string } | { kind: "space"; id: string };

type SessionRow = Pick<Database["public"]["Tables"]["watch_sessions"]["Row"], "id" | "watch_link_id" | "viewer_identifier" | "viewer_profile_id" | "started_at" | "last_seen_at" | "ended_at" | "watch_time_seconds" | "completion_percentage" | "device_type" | "browser" | "os">;

type VideoRef = {
  id: string;
  title: string;
  source_type: string;
  duration: number | null;
  space_id: string;
  organization_id: string;
};

type EventRow = {
  id: string;
  session_id: string;
  event_type: Database["public"]["Enums"]["watch_event_type"];
  position: number;
  duration: number | null;
  from_position: number | null;
  occurred_at: string | null;
  received_at: string;
  playback_rate: number | null;
  from_rate: number | null;
  to_rate: number | null;
  metadata: Database["public"]["Tables"]["watch_events"]["Row"]["metadata"];
  created_at: string;
  sequence_number: number | null;
};


type User360Result = {
  profile: Pick<ProfileRow, "id" | "name" | "email" | "clickup_user_id" | "role" | "is_active" | "created_at" | "last_seen_at">;
  memberships: Array<{ organization_id: string; organization_name: string; space_id: string; space_name: string; role: string; status: string }>;
  sessions: Array<{
    session_id: string;
    video_id: string;
    video_title: string;
    organization_id: string;
    space_id: string;
    started_at: string;
    first_play_at: string | null;
    last_activity_at: string;
    ended_at: string | null;
    watch_time_seconds: number | null;
    completion_percentage: number | null;
    last_position: number | null;
    source_type: string;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    event_count: number;
    playback_events: EventRow[];
    heatmap: ReturnType<typeof buildPlaybackHeatmap>;
  }>;
  summary: { total_watch_time_seconds: number | null; videos_watched: number; videos_completed: number; sessions: number; average_completion_percentage: number | null; average_session_duration_seconds: number | null; last_activity_at: string | null };
};

async function authorizeScope(scope: Scope, actor: AuthenticatedUser): Promise<void> {
  if (scope.kind === "owner") {
    if (!isOwner(actor.role)) throw new Error("forbidden");
    return;
  }
  if (scope.kind === "organization") {
    await authorizeOrganizationAdmin(scope.id, actor);
    return;
  }
  await authorizeSpaceAdmin(scope.id, actor);
}

export async function getUser360(profileId: string, scope: Scope, actor: AuthenticatedUser): Promise<User360Result | null> {
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return null;
  await authorizeScope(scope, actor);
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, name, email, clickup_user_id, role, is_active, created_at, last_seen_at")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("space_members")
    .select("space_id, profile_id, role, status")
    .eq("profile_id", profileId)
    .neq("status", "removed")
    .limit(500);
  if (membershipError) return null;

  const membershipRows = memberships ?? [];
  const memberSpaceIds = [...new Set(membershipRows.map((membership) => membership.space_id))];
  const { data: memberSpaces, error: memberSpacesError } = memberSpaceIds.length > 0
    ? await supabase.from("spaces").select("id, name, organization_id").in("id", memberSpaceIds).is("archived_at", null).limit(500)
    : { data: [], error: null };
  if (memberSpacesError) return null;
  const spaceById = new Map((memberSpaces ?? []).map((space) => [space.id, space]));

  const visibleSpaceIds = new Set<string>();
  if (scope.kind === "space") visibleSpaceIds.add(scope.id);
  else if (scope.kind === "organization") {
    const { data: spaces, error: spacesError } = await supabase.from("spaces").select("id").eq("organization_id", scope.id).is("archived_at", null).limit(100);
    if (spacesError) return null;
    for (const space of spaces ?? []) visibleSpaceIds.add(space.id);
  }
  const scopedMemberships = membershipRows.filter((membership) => scope.kind === "owner" || visibleSpaceIds.has(membership.space_id));
  const organizationIds = [...new Set(scopedMemberships.map((membership) => spaceById.get(membership.space_id)?.organization_id).filter((id): id is string => typeof id === "string"))];
  const { data: organizations, error: organizationsError } = organizationIds.length > 0
    ? await supabase.from("organizations").select("id, name").in("id", organizationIds).limit(100)
    : { data: [], error: null };
  if (organizationsError) return null;
  const organizationById = new Map((organizations ?? []).map((organization) => [organization.id, organization]));
  const membershipViews = scopedMemberships.flatMap((membership) => {
    const space = spaceById.get(membership.space_id);
    const organization = space ? organizationById.get(space.organization_id) : undefined;
    if (!space || !organization) return [];
    return [{ organization_id: organization.id, organization_name: organization.name, space_id: space.id, space_name: space.name, role: membership.role, status: membership.status }];
  });

  const { data: rawSessions, error: sessionsError } = await supabase
    .from("watch_sessions")
    .select("id, watch_link_id, viewer_identifier, viewer_profile_id, started_at, last_seen_at, ended_at, watch_time_seconds, completion_percentage, device_type, browser, os")
    .eq("viewer_profile_id", profileId)
    .order("started_at", { ascending: false })
    .limit(2000);
  if (sessionsError) return null;
  const sessionRows: SessionRow[] = rawSessions ?? [];
  const linkIds = [...new Set(sessionRows.map((session) => session.watch_link_id))];
  const { data: links, error: linksError } = linkIds.length > 0
    ? await supabase.from("watch_links").select("id, video_id").in("id", linkIds).limit(2000)
    : { data: [], error: null };
  if (linksError) return null;
  const linkById = new Map((links ?? []).map((link) => [link.id, link]));
  const videoIds = [...new Set((links ?? []).map((link) => link.video_id))];
  const { data: videos, error: videosError } = videoIds.length > 0
    ? await supabase.from("videos").select("id, title, source_type, duration, space_id").in("id", videoIds).limit(2000)
    : { data: [], error: null };
  if (videosError) return null;
  const videoById = new Map((videos ?? []).map((video) => [video.id, video]));
  const sessions = sessionRows.flatMap((session) => {
    const link = linkById.get(session.watch_link_id);
    const video = link ? videoById.get(link.video_id) : undefined;
    if (!video || typeof video.space_id !== "string") return [];
    const space = spaceById.get(video.space_id);
    const organizationId = space?.organization_id;
    if (!space || !organizationId || (scope.kind === "space" && space.id !== scope.id) || (scope.kind === "organization" && !visibleSpaceIds.has(space.id))) return [];
    const videoRef: VideoRef = { id: video.id, title: video.title, source_type: video.source_type, duration: video.duration, space_id: space.id, organization_id: organizationId };
    return [{ session, video: videoRef }];
  });
  const sessionIds = sessions.map((entry) => entry.session.id);
  const { data: rawEvents, error: eventsError } = sessionIds.length > 0
    ? await supabase.from("watch_events").select("id, session_id, event_type, position, duration, from_position, occurred_at, received_at, playback_rate, from_rate, to_rate, metadata, created_at, sequence_number").in("session_id", sessionIds).order("created_at", { ascending: true }).limit(10000)
    : { data: [], error: null };
  if (eventsError) return null;
  const eventsBySession = new Map<string, EventRow[]>();
  for (const event of rawEvents ?? []) {
    const eventRow: EventRow = {
      id: event.id,
      session_id: event.session_id,
      event_type: event.event_type,
      position: event.position,
      duration: event.duration,
      from_position: event.from_position,
      occurred_at: event.occurred_at,
      received_at: event.received_at,
      playback_rate: event.playback_rate,
      from_rate: event.from_rate,
      to_rate: event.to_rate,
      metadata: event.metadata,
      created_at: event.created_at,
      sequence_number: event.sequence_number,
    };
    eventsBySession.set(eventRow.session_id, [...(eventsBySession.get(eventRow.session_id) ?? []), eventRow]);
  }
  const resultSessions = sessions.map(({ session, video }) => {
    const events = eventsBySession.get(session.id) ?? [];
    const firstPlay = events.find((event) => event.event_type === "play" || event.event_type === "resume");
    const lastEvent = events[events.length - 1];
    const heatmap = buildPlaybackHeatmap(events.map((event) => ({ id: event.id, event_type: event.event_type, position: event.position, from_position: event.from_position, duration: event.duration, created_at: event.created_at, sequence_number: event.sequence_number, occurred_at: event.occurred_at })), video.duration, video.source_type === "youtube" || video.source_type === "direct_url");
    const measured = heatmap.available || events.some((event) => event.duration !== null && event.duration > 0);
    return { session_id: session.id, video_id: video.id, video_title: video.title, organization_id: video.organization_id, space_id: video.space_id, started_at: session.started_at, first_play_at: firstPlay?.occurred_at ?? firstPlay?.created_at ?? null, last_activity_at: lastEvent?.occurred_at ?? lastEvent?.received_at ?? session.last_seen_at, ended_at: session.ended_at, watch_time_seconds: measured ? Math.max(0, Number(session.watch_time_seconds ?? 0)) : null, completion_percentage: measured ? Math.max(0, Math.min(100, Number(session.completion_percentage ?? 0))) : null, last_position: measured ? (lastEvent?.position ?? null) : null, source_type: video.source_type, device_type: session.device_type, browser: session.browser, os: session.os, event_count: events.length, playback_events: events, heatmap };
  });
  const measuredSessions = resultSessions.filter((session) => session.watch_time_seconds !== null);
  const totalWatchTime = measuredSessions.length > 0 ? Math.round(measuredSessions.reduce((sum, session) => sum + (session.watch_time_seconds ?? 0), 0)) : null;
  const lastActivity = resultSessions.slice().sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())[0]?.last_activity_at ?? null;
  return {
    profile,
    memberships: membershipViews,
    sessions: resultSessions,
    summary: {
      total_watch_time_seconds: totalWatchTime,
      videos_watched: new Set(resultSessions.map((session) => session.video_id)).size,
      videos_completed: measuredSessions.filter((session) => (session.completion_percentage ?? 0) >= 90).length,
      sessions: resultSessions.length,
      average_completion_percentage: measuredSessions.length > 0 ? Math.round(measuredSessions.reduce((sum, session) => sum + (session.completion_percentage ?? 0), 0) / measuredSessions.length) : null,
      average_session_duration_seconds: resultSessions.length > 0 ? Math.round(resultSessions.reduce((sum, session) => sum + Math.max(0, (new Date(session.ended_at ?? session.last_activity_at).getTime() - new Date(session.started_at).getTime()) / 1000), 0) / resultSessions.length) : null,
      last_activity_at: lastActivity,
    },
  };
}
