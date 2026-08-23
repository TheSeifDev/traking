import { readFileSync } from "node:fs";
import { isSpaceRole, readSpaceSelector } from "../src/lib/spaces/access";

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

function source(path: string): string {
  return readFileSync(path, "utf8");
}

section("Pure selector and role contracts");
assert(isSpaceRole("admin") && isSpaceRole("member"), "only supported Space roles are accepted");
assert(!isSpaceRole("owner") && !isSpaceRole("viewer") && !isSpaceRole("guest"), "platform roles and guest role are not Space roles");
assert(readSpaceSelector(new Request("https://trackup.test/videos?space_id=space-a")) === "space-a", "space_id is read as a selector");
assert(readSpaceSelector(new Request("https://trackup.test/videos?spaceId=space-b")) === "space-b", "spaceId compatibility selector is supported");
assert(readSpaceSelector(new Request("https://trackup.test/videos")) === null, "missing selector is explicit null");

section("Additive migration and database isolation");
const migration = source("supabase/migrations/20260824000007_create_spaces_and_memberships.sql");
assert(migration.includes("CREATE TYPE public.space_member_role") && migration.includes("CREATE TYPE public.space_member_status"), "Space role/status enums are persisted");
assert(migration.includes("CREATE TABLE IF NOT EXISTS public.spaces") && migration.includes("CREATE TABLE IF NOT EXISTS public.space_members"), "Spaces and memberships are additive tables");
assert(migration.includes("ADD COLUMN IF NOT EXISTS space_id UUID"), "video scope is an additive nullable migration seam");
assert(!/\bDROP\s+(TABLE|COLUMN|TYPE)\b/i.test(migration) && !/\bDELETE\s+FROM\b/i.test(migration), "Spaces migration contains no destructive drop/delete operation");
assert(migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("No direct space reads") && migration.includes("No direct space member reads"), "new tables deny direct anon/authenticated access");
assert(migration.includes("idx_spaces_clickup_workspace") && migration.includes("idx_space_members_space_status") && migration.includes("idx_videos_space"), "Space and resource lookup indexes exist");
assert(migration.includes("INSERT INTO public.spaces") && migration.includes("INSERT INTO public.space_members") && migration.includes("UPDATE public.videos AS v"), "workspace, membership, and video backfill is deterministic");
assert(migration.includes("ON CONFLICT (clickup_workspace_id) DO NOTHING") && migration.includes("ON CONFLICT (space_id, profile_id) DO NOTHING"), "backfill reruns are idempotent on unique keys");

section("Server-side Space authorization and membership mutations");
const access = source("src/lib/spaces/access.ts");
const spaceService = source("src/lib/spaces/service.ts");
assert(access.includes("if (isOwner(user.role))") && access.includes("is_platform_owner: true"), "platform owner bypass is explicit and server-side");
assert(access.includes("membership.status !== \"active\"") && access.includes("throw denied()"), "inactive/suspended/removed memberships fail closed");
assert(access.includes("resolveSpaceForUser") && access.includes("authorizeSpaceMember(explicitSpaceId, user)"), "query selector is followed by authorization");
assert(access.includes("resolveSpaceAdminForUser") && access.includes("authorizeSpaceAdmin(explicitSpaceId, user)"), "admin selector is followed by admin authorization");
assert(access.includes("getAccessibleSpaces") && access.includes("from(\"spaces\")") && access.includes("isOwner(user.role)"), "owner directory can enumerate active Spaces without membership fabrication");
assert(spaceService.includes("cannot_modify_owner") && spaceService.includes("cannot_modify_self") && spaceService.includes("last_admin_required"), "membership mutations protect platform owner, self, and last admin");
assert(spaceService.includes("source: \"manual\"") && spaceService.includes("clickup_user_id: null"), "manual membership creation has explicit source metadata");
assert(spaceService.includes("profiles") && spaceService.includes("is_active") && !spaceService.includes("insert({ email"), "member management uses existing active profiles and does not create guests");

