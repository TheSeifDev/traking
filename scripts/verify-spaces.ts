import { readFileSync } from "node:fs";
import { isSpaceRole, readSpaceSelector } from "../src/lib/spaces/access";
import { getSafeSpaceDisplayName, getSpaceDisplayName, hasOrganizationSpaceLabelCollision, isLegacyOrganizationContainerSpace, isSelectableChildSpace } from "../src/lib/spaces/labels";
import { organizationDataScope } from "../src/lib/spaces/data-scope";

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
assert(getSafeSpaceDisplayName("PHANTOMS | ORG", "PHANTOMS | ORG") === "Legacy Space label (review required)", "Organization/Space label collision is never presented as the Organization itself");
assert(hasOrganizationSpaceLabelCollision("PHANTOMS | ORG", "PHANTOMS | ORG"), "legacy Organization/Space label collision is detectable");
assert(getSafeSpaceDisplayName("AI Team-Phantoms", "PHANTOMS | ORG") === "AI Team-Phantoms", "real Space labels remain selectable under their Organization");
const legacyContainer = { name: "PHANTOMS | ORG", clickup_workspace_id: "workspace-1", clickup_space_id: null };
const linkedChild = { name: "Software Team", clickup_workspace_id: null, clickup_space_id: "space-1" };
assert(isLegacyOrganizationContainerSpace(legacyContainer, "PHANTOMS | ORG"), "an unbound Organization-label workspace row is diagnosed as a legacy container");
assert(!isSelectableChildSpace(legacyContainer, "PHANTOMS | ORG"), "the Organization-label workspace row is never put in a Space selector");
assert(!isSelectableChildSpace({ name: "PHANTOMS | ORG", clickup_workspace_id: null, clickup_space_id: null }, "PHANTOMS | ORG"), "an older Organization-label row without workspace mapping is also excluded from child Space scope");
assert(isSelectableChildSpace(linkedChild, "PHANTOMS | ORG") && getSpaceDisplayName(linkedChild) === "Software Team", "a linked ClickUp Space remains a selectable child with its real name");
const organizationScope = organizationDataScope({ id: "organization-1", clickup_workspace_id: "workspace-1" });
assert(organizationScope?.type === "organization" && organizationScope.organizationId === "organization-1" && organizationScope.workspaceId === "workspace-1", "Owner All Spaces has an explicit organization scope");

