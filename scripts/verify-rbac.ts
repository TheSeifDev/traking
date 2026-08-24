/**
 * TrackUp RBAC Permission System – Verification Tests
 *
 * Tests every requirement from the RBAC spec:
 *   - Owner permissions (full set)
 *   - Admin permissions
 *   - Viewer permissions
 *   - Cross-role boundary violations
 *   - Invalid role handling
 *   - Inactive user handling
 *   - Unauthenticated user handling
 *   - roleHasPermission edge cases
 *   - ROLE_PERMISSIONS completeness
 */

import {
  ROLE_PERMISSIONS,
  roleHasPermission,
  roleHasAllPermissions,
  roleHasAnyPermission,
  getPermissionsForRole,
  isOwner,
  isAdmin,
  isAdminOrOwner,
  isViewer,
  hasMinimumRole,
  determineInitialRole,
  isConfiguredOwnerEmail,
} from "../src/lib/auth/rbac";
import { AuthError } from "../src/lib/auth/session";
import { USER_ROLES, type UserRole } from "../src/types/auth";
import { PERMISSIONS, ALL_PERMISSIONS } from "../src/types/permissions";

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
// Setup environment
// ---------------------------------------------------------------------------

process.env.TRACKUP_OWNER_EMAIL = "ceo@trackup.io";

// ---------------------------------------------------------------------------
// 1. Owner permissions – must have every defined permission
// ---------------------------------------------------------------------------

section("1. Owner permissions");

for (const p of ALL_PERMISSIONS) {
  assert(
    roleHasPermission(USER_ROLES.OWNER, p),
    `owner has permission: ${p}`
  );
}

assert(
  roleHasAllPermissions(USER_ROLES.OWNER, [...ALL_PERMISSIONS]),
  "roleHasAllPermissions: owner holds every permission"
);

// ---------------------------------------------------------------------------
// 2. Admin permissions – explicit set, NO admin-only restrictions
// ---------------------------------------------------------------------------

section("2. Admin permissions");

const ADMIN_EXPECTED = [
  PERMISSIONS.VIDEOS_READ,
  PERMISSIONS.VIDEOS_CREATE,
  PERMISSIONS.VIDEOS_UPDATE,
  PERMISSIONS.VIDEOS_DELETE,
  PERMISSIONS.ANALYTICS_READ,
];

const ADMIN_DENIED = [
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.ADMINS_MANAGE,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.SYSTEM_MANAGE,
];

for (const p of ADMIN_EXPECTED) {
  assert(roleHasPermission(USER_ROLES.ADMIN, p), `admin has permission: ${p}`);
}

for (const p of ADMIN_DENIED) {
  assert(!roleHasPermission(USER_ROLES.ADMIN, p), `admin does NOT have permission: ${p}`);
}

// ---------------------------------------------------------------------------
// 3. Viewer permissions – minimal set
// ---------------------------------------------------------------------------

section("3. Viewer permissions");

const VIEWER_EXPECTED = [PERMISSIONS.VIDEOS_READ, PERMISSIONS.ANALYTICS_READ];

const VIEWER_DENIED = [
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.VIDEOS_CREATE,
  PERMISSIONS.VIDEOS_UPDATE,
  PERMISSIONS.VIDEOS_DELETE,
  PERMISSIONS.ADMINS_MANAGE,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.SYSTEM_MANAGE,
];

for (const p of VIEWER_EXPECTED) {
  assert(roleHasPermission(USER_ROLES.VIEWER, p), `viewer has permission: ${p}`);
}

for (const p of VIEWER_DENIED) {
  assert(!roleHasPermission(USER_ROLES.VIEWER, p), `viewer does NOT have permission: ${p}`);
}

// ---------------------------------------------------------------------------
// 4. Cross-role boundary – viewer/admin cannot escalate
// ---------------------------------------------------------------------------

section("4. Cross-role boundaries");

assert(
  !roleHasPermission(USER_ROLES.VIEWER, PERMISSIONS.VIDEOS_CREATE),
  "viewer cannot create videos"
);

assert(
  !roleHasPermission(USER_ROLES.ADMIN, PERMISSIONS.SYSTEM_MANAGE),
  "admin cannot manage system"
);

assert(
  !roleHasPermission(USER_ROLES.ADMIN, PERMISSIONS.ADMINS_MANAGE),
  "admin cannot manage platform team roles"
);

assert(
  roleHasAnyPermission(USER_ROLES.VIEWER, [PERMISSIONS.VIDEOS_READ, PERMISSIONS.SYSTEM_MANAGE]),
  "roleHasAnyPermission: viewer can read videos (partial match)"
);

assert(
  !roleHasAnyPermission(USER_ROLES.VIEWER, [PERMISSIONS.SYSTEM_MANAGE, PERMISSIONS.USERS_MANAGE]),
  "roleHasAnyPermission: viewer has none of [system.manage, users.manage]"
);

// ---------------------------------------------------------------------------
// 5. ROLE_PERMISSIONS set integrity
// ---------------------------------------------------------------------------

section("5. ROLE_PERMISSIONS set integrity");

assert(
  ROLE_PERMISSIONS[USER_ROLES.OWNER].size === ALL_PERMISSIONS.length,
  `owner set contains all ${ALL_PERMISSIONS.length} permissions`
);

