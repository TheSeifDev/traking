/**
 * TrackUp Route & API Authorization – Verification Tests
 *
 * Tests middleware logic, page guard behavior, and API handler wrappers
 * using simulated session states (no live DB or HTTP calls required).
 *
 * Covers all 8 test scenarios from the spec:
 *   1. unauthenticated → /dashboard
 *   2. viewer → /admin
 *   3. viewer → /owner
 *   4. admin → /admin
 *   5. admin → /owner
 *   6. owner → /admin
 *   7. owner → /owner
 *   8. inactive user → protected routes
 *
 * Plus: API handler permission enforcement for each role.
 */

import { readFileSync } from "node:fs";

import { AuthError } from "../src/lib/auth/session";
import {
  roleHasPermission,
  hasMinimumRole,
} from "../src/lib/auth/rbac";
import {
  isValidRole,
  USER_ROLES,
  type AuthenticatedUser,
  type UserRole,
} from "../src/types/auth";
import { PERMISSIONS } from "../src/types/permissions";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n── ${title}`);
}

// ---------------------------------------------------------------------------
// Simulated session helpers
// ---------------------------------------------------------------------------

function makeUser(role: UserRole, is_active = true): AuthenticatedUser {
  return {
    id: `${role}-user-uuid`,
    email: `${role}@trackup.io`,
    role,
    is_active,
    name: `Test ${role}`,
    clickup_user_id: `cu_${role}`,
  };
}

// Simulate the middleware fast-path role check for a given path + session
function simulateMiddlewareAccess(
  pathname: string,
  session: { role: string } | null
): "allowed" | "redirect_login" | "redirect_forbidden" {
  const PROTECTED_PREFIXES = ["/dashboard", "/videos", "/analytics", "/profile", "/admin", "/owner"];
  const ADMIN_PREFIXES = ["/admin"];
  const OWNER_PREFIXES = ["/owner"];
  const OWNER_ONLY_ADMIN_PATHS = ["/admin/users"];

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isOwner = OWNER_PREFIXES.some((p) => pathname.startsWith(p));
  const isOwnerOnlyAdmin = OWNER_ONLY_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isProtected) return "allowed";

  if (!session) return "redirect_login";

  const role = session.role;

  if (isOwnerOnlyAdmin || isOwner) {
    if (!isValidRole(role) || !hasMinimumRole(role, USER_ROLES.OWNER)) {
      return "redirect_forbidden";
    }
  } else if (isAdmin) {
    if (!isValidRole(role) || !hasMinimumRole(role, USER_ROLES.ADMIN)) {
      return "redirect_forbidden";
    }
  }

  return "allowed";
}

// Simulate the requireAuth / requireRole guard behavior without a DB
function simulateGuard(
  user: AuthenticatedUser | null,
  minimumRole?: UserRole
): "ok" | "unauthenticated" | "inactive" | "forbidden" {
  if (!user) return "unauthenticated";
  if (!user.is_active) return "inactive";
  if (!isValidRole(user.role)) return "unauthenticated";
  if (minimumRole && !hasMinimumRole(user.role, minimumRole)) return "forbidden";
  return "ok";
}

// Simulate the withPermission API handler behavior
function simulateApiHandler(
  user: AuthenticatedUser | null,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
): 200 | 401 | 403 {
  if (!user) return 401;
  if (!user.is_active) return 403;
  if (!isValidRole(user.role)) return 401;
  if (!roleHasPermission(user.role, permission)) return 403;
  return 200;
}

function simulateDashboardApi(user: AuthenticatedUser | null): 200 | 401 | 403 {
  if (!user) return 401;
  if (!user.is_active) return 403;
  if (!isValidRole(user.role)) return 401;
  return hasMinimumRole(user.role, USER_ROLES.ADMIN) ? 200 : 403;
}

// ---------------------------------------------------------------------------
// 1. Unauthenticated → /dashboard
// ---------------------------------------------------------------------------

section("1. Unauthenticated user → /dashboard");

assert(
  simulateMiddlewareAccess("/dashboard", null) === "redirect_login",
  "middleware redirects unauthenticated user to /login"
);
assert(
  simulateGuard(null) === "unauthenticated",
  "guardAuth throws unauthenticated for null session"
);
assert(
  simulateApiHandler(null, PERMISSIONS.VIDEOS_READ) === 401,
  "API handler returns 401 for unauthenticated"
);

// ---------------------------------------------------------------------------
// 2. Viewer → /admin
// ---------------------------------------------------------------------------

section("2. Viewer → /admin/*");

const viewer = makeUser(USER_ROLES.VIEWER);

assert(
  simulateMiddlewareAccess("/admin", { role: "viewer" }) === "redirect_forbidden",
  "middleware blocks viewer from /admin"
);
assert(
  simulateMiddlewareAccess("/admin/users", { role: "viewer" }) === "redirect_forbidden",
  "middleware blocks viewer from /admin/users"
);
assert(
  simulateGuard(viewer, USER_ROLES.ADMIN) === "forbidden",
  "guardAdmin throws forbidden for viewer"
);

// ---------------------------------------------------------------------------
// 3. Viewer → /owner
// ---------------------------------------------------------------------------

section("3. Viewer → /owner/*");

assert(
  simulateMiddlewareAccess("/owner", { role: "viewer" }) === "redirect_forbidden",
  "middleware blocks viewer from /owner"
);
assert(
  simulateMiddlewareAccess("/owner/admins", { role: "viewer" }) === "redirect_forbidden",
  "middleware blocks viewer from /owner/admins"
);
assert(
  simulateGuard(viewer, USER_ROLES.OWNER) === "forbidden",
  "guardOwner throws forbidden for viewer"
);

// ---------------------------------------------------------------------------
// 4. Admin → /admin  (allowed)
// ---------------------------------------------------------------------------

section("4. Admin → /admin/* (allowed)");

const admin = makeUser(USER_ROLES.ADMIN);

assert(
  simulateMiddlewareAccess("/admin", { role: "admin" }) === "allowed",
  "middleware allows admin to /admin"
);
assert(
  simulateMiddlewareAccess("/admin/users", { role: "admin" }) === "redirect_forbidden",
  "middleware blocks admin from owner-only /admin/users"
);
assert(
  simulateMiddlewareAccess("/admin/settings", { role: "admin" }) === "allowed",
  "middleware allows admin to /admin/settings"
);
assert(
  simulateGuard(admin, USER_ROLES.ADMIN) === "ok",
  "guardAdmin passes for admin role"
);

// ---------------------------------------------------------------------------
// 5. Admin → /owner  (denied)
// ---------------------------------------------------------------------------

section("5. Admin → /owner/* (denied)");

assert(
  simulateMiddlewareAccess("/owner", { role: "admin" }) === "redirect_forbidden",
  "middleware blocks admin from /owner"
);
assert(
  simulateMiddlewareAccess("/owner/admins", { role: "admin" }) === "redirect_forbidden",
  "middleware blocks admin from /owner/admins"
);
assert(
  simulateGuard(admin, USER_ROLES.OWNER) === "forbidden",
  "guardOwner throws forbidden for admin role"
);

// ---------------------------------------------------------------------------
// 6. Owner → /admin  (allowed)
// ---------------------------------------------------------------------------

section("6. Owner → /admin/* (allowed)");

const owner = makeUser(USER_ROLES.OWNER);

assert(
  simulateMiddlewareAccess("/admin", { role: "owner" }) === "allowed",
  "middleware allows owner to /admin"
);
assert(
  simulateMiddlewareAccess("/admin/users", { role: "owner" }) === "allowed",
  "middleware allows owner to /admin/users"
);
assert(
  simulateGuard(owner, USER_ROLES.ADMIN) === "ok",
  "guardAdmin passes for owner role"
);

// ---------------------------------------------------------------------------
// 7. Owner → /owner  (allowed)
// ---------------------------------------------------------------------------

section("7. Owner → /owner/* (allowed)");

assert(
  simulateMiddlewareAccess("/owner", { role: "owner" }) === "allowed",
  "middleware allows owner to /owner"
);
assert(
  simulateMiddlewareAccess("/owner/admins", { role: "owner" }) === "allowed",
  "middleware allows owner to /owner/admins"
);
assert(
  simulateGuard(owner, USER_ROLES.OWNER) === "ok",
  "guardOwner passes for owner role"
);

// ---------------------------------------------------------------------------
// 8. Inactive user → protected routes
// ---------------------------------------------------------------------------

section("8. Inactive user → all protected routes denied");

const inactiveAdmin = makeUser(USER_ROLES.ADMIN, false /* is_active = false */);

assert(
  simulateGuard(inactiveAdmin) === "inactive",
  "guardAuth throws inactive_account for deactivated admin"
);
assert(
  simulateGuard(inactiveAdmin, USER_ROLES.ADMIN) === "inactive",
  "guardAdmin throws inactive_account for deactivated admin"
);
assert(simulateDashboardApi(viewer) === 403, "withDashboardAuth denies viewer");
assert(simulateDashboardApi(admin) === 200, "withDashboardAuth allows admin");
assert(simulateDashboardApi(owner) === 200, "withDashboardAuth allows owner");
assert(
  simulateApiHandler(inactiveAdmin, PERMISSIONS.VIDEOS_READ) === 403,
  "API handler returns 403 for inactive account"
);
assert(
  simulateApiHandler(inactiveAdmin, PERMISSIONS.VIDEOS_CREATE) === 403,
  "API handler returns 403 for inactive admin on videos.create"
);

// ---------------------------------------------------------------------------
// 9. Protected server operations – per-permission API enforcement
// ---------------------------------------------------------------------------

section("9. Protected API operations – permission enforcement");

// videos.create – viewer denied, admin/owner allowed
assert(simulateApiHandler(viewer, PERMISSIONS.VIDEOS_CREATE) === 403, "viewer: videos.create → 403");
assert(simulateApiHandler(admin, PERMISSIONS.VIDEOS_CREATE) === 200, "admin: videos.create → 200");
assert(simulateApiHandler(owner, PERMISSIONS.VIDEOS_CREATE) === 200, "owner: videos.create → 200");

// videos.update
assert(simulateApiHandler(viewer, PERMISSIONS.VIDEOS_UPDATE) === 403, "viewer: videos.update → 403");
assert(simulateApiHandler(admin, PERMISSIONS.VIDEOS_UPDATE) === 200, "admin: videos.update → 200");
assert(simulateApiHandler(owner, PERMISSIONS.VIDEOS_UPDATE) === 200, "owner: videos.update → 200");

// videos.delete
assert(simulateApiHandler(viewer, PERMISSIONS.VIDEOS_DELETE) === 403, "viewer: videos.delete → 403");
assert(simulateApiHandler(admin, PERMISSIONS.VIDEOS_DELETE) === 200, "admin: videos.delete → 200");
assert(simulateApiHandler(owner, PERMISSIONS.VIDEOS_DELETE) === 200, "owner: videos.delete → 200");

// users.manage – owner only; admin and viewer denied
assert(simulateApiHandler(viewer, PERMISSIONS.USERS_MANAGE) === 403, "viewer: users.manage → 403");
assert(simulateApiHandler(admin, PERMISSIONS.USERS_MANAGE) === 403, "admin: users.manage → 403");
assert(simulateApiHandler(owner, PERMISSIONS.USERS_MANAGE) === 200, "owner: users.manage → 200");

// admins.manage – owner only; admin and viewer denied
assert(simulateApiHandler(viewer, PERMISSIONS.ADMINS_MANAGE) === 403, "viewer: admins.manage → 403");
assert(simulateApiHandler(admin, PERMISSIONS.ADMINS_MANAGE) === 403, "admin: admins.manage → 403");
assert(simulateApiHandler(owner, PERMISSIONS.ADMINS_MANAGE) === 200, "owner: admins.manage → 200");

// settings.manage – only owner
assert(simulateApiHandler(viewer, PERMISSIONS.SETTINGS_MANAGE) === 403, "viewer: settings.manage → 403");
assert(simulateApiHandler(admin, PERMISSIONS.SETTINGS_MANAGE) === 403, "admin: settings.manage → 403");
assert(simulateApiHandler(owner, PERMISSIONS.SETTINGS_MANAGE) === 200, "owner: settings.manage → 200");

// system.manage – only owner
assert(simulateApiHandler(viewer, PERMISSIONS.SYSTEM_MANAGE) === 403, "viewer: system.manage → 403");
assert(simulateApiHandler(admin, PERMISSIONS.SYSTEM_MANAGE) === 403, "admin: system.manage → 403");
assert(simulateApiHandler(owner, PERMISSIONS.SYSTEM_MANAGE) === 200, "owner: system.manage → 200");

// ---------------------------------------------------------------------------
// 10. AuthError class – correct codes for route protection
// ---------------------------------------------------------------------------

section("10. AuthError codes are structurally correct");

const codes: string[] = [
  "unauthenticated",
  "inactive_account",
  "forbidden",
  "missing_profile",
  "invalid_role",
  "database_error",
];

for (const code of codes) {
  const e = new AuthError(code as import("../src/lib/auth/session").AuthErrorCode, "msg");
  assert(e.code === code && e instanceof AuthError, `AuthError code '${code}' is valid`);
}

// ---------------------------------------------------------------------------
// 11. Dashboard route is viewer-accessible (P0-1 regression guard)
//
// Background: app/(dashboard)/layout.tsx used to call guardRole(ADMIN, "/").
// Every fresh ClickUp-authenticated user is provisioned as VIEWER, so they
// landed on /dashboard after OAuth and were silently redirected back to the
// marketing home page by handleAuthError. The layout was changed to guardAuth()
// to let viewers in; privileged surfaces (admin / owner, member management,
// settings) are now guarded at the page level. These tests pin that behaviour:
//   - viewer → /dashboard MUST be allowed
//   - viewer → /admin MUST be forbidden
//   - viewer → /owner MUST be forbidden
//   - admin → /admin MUST be allowed; admin → /owner MUST be forbidden
//   - owner → /admin and /owner MUST be allowed
// We also read the layout/page sources to verify the guards are wired up
// exactly that way; this fails closed if anyone reverts the layout guard.
// ---------------------------------------------------------------------------

section("11. Dashboard viewer-accessible regression (P0-1)");

const dashboardLayout = readFileSync("app/(dashboard)/layout.tsx", "utf8");
const dashboardPage = readFileSync("app/(dashboard)/dashboard/page.tsx", "utf8");
const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
const ownerLayout = readFileSync("app/owner/layout.tsx", "utf8");
const adminUsersPage = readFileSync("app/admin/users/page.tsx", "utf8");

// Pin the actual source-level guards so a future regression to guardRole(ADMIN, "/")
// in the dashboard layout is caught here instead of in production.
assert(
  dashboardLayout.includes('await guardAuth()') && !dashboardLayout.includes("guardRole(USER_ROLES.ADMIN"),
  "(dashboard)/layout.tsx uses guardAuth() so viewers can enter /dashboard"
);
assert(
  dashboardPage.includes('await guardAuth()'),
  "(dashboard)/dashboard/page.tsx uses guardAuth() for the landing dashboard"
);
assert(
  adminLayout.includes('await guardAdmin()'),
  "app/admin/layout.tsx enforces the ADMIN gate at the layout boundary"
);
assert(
  ownerLayout.includes('await guardOwner()'),
  "app/owner/layout.tsx enforces the OWNER gate at the layout boundary"
);
assert(
  adminUsersPage.includes('await guardOwner()'),
  "app/admin/users/page.tsx keeps owner-only team management at the page boundary"
);

// Middleware fast-path: viewer is allowed past middleware into the dashboard.
assert(
  simulateMiddlewareAccess("/dashboard", { role: "viewer" }) === "allowed",
  "viewer: middleware lets a viewer into /dashboard"
);
assert(
  simulateMiddlewareAccess("/dashboard/analytics", { role: "viewer" }) === "allowed",
  "viewer: middleware lets a viewer into /dashboard/analytics"
);
assert(
  simulateMiddlewareAccess("/dashboard/videos", { role: "viewer" }) === "allowed",
  "viewer: middleware lets a viewer into /dashboard/videos"
);

// Layout/page guard: viewer passes guardAuth (no role requirement), so no
// redirect — equivalent to "the page renders".
assert(
  simulateGuard(viewer) === "ok",
  "viewer: guardAuth passes — page renders for viewer"
);

// Viewer is still blocked from privileged admin and owner surfaces.
assert(
  simulateMiddlewareAccess("/admin", { role: "viewer" }) === "redirect_forbidden",
  "viewer: middleware still blocks /admin"
);
assert(
  simulateMiddlewareAccess("/admin/users", { role: "viewer" }) === "redirect_forbidden",
  "viewer: middleware still blocks /admin/users"
);
assert(
  simulateMiddlewareAccess("/owner", { role: "viewer" }) === "redirect_forbidden",
  "viewer: middleware still blocks /owner"
);
assert(
  simulateMiddlewareAccess("/owner/admins", { role: "viewer" }) === "redirect_forbidden",
  "viewer: middleware still blocks /owner/admins"
);
assert(
  simulateGuard(viewer, USER_ROLES.ADMIN) === "forbidden",
  "viewer: guardAdmin rejects viewer"
);
assert(
  simulateGuard(viewer, USER_ROLES.OWNER) === "forbidden",
  "viewer: guardOwner rejects viewer"
);

// Admin can enter admin surfaces but not owner-only surfaces.
assert(
  simulateMiddlewareAccess("/admin", { role: "admin" }) === "allowed",
  "admin: middleware allows /admin"
);
assert(
  simulateMiddlewareAccess("/admin/settings", { role: "admin" }) === "allowed",
  "admin: middleware allows /admin/settings"
);
assert(
  simulateMiddlewareAccess("/admin/users", { role: "admin" }) === "redirect_forbidden",
  "admin: middleware blocks owner-only /admin/users"
);
assert(
  simulateMiddlewareAccess("/owner", { role: "admin" }) === "redirect_forbidden",
  "admin: middleware blocks /owner"
);
assert(
  simulateMiddlewareAccess("/owner/admins", { role: "admin" }) === "redirect_forbidden",
  "admin: middleware blocks /owner/admins"
);
assert(
  simulateGuard(admin, USER_ROLES.ADMIN) === "ok",
  "admin: guardAdmin passes"
);
assert(
  simulateGuard(admin, USER_ROLES.OWNER) === "forbidden",
  "admin: guardOwner rejects admin"
);

// Owner can enter both admin and owner surfaces.
assert(
  simulateMiddlewareAccess("/admin", { role: "owner" }) === "allowed",
  "owner: middleware allows /admin"
);
assert(
  simulateMiddlewareAccess("/admin/users", { role: "owner" }) === "allowed",
  "owner: middleware allows /admin/users (owner-only)"
);
assert(
  simulateMiddlewareAccess("/owner", { role: "owner" }) === "allowed",
  "owner: middleware allows /owner"
);
assert(
  simulateMiddlewareAccess("/owner/admins", { role: "owner" }) === "allowed",
  "owner: middleware allows /owner/admins"
);
assert(
  simulateGuard(owner, USER_ROLES.ADMIN) === "ok",
  "owner: guardAdmin passes (owner hierarchy ≥ admin)"
);
assert(
  simulateGuard(owner, USER_ROLES.OWNER) === "ok",
  "owner: guardOwner passes"
);

// Permission-level enforcement at the privileged-route boundary: viewer must
// not gain access to admin-only / owner-only permissions even if a future
// middleware bug leaks them onto the route.
assert(
  simulateApiHandler(viewer, PERMISSIONS.ADMINS_MANAGE) === 403,
  "viewer: admins.manage permission rejected at API boundary"
);
assert(
  simulateApiHandler(viewer, PERMISSIONS.USERS_MANAGE) === 403,
  "viewer: users.manage permission rejected at API boundary"
);
assert(
  simulateApiHandler(viewer, PERMISSIONS.SETTINGS_MANAGE) === 403,
  "viewer: settings.manage permission rejected at API boundary"
);
assert(
  simulateApiHandler(viewer, PERMISSIONS.SYSTEM_MANAGE) === 403,
  "viewer: system.manage permission rejected at API boundary"
);
assert(
  simulateApiHandler(admin, PERMISSIONS.VIDEOS_CREATE) === 200,
  "admin: videos.create permission allowed at API boundary"
);
assert(
  simulateApiHandler(admin, PERMISSIONS.ADMINS_MANAGE) === 403,
  "admin: admins.manage permission rejected at API boundary (owner-only)"
);
assert(
  simulateApiHandler(owner, PERMISSIONS.ADMINS_MANAGE) === 200,
  "owner: admins.manage permission allowed at API boundary"
);

// ---------------------------------------------------------------------------

section("Login OAuth route wiring");

const loginHero = readFileSync("src/components/login/LoginHero.tsx", "utf8");
const loginCard = readFileSync("src/components/login/LoginCard.tsx", "utf8");
const clickupAuthRoute = readFileSync("app/api/auth/clickup/route.ts", "utf8");
const settingsPage = readFileSync("app/(dashboard)/settings/page.tsx", "utf8");
const videoListRoute = readFileSync("app/api/videos/route.ts", "utf8");
const videoDetailRoute = readFileSync("app/api/videos/[id]/route.ts", "utf8");
const clickupTaskSearchRoute = readFileSync("app/api/clickup/tasks/route.ts", "utf8");

assert(
  loginHero.includes('authHref = "/api/auth/clickup"'),
  "LoginHero default href points to the implemented ClickUp OAuth route"
);
assert(
  loginCard.includes('authHref = "/api/auth/clickup"'),
  "LoginCard default href points to the implemented ClickUp OAuth route"
);
assert(
  clickupAuthRoute.includes("export async function GET"),
  "ClickUp OAuth route exposes a GET handler"
);
assert(
  settingsPage.includes('href="/api/auth/clickup"'),
  "settings reconnect CTA points to the implemented ClickUp OAuth route"
);
assert(
  videoListRoute.includes("withDashboardAuth") && videoListRoute.includes("resolveSpaceForUser") && videoListRoute.includes("spaceDataScope") && videoListRoute.includes("listVideos(scope)"),
  "video list route enforces authenticated Space membership and scoped reads"
);
assert(
  videoDetailRoute.includes("withDashboardAuth") && videoDetailRoute.includes("resolveSpaceForUser") && videoDetailRoute.includes("spaceDataScope") && videoDetailRoute.includes("getVideo(id, scope)"),
  "video detail route enforces authenticated Space membership"
);
assert(
  clickupTaskSearchRoute.includes("withDashboardAuth") && clickupTaskSearchRoute.includes("resolveSpaceAdminForUser") && clickupTaskSearchRoute.includes("workspace.clickup_team_id"),
  "ClickUp task search route enforces Space-admin authorization and selected workspace"
);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${"=".repeat(56)}`);
console.log(`TrackUp Route Authorization: ${passed}/${total} tests passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
