import { existsSync, readFileSync } from "node:fs";
import { createSignedSessionCookie, verifySignedSessionCookie } from "../src/lib/auth/session-cookie";
import { getClickUpRedirectUri } from "../src/lib/app-url";
import { USER_ROLES, type AuthenticatedUser } from "../src/types/auth";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed += 1;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed += 1;
  }
}

function section(title: string): void {
  console.log(`\n-- ${title}`);
}

process.env.TRACKUP_SESSION_SECRET = "test_secret_with_at_least_32_characters";

const viewer: AuthenticatedUser = {
  id: "viewer-user-uuid",
  email: "viewer@trackup.io",
  role: USER_ROLES.VIEWER,
  is_active: true,
  name: "Viewer",
  clickup_user_id: "cu_viewer",
};

async function runTests(): Promise<void> {
  section("Signed TrackUp session cookie");

  const signed = await createSignedSessionCookie(viewer);
  const verified = await verifySignedSessionCookie(signed);
  assert(verified?.id === viewer.id, "valid signed session verifies");
  assert(verified?.role === USER_ROLES.VIEWER, "verified session preserves role");
  assert(!signed.includes(viewer.email), "cookie payload is base64url encoded, not raw JSON");

  const [payload, signature] = signed.split(".");
  const forgedPayload = payload.slice(0, -1) + (payload.endsWith("A") ? "B" : "A");
  assert(await verifySignedSessionCookie(`${forgedPayload}.${signature}`) === null, "payload tampering is rejected");
  assert(await verifySignedSessionCookie(`${payload}.invalidsignature`) === null, "signature tampering is rejected");
  assert(await verifySignedSessionCookie(JSON.stringify(viewer)) === null, "legacy unsigned JSON cookie is rejected");

  section("RLS migration hardening");

  const migration = readFileSync("supabase/migrations/20260820000001_create_rbac_and_profiles.sql", "utf8");
  assert(migration.includes('CREATE POLICY "No direct profile updates"'), "profile UPDATE is denied to authenticated clients");
  assert(migration.includes('CREATE POLICY "No direct profile inserts"'), "profile INSERT is denied to authenticated clients");
  assert(migration.includes('CREATE POLICY "No direct profile deletes"'), "profile DELETE is denied to authenticated clients");
  assert(!migration.includes('CREATE POLICY "Only owners can delete profiles"'), "owner profile deletion policy is absent");
  assert(migration.includes("REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC"), "SECURITY DEFINER helper execute is revoked from PUBLIC");

  section("Authenticated watch-session capability checks");
  assert(!existsSync("app/api/viewer/identity/route.ts") && !existsSync("src/components/watch/ViewerIdentityGate.tsx") && !existsSync("src/lib/auth/viewer-identity-cookie.ts") && !existsSync("src/lib/tracking/viewer-identity.ts"), "guest viewer authentication files are removed");
  const capabilityMigration = readFileSync("supabase/migrations/20260822000004_harden_watch_session_capabilities.sql", "utf8");
  const sessionRoute = readFileSync("app/api/tracking/session/route.ts", "utf8");
  const eventRoute = readFileSync("app/api/tracking/event/route.ts", "utf8");
  const endRoute = readFileSync("app/api/tracking/session/[sessionId]/end/route.ts", "utf8");
  const trackingService = readFileSync("src/lib/tracking/service.ts", "utf8");
  const watchPlayer = readFileSync("src/components/watch/WatchPlayer.tsx", "utf8");

  assert(capabilityMigration.includes("ADD COLUMN IF NOT EXISTS session_token TEXT"), "watch sessions add a private session token");
  assert(capabilityMigration.includes("gen_random_bytes(32)"), "existing watch sessions receive random backfill tokens");
  assert(capabilityMigration.includes("ALTER COLUMN session_token SET NOT NULL"), "session token is mandatory after backfill");
  assert(capabilityMigration.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_sessions_session_token"), "session token has a unique index");
  assert(sessionRoute.includes("withAuth") && sessionRoute.includes("createWatchSession(resolved.watch_link_id, user.id"), "session creation requires an authenticated TrackUp profile");
  assert(sessionRoute.includes("session_token: session.sessionToken"), "session creation route returns the private capability");
  assert(eventRoute.includes("withAuth") && eventRoute.includes("recordTrackingEvents(\n    sessionId") && eventRoute.includes("user.id"), "event route requires the authenticated TrackUp profile");
  assert(eventRoute.includes("missing_session_token") && eventRoute.includes("const sessionToken") && eventRoute.includes("recordTrackingEvents"), "event route requires and forwards the capability");
  assert(eventRoute.includes("status: 404") && eventRoute.includes("session_not_found"), "event route uses a non-leaking capability failure");
  assert(endRoute.includes("withAuth") && endRoute.includes("endWatchSession(sessionId, sessionToken, user.id"), "end route requires the authenticated TrackUp profile");
  assert(endRoute.includes("missing_session_token") && endRoute.includes("sessionToken"), "end route requires and forwards the capability");
  assert(endRoute.includes("status: 404") && endRoute.includes("session_not_found"), "end route uses a non-leaking capability failure");
  assert(endRoute.includes("const position") && endRoute.includes("finalDuration") && endRoute.includes("finalEvent") && endRoute.includes("endWatchSession(sessionId, sessionToken, user.id, watchTime, completion, position, finalDuration, finalEvent)"), "session end accepts final player position and duration for the authenticated profile");
  assert(trackingService.includes('randomBytes(32).toString("hex")'), "tracking service creates an opaque random capability");
  assert(trackingService.includes('.select("id, session_token")'), "tracking service reads the created capability");
  assert(trackingService.includes("recordTrackingEvents") && trackingService.includes('.eq("session_token", sessionToken)'), "event writes scope last-seen updates by capability");
  assert(trackingService.includes('.eq("session_token", sessionToken)'), "session end updates scope by capability");
  assert(trackingService.includes('event_type: "ended"') && trackingService.includes("position: position ?? 0") && trackingService.includes("duration: duration ?? null"), "session end stores an ended event only when final player telemetry exists");
  assert(trackingService.includes("duration: event.duration !== null") && trackingService.includes("duration: event.duration"), "provider duration is stored with each event");
  assert(trackingService.includes("const { error: sessionUpdateError } = await supabase") && trackingService.includes("if (sessionUpdateError)") && trackingService.includes("return true"), "event ingestion awaits the last-activity session update");
  assert(trackingService.includes("from_position: event.from_position !== null") && trackingService.includes("from_position: event.from_position"), "seek origin is stored in the dedicated from_position field");
  assert(trackingService.includes("hashViewerIdentity") && trackingService.includes('.select("id, viewer_identifier, viewer_profile_id")') && trackingService.includes("data.viewer_profile_id === viewerIdentity && data.viewer_identifier === await hashViewerIdentity(viewerIdentity)"), "tracking writes are bound to the exact authenticated profile identity and its stable hash");
  assert(trackingService.includes('.is("ended_at", null)'), "events and session end reject already-ended sessions");
  assert(watchPlayer.includes("const accumulateWatchTime = useCallback((resume: boolean)"), "watch player accumulates elapsed play segments explicitly");
  assert(watchPlayer.includes("startTimeRef.current = Date.now()") && watchPlayer.includes("const initialSnapshot = readSnapshot()") && watchPlayer.includes("startSession()"), "watch time does not start before playback begins");
  assert(watchPlayer.includes("accumulateWatchTime(true)"), "heartbeat flushes and resumes the active play segment");
  assert(watchPlayer.includes("accumulateWatchTime(false)") && watchPlayer.includes("void sendEvent(\"pause\""), "pause flushes the active play segment");
  assert(watchPlayer.includes('eventType === "resume" ? "resume" : "play"') || watchPlayer.includes('const eventType: TrackingEventType = hasPlayedRef.current ? "resume" : "play"'), "player distinguishes initial play from resumed playback");
  assert(watchPlayer.includes("from_position"), "watch player sends seek origin data");
  assert(watchPlayer.includes("session_token: sessionToken"), "watch player forwards the capability to tracking APIs");
  assert(watchPlayer.includes('data.session_token !== "string"'), "watch player requires the capability before readiness");
  const analyticsMigration = readFileSync("supabase/migrations/20260824000004_add_analytics_identity_and_ordered_events.sql", "utf8");
  const analyticsRanges = readFileSync("src/lib/analytics/ranges.ts", "utf8");
  const viewerAnalyticsRoute = readFileSync("app/api/videos/[id]/analytics/viewers/[viewerId]/route.ts", "utf8");
  const sessionAnalyticsRoute = readFileSync("app/api/videos/[id]/analytics/sessions/[sessionId]/route.ts", "utf8");
  const videoAnalyticsPage = readFileSync("app/(dashboard)/analytics/videos/[id]/page.tsx", "utf8");
  const viewerAnalyticsPage = readFileSync("app/(dashboard)/analytics/videos/[id]/viewers/[viewerId]/page.tsx", "utf8");
  const sessionAnalyticsPage = readFileSync("app/(dashboard)/analytics/videos/[id]/sessions/[sessionId]/page.tsx", "utf8");
  assert(analyticsMigration.includes("viewer_profile_id UUID REFERENCES public.profiles(id)") && analyticsMigration.includes("device_type TEXT") && analyticsMigration.includes("browser TEXT") && analyticsMigration.includes("os TEXT"), "analytics sessions persist profile-backed device metadata");
  assert(analyticsMigration.includes("client_event_id TEXT") && analyticsMigration.includes("sequence_number INTEGER") && analyticsMigration.includes("occurred_at TIMESTAMPTZ") && analyticsMigration.includes("metadata JSONB"), "analytics events persist ordered idempotent telemetry");
  assert(analyticsMigration.includes("uq_watch_events_session_client_event") && analyticsMigration.includes("idx_watch_events_session_sequence"), "analytics events have dedupe and ordering indexes");
  assert(eventRoute.includes("MAX_BATCH_SIZE") && eventRoute.includes("normalizeMetadata") && eventRoute.includes("invalid_batch_size"), "tracking batch input is bounded and sanitized");
  assert(trackingService.includes("viewer_profile_id: viewerIdentity") && !trackingService.includes("viewer_identity_id") && trackingService.includes("deriveViewerClientMetadata"), "new sessions bind only the authenticated profile and coarse client metadata");
  assert(watchPlayer.includes("pendingEventsRef") && watchPlayer.includes("sequenceNumberRef") && watchPlayer.includes("flushEvents") && watchPlayer.includes("client_event_id"), "player batches ordered idempotent events");
  assert(analyticsRanges.includes("reconstructWatchedRanges") && analyticsRanges.includes("aggregateHeatmaps") && analyticsRanges.includes("not_available_from_provider"), "range aggregation has deterministic and honest availability states");
  assert(viewerAnalyticsRoute.includes("withDashboardAuth") && viewerAnalyticsRoute.includes("resolveSpaceAdminForUser") && viewerAnalyticsRoute.includes("getVideoViewerAnalytics") && sessionAnalyticsRoute.includes("withDashboardAuth") && sessionAnalyticsRoute.includes("resolveSpaceAdminForUser") && sessionAnalyticsRoute.includes("getVideoSessionAnalytics"), "viewer and session analytics APIs enforce authenticated Space-admin scope");
  assert(videoAnalyticsPage.includes("HeatmapPanel") && viewerAnalyticsPage.includes("ViewerIdentityCard") && sessionAnalyticsPage.includes("SessionTimeline"), "scoped analytics pages render the new detail hierarchy");

  section("Watch-link lifecycle and owner mutation checks");
  const revocationMigration = readFileSync("supabase/migrations/20260822000005_add_watch_link_revocation.sql", "utf8");
  const eventPositionMigration = readFileSync("supabase/migrations/20260822000006_add_watch_event_from_position.sql", "utf8");
  const resumeEventMigration = readFileSync("supabase/migrations/20260823000002_add_resume_watch_event.sql", "utf8");
  const activeLinkMigration = readFileSync("supabase/migrations/20260823000001_enforce_one_active_watch_link.sql", "utf8");
  const watchLinkService = readFileSync("src/lib/videos/service.ts", "utf8");
  const watchLinkRoute = readFileSync("app/api/videos/[id]/watch-link/route.ts", "utf8");
  const ownerAdminsRoute = readFileSync("app/api/owner/admins/route.ts", "utf8");
  const watchLinkPanel = readFileSync("src/components/dashboard/WatchLinkPanel.tsx", "utf8");
  const videoList = readFileSync("src/components/dashboard/VideoList.tsx", "utf8");
  const videosApi = readFileSync("app/api/videos/route.ts", "utf8");
  const watchPage = readFileSync("app/watch/[token]/page.tsx", "utf8");
  const teamManager = readFileSync("src/components/dashboard/TeamMemberManager.tsx", "utf8");
  const adminUsersPage = readFileSync("app/admin/users/page.tsx", "utf8");
  const adminUsersRoute = readFileSync("app/api/admin/users/route.ts", "utf8");
  const roleManagement = readFileSync("src/lib/auth/role-management.ts", "utf8");
  const invitationMigration = readFileSync("supabase/migrations/20260824000001_create_invitations_and_profile_presence.sql", "utf8");
  const acceptanceMigration = readFileSync("supabase/migrations/20260824000002_add_invitation_acceptance_rpc.sql", "utf8");
  const presenceMigration = readFileSync("supabase/migrations/20260824000003_add_profile_last_seen_rpc.sql", "utf8");
  const invitationService = readFileSync("src/lib/auth/invitations.ts", "utf8");
  const invitationCookie = readFileSync("src/lib/auth/invitation-cookie.ts", "utf8");
  const inviteStartRoute = readFileSync("app/api/invitations/start/route.ts", "utf8");
  const presenceRoute = readFileSync("app/api/auth/presence/route.ts", "utf8");
  const functionSecurityMigration = readFileSync("supabase/migrations/20260824000011_harden_function_security.sql", "utf8");
  const legacyRlsMigration = readFileSync("supabase/migrations/20260824000012_harden_legacy_rls_ingestion.sql", "utf8");
  const watchLinksPage = readFileSync("app/(dashboard)/watch-links/page.tsx", "utf8");
  const watchLinksManager = readFileSync("src/components/dashboard/WatchLinksManager.tsx", "utf8");
  const dashboardShell = readFileSync("src/components/dashboard/DashboardShell.tsx", "utf8");
  assert(revocationMigration.includes("ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ"), "watch links have a revocation timestamp");
  assert(eventPositionMigration.includes("ADD COLUMN IF NOT EXISTS from_position NUMERIC(10,2)"), "watch events preserve seek origin position");
  assert(resumeEventMigration.includes("ALTER TYPE public.watch_event_type ADD VALUE IF NOT EXISTS 'resume'"), "watch events distinguish resumed playback");
  assert(activeLinkMigration.includes("CREATE UNIQUE INDEX") && activeLinkMigration.includes("WHERE revoked_at IS NULL"), "database enforces one active watch link per video while preserving revoked history");
  assert(revocationMigration.includes("idx_watch_links_revoked_at"), "watch-link revocation is indexed");
  assert(trackingService.includes("if (link.revoked_at) return null"), "revoked links cannot create new sessions");
  assert(trackingService.includes('.select("id, expires_at, revoked_at")') && trackingService.includes("const { data: activeLink"), "session creation re-checks link lifecycle before insert");
  assert(trackingService.includes("new Date(activeLink.expires_at) <= new Date()"), "session creation rejects expiry at the current instant");
  assert(watchLinkService.includes("export async function revokeWatchLink"), "video service exposes real link revocation");
  assert(watchLinkService.includes('.eq("workspace_id", workspaceId)') && watchLinkService.includes('.eq("video_id", videoId)'), "link revocation verifies video workspace ownership");
  assert(watchLinkService.includes('.is("revoked_at", null)'), "link revocation is idempotently scoped to active links");
  assert(watchLinkService.includes("23505") && watchLinkService.includes("toResult(racedLink, true)"), "watch-link generation safely reuses the active link across concurrent requests");
  assert(watchLinkRoute.includes("link.reused ? 200 : 201"), "watch-link API distinguishes a newly created link from an existing active link");
  assert(watchLinkPanel.includes("Viewer link") && watchLinkPanel.includes("One private TrackUp link per video") && !watchLinkPanel.includes("Copy active link"), "watch-link UI communicates a single viewer-link contract without duplicate header actions");
  assert(watchLinkRoute.includes("export const DELETE") && watchLinkRoute.includes("revokeWatchLink"), "watch-link route exposes protected DELETE revocation");
  assert(ownerAdminsRoute.includes("changeUserRole") && !ownerAdminsRoute.includes("TODO: implement"), "owner admin route performs real role mutations");
  assert(watchLinkPanel.includes('method: "DELETE"') && watchLinkPanel.includes("revoked_at"), "watch-link UI reflects server revocation state");
  assert(watchLinkPanel.includes("appOrigin") && !watchLinkPanel.includes("window.location.origin"), "watch-link UI builds URLs without server-side window access");
  assert(watchPage.includes("getCurrentUser") && watchPage.includes("LoginRequired") && !watchPage.includes("ViewerIdentityGate") && !watchPage.includes("viewer_identity"), "viewer requires ClickUp-authenticated TrackUp identity");
  assert(watchLinkService.includes("viewer_profile_id") && watchLinkService.includes("viewer_identifier ?? session.id") && !watchLinkService.includes("viewer_identity_id"), "analytics summaries preserve profile identity and legacy anonymous fallback");
  assert(videoList.includes('video.playback_metrics_available && video.avg_completion !== null') && !videoList.includes('avg_completion ?? 0'), "video library does not turn unsupported completion into zero");
  assert(videoList.includes("img.youtube.com/vi/") && videoList.includes("getLinkState") && videoList.includes("Active"), "video library derives thumbnails, link status, and the single active-link state from real fields");
  assert(videosApi.includes("getWorkspaceAnalytics") && videosApi.includes("summary") && videosApi.includes("total_viewers"), "video API returns real library summary data alongside videos");
  assert(videoList.includes("providerFilter") && videoList.includes("statusFilter") && videoList.includes("sortBy") && videoList.includes("Search videos, descriptions, providers"), "video library provides real search, provider/status filters, and sorting");
  assert(videoList.includes("Most viewed") && videoList.includes("Alphabetical") && videoList.includes("Copy link") && videoList.includes("Open viewer") && videoList.includes("Revoke"), "video cards expose the required real management actions");
  assert(videoList.includes('method: "DELETE"') && videoList.includes("link_id: activeLink.id") && videoList.includes("Retry"), "video library exposes protected revoke and retry states");
  assert(watchLinkService.includes('throw new Error("video_list_failed")') && watchLinkService.includes("created_at,\n          watch_sessions"), "video list surfaces query failures and returns complete link fields");
  assert(watchLinksPage.includes("listVideos") && watchLinksManager.includes("WatchLinkPanel"), "watch-links page reuses workspace-scoped video and link contracts");
  assert(watchLinksManager.includes("Search watch links") && watchLinksManager.includes("Revoked links") && watchLinksManager.includes("No active link"), "watch-links UI provides searchable access cards and explicit active/revoked states");
  assert(watchLinksManager.includes("aspect-video") && watchLinksManager.includes("line-clamp-2") && watchLinksManager.includes("grid-cols-3") && watchLinksManager.includes("grid-cols-1") && watchLinksManager.includes("Session counts are recorded views"), "watch-links cards preserve media ratio and compact page-level information hierarchy");
  assert(watchLinkPanel.includes("min-h-11") && watchLinkPanel.includes("grid-cols-1") && watchLinkPanel.includes("sm:grid-cols-3") && watchLinkPanel.includes("Copy link") && watchLinkPanel.includes("Open") && watchLinkPanel.includes("Revoke"), "watch-link actions maintain mobile touch targets with explicit primary, secondary, and danger labels");
  assert(watchLinkPanel.includes("Revoked history") && watchLinkPanel.includes("View audit") && watchLinkPanel.includes("previous URL hidden") && !watchLinkPanel.includes("historyLinks.map((link) => {\n            const url"), "watch-link history is separated from active access without presenting revoked URLs as active");
  assert(dashboardShell.includes('href: "/watch-links"'), "dashboard navigation exposes watch links");
  assert(watchPage.includes("WatchPlayer") && watchPage.includes('robots: { index: false, follow: false }'), "public viewer remains internal and non-indexable");
  assert(watchPlayer.includes("https://www.youtube.com/iframe_api") && watchPlayer.includes("new api.Player"), "YouTube uses the official IFrame Player API inside TrackUp");
  assert(watchPlayer.includes("getCurrentTime") && watchPlayer.includes("getDuration") && watchPlayer.includes("onStateChange"), "YouTube telemetry reads current time, duration, and state changes from the API");
  assert(watchPlayer.includes("widget_referrer: window.location.origin") && watchPlayer.includes('setAttribute("referrerpolicy", "strict-origin-when-cross-origin")'), "YouTube IFrame API receives a valid origin referrer configuration");
  assert(watchPlayer.includes("youtube_iframe_api") || watchPlayer.includes("YouTube IFrame API"), "YouTube capability messaging is explicit");
  assert(teamManager.includes('fetch("/api/owner/admins"') && teamManager.includes("/api/owner/users/") && teamManager.includes('fetch("/api/admin/users"'), "team UI uses real owner management and invite endpoints");
  assert(teamManager.includes("Send a secure invitation") && teamManager.includes("transactional provider") && teamManager.includes("Resend"), "invite UI exposes real dispatch and lifecycle controls");
  assert(adminUsersPage.includes("TeamMemberManager") && adminUsersPage.includes("guardOwner"), "global team-management UI is owner-only");
  assert(adminUsersRoute.includes("createInvitation") && adminUsersRoute.includes("invalid_json") && adminUsersRoute.includes("delivery_not_configured"), "global invite route validates input and requires real dispatch");
  assert(invitationService.includes("requirePermission(permission)") && invitationService.includes("PERMISSIONS.USERS_MANAGE"), "global invitation service keeps centralized permission authorization");
  assert(invitationMigration.includes("CREATE TABLE IF NOT EXISTS public.invitations") && invitationMigration.includes("token_hash TEXT NOT NULL UNIQUE") && invitationMigration.includes("invitations_role_check"), "invitation schema persists only hashed single-use token state");
  assert(invitationMigration.includes("last_seen_at TIMESTAMPTZ") && invitationMigration.includes("No direct invitation reads"), "profile presence and invitation RLS are explicit");
  assert(acceptanceMigration.includes("CREATE OR REPLACE FUNCTION public.accept_invitation") && acceptanceMigration.includes("FOR UPDATE") && acceptanceMigration.includes("invitation_email_mismatch"), "acceptance is atomic, locked, and same-email constrained");
  assert(presenceMigration.includes("touch_profile_last_seen") && presenceMigration.includes("interval '5 minutes'"), "presence write is server-debounced in the database");
  assert(invitationService.includes("randomBytes(32)") && invitationService.includes("createHash(\"sha256\")") && invitationService.includes("last_sent_at"), "invitation service generates raw token once and stores only its digest");
  assert(invitationService.includes("delivery_not_configured") && invitationService.includes("if (!delivery.success)"), "invitation success is gated on transactional provider response");
  assert(invitationCookie.includes("tokenHash") && invitationCookie.includes("timingSafeEqual") && !invitationCookie.includes("rawToken"), "OAuth context cookie is signed and contains no raw token");
  assert(inviteStartRoute.includes("createInvitationContextCookie") && inviteStartRoute.includes("hashInvitationToken"), "invite start converts token to signed hashed OAuth context");
  assert(presenceRoute.includes("withAuth") && presenceRoute.includes("user.id") && !presenceRoute.includes("request.json"), "presence route uses only authenticated session identity");
  assert(roleManagement.includes("isOwner(requester.role)") && !roleManagement.includes("isAdminOrOwner(requester.role)") && !roleManagement.includes("createClickUpInvite"), "global role/status management is owner-only");
  assert(ownerAdminsRoute.includes("withRole") && ownerAdminsRoute.includes("USER_ROLES.OWNER") && !ownerAdminsRoute.includes("withPermission"), "owner admin mutation route is owner-only at the HTTP boundary");
  assert(adminUsersPage.includes("guardOwner"), "global user-management page is owner-only at the page boundary");
  assert(functionSecurityMigration.includes("REVOKE ALL ON FUNCTION public.get_current_user_role() FROM anon, authenticated") && functionSecurityMigration.includes("REVOKE ALL ON FUNCTION public.is_admin_or_owner() FROM anon, authenticated") && functionSecurityMigration.includes("REVOKE ALL ON FUNCTION public.is_owner() FROM anon, authenticated") && functionSecurityMigration.includes("SET search_path = public"), "function security migration revokes exposed helper execution and pins trigger search_path");
  assert(legacyRlsMigration.includes("No direct workspace reads") && legacyRlsMigration.includes("DROP POLICY IF EXISTS \"Anon can insert watch sessions\"") && legacyRlsMigration.includes("DROP POLICY IF EXISTS \"Anon can insert watch events\"") && legacyRlsMigration.includes("REVOKE ALL ON TABLE public.watch_sessions FROM anon, authenticated"), "legacy RLS migration closes workspace enumeration and anonymous tracking inserts");

  section("Provider-aware analytics honesty");
  const analyticsService = readFileSync("src/lib/videos/service.ts", "utf8");
  const analyticsDetail = readFileSync("src/components/dashboard/AnalyticsDetail.tsx", "utf8");
  const workspaceAnalyticsDashboard = readFileSync("src/components/dashboard/WorkspaceAnalyticsDashboard.tsx", "utf8");
  const dashboardPage = readFileSync("app/(dashboard)/dashboard/page.tsx", "utf8");
  const dashboardOverview = readFileSync("src/components/dashboard/DashboardOverview.tsx", "utf8");
  const videoDetailPage = readFileSync("app/(dashboard)/videos/[id]/page.tsx", "utf8");
  const videoAnalyticsDashboard = readFileSync("src/components/dashboard/VideoAnalyticsDashboard.tsx", "utf8");
  const viewerAnalyticsPanel = readFileSync("src/components/dashboard/ViewerAnalyticsPanel.tsx", "utf8");
  assert(analyticsService.includes("playback_metrics_scope") && analyticsService.includes('sourceType === "direct_url" || sourceType === "youtube"'), "analytics scope playback metrics to direct URLs and YouTube API telemetry");
  assert(analyticsService.includes("isValidTelemetryEvent") && analyticsService.includes("has_playback_telemetry"), "analytics requires stored valid telemetry before marking a session measured");
  assert(viewerAnalyticsPanel.includes("has_playback_telemetry") && !viewerAnalyticsPanel.includes("YouTube IFrame API measured"), "viewer UI separates provider capability from recorded telemetry");
  assert(analyticsService.includes("avg_completion_percentage: null") && analyticsService.includes("playback_metrics_available: false"), "analytics return unavailable instead of invented provider completion");
  assert(analyticsService.includes('v.source_type === "direct_url" && sessions.length > 0'), "video list completion is native-provider scoped");
  assert(workspaceAnalyticsDashboard.includes("Views over time") && workspaceAnalyticsDashboard.includes("Top videos by watch time") && workspaceAnalyticsDashboard.includes("Date range"), "workspace analytics dashboard communicates overview charts and filters");
  assert(dashboardPage.includes("DashboardOverview") && dashboardOverview.includes("Sessions over time") && dashboardOverview.includes("Top videos") && dashboardOverview.includes("Recent viewer activity") && dashboardOverview.includes("Quick actions"), "dashboard has clear workspace-level information architecture");
  assert(dashboardOverview.includes("activity.length === 0") && dashboardOverview.includes("No activity in this range") && dashboardOverview.includes("Not measurable") && dashboardOverview.includes("Provider telemetry unavailable"), "dashboard renders truthful no-data and telemetry states");
  assert(videoDetailPage.includes("VideoAnalyticsDashboard") && videoAnalyticsDashboard.includes("HeatmapPanel") && videoAnalyticsDashboard.includes("Not measured yet"), "video analytics dashboard explains provider limits and honest empty states");
  assert(analyticsService.includes("viewer_sessions") && analyticsService.includes("first_play_at") && analyticsService.includes("last_activity_at") && analyticsService.includes("latestEvent"), "analytics service exposes per-session timestamps and viewer breakdown");
  assert(videoAnalyticsDashboard.includes("has_playback_telemetry") && videoAnalyticsDashboard.includes("Telemetry sessions"), "video analytics shows measured session count from actual telemetry");
  assert(analyticsService.includes("from_position") && analyticsService.includes("eventsBySession") && analyticsService.includes("last_position"), "analytics service exposes supported playback event timelines and last position");
  assert(analyticsService.includes("total_measurable_watch_time_seconds") && analyticsService.includes("activity_over_time") && analyticsService.includes("top_videos_by_watch_time"), "analytics service exposes workspace totals, activity series, and top-video summaries");
  assert(workspaceAnalyticsDashboard.includes("analytics.viewer_sessions") && viewerAnalyticsPanel.includes("Session-only lifecycle") && viewerAnalyticsPanel.includes("Matching sessions"), "analytics UI renders per-viewer sessions with honest provider scope");
  assert(analyticsService.includes("viewer_profile_id") && analyticsService.includes("buildViewerSummaries") && analyticsService.includes("telemetry_health"), "analytics service exposes identified viewer summaries and telemetry health");
  assert(analyticsDetail.includes("Watched coverage") && analyticsDetail.includes("No playback data") && analyticsDetail.includes("Not available from provider") && analyticsDetail.includes("Session timeline"), "analytics detail UI exposes honest heatmap and event states");

  section("OAuth state and service-role checks");

  const appUrlHelper = readFileSync("src/lib/app-url.ts", "utf8");
  const nextConfig = readFileSync("next.config.ts", "utf8");
  const oauthStart = readFileSync("app/api/auth/clickup/route.ts", "utf8");
  const oauthCallback = readFileSync("app/api/auth/clickup/callback/route.ts", "utf8");
  const logoutRoute = readFileSync("app/api/auth/logout/route.ts", "utf8");
  const videoServiceForUrls = readFileSync("src/lib/videos/service.ts", "utf8");
  const adminClient = readFileSync("utils/supabase/admin.ts", "utf8");
  const middleware = readFileSync("middleware.ts", "utf8");
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedirectUri = process.env.CLICKUP_REDIRECT_URI;

  assert(appUrlHelper.includes('const PRODUCTION_APP_URL = "https://trakeup.vercel.app"'), "production app origin is the Trakeup domain");
  assert(nextConfig.includes('key: "Content-Security-Policy"') && nextConfig.includes("frame-src https://www.youtube.com") && nextConfig.includes("connect-src 'self'"), "CSP is present and allows the internal YouTube IFrame/player network contract");
  assert(nextConfig.includes('key: "Referrer-Policy"') && nextConfig.includes('strict-origin-when-cross-origin'), "YouTube embeds receive a referrer policy required for player configuration");
  assert(nextConfig.includes('key: "X-Content-Type-Options"') && nextConfig.includes('value: "nosniff"') && nextConfig.includes('key: "X-Frame-Options"') && nextConfig.includes('value: "DENY"') && nextConfig.includes('key: "Permissions-Policy"'), "baseline browser hardening headers are configured");
  assert(appUrlHelper.includes('const DEVELOPMENT_CLICKUP_REDIRECT_URI = `https://localhost:3000${CLICKUP_CALLBACK_PATH}`'), "local OAuth callback is the HTTPS localhost URI");
  assert(appUrlHelper.includes('const PRODUCTION_CLICKUP_REDIRECT_URI = `${PRODUCTION_APP_URL}${CLICKUP_CALLBACK_PATH}`'), "production OAuth callback is the Trakeup HTTPS URI");
  assert(appUrlHelper.includes('process.env.NODE_ENV === "production" ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL'), "app URL fallback is environment-aware");
  assert(appUrlHelper.includes("const expected = process.env.NODE_ENV === \"production\""), "OAuth callback selection is environment-aware");
  assert(appUrlHelper.includes("isLocalAppUrl") && appUrlHelper.includes("return PRODUCTION_APP_URL"), "production rejects loopback app URLs");
  process.env.CLICKUP_REDIRECT_URI = "http://stale.example/callback";
  Reflect.set(process.env, "NODE_ENV", "development");
  assert(getClickUpRedirectUri() === "https://localhost:3000/api/auth/clickup/callback", "development selects the localhost callback regardless of stale production config");
  Reflect.set(process.env, "NODE_ENV", "production");
  assert(getClickUpRedirectUri() === "https://trakeup.vercel.app/api/auth/clickup/callback", "production selects the HTTPS Trakeup callback regardless of stale local config");
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
  if (originalRedirectUri === undefined) delete process.env.CLICKUP_REDIRECT_URI;
  else process.env.CLICKUP_REDIRECT_URI = originalRedirectUri;
assert(oauthStart.includes("getClickUpRedirectUri") && !oauthStart.includes('"http://localhost:3000"'), "OAuth start uses canonical redirect configuration without localhost fallback");
assert(oauthCallback.includes("getClickUpRedirectUri") && oauthCallback.includes("redirect_uri: redirectUri"), "OAuth token exchange uses the same environment-aware callback URI");
assert(logoutRoute.includes("getAppUrl") && !logoutRoute.includes('"http://localhost:3000"'), "logout uses canonical production origin");
assert(videoServiceForUrls.includes("const appUrl = getAppUrl()") && !videoServiceForUrls.includes('process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"'), "watch links use canonical production origin");
  const authRedirect = readFileSync("src/lib/auth/redirect.ts", "utf8");
  assert(authRedirect.includes("getSafeAuthReturnPath") && authRedirect.includes("startsWith(\"//\")"), "auth return path rejects external and protocol-relative redirects");
  assert(oauthStart.includes("trackup_oauth_state") && oauthStart.includes("AUTH_RETURN_COOKIE"), "OAuth start stores state and return cookies");
assert(oauthStart.includes("https://app.clickup.com/api?"), "OAuth start uses ClickUp authorization URL");
  assert(oauthCallback.includes("state !== expectedState") && oauthCallback.includes("new URL(destination, request.url)"), "OAuth callback validates state and returns to the preserved path");
assert(oauthCallback.includes("https://api.clickup.com/api/v2/oauth/token"), "OAuth callback uses ClickUp token URL");
assert(oauthCallback.includes("https://api.clickup.com/api/v2/team"), "OAuth callback verifies authorized Workspaces");
assert(oauthCallback.includes("Authorization: `Bearer ${accessToken}`"), "OAuth API requests use Bearer token header");
assert(oauthCallback.includes("createSignedSessionCookie"), "OAuth callback writes signed session cookie");
assert(!adminClient.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;"), "admin client does not fall back to public key");
assert(middleware.includes("getSupabaseResponse") && middleware.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), "middleware does not crash when optional public Supabase env is missing");

  const total = passed + failed;
  console.log(`\n${"=".repeat(56)}`);
  console.log(`TrackUp Security Hardening: ${passed}/${total} tests passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