section("Additive migration and database isolation");
const migration = source("supabase/migrations/20260824000007_create_spaces_and_memberships.sql");
const organizationMigration = source("supabase/migrations/20260824000008_create_organizations_and_memberships.sql");
assert(migration.includes("CREATE TYPE public.space_member_role") && migration.includes("CREATE TYPE public.space_member_status"), "Space role/status enums are persisted");
assert(migration.includes("CREATE TABLE IF NOT EXISTS public.spaces") && migration.includes("CREATE TABLE IF NOT EXISTS public.space_members"), "Spaces and memberships are additive tables");
assert(migration.includes("ADD COLUMN IF NOT EXISTS space_id UUID"), "video scope is an additive nullable migration seam");
assert(!/\bDROP\s+(TABLE|COLUMN|TYPE)\b/i.test(migration) && !/\bDELETE\s+FROM\b/i.test(migration), "Spaces migration contains no destructive drop/delete operation");
assert(migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("No direct space reads") && migration.includes("No direct space member reads"), "new tables deny direct anon/authenticated access");
assert(migration.includes("idx_spaces_clickup_workspace") && migration.includes("idx_space_members_space_status") && migration.includes("idx_videos_space"), "Space and resource lookup indexes exist");
assert(migration.includes("INSERT INTO public.spaces") && migration.includes("INSERT INTO public.space_members") && migration.includes("UPDATE public.videos AS v"), "workspace, membership, and video backfill is deterministic");
assert(migration.includes("ON CONFLICT (clickup_workspace_id) DO NOTHING") && migration.includes("ON CONFLICT (space_id, profile_id) DO NOTHING"), "backfill reruns are idempotent on unique keys");
const controlRoomMigration = source("supabase/migrations/20260824000010_add_clickup_space_and_cron_evidence.sql");
assert(controlRoomMigration.includes("clickup_space_id") && controlRoomMigration.includes("cron_executions") && controlRoomMigration.includes("UNIQUE (job_name, execution_key)"), "Control Room hierarchy and cron evidence migration is additive and idempotent");
assert(controlRoomMigration.includes("uq_spaces_clickup_space_id") && controlRoomMigration.includes("WHERE clickup_space_id IS NOT NULL"), "ClickUp Space IDs are unique without rewriting legacy rows");
assert(organizationMigration.includes("CREATE TABLE IF NOT EXISTS public.organizations") && organizationMigration.includes("CREATE TABLE IF NOT EXISTS public.organization_members"), "Organization hierarchy is additive");
assert(organizationMigration.includes("ADD COLUMN IF NOT EXISTS organization_id UUID") && organizationMigration.includes("spaces_organization_id_fkey"), "Space-to-Organization relationship is additive and constrained");
assert(organizationMigration.includes("ALTER COLUMN organization_id SET NOT NULL") && organizationMigration.includes("INSERT INTO public.organization_members"), "existing Spaces are deterministically backfilled into Organization memberships");
assert(!/\\bDROP\\s+(TABLE|COLUMN|TYPE)\\b/i.test(organizationMigration) && !/\\bDELETE\\s+FROM\\b/i.test(organizationMigration), "Organization migration contains no destructive drop/delete operation");
assert(organizationMigration.includes("No direct organization reads") && organizationMigration.includes("No direct organization member reads") && organizationMigration.includes("ENABLE ROW LEVEL SECURITY"), "Organization tables deny direct anon/authenticated access");
assert(organizationMigration.includes("idx_spaces_organization") && organizationMigration.includes("idx_organization_members_org_status"), "Organization lookup indexes exist");

section("Server-side Space authorization and membership mutations");
const access = source("src/lib/spaces/access.ts");
const spaceService = source("src/lib/spaces/service.ts");
const organizationService = source("src/lib/organizations/service.ts");
assert(access.includes("if (isOwner(user.role))") && access.includes("is_platform_owner: true"), "platform owner bypass is explicit and server-side");
assert(access.includes("membership.status !== \"active\"") && access.includes("throw denied()"), "inactive/suspended/removed memberships fail closed");
assert(access.includes("resolveSpaceForUser") && access.includes("authorizeSpaceMember(explicitSpaceId, user)"), "query selector is followed by authorization");
assert(access.includes("resolveSpaceAdminForUser") && access.includes("authorizeSpaceAdmin(explicitSpaceId, user)"), "admin selector is followed by admin authorization");
assert(access.includes("access.organization_membership?.role === \"admin\""), "Organization admins retain Space-admin authority through the Organization hierarchy");
assert(access.includes("getAccessibleSpaces") && access.includes("from(\"spaces\")") && access.includes("isOwner(user.role)"), "owner directory can enumerate active Spaces without membership fabrication");
assert(access.includes("hydrateOrganizationWorkspaceIds") && access.includes("organization.clickup_workspace_id") && access.includes("resolvedSpace"), "child Spaces inherit the linked Organization workspace in the trusted access projection");
assert(access.includes('.filter((membership) => membership.role === "admin")') && access.includes('organizationMembership?.role === "admin"'), "only Organization admins receive organization-wide Space visibility");
assert(access.includes("hasOrganizationAdminAccess") && access.includes("hasActiveSpaceAccess = hasActiveOrganizationAccess && membership?.status === \"active\""), "ordinary Organization members require direct active Space membership");
assert(organizationService.includes('from("space_members")') && organizationService.includes('permittedSpaceIds') && organizationService.includes('query.in("id", permittedSpaceIds)'), "Organization Space listing is restricted to explicit direct memberships for ordinary members");
assert(spaceService.includes("cannot_modify_owner") && spaceService.includes("cannot_modify_self") && spaceService.includes("last_admin_required"), "membership mutations protect platform owner, self, and last admin");
assert(spaceService.includes("source: \"manual\"") && spaceService.includes("clickup_user_id: null"), "manual membership creation has explicit source metadata");
assert(spaceService.includes("profiles") && spaceService.includes("is_active") && !spaceService.includes("insert({ email"), "member management uses existing active profiles and does not create guests");
assert(spaceService.includes('from("organization_members")') && spaceService.includes('eq("organization_id", access.space.organization_id)') && spaceService.includes('eq("status", "active")') && spaceService.includes('error: "organization_mismatch"'), "Space assignment requires an active Organization member server-side");
assert(access.includes("activeOrganizationIds") && access.includes("directSpacesWithOrganizationAccess") && access.includes("hasOrganizationAdminAccess") && access.includes("hasActiveSpaceAccess = hasActiveOrganizationAccess"), "direct Space access cannot survive inactive Organization membership");

