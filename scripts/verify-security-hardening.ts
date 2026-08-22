import { readFileSync } from "node:fs";
import { createSignedSessionCookie, verifySignedSessionCookie } from "../src/lib/auth/session-cookie";
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
  assert(sessionRoute.includes("session_token: session.sessionToken"), "session creation route returns the private capability");
  assert(eventRoute.includes("missing_session_token") && eventRoute.includes("session_token,"), "event route requires and forwards the capability");
  assert(eventRoute.includes("status: 404") && eventRoute.includes("session_not_found"), "event route uses a non-leaking capability failure");
  assert(endRoute.includes("missing_session_token") && endRoute.includes("sessionToken"), "end route requires and forwards the capability");
  assert(endRoute.includes("status: 404") && endRoute.includes("session_not_found"), "end route uses a non-leaking capability failure");
  assert(trackingService.includes('randomBytes(32).toString("hex")'), "tracking service creates an opaque random capability");
  assert(trackingService.includes('.select("id, session_token")'), "tracking service reads the created capability");
  assert(trackingService.includes('.eq("session_token", payload.session_token)'), "event writes scope last-seen updates by capability");
  assert(trackingService.includes('.eq("session_token", sessionToken)'), "session end updates scope by capability");
  assert(trackingService.includes("from_position: payload.from_position ?? null"), "seek origin is stored in the dedicated from_position field");
  assert(watchPlayer.includes("const accumulateWatchTime = useCallback((resume = false)"), "watch player accumulates elapsed play segments explicitly");
  assert(watchPlayer.includes("startTimeRef.current = null;"), "watch time does not start before playback begins");
  assert(watchPlayer.includes("accumulateWatchTime(true)"), "heartbeat flushes and resumes the active play segment");
  assert(watchPlayer.includes("accumulateWatchTime();\n    void sendEvent(\"pause\""), "pause flushes the active play segment");
  assert(watchPlayer.includes("from_position"), "watch player sends seek origin data");
  assert(watchPlayer.includes("session_token: sessionToken"), "watch player forwards the capability to tracking APIs");
  assert(watchPlayer.includes('typeof data.session_token === "string"'), "watch player requires the capability before readiness");

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
  const watchLinksPage = readFileSync("app/(dashboard)/watch-links/page.tsx", "utf8");
  const dashboardShell = readFileSync("src/components/dashboard/DashboardShell.tsx", "utf8");
  assert(revocationMigration.includes("ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ"), "watch links have a revocation timestamp");
  assert(eventPositionMigration.includes("ADD COLUMN IF NOT EXISTS from_position NUMERIC(10,2)"), "watch events preserve seek origin position");
  assert(revocationMigration.includes("idx_watch_links_revoked_at"), "watch-link revocation is indexed");
  assert(trackingService.includes("if (data.revoked_at) return null"), "revoked links cannot create new sessions");
  assert(trackingService.includes('.select("id, expires_at, revoked_at")') && trackingService.includes("const { data: activeLink"), "session creation re-checks link lifecycle before insert");
  assert(trackingService.includes("new Date(activeLink.expires_at) <= new Date()"), "session creation rejects expiry at the current instant");
  assert(watchLinkService.includes("export async function revokeWatchLink"), "video service exposes real link revocation");
  assert(watchLinkService.includes('.eq("workspace_id", workspaceId)') && watchLinkService.includes('.eq("video_id", videoId)'), "link revocation verifies video workspace ownership");
  assert(watchLinkService.includes('.is("revoked_at", null)'), "link revocation is idempotently scoped to active links");
  assert(watchLinkRoute.includes("export const DELETE") && watchLinkRoute.includes("revokeWatchLink"), "watch-link route exposes protected DELETE revocation");
  assert(ownerAdminsRoute.includes("changeUserRole") && !ownerAdminsRoute.includes("TODO: implement"), "owner admin route performs real role mutations");
  assert(watchLinkPanel.includes('method: "DELETE"') && watchLinkPanel.includes("revoked_at"), "watch-link UI reflects server revocation state");
  assert(videoList.includes('video.avg_completion === null') && !videoList.includes('avg_completion ?? 0'), "video library does not turn unsupported completion into zero");
  assert(videoList.includes("img.youtube.com/vi/") && videoList.includes("statusLabel"), "video library derives YouTube thumbnails and link status from real fields");
  assert(watchLinksPage.includes("listVideos") && watchLinksPage.includes("WatchLinkPanel"), "watch-links page reuses workspace-scoped video and link contracts");
  assert(dashboardShell.includes('href: "/watch-links"'), "dashboard navigation exposes watch links");
  assert(watchPage.includes("WatchPlayer") && watchPage.includes('robots: { index: false, follow: false }'), "public viewer remains internal and non-indexable");
  assert(watchPlayer.includes("https://www.youtube.com/embed/") && watchPlayer.includes("referrerPolicy"), "YouTube is rendered through the internal embed player");
  assert(teamManager.includes('fetch("/api/owner/admins"') && teamManager.includes("/api/owner/users/") && teamManager.includes("not_implemented"), "team UI uses real owner endpoints and documents invite gap");
  assert(adminUsersPage.includes("501 not_implemented") && !adminUsersPage.includes("Create invite"), "admin UI does not offer a fake invite flow");

  section("Provider-aware analytics honesty");
  const analyticsService = readFileSync("src/lib/videos/service.ts", "utf8");
  const analyticsPage = readFileSync("app/(dashboard)/analytics/page.tsx", "utf8");
  const dashboardPage = readFileSync("app/(dashboard)/dashboard/page.tsx", "utf8");
  const videoDetailPage = readFileSync("app/(dashboard)/videos/[id]/page.tsx", "utf8");
  assert(analyticsService.includes("playback_metrics_scope") && analyticsService.includes('video.source_type === "direct_url"'), "analytics scope playback metrics to native direct URLs");
  assert(analyticsService.includes("avg_completion_percentage: null") && analyticsService.includes("playback_metrics_available: false"), "analytics return unavailable instead of invented provider completion");
  assert(analyticsService.includes('v.source_type === "direct_url" && sessions.length > 0'), "video list completion is native-provider scoped");
  assert(analyticsPage.includes('analytics.avg_completion_percentage === null ? "Unavailable"'), "analytics page does not display unsupported completion as zero");
  assert(dashboardPage.includes('analytics.avg_completion_percentage === null ? "Unavailable"'), "dashboard does not display unsupported completion as zero");
  assert(videoDetailPage.includes('analytics.playback_metrics_scope === "direct_url_native_html5"') && videoDetailPage.includes("Playback telemetry unavailable"), "video detail explains provider telemetry limits");

  section("OAuth state and service-role checks");

  const appUrlHelper = readFileSync("src/lib/app-url.ts", "utf8");
  const oauthStart = readFileSync("app/api/auth/clickup/route.ts", "utf8");
  const oauthCallback = readFileSync("app/api/auth/clickup/callback/route.ts", "utf8");
  const logoutRoute = readFileSync("app/api/auth/logout/route.ts", "utf8");
  const videoServiceForUrls = readFileSync("src/lib/videos/service.ts", "utf8");
  const adminClient = readFileSync("utils/supabase/admin.ts", "utf8");

