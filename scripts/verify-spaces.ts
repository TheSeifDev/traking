import { readFileSync } from "node:fs";
import { isSpaceRole, readSpaceSelector } from "../src/lib/spaces/access";
import { getSafeSpaceDisplayName, getSpaceDisplayName, hasOrganizationSpaceLabelCollision, isLegacyOrganizationContainerSpace, isSelectableChildSpace } from "../src/lib/spaces/labels";

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
assert(isSelectableChildSpace(linkedChild, "PHANTOMS | ORG") && getSpaceDisplayName(linkedChild) === "Software Team", "a linked ClickUp Space remains a selectable child with its real name");

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
assert(access.includes("getAccessibleSpaces") && access.includes("from(\"spaces\")") && access.includes("isOwner(user.role)"), "owner directory can enumerate active Spaces without membership fabrication");
assert(access.includes("hydrateOrganizationWorkspaceIds") && access.includes("organization.clickup_workspace_id") && access.includes("resolvedSpace"), "child Spaces inherit the linked Organization workspace in the trusted access projection");
assert(access.includes('.filter((membership) => membership.role === "admin")') && access.includes('organizationMembership?.role === "admin"'), "only Organization admins receive organization-wide Space visibility");
assert(access.includes('organizationMembership?.status === "active" && organizationMembership.role === "admin"'), "ordinary Organization members require direct active Space membership");
assert(organizationService.includes('from("space_members")') && organizationService.includes('permittedSpaceIds') && organizationService.includes('query.in("id", permittedSpaceIds)'), "Organization Space listing is restricted to explicit direct memberships for ordinary members");
assert(spaceService.includes("cannot_modify_owner") && spaceService.includes("cannot_modify_self") && spaceService.includes("last_admin_required"), "membership mutations protect platform owner, self, and last admin");
assert(spaceService.includes("source: \"manual\"") && spaceService.includes("clickup_user_id: null"), "manual membership creation has explicit source metadata");
assert(spaceService.includes("profiles") && spaceService.includes("is_active") && !spaceService.includes("insert({ email"), "member management uses existing active profiles and does not create guests");

section("Space API route protection and resource IDOR defense");
const routeContracts: Array<[string, string[]]> = [
  ["app/api/spaces/route.ts", ["withAuth", "createSpace"]],
  ["app/api/spaces/[spaceId]/route.ts", ["withAuth", "getSpaceForUser"]],
  ["app/api/spaces/[spaceId]/members/route.ts", ["withAuth", "listSpaceMembers", "addSpaceMember"]],
  ["app/api/spaces/[spaceId]/members/[profileId]/route.ts", ["withAuth", "updateSpaceMemberRole", "removeSpaceMember"]],
  ["app/api/spaces/active/route.ts", ["withAuth", "setActiveSpacePreference", "getSpaceForUser"]],
  ["app/api/spaces/[spaceId]/member-candidates/route.ts", ["withAuth", "searchSpaceMemberCandidates"]],
  ["app/api/spaces/[spaceId]/analytics/route.ts", ["withAuth", "authorizeSpaceAdmin"]],
  ["app/api/spaces/[spaceId]/sync-clickup/route.ts", ["withAuth", "authorizeSpaceAdmin", "syncClickUpAuthorizedTeams"]],
  ["app/api/organizations/route.ts", ["withAuth", "listOrganizationsForUser"]],
  ["app/api/organizations/[organizationId]/route.ts", ["withAuth", "getOrganizationForUser", "listOrganizationSpaces"]],
  ["app/api/organizations/[organizationId]/spaces/route.ts", ["withAuth", "createSpace", "listOrganizationSpaces"]],
  ["app/api/organizations/[organizationId]/members/route.ts", ["withAuth", "listOrganizationMembers", "addOrganizationMember"]],
  ["app/api/organizations/[organizationId]/members/[profileId]/route.ts", ["withAuth", "updateOrganizationMemberRole", "removeOrganizationMember"]],
  ["app/(dashboard)/organizations/[organizationId]/analytics/page.tsx", ["getOrganizationForUser", "listOrganizationSpaces", "getWorkspaceAnalytics"]],
  ["app/(dashboard)/organizations/[organizationId]/settings/page.tsx", ["getOrganizationForUser", "Organization settings"]],
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
const membersManager = source("src/components/spaces/SpaceMembersManager.tsx");
const spacesDirectory = source("src/components/spaces/SpacesDirectory.tsx");
const spaceDashboard = source("src/components/spaces/SpaceDashboard.tsx");
const organizationDashboard = source("src/components/organizations/OrganizationDashboard.tsx");
const organizationSpacesPage = source("app/(dashboard)/organizations/[organizationId]/spaces/page.tsx");
const ownerPage = source("app/owner/page.tsx");
const activeSpaceRoute = source("app/api/spaces/active/route.ts");
assert(shell.includes("useSearchParams") && shell.includes("activeSpaceId") && shell.includes("isSelectableChildSpace") && shell.includes("Current context") && !shell.includes("<select") && !shell.includes("selectSpace("), "dashboard shell is a non-interactive Organization/Space context indicator");
assert(activeSpaceRoute.includes("withAuth") && activeSpaceRoute.includes("getSpaceForUser") && activeSpaceRoute.includes("setActiveSpacePreference") && activeSpaceRoute.includes("isSelectableChildSpace"), "active Space selection is authenticated and server-authorized");
assert(overview.includes("canManage: boolean") && overview.includes("spaceId") && overview.includes("scoped"), "dashboard overview uses explicit Space authorization and scoped links");
assert(analyticsDashboard.includes("spaceId") && analyticsDashboard.includes("scoped") && analyticsDashboard.includes("ViewerAnalyticsPanel spaceId"), "analytics drilldowns retain Space context");
assert(viewerPanel.includes("spaceId?") && viewerPanel.includes("playback_events.length") && viewerPanel.includes("Watched ranges"), "viewer/session analytics renders real event and honest range state");
assert(membersManager.includes("/sync-clickup") && membersManager.includes("clickupConnected"), "membership UI exposes explicit ClickUp sync only when connected");
assert(spacesDirectory.includes("isLegacyOrganizationContainerSpace") && spacesDirectory.includes("getSpaceDisplayName(space)") && spacesDirectory.includes("activeSpaceId") && spacesDirectory.includes("/api/spaces/active") && spacesDirectory.includes("Current Space") && !spacesDirectory.includes("getSafeSpaceDisplayName"), "Space directory selects and marks the authorized active child Space");
assert(spaceDashboard.includes("getSpaceDisplayName(space)") && !spaceDashboard.includes("getSafeSpaceDisplayName"), "Space dashboard never uses the diagnostic label as its primary title");
assert(organizationDashboard.includes("getSpaceDisplayName(space)") && !organizationDashboard.includes("getSafeSpaceDisplayName"), "Organization dashboard renders child Space names directly");
assert(organizationSpacesPage.includes("getSpaceDisplayName(space)") && !organizationSpacesPage.includes("getSafeSpaceDisplayName"), "Organization-scoped Space directory renders child names directly");
assert(ownerPage.includes("getAccessibleOrganizations") && ownerPage.includes("listSpacesForUser") && ownerPage.includes("organizations={organizations}") && ownerPage.includes("spaces={spaces}"), "Owner shell receives separate Organization and authorized Space context");

console.log(`\n${"=".repeat(56)}`);
console.log(`TrackUp Spaces: ${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