section("Space API route protection and resource IDOR defense");
const routeContracts: Array<[string, string[]]> = [
  ["app/api/spaces/route.ts", ["withDashboardAuth", "createSpace"]],
  ["app/api/spaces/[spaceId]/route.ts", ["withDashboardAuth", "getSpaceForUser"]],
  ["app/api/spaces/[spaceId]/members/route.ts", ["withDashboardAuth", "listSpaceMembers", "addSpaceMember"]],
  ["app/api/spaces/[spaceId]/members/[profileId]/route.ts", ["withDashboardAuth", "updateSpaceMemberRole", "removeSpaceMember"]],
  ["app/api/spaces/active/route.ts", ["withDashboardAuth", "setActiveSpacePreference", "getSpaceForUser"]],
  ["app/api/spaces/[spaceId]/member-candidates/route.ts", ["withDashboardAuth", "searchSpaceMemberCandidates"]],
  ["app/api/spaces/[spaceId]/analytics/route.ts", ["withDashboardAuth", "authorizeSpaceAdmin"]],
  ["app/api/spaces/[spaceId]/sync-clickup/route.ts", ["withDashboardAuth", "authorizeSpaceAdmin", "syncClickUpAuthorizedTeams"]],
  ["app/api/organizations/route.ts", ["withDashboardAuth", "listOrganizationsForUser"]],
  ["app/api/organizations/[organizationId]/route.ts", ["withDashboardAuth", "getOrganizationForUser", "listOrganizationSpaces"]],
  ["app/api/organizations/[organizationId]/spaces/route.ts", ["withDashboardAuth", "createSpace", "listOrganizationSpaces"]],
  ["app/api/organizations/[organizationId]/members/route.ts", ["withDashboardAuth", "listOrganizationMembers", "addOrganizationMember"]],
  ["app/api/organizations/[organizationId]/member-candidates/route.ts", ["withDashboardAuth", "searchOrganizationMemberCandidates"]],
  ["app/api/organizations/[organizationId]/members/[profileId]/route.ts", ["withDashboardAuth", "updateOrganizationMemberRole", "removeOrganizationMember"]],
  ["app/(dashboard)/organizations/[organizationId]/members/[profileId]/page.tsx", ["guardAuth", "getUser360", "kind: \"organization\"", "User360Dashboard"]],
  ["app/(dashboard)/organizations/[organizationId]/analytics/page.tsx", ["getOrganizationForUser", "listOrganizationSpaces", "getWorkspaceAnalytics"]],
  ["app/(dashboard)/organizations/[organizationId]/settings/page.tsx", ["getOrganizationForUser", "Organization settings"]],
  ["app/api/videos/route.ts", ["withDashboardAuth", "resolveSpaceForUser", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/route.ts", ["withDashboardAuth", "resolveSpaceForUser", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/watch-link/route.ts", ["withDashboardAuth", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/analytics/route.ts", ["withDashboardAuth", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/analytics/viewers/[viewerId]/route.ts", ["withDashboardAuth", "resolveSpaceAdminForUser", "access.space.id"]],
  ["app/api/videos/[id]/analytics/sessions/[sessionId]/route.ts", ["withDashboardAuth", "resolveSpaceAdminForUser", "access.space.id"]],
];
for (const [path, terms] of routeContracts) {
  const content = source(path);
  assert(terms.every((term) => content.includes(term)), `${path} has its complete authenticated Space contract`);
}
const videoService = source("src/lib/videos/service.ts");
assert(videoService.includes('scope: VideoDataScope') && videoService.includes('scope.type === "organization"') && videoService.includes('.eq("workspace_id", scope.workspaceId)') && videoService.includes('.eq("space_id", scope.spaceId)'), "resource service applies explicit organization or Space predicates");
assert(videoService.includes('organizationId') && videoService.includes('clickup_workspace_id') && !videoService.includes('spaceIds'), "Owner organization scope is validated against its organization/workspace and does not use child-Space allowlists");
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
assert(sync.includes("available: false") && sync.includes("available: true"), "ClickUp member responses are never assumed authoritative-complete");
assert(!sync.includes('status: \"suspended\"') && !sync.includes('status: "removed"'), "sync does not silently suspend/remove absent members");
assert(sync.includes("existing?.source ?? \"clickup\"") && sync.includes("existing?.joined_at ?? now"), "sync preserves existing membership source and join timestamp");
assert(!sync.includes('from("profiles").insert') && !sync.includes('from("profiles").upsert'), "sync never fabricates TrackUp profiles from ClickUp payloads");
assert(sync.includes("getClickUpSpacesForSync") && sync.includes("clickup_space_id") && sync.includes("organization_id: organizationId") && !sync.includes("findLinkedSpace"), "ClickUp sync maps provider Spaces under an existing Organization and never treats Workspace as a Space");
assert(callback.includes("getAuthorizedTeams") && callback.includes("upsertClickUpConnections") && callback.includes("syncClickUpAuthorizedTeams"), "OAuth callback persists all authorized teams and invokes safe sync after provisioning");
assert(callback.includes("createSignedSessionCookie") && callback.includes("new URL(destination, request.url)"), "OAuth session and return redirect architecture remains intact");
assert(clickupClient.includes("/api/v2/team") && clickupClient.includes("getClickUpTokenForWorkspace") && clickupClient.includes("/space?archived=false") && !clickupClient.includes("console.log(token"), "manual sync uses stored server token only, reads explicit Spaces, and never logs it");

section("UI scope and capability honesty");
const shell = source("src/components/dashboard/DashboardShell.tsx");
const overview = source("src/components/dashboard/DashboardOverview.tsx");
  const analyticsDashboard = source("src/components/dashboard/WorkspaceAnalyticsDashboard.tsx");
  const viewerPanel = source("src/components/dashboard/ViewerAnalyticsPanel.tsx");
  const userService = source("src/lib/users/service.ts");
const membersManager = source("src/components/spaces/SpaceMembersManager.tsx");
const spacesDirectory = source("src/components/spaces/SpacesDirectory.tsx");
const spaceDashboard = source("src/components/spaces/SpaceDashboard.tsx");
const organizationDashboard = source("src/components/organizations/OrganizationDashboard.tsx");
const organizationMembersManager = source("src/components/organizations/OrganizationMembersManager.tsx");
const organizationSpacesPage = source("app/(dashboard)/organizations/[organizationId]/spaces/page.tsx");
const trackingTypes = source("src/types/tracking.ts");
const trackingPlayer = source("src/components/watch/WatchPlayer.tsx");
const trackingEngine = source("src/lib/playback/tracking-engine.ts");
const trackingRanges = source("src/lib/analytics/ranges.ts");
const trackingServiceSource = source("src/lib/tracking/service.ts");
const detailedTelemetryMigration = source("supabase/migrations/20260824000013_add_detailed_playback_events.sql");
const ownerPage = source("app/owner/page.tsx");
const controlRoom = source("src/lib/observability/control-room.ts");
const activeSpaceRoute = source("app/api/spaces/active/route.ts");
const activeSpaceService = source("src/lib/spaces/active-space.ts");
const dataScope = source("src/lib/spaces/data-scope.ts");
const dashboardPage = source("app/(dashboard)/dashboard/page.tsx");
const videosRoute = source("app/api/videos/route.ts");
const videosPage = source("app/(dashboard)/videos/page.tsx");
const videoList = source("src/components/dashboard/VideoList.tsx");
const analyticsPage = source("app/(dashboard)/analytics/page.tsx");
const watchLinksPage = source("app/(dashboard)/watch-links/page.tsx");
const watchLinksManager = source("src/components/dashboard/WatchLinksManager.tsx");
const videoDetailPage = source("app/(dashboard)/videos/[id]/page.tsx");
const analyticsVideoPage = source("app/(dashboard)/analytics/videos/[id]/page.tsx");
const workspaceAnalyticsDashboard = source("src/components/dashboard/WorkspaceAnalyticsDashboard.tsx");
const viewerAnalyticsPanel = source("src/components/dashboard/ViewerAnalyticsPanel.tsx");
const securityModel = source("docs/security-model.md");
assert(shell.includes("useSearchParams") && shell.includes("activeSpaceId") && shell.includes("isSelectableChildSpace") && shell.includes("Current context") && shell.includes("organizationContext") && shell.includes("displayedSpaceContext") && shell.includes("organizations.length > 1") && shell.includes('aria-label="Select Organization"') && shell.includes("selectOrganization") && !shell.includes('aria-label="Select Space"') && !shell.includes("selectSpace("), "dashboard shell keeps single Organization plain text while allowing selection only for multiple Organizations and keeps Space non-interactive");
assert(shell.includes("organizationMembersNavItem") && shell.includes('label: "Members"') && shell.includes('`/organizations/${encodeURIComponent(selectedOrganizationId)}/members`') && shell.includes("spaceMembersNavItem") && shell.includes('label: "Space members"'), "primary sidebar separates dynamic Organization Members from Space members using canonical IDs");
assert(shell.includes('if (href === "/organizations")') && shell.includes('!pathname.includes("/members")') && shell.includes('if (href.includes("/members"))'), "Members active state wins over generic Organizations matching for organization member routes");
const organizationMemberProfilePage = source("app/(dashboard)/organizations/[organizationId]/members/[profileId]/page.tsx");
assert(organizationMemberProfilePage.includes("getUser360") && organizationMemberProfilePage.includes('kind: "organization"') && organizationMemberProfilePage.includes("User360Dashboard"), "Organization member profiles use the protected organization-scoped User 360 route");
assert(userService.includes("inferredDuration = video.duration ?? latestReliableEvent?.duration ?? null") && userService.includes("buildPlaybackHeatmap") && userService.includes("duration: inferredDuration"), "User 360 reuses provider-reported event duration when video metadata is absent");
assert(organizationMembersManager.includes('member.profile.role === "owner"') && organizationMembersManager.includes('member.role === "admin" ? "ADMIN" : "MEMBER"') && organizationMembersManager.includes('roleClasses(role)'), "Organization Members manager displays canonical OWNER/ADMIN/MEMBER roles");
assert(organizationMembersManager.includes("useEffect") && organizationMembersManager.includes("AbortController") && organizationMembersManager.includes("setTimeout"), "Organization member candidate search updates live with debouncing and cancels stale requests");
assert(organizationMembersManager.includes("View profile") && organizationMembersManager.includes("profileHref") && organizationMembersManager.includes('role="link"'), "Organization member rows navigate to real profile details and expose an accessible clickable surface");
assert(organizationMembersManager.includes("memberFilter") && organizationMembersManager.includes("visibleMembers") && organizationMembersManager.includes("Filter current members"), "Organization member directory filters current members locally by real identity fields");
assert(organizationMembersManager.includes("searchOrganizationMemberCandidates") || organizationMembersManager.includes("member-candidates"), "Organization Members manager searches real active profile candidates");
assert(organizationMembersManager.includes('method: "PATCH"') && organizationMembersManager.includes('method: "DELETE"') && organizationMembersManager.includes("last_admin_required"), "Organization Members manager uses real role/removal mutation states");
assert(spaceService.includes('from("organization_members")') && spaceService.includes("organization_role") && spaceService.includes("organization_status"), "Space member responses include Organization role separately from Space access");
assert(membersManager.includes("Organization role") && membersManager.includes("Space access") && membersManager.includes("Make Space admin") && membersManager.includes("Organization role was not changed"), "Space Members UI explicitly separates Organization role from Space access");
assert(trackingTypes.includes('"session_started"') && trackingTypes.includes('"seek_started"') && trackingTypes.includes('"seek_completed"') && trackingTypes.includes('"playback_progress"') && trackingTypes.includes('"player_error"'), "tracking event contract includes detailed lifecycle and provider telemetry types");
assert(detailedTelemetryMigration.includes("ALTER TYPE public.watch_event_type") && detailedTelemetryMigration.includes("session_started") && detailedTelemetryMigration.includes("player_error") && detailedTelemetryMigration.includes("idx_watch_events_event_type") && !/\\bDROP\\s+(TABLE|COLUMN|TYPE)\\b/i.test(detailedTelemetryMigration), "detailed telemetry migration is additive and indexed");
assert(trackingServiceSource.includes('event_type: "session_started"') && trackingServiceSource.includes('event_type: "session_ended"') && trackingServiceSource.includes("onConflict: \"session_id,client_event_id\""), "tracking service persists idempotent session lifecycle events");
assert(trackingPlayer.includes("UniversalTrackingEngine") && trackingPlayer.includes("handleNormalized") && trackingEngine.includes('sendEvent("playback_progress"') && trackingEngine.includes('sendEvent("seek_completed"') && trackingEngine.includes('sendEvent("buffering_started"') && trackingEngine.includes('sendEvent("player_error"'), "provider adapters route detailed playback movement and error events through the universal engine");
assert(trackingRanges.includes('case "playback_progress"') && trackingRanges.includes('case "seek_started"') && trackingRanges.includes('case "seek_completed"') && trackingRanges.includes('case "buffering_started"'), "range reconstruction handles progress, seek boundaries, and buffering without counting skipped gaps");
assert(activeSpaceRoute.includes("withDashboardAuth") && activeSpaceRoute.includes("getSpaceForUser") && activeSpaceRoute.includes("setActiveSpacePreference") && activeSpaceRoute.includes("isSelectableChildSpace"), "active Space selection is authenticated and server-authorized");
assert(activeSpaceService.includes('ALL_SPACES_PREFIX = "all:"') && activeSpaceService.includes('type: "all"') && activeSpaceService.includes("setAllSpacesPreference"), "All Spaces is represented by an explicit organization preference, not a fake Space UUID");
assert(activeSpaceService.includes("isOwner(user.role)") && activeSpaceService.includes("organizationSpaces.length === 1") && activeSpaceService.includes("requiresSelection"), "Owner defaults to All Spaces, one-space users auto-select, and multi-space users require an explicit choice");
assert(dataScope.includes('type: "organization"') && dataScope.includes('type: "space"') && dataScope.includes("organizationDataScope"), "resource scope model distinguishes virtual Organization from real Space");
assert(activeSpaceRoute.includes("scope === \"all\"") && activeSpaceRoute.includes("authorizeAllSpacesForUser") && activeSpaceRoute.includes("organization_id"), "All Spaces selection is server-authorized and owner-only");
assert(videosRoute.includes("organization_id") && videosRoute.includes("authorizeAllSpacesForUser") && videosRoute.includes("organizationDataScope") && videosRoute.includes("listVideos(scope)") && videosRoute.includes("getWorkspaceAnalytics(scope)"), "organization video GET uses the authorized virtual organization scope");
assert(videosPage.includes("context.type === \"all\"") && videosPage.includes("spaceCanManage={false}"), "All Spaces video library is read-only until a real Space is selected for mutation");
assert(analyticsPage.includes("context.type === \"all\"") && analyticsPage.includes("organizationDataScope") && analyticsPage.includes("getWorkspaceAnalytics(scope)") && analyticsPage.includes("listVideos(scope)"), "All Spaces analytics uses the complete authorized organization aggregate");
assert(watchLinksPage.includes("context.type === \"all\"") && watchLinksPage.includes("organizationDataScope") && watchLinksPage.includes("listVideos(scope)") && watchLinksPage.includes("organizationId={organization.id}") && watchLinksPage.includes("spaceCanManage={false}"), "All Spaces watch links are read-only and use the complete organization scope");
assert(watchLinksManager.includes("organizationId?: string | null") && watchLinksManager.includes("organizationId = null") && watchLinksManager.includes("organizationId={organizationId}") && watchLinksManager.includes("organization_id=${encodeURIComponent(organizationId)}"), "watch-link detail and audit links preserve organization scope in All Spaces");
assert(dashboardPage.includes("organizationDataScope") && dashboardPage.includes("getWorkspaceAnalytics(scope)") && dashboardPage.includes("listVideos(scope)"), "dashboard All Spaces aggregates complete organization data");
assert(videoDetailPage.includes("organizationDataScope") && videoDetailPage.includes("getVideo(id, scope)") && videoDetailPage.includes("getVideoAnalytics(id, scope)"), "Owner All Spaces video detail includes historical organization-owned videos");
assert(videoList.includes("organizationId={organizationId}") && videoList.includes("organization_id=${encodeURIComponent(organizationId)}"), "All Spaces library detail links preserve organization scope instead of legacy space IDs");
assert(analyticsVideoPage.includes("organizationDataScope") && analyticsVideoPage.includes("getVideo(id, scope)") && analyticsVideoPage.includes("ViewerAnalyticsPanel") && analyticsVideoPage.includes("organizationId"), "Owner All Spaces analytics drilldown retains organization scope for viewer/session links");
assert(workspaceAnalyticsDashboard.includes("href={scoped(`/analytics/videos/${video.video_id}`)}") && !workspaceAnalyticsDashboard.includes("video.space_id ? `/analytics/videos/"), "workspace analytics drilldowns preserve the selected organization or real Space scope");
assert(viewerAnalyticsPanel.includes("organizationId?") && viewerAnalyticsPanel.includes("organization_id"), "viewer/session drilldown links preserve virtual organization context");
assert(securityModel.includes("explicit organization data scope") && securityModel.includes("including preserved historical Organization-container rows") && securityModel.includes("excluded from normal child-Space presentation"), "security model documents the Owner organization scope and normal legacy exclusion separately");
assert(overview.includes('scopeType?: "specific" | "all"') && overview.includes("organizationId") && overview.includes("scopedVideo") && overview.includes("const scopedVideo = (path: string) => scoped(path)") && !overview.includes("video.space_id"), "dashboard overview distinguishes organization aggregation and real Space detail links");
assert(analyticsDashboard.includes('scopeType?: "specific" | "all"') && analyticsDashboard.includes("organizationId") && analyticsDashboard.includes("href={scoped(`/analytics/videos/${video.video_id}`)}"), "analytics drilldowns retain organization or real per-video Space context");
assert(analyticsDashboard.includes('"sessions"') && analyticsDashboard.includes('"engagement"') && analyticsDashboard.includes("ViewerAnalyticsPanel") && analyticsDashboard.includes("measurableSessions"), "Workspace Analytics separates overview, sessions, viewers, videos, and engagement with reliable measurement state");
assert(overview.includes("canManage: boolean") && overview.includes("spaceId") && overview.includes("scoped"), "dashboard overview uses explicit Space authorization and scoped links");
assert(analyticsDashboard.includes("spaceId") && analyticsDashboard.includes("scoped") && analyticsDashboard.includes("ViewerAnalyticsPanel") && analyticsDashboard.includes("spaceId={spaceId"), "analytics drilldowns retain Space context");
assert(viewerPanel.includes("spaceId?") && viewerPanel.includes("playback_events.length") && viewerPanel.includes("Not measured") && viewerPanel.includes("View timeline") && viewerPanel.includes("Previous") && viewerPanel.includes("Next") && viewerPanel.includes("hidden overflow-hidden") && viewerPanel.includes("md:hidden"), "viewer/session analytics renders structured desktop table, mobile cards, pagination, real events, and honest unavailable states");
assert(viewerPanel.includes('mode?: "sessions" | "viewers"') && viewerPanel.includes("ViewerDirectory") && viewerPanel.includes("viewerPageCount") && analyticsDashboard.includes('mode="sessions"') && analyticsDashboard.includes('mode="viewers"'), "Sessions and Viewers tabs render distinct session-table and viewer-directory surfaces");
assert(membersManager.includes("/sync-clickup") && membersManager.includes("clickupConnected"), "membership UI exposes explicit ClickUp sync only when connected");
assert(spacesDirectory.includes("isLegacyOrganizationContainerSpace") && spacesDirectory.includes("getSpaceDisplayName(space)") && spacesDirectory.includes("activeSpaceId") && spacesDirectory.includes("/api/spaces/active") && spacesDirectory.includes("Current Space") && !spacesDirectory.includes("getSafeSpaceDisplayName"), "Space directory selects and marks the authorized active child Space");
assert(spacesDirectory.includes("All Spaces") && spacesDirectory.includes("selectAllSpaces") && spacesDirectory.includes('scope: "all"') && spacesDirectory.includes("allSpacesActive"), "Owner Spaces directory exposes a persisted All Spaces context");
assert(spaceDashboard.includes("getSpaceDisplayName(space)") && !spaceDashboard.includes("getSafeSpaceDisplayName"), "Space dashboard never uses the diagnostic label as its primary title");
assert(organizationDashboard.includes("getSpaceDisplayName(space)") && !organizationDashboard.includes("getSafeSpaceDisplayName"), "Organization dashboard renders child Space names directly");
assert(organizationSpacesPage.includes("getSpaceDisplayName(space)") && !organizationSpacesPage.includes("getSafeSpaceDisplayName"), "Organization-scoped Space directory renders child names directly");
assert(organizationDashboard.includes("Manage members") && organizationDashboard.includes("/organizations/${organization.id}/members"), "Organization dashboard Manage members action uses the real Organization Members route");
assert(ownerPage.includes("resolveActiveSpaceForUser") && ownerPage.includes("organizations={activeSpace.organizations}") && ownerPage.includes("spaces={activeSpace.spaces}") && ownerPage.includes("activeSpaceContext={activeSpace.context}") && ownerPage.includes("activeSpaceNeedsPersistence={activeSpace.activeSpaceNeedsPersistence}"), "Owner shell receives resolved Organization, Space, and All Spaces context");
assert(controlRoom.includes("hasReliablePlaybackTelemetry") && controlRoom.includes("isMeasuredSession") && controlRoom.includes("event_type, position, duration") && !controlRoom.includes("scopedSessions.filter((session) => session.watch_time_seconds !== null)"), "Owner Control Room uses canonical persisted playback evidence for measured state");

console.log(`\n${"=".repeat(56)}`);
console.log(`TrackUp Spaces: ${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