assert(appUrlHelper.includes('const PRODUCTION_APP_URL = "https://trakeup.vercel.app"'), "production app origin is the Trakeup domain");
assert(appUrlHelper.includes('process.env.NODE_ENV === "production" ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL'), "app URL fallback is environment-aware");
assert(appUrlHelper.includes("isLocalAppUrl") && appUrlHelper.includes("return PRODUCTION_APP_URL"), "production rejects loopback app URLs");
assert(oauthStart.includes("getClickUpRedirectUri") && !oauthStart.includes('"http://localhost:3000"'), "OAuth start uses canonical redirect configuration without localhost fallback");
assert(!oauthCallback.includes("process.env.CLICKUP_REDIRECT_URI") && !oauthCallback.includes("http://localhost:3000"), "OAuth callback does not use a loopback redirect configuration");
assert(logoutRoute.includes("getAppUrl") && !logoutRoute.includes('"http://localhost:3000"'), "logout uses canonical production origin");
assert(videoServiceForUrls.includes("const appUrl = getAppUrl()") && !videoServiceForUrls.includes('process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"'), "watch links use canonical production origin");
assert(oauthStart.includes("trackup_oauth_state"), "OAuth start stores state cookie");
assert(oauthStart.includes("https://app.clickup.com/api?"), "OAuth start uses ClickUp authorization URL");
assert(oauthCallback.includes("state !== expectedState"), "OAuth callback validates returned state");
assert(oauthCallback.includes("https://api.clickup.com/api/v2/oauth/token"), "OAuth callback uses ClickUp token URL");
assert(oauthCallback.includes("https://api.clickup.com/api/v2/team"), "OAuth callback verifies authorized Workspaces");
assert(oauthCallback.includes("Authorization: `Bearer ${accessToken}`"), "OAuth API requests use Bearer token header");
assert(oauthCallback.includes("createSignedSessionCookie"), "OAuth callback writes signed session cookie");
assert(!adminClient.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;"), "admin client does not fall back to public key");

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