assert(
  ROLE_PERMISSIONS[USER_ROLES.ADMIN].size === ADMIN_EXPECTED.length,
  `admin set contains exactly ${ADMIN_EXPECTED.length} permissions`
);

assert(
  ROLE_PERMISSIONS[USER_ROLES.VIEWER].size === VIEWER_EXPECTED.length,
  `viewer set contains exactly ${VIEWER_EXPECTED.length} permissions`
);

const ownerPerms = getPermissionsForRole(USER_ROLES.OWNER);
assert(ownerPerms.size === ALL_PERMISSIONS.length, "getPermissionsForRole(owner) returns correct size");

// ---------------------------------------------------------------------------
// 6. Invalid role handling
// ---------------------------------------------------------------------------

section("6. Invalid role handling");

// Cast to defeat TS – simulates a corrupt DB value arriving at runtime
const bogusRole = "superadmin" as unknown as UserRole;
assert(
  !roleHasPermission(bogusRole, PERMISSIONS.VIDEOS_READ),
  "unrecognised role is denied all permissions"
);

assert(
  getPermissionsForRole(bogusRole).size === 0,
  "getPermissionsForRole returns empty Set for unrecognised role"
);

// ---------------------------------------------------------------------------
// 7. Inactive user – AuthError class shape
// ---------------------------------------------------------------------------

section("7. Inactive user / AuthError");

const inactiveError = new AuthError("inactive_account", "Account is inactive");
assert(inactiveError instanceof AuthError, "AuthError is instanceof AuthError");
assert(inactiveError instanceof Error, "AuthError is instanceof Error");
assert(inactiveError.code === "inactive_account", "AuthError.code is set correctly");
assert(inactiveError.name === "AuthError", "AuthError.name is 'AuthError'");

const forbiddenError = new AuthError("forbidden", "Permission denied");
assert(forbiddenError.code === "forbidden", "AuthError.code 'forbidden' works");

const unauthError = new AuthError("unauthenticated", "Not logged in");
assert(unauthError.code === "unauthenticated", "AuthError.code 'unauthenticated' works");

// ---------------------------------------------------------------------------
// 8. Role hierarchy / hasMinimumRole
// ---------------------------------------------------------------------------

section("8. Role hierarchy");

assert(hasMinimumRole(USER_ROLES.OWNER, USER_ROLES.OWNER), "owner ≥ owner");
assert(hasMinimumRole(USER_ROLES.OWNER, USER_ROLES.ADMIN), "owner ≥ admin");
assert(hasMinimumRole(USER_ROLES.OWNER, USER_ROLES.VIEWER), "owner ≥ viewer");
assert(hasMinimumRole(USER_ROLES.ADMIN, USER_ROLES.ADMIN), "admin ≥ admin");
assert(hasMinimumRole(USER_ROLES.ADMIN, USER_ROLES.VIEWER), "admin ≥ viewer");
assert(!hasMinimumRole(USER_ROLES.ADMIN, USER_ROLES.OWNER), "admin < owner");
assert(!hasMinimumRole(USER_ROLES.VIEWER, USER_ROLES.ADMIN), "viewer < admin");
assert(!hasMinimumRole(USER_ROLES.VIEWER, USER_ROLES.OWNER), "viewer < owner");

// ---------------------------------------------------------------------------
// 9. Role predicate helpers
// ---------------------------------------------------------------------------

section("9. Role predicates");

assert(isOwner(USER_ROLES.OWNER), "isOwner(owner)");
assert(!isOwner(USER_ROLES.ADMIN), "!isOwner(admin)");
assert(isAdmin(USER_ROLES.ADMIN), "isAdmin(admin)");
assert(!isAdmin(USER_ROLES.OWNER), "!isAdmin(owner)");
assert(isViewer(USER_ROLES.VIEWER), "isViewer(viewer)");
assert(isAdminOrOwner(USER_ROLES.OWNER), "isAdminOrOwner(owner)");
assert(isAdminOrOwner(USER_ROLES.ADMIN), "isAdminOrOwner(admin)");
assert(!isAdminOrOwner(USER_ROLES.VIEWER), "!isAdminOrOwner(viewer)");

// ---------------------------------------------------------------------------
// 10. Owner-email detection
// ---------------------------------------------------------------------------

section("10. Owner-email detection");

assert(isConfiguredOwnerEmail("ceo@trackup.io"), "exact owner email detected");
assert(isConfiguredOwnerEmail("  CEO@TrackUp.IO  "), "case-insensitive + trimmed owner email detected");
assert(!isConfiguredOwnerEmail("member@agency.com"), "non-owner email rejected");
assert(!isConfiguredOwnerEmail(null), "null email rejected");
assert(!isConfiguredOwnerEmail(undefined), "undefined email rejected");

assert(determineInitialRole("ceo@trackup.io") === USER_ROLES.OWNER, "owner email → 'owner' role");
assert(determineInitialRole("stranger@test.com") === USER_ROLES.VIEWER, "other email → 'viewer' role");

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${"=".repeat(52)}`);
console.log(`TrackUp RBAC Verification: ${passed}/${total} tests passed`);
if (failed > 0) {
  console.error(`${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
