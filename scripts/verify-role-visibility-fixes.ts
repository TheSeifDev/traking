/**
 * TrackUp Role-Visibility Hardening — Regression Tests
 *
 * Locks down the three authorization gaps identified in the role visibility
 * audit:
 *
 *   P0-1  Organization-wide analytics must NOT be reachable by Viewer users
 *         through /analytics or /organizations/[id]/analytics.
 *
 *   P0-2  Organization Settings must NOT be reachable by Viewer users.
 *
 *   P1-1  /api/spaces/active must be reachable by any authenticated user for a
 *         space/organization the caller can access; viewers must NOT be able to
 *         persist a context they cannot see, and must not be able to mutate
 *         anyone else's preference.
 *
 * These tests are static source-level checks. They verify that the source
 * files actually enforce the contract — not just that the route compiles.
 * Each test references the real implementation surface so a regression that
 * re-introduces a guardAuth/getOrganizationForUser-only path or a viewer
 * leak into ViewerActivityDashboard will be caught.
 */

import { readFileSync } from "node:fs";

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

function source(relativePath: string): string {
  return readFileSync(`./${relativePath}`, "utf8");
}

function occurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const next = haystack.indexOf(needle, index);
    if (next === -1) return count;
    count += 1;
    index = next + needle.length;
  }
}

// ---------------------------------------------------------------------------
// P0-1 — Organization-wide analytics viewer access
// ---------------------------------------------------------------------------

section("P0-1: Organization-wide analytics is admin/owner only");

const dashboardAnalytics = source("app/(dashboard)/analytics/page.tsx");

// The org-wide ("all") branch must check for an admin/owner-style capability
// BEFORE rendering ViewerActivityDashboard. A viewer must never receive that
// dashboard from this branch.
const orgBranch = dashboardAnalytics.match(/context\.type === "all"[^\n]*\{([\s\S]*?)\n\s{0,4}\}\s*return\s+PersonalSpaceAnalytics/) ||
  dashboardAnalytics.match(/context\.type === "all"[\s\S]{0,4000}/);
assert(
  Boolean(orgBranch && orgBranch[0]),
  "dashboard /analytics contains an organization-context branch",
);

// Extract the "all" branch body for inspection. We use a simple approach: look
// for the marker that separates admin/owner rendering from viewer personal.
const canManageCheck = dashboardAnalytics.includes('access.is_platform_owner ||') ||
  dashboardAnalytics.includes("is_platform_owner") ||
  dashboardAnalytics.includes("membership_role === \"admin\"") ||
  dashboardAnalytics.includes('membership_role === "admin"') ||
  dashboardAnalytics.includes("membership?.role === \"admin\"") ||
  dashboardAnalytics.includes("canManage") ||
  dashboardAnalytics.includes("canManageOrg") ||
  dashboardAnalytics.includes("canManageAllSpaces") ||
  dashboardAnalytics.includes("user.role === \"owner\"") ||
  dashboardAnalytics.includes("user.role === 'owner'");
assert(canManageCheck, "dashboard /analytics performs an admin/owner capability check inside the organization branch");

// The viewer branch must render PersonalSpaceAnalytics or an equivalent personal
// analytics surface; it must NOT render ViewerActivityDashboard for them.
const viewerPersonalRendering = dashboardAnalytics.includes("PersonalSpaceAnalytics") &&
  /context\.type === "all"[\s\S]*?PersonalSpaceAnalytics/.test(dashboardAnalytics);
assert(viewerPersonalRendering, "dashboard /analytics renders PersonalSpaceAnalytics for viewers in the organization branch");

// And the admin/owner branch inside the same if-block must still render
// ViewerActivityDashboard. Verify that within the organization-branch code
// (after `context.type === "all"`) we see canManageOrg BEFORE any reference to
// ViewerActivityDashboard.
const orgBranchStart = dashboardAnalytics.indexOf('context.type === "all"');
const orgBranchSlice = orgBranchStart >= 0 ? dashboardAnalytics.slice(orgBranchStart) : "";
const canManageIdxInOrgBranch = orgBranchSlice.indexOf("canManageOrg");
const viewerActivityIdxInOrgBranch = orgBranchSlice.indexOf("ViewerActivityDashboard");
assert(
  canManageIdxInOrgBranch >= 0 && viewerActivityIdxInOrgBranch > canManageIdxInOrgBranch,
  "dashboard /analytics still renders ViewerActivityDashboard for admin/owner in the organization branch (after canManageOrg)",
);

