import { readFileSync } from "node:fs";
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

  section("Anonymous watch-session capability checks");
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
  assert(sessionRoute.includes("withAuth") && sessionRoute.includes("createWatchSession(resolved.watch_link_id, user.id)"), "session creation requires the authenticated viewer identity");
  assert(sessionRoute.includes("session_token: session.sessionToken"), "session creation route returns the private capability");
  assert(eventRoute.includes("withAuth") && eventRoute.includes("user.id"), "event route requires the authenticated viewer identity");
  assert(eventRoute.includes("missing_session_token") && eventRoute.includes("session_token,"), "event route requires and forwards the capability");
  assert(eventRoute.includes("status: 404") && eventRoute.includes("session_not_found"), "event route uses a non-leaking capability failure");
  assert(endRoute.includes("withAuth") && endRoute.includes("user.id"), "end route requires the authenticated viewer identity");
  assert(endRoute.includes("missing_session_token") && endRoute.includes("sessionToken"), "end route requires and forwards the capability");
  assert(endRoute.includes("status: 404") && endRoute.includes("session_not_found"), "end route uses a non-leaking capability failure");
  assert(trackingService.includes('randomBytes(32).toString("hex")'), "tracking service creates an opaque random capability");
  assert(trackingService.includes('.select("id, session_token")'), "tracking service reads the created capability");
  assert(trackingService.includes('.eq("session_token", payload.session_token)'), "event writes scope last-seen updates by capability");
  assert(trackingService.includes('.eq("session_token", sessionToken)'), "session end updates scope by capability");
  assert(trackingService.includes("duration: payload.duration ?? null"), "provider duration is stored with each event");
  assert(trackingService.includes("from_position: payload.from_position ?? null"), "seek origin is stored in the dedicated from_position field");
  assert(trackingService.includes("hashViewerIdentity") && trackingService.includes("data.viewer_identifier === await hashViewerIdentity(viewerIdentity)"), "tracking writes are bound to the authenticated viewer identity");
  assert(trackingService.includes('.is("ended_at", null)'), "events and session end reject already-ended sessions");
  assert(watchPlayer.includes("const accumulateWatchTime = useCallback((resume: boolean)"), "watch player accumulates elapsed play segments explicitly");
  assert(watchPlayer.includes("startTimeRef.current = startTimeRef.current ?? Date.now()") && watchPlayer.includes("startSession()"), "watch time does not start before playback begins");
  assert(watchPlayer.includes("accumulateWatchTime(true)"), "heartbeat flushes and resumes the active play segment");
  assert(watchPlayer.includes("accumulateWatchTime(false)") && watchPlayer.includes("void sendEvent(\"pause\""), "pause flushes the active play segment");
  assert(watchPlayer.includes("from_position"), "watch player sends seek origin data");
  assert(watchPlayer.includes("session_token: sessionToken"), "watch player forwards the capability to tracking APIs");
  assert(watchPlayer.includes('data.session_token !== "string"'), "watch player requires the capability before readiness");

  section("Watch-link lifecycle and owner mutation checks");
  const revocationMigration = readFileSync("supabase/migrations/20260822000005_add_watch_link_revocation.sql", "utf8");
  const eventPositionMigration = readFileSync("supabase/migrations/20260822000006_add_watch_event_from_position.sql", "utf8");
  const watchLinkService = readFileSync("src/lib/videos/service.ts", "utf8");
  const watchLinkRoute = readFileSync("app/api/videos/[id]/watch-link/route.ts", "utf8");
  const ownerAdminsRoute = readFileSync("app/api/owner/admins/route.ts", "utf8");
  const watchLinkPanel = readFileSync("src/components/dashboard/WatchLinkPanel.tsx", "utf8");
  const videoList = readFileSync("src/components/dashboard/VideoList.tsx", "utf8");
  const watchPage = readFileSync("app/watch/[token]/page.tsx", "utf8");
  const teamManager = readFileSync("src/components/dashboard/TeamMemberManager.tsx", "utf8");
  const adminUsersPage = readFileSync("app/admin/users/page.tsx", "utf8");
  const adminUsersRoute = readFileSync("app/api/admin/users/route.ts", "utf8");
  const roleManagement = readFileSync("src/lib/auth/role-management.ts", "utf8");
  const watchLinksPage = readFileSync("app/(dashboard)/watch-links/page.tsx", "utf8");
  const dashboardShell = readFileSync("src/components/dashboard/DashboardShell.tsx", "utf8");
  assert(revocationMigration.includes("ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ"), "watch links have a revocation timestamp");
  assert(eventPositionMigration.includes("ADD COLUMN IF NOT EXISTS from_position NUMERIC(10,2)"), "watch events preserve seek origin position");
  assert(revocationMigration.includes("idx_watch_links_revoked_at"), "watch-link revocation is indexed");
  assert(trackingService.includes("if (link.revoked_at) return null"), "revoked links cannot create new sessions");
  assert(trackingService.includes('.select("id, expires_at, revoked_at")') && trackingService.includes("const { data: activeLink"), "session creation re-checks link lifecycle before insert");
  assert(trackingService.includes("new Date(activeLink.expires_at) <= new Date()"), "session creation rejects expiry at the current instant");
  assert(watchLinkService.includes("export async function revokeWatchLink"), "video service exposes real link revocation");
  assert(watchLinkService.includes('.eq("workspace_id", workspaceId)') && watchLinkService.includes('.eq("video_id", videoId)'), "link revocation verifies video workspace ownership");
  assert(watchLinkService.includes('.is("revoked_at", null)'), "link revocation is idempotently scoped to active links");
  assert(watchLinkRoute.includes("export const DELETE") && watchLinkRoute.includes("revokeWatchLink"), "watch-link route exposes protected DELETE revocation");
  assert(ownerAdminsRoute.includes("changeUserRole") && !ownerAdminsRoute.includes("TODO: implement"), "owner admin route performs real role mutations");
  assert(watchLinkPanel.includes('method: "DELETE"') && watchLinkPanel.includes("revoked_at"), "watch-link UI reflects server revocation state");
  assert(watchLinkPanel.includes("appOrigin") && !watchLinkPanel.includes("window.location.origin"), "watch-link UI builds URLs without server-side window access");
  assert(watchPage.includes("getCurrentUser") && watchPage.includes("Sign in to watch this video") && watchPage.includes("/login?redirect="), "viewer requires auth and preserves the exact return path");
  assert(videoList.includes('video.avg_completion === null') && !videoList.includes('avg_completion ?? 0'), "video library does not turn unsupported completion into zero");
  assert(videoList.includes("img.youtube.com/vi/") && videoList.includes("statusLabel"), "video library derives YouTube thumbnails and link status from real fields");
  assert(watchLinkService.includes('throw new Error("video_list_failed")') && watchLinkService.includes("created_at,\n          watch_sessions"), "video list surfaces query failures and returns complete link fields");
  assert(watchLinksPage.includes("listVideos") && watchLinksPage.includes("WatchLinkPanel"), "watch-links page reuses workspace-scoped video and link contracts");
  assert(dashboardShell.includes('href: "/watch-links"'), "dashboard navigation exposes watch links");
  assert(watchPage.includes("WatchPlayer") && watchPage.includes('robots: { index: false, follow: false }'), "public viewer remains internal and non-indexable");
  assert(watchPlayer.includes("https://www.youtube.com/iframe_api") && watchPlayer.includes("new api.Player"), "YouTube uses the official IFrame Player API inside TrackUp");
  assert(watchPlayer.includes("getCurrentTime") && watchPlayer.includes("getDuration") && watchPlayer.includes("onStateChange"), "YouTube telemetry reads current time, duration, and state changes from the API");
  assert(watchPlayer.includes("youtube_iframe_api") || watchPlayer.includes("YouTube IFrame API"), "YouTube capability messaging is explicit");
  assert(teamManager.includes('fetch("/api/owner/admins"') && teamManager.includes("/api/owner/users/") && teamManager.includes('fetch("/api/admin/users"'), "team UI uses real owner management and invite endpoints");
  assert(teamManager.includes("must sign in through ClickUp") && teamManager.includes("Create profile"), "invite UI explains ClickUp pre-provisioning without fake email delivery");
  assert(adminUsersPage.includes("owner-level users-manage permission") && !adminUsersPage.includes("501 not_implemented"), "admin UI reflects the implemented owner-only invite capability");
  assert(adminUsersRoute.includes("createClickUpInvite") && adminUsersRoute.includes("invalid_json"), "admin invite route validates input and calls the real service");
  assert(roleManagement.includes("export async function createClickUpInvite") && roleManagement.includes("isConfiguredOwnerEmail") && roleManagement.includes("is_active: true"), "invite service pre-provisions a protected ClickUp profile");

  section("Provider-aware analytics honesty");
  const analyticsService = readFileSync("src/lib/videos/service.ts", "utf8");
  const workspaceAnalyticsDashboard = readFileSync("src/components/dashboard/WorkspaceAnalyticsDashboard.tsx", "utf8");
  const dashboardPage = readFileSync("app/(dashboard)/dashboard/page.tsx", "utf8");
  const videoDetailPage = readFileSync("app/(dashboard)/videos/[id]/page.tsx", "utf8");
  const videoAnalyticsDashboard = readFileSync("src/components/dashboard/VideoAnalyticsDashboard.tsx", "utf8");
  const viewerAnalyticsPanel = readFileSync("src/components/dashboard/ViewerAnalyticsPanel.tsx", "utf8");
  assert(analyticsService.includes("playback_metrics_scope") && analyticsService.includes('sourceType === "direct_url" || sourceType === "youtube"'), "analytics scope playback metrics to direct URLs and YouTube API telemetry");
  assert(analyticsService.includes("avg_completion_percentage: null") && analyticsService.includes("playback_metrics_available: false"), "analytics return unavailable instead of invented provider completion");
  assert(analyticsService.includes('v.source_type === "direct_url" && sessions.length > 0'), "video list completion is native-provider scoped");
  assert(workspaceAnalyticsDashboard.includes("Views over time") && workspaceAnalyticsDashboard.includes("Top videos by watch time") && workspaceAnalyticsDashboard.includes("Date range"), "workspace analytics dashboard communicates overview charts and filters");
  assert(dashboardPage.includes('analytics.avg_completion_percentage === null ? "Unavailable"'), "dashboard does not display unsupported completion as zero");
  assert(videoDetailPage.includes("VideoAnalyticsDashboard") && videoAnalyticsDashboard.includes("Coverage and heatmap") && videoAnalyticsDashboard.includes("Not measured yet"), "video analytics dashboard explains provider limits and honest empty states");
  assert(analyticsService.includes("viewer_sessions") && analyticsService.includes("first_play_at") && analyticsService.includes("last_activity_at") && analyticsService.includes("latestEvent"), "analytics service exposes per-session timestamps and viewer breakdown");
  assert(analyticsService.includes("from_position") && analyticsService.includes("eventsBySession") && analyticsService.includes("last_position"), "analytics service exposes supported playback event timelines and last position");
  assert(analyticsService.includes("total_measurable_watch_time_seconds") && analyticsService.includes("activity_over_time") && analyticsService.includes("top_videos_by_watch_time"), "analytics service exposes workspace totals, activity series, and top-video summaries");
  assert(workspaceAnalyticsDashboard.includes("analytics.viewer_sessions") && viewerAnalyticsPanel.includes("Session-only measurement") && viewerAnalyticsPanel.includes("Total sessions"), "analytics UI renders per-viewer sessions with honest provider scope");

  section("OAuth state and service-role checks");

  const appUrlHelper = readFileSync("src/lib/app-url.ts", "utf8");
  const oauthStart = readFileSync("app/api/auth/clickup/route.ts", "utf8");
  const oauthCallback = readFileSync("app/api/auth/clickup/callback/route.ts", "utf8");
  const logoutRoute = readFileSync("app/api/auth/logout/route.ts", "utf8");
  const videoServiceForUrls = readFileSync("src/lib/videos/service.ts", "utf8");
  const adminClient = readFileSync("utils/supabase/admin.ts", "utf8");
  const middleware = readFileSync("middleware.ts", "utf8");
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedirectUri = process.env.CLICKUP_REDIRECT_URI;

assert(appUrlHelper.includes('const PRODUCTION_APP_URL = "https://trakeup.vercel.app"'), "production app origin is the Trakeup domain");
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
  assert(oauthCallback.includes("state !== expectedState") && oauthCallback.includes("new URL(returnTo, request.url)"), "OAuth callback validates state and returns to the preserved path");
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