section("Space API route protection and resource IDOR defense");
const routeContracts: Array<[string, string[]]> = [
  ["app/api/spaces/route.ts", ["withAuth", "createSpace"]],
  ["app/api/spaces/[spaceId]/route.ts", ["withAuth", "getSpaceForUser"]],
  ["app/api/spaces/[spaceId]/members/route.ts", ["withAuth", "listSpaceMembers", "addSpaceMember"]],
  ["app/api/spaces/[spaceId]/members/[profileId]/route.ts", ["withAuth", "updateSpaceMemberRole", "removeSpaceMember"]],
  ["app/api/spaces/[spaceId]/member-candidates/route.ts", ["withAuth", "searchSpaceMemberCandidates"]],
  ["app/api/spaces/[spaceId]/analytics/route.ts", ["withAuth", "authorizeSpaceAdmin"]],
  ["app/api/spaces/[spaceId]/sync-clickup/route.ts", ["withAuth", "authorizeSpaceAdmin", "syncClickUpAuthorizedTeams"]],
  ["app/api/videos/route.ts", ["withAuth", "resolveSpaceForUser", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/route.ts", ["withAuth", "resolveSpaceForUser", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/watch-link/route.ts", ["withAuth", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/analytics/route.ts", ["withAuth", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/analytics/viewers/[viewerId]/route.ts", ["withAuth", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/analytics/sessions/[sessionId]/route.ts", ["withAuth", "resolveSpaceAdminForUser", "access.space.id"]],
];
for (const [path, terms] of routeContracts) {
  const content = source(path);
  assert(terms.every((term) => content.includes(term)), `${path} has its complete authenticated Space contract`);
}
const videoService = source("src/lib/videos/service.ts");
assert(videoService.includes('.eq("workspace_id", workspaceId)') && videoService.includes('.eq("space_id", spaceId)'), "resource service applies workspace and Space predicates");
assert(videoService.includes("getVideoViewerAnalytics") && videoService.includes("getVideoSessionAnalytics") && videoService.includes("viewer_profile_id"), "analytics service exposes scoped viewer/session data");

section("Authenticated watch access and tracking preservation");
const watchPage = source("app/watch/[token]/page.tsx");
const trackingSession = source("app/api/tracking/session/route.ts");
const trackingEvent = source("app/api/tracking/event/route.ts");
const trackingEnd = source("app/api/tracking/session/[sessionId]/end/route.ts");
const providerError = source("app/api/tracking/provider-error/route.ts");
const trackingService = source("src/lib/tracking/service.ts");
assert(watchPage.includes("getCurrentUser") && watchPage.includes("authorizeSpaceMember") && watchPage.includes("if (!resolved.space_id)"), "watch page requires authenticated Space membership before player render");
assert(trackingSession.includes("authorizeSpaceMember(resolved.space_id, user)") && trackingSession.includes("createWatchSession(resolved.watch_link_id, user.id"), "session creation adds Space auth without replacing profile identity");
assert(trackingEvent.includes("getTrackingSessionSpaceId(sessionId, user.id)") && trackingEvent.includes("recordTrackingEvents") && trackingEvent.includes("user.id"), "event ingestion preserves exact authenticated profile binding");
assert(trackingEnd.includes("getTrackingSessionSpaceId(sessionId, user.id)") && trackingEnd.includes("endWatchSession(sessionId, sessionToken, user.id"), "session end preserves capability and profile checks");
assert(providerError.includes("getTrackingSessionSpaceId(sessionId, user.id)") && providerError.includes("recordProviderError"), "provider-error path is also Space-scoped");
assert(trackingService.includes("viewer_profile_id: viewerIdentity") && trackingService.includes("hashViewerIdentity") && trackingService.includes("session_token"), "tracking storage retains profile, stable hash, and session capability");
assert(trackingService.includes("space_id") && trackingService.includes("getTrackingSessionSpaceId"), "tracking resolves Space through persisted link/video relation");

section("Conservative ClickUp synchronization");
const sync = source("src/lib/clickup/sync.ts");
const callback = source("app/api/auth/clickup/callback/route.ts");
const clickupClient = source("src/lib/clickup/client.ts");
assert(sync.includes("return { identities, complete: false }"), "ClickUp member responses are never assumed authoritative-complete");
assert(!sync.includes('status: \"suspended\"') && !sync.includes('status: "removed"'), "sync does not silently suspend/remove absent members");
assert(sync.includes("existingMembership?.role") && sync.includes("source = existingMembership?.source"), "sync preserves existing membership role and manual source");
assert(!sync.includes('from("profiles").insert') && !sync.includes('from("profiles").upsert'), "sync never fabricates TrackUp profiles from ClickUp payloads");
assert(sync.includes("ensureSpaceForWorkspace") && sync.includes("concurrent OAuth callback") && sync.includes("clickup_workspace_id"), "Space creation re-reads after a unique race and is workspace keyed");
assert(callback.includes("getAuthorizedTeams") && callback.includes("upsertClickUpConnections") && callback.includes("syncClickUpAuthorizedTeams"), "OAuth callback persists all authorized teams and invokes safe sync after provisioning");
assert(callback.includes("createSignedSessionCookie") && callback.includes("new URL(destination, request.url)"), "OAuth session and return redirect architecture remains intact");
assert(clickupClient.includes("/api/v2/team") && clickupClient.includes("getClickUpTokenForWorkspace") && !clickupClient.includes("console.log(token"), "manual sync uses stored server token only and never logs it");

section("UI scope and capability honesty");
const shell = source("src/components/dashboard/DashboardShell.tsx");
const overview = source("src/components/dashboard/DashboardOverview.tsx");
const analyticsDashboard = source("src/components/dashboard/WorkspaceAnalyticsDashboard.tsx");
const viewerPanel = source("src/components/dashboard/ViewerAnalyticsPanel.tsx");
const membersManager = source("src/components/spaces/SpaceMembersManager.tsx");
assert(shell.includes("useSearchParams") && shell.includes("space_id") && shell.includes("Members"), "dashboard shell preserves Space selection and exposes Space members for admins");
assert(overview.includes("canManage: boolean") && overview.includes("spaceId") && overview.includes("scoped"), "dashboard overview uses explicit Space authorization and scoped links");
assert(analyticsDashboard.includes("spaceId") && analyticsDashboard.includes("scoped") && analyticsDashboard.includes("ViewerAnalyticsPanel spaceId"), "analytics drilldowns retain Space context");
assert(viewerPanel.includes("spaceId?") && viewerPanel.includes("playback_events.length") && viewerPanel.includes("Watched ranges"), "viewer/session analytics renders real event and honest range state");
assert(membersManager.includes("/sync-clickup") && membersManager.includes("clickupConnected"), "membership UI exposes explicit ClickUp sync only when connected");

console.log(`\n${"=".repeat(56)}`);
console.log(`TrackUp Spaces: ${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