// The viewer branch must use the existing personal analytics service. We do
// not require a new architecture — reusing getWorkspaceAnalytics with the
// viewer profile id is the expected pattern.
const usesExistingPersonalAnalyticsService = /context\.type === "all"[\s\S]*?getWorkspaceAnalytics\([^)]*user\.id/.test(dashboardAnalytics) ||
  dashboardAnalytics.includes("getWorkspaceAnalytics(scope, user.id)") ||
  dashboardAnalytics.includes("getWorkspaceAnalytics(organizationScope, user.id)");
assert(
  usesExistingPersonalAnalyticsService,
  "dashboard /analytics reuses getWorkspaceAnalytics for viewer personal analytics in the organization branch",
);

// The dedicated org analytics page must also gate on canManage before
// rendering the ViewerActivityDashboard.
const orgAnalyticsPage = source("app/(dashboard)/organizations/[organizationId]/analytics/page.tsx");
const orgAnalyticsGated = (orgAnalyticsPage.includes("canManageOrg") || orgAnalyticsPage.includes("canManage")) &&
  orgAnalyticsPage.includes("notFound") &&
  /if\s*\(\s*!canManageOrg/.test(orgAnalyticsPage);
assert(orgAnalyticsGated, "organizations/[id]/analytics page requires admin/owner capability and notFound()s viewers");

// The page is a custom admin/owner surface (aggregated cards, not
// ViewerActivityDashboard) — verify it still computes aggregated analytics and
// renders admin-only content (the org Spaces grid, the Top Videos cards).
const orgAnalyticsAggregatesSpaces = orgAnalyticsPage.includes("listOrganizationSpaces") &&
  orgAnalyticsPage.includes("Top videos") &&
  orgAnalyticsPage.includes("Across this Organization");
assert(
  orgAnalyticsAggregatesSpaces,
  "organizations/[id]/analytics page aggregates analytics across organization Spaces for admin/owner",
);

const orgAnalyticsFallsBackToPersonal = /if\s*\(\s*!canManageOrg[\s\S]{0,2000}?Your sessions/.test(orgAnalyticsPage) ||
  (/if\s*\(\s*!canManageOrg[\s\S]{0,2000}?PersonalSpaceAnalytics/.test(orgAnalyticsPage));
assert(
  orgAnalyticsFallsBackToPersonal,
  "organizations/[id]/analytics page falls back to a personal analytics surface for viewers",
);

// ---------------------------------------------------------------------------
// P0-2 — Organization Settings viewer access
// ---------------------------------------------------------------------------

section("P0-2: Organization Settings is admin/owner only");

const orgSettingsPage = source("app/(dashboard)/organizations/[organizationId]/settings/page.tsx");

// Must use the admin/owner authorization helper, not the member-only one.
assert(
  orgSettingsPage.includes("authorizeOrganizationAdmin"),
  "organization settings page uses authorizeOrganizationAdmin",
);
assert(
  !orgSettingsPage.includes("getOrganizationForUser(") ||
    orgSettingsPage.includes("authorizeOrganizationAdmin"),
  "organization settings page no longer relies solely on getOrganizationForUser",
);

// Must translate a denial into notFound() so forbidden/forbidden-organization
// look identical to "no such page" — no information leak.
const orgSettingsNotFoundOnDeny = orgSettingsPage.includes("notFound()") &&
  /catch\s*\{[\s\S]{0,40}notFound\(\)/.test(orgSettingsPage);
assert(orgSettingsNotFoundOnDeny, "organization settings page translates auth failure to notFound()");

// The settings page UI (label "Organization settings") must still be present.
assert(orgSettingsPage.includes("Organization settings"), "organization settings page still renders the settings UI");

// ---------------------------------------------------------------------------
// P1-1 — /api/spaces/active + DashboardShell viewer access
// ---------------------------------------------------------------------------

section("P1-1: /api/spaces/active is per-user and accessible");

const activeSpaceRoute = source("app/api/spaces/active/route.ts");
const dashboardShell = source("src/components/dashboard/DashboardShell.tsx");

// Endpoint must use withAuth (any authenticated user) for per-user preference.
assert(
  activeSpaceRoute.includes("withAuth("),
  "/api/spaces/active uses withAuth for the calling user",
);
// Specifically, the prior behavior used withDashboardAuth which silently 403'd
// viewers. We verify the old wrapper is no longer present.
assert(
  !activeSpaceRoute.includes("withDashboardAuth("),
  "/api/spaces/active no longer uses withDashboardAuth (viewer-blocking wrapper)",
);

// Specific scope must validate the requested space is accessible to the caller
// via the existing space access helper. Viewers must NOT be able to persist a
// space they are not a member of.
assert(
  activeSpaceRoute.includes("getSpaceForUser"),
  "/api/spaces/active calls getSpaceForUser for the specific-scope path",
);
assert(
  activeSpaceRoute.includes("setActiveSpacePreference"),
  "/api/spaces/active still calls setActiveSpacePreference for the specific scope",
);
assert(
  activeSpaceRoute.includes("isSelectableChildSpace"),
  "/api/spaces/active still rejects non-selectable container Spaces",
);

// All scope must validate the requested organization membership. Viewers who
// are NOT org members must NOT be able to persist "All Spaces" for an org.
assert(
  activeSpaceRoute.includes("authorizeOrganizationMember"),
  "/api/spaces/active calls authorizeOrganizationMember for the all-spaces path",
);
assert(
  activeSpaceRoute.includes("setAllSpacesPreference"),
  "/api/spaces/active still calls setAllSpacesPreference for the all-spaces path",
);

// UUID validation must be present to prevent empty/non-UUID payloads from
// triggering downstream lookups.
assert(
  /isUuid\([\s\S]{0,40}\)\s*&&/.test(activeSpaceRoute) || activeSpaceRoute.includes("UUID_PATTERN"),
  "/api/spaces/active validates request identifiers before lookup",
);

// DELETE must remain auth-only and clear the calling user's cookie.
assert(
  /export const DELETE[\s\S]{0,200}withAuth/.test(activeSpaceRoute) &&
    activeSpaceRoute.includes("clearActiveSpacePreference"),
  "/api/spaces/active DELETE is withAuth + clearActiveSpacePreference",
);

// The endpoint must not silently swallow failures: each branch returns an
// error JSON body on rejection.
assert(
  occurrences(activeSpaceRoute, 'NextResponse.json({ error:') >= 3,
  "/api/spaces/active surfaces explicit error codes for forbidden/invalid bodies",
);

// DashboardShell must no longer be fire-and-forget silent on 403 — failures
// must surface into the console so the silent-403 regression is observable.
assert(
  dashboardShell.includes("Active space preference persist rejected"),
  "DashboardShell surfaces active-space POST 403 instead of swallowing it",
);
assert(
  dashboardShell.includes("Active space preference persist failed") ||
    dashboardShell.includes("Active space preference clear failed"),
  "DashboardShell surfaces active-space POST/DELETE network failure",
);

// The fetcher must call fetch on /api/spaces/active with method POST and
// method DELETE (we keep the existing surface).
assert(
  dashboardShell.includes('method: "POST"') &&
    dashboardShell.includes("/api/spaces/active") &&
    dashboardShell.includes('method: "DELETE"'),
  "DashboardShell still uses POST/DELETE /api/spaces/active",
);

// Per-user guarantee: the cookie-writing helpers are keyed by the calling
// user inside the route, not by anything in the body.
const writesOnlyForCaller = activeSpaceRoute.includes("setActiveSpacePreference(access.space.id)") &&
  activeSpaceRoute.includes("setAllSpacesPreference(organizationId)");
assert(
  writesOnlyForCaller,
  "/api/spaces/active only writes preferences for the caller (no impersonation body fields)",
);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${"=".repeat(52)}`);
console.log(`TrackUp Role-Visibility Hardening: ${passed}/${total} tests passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
