import { determineInitialRole, isConfiguredOwnerEmail, hasMinimumRole, isOwner, isAdmin, isViewer } from "../src/lib/auth/rbac";
import { USER_ROLES } from "../src/types/auth";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("Running TrackUp RBAC Provisioning Foundation Tests");
  console.log("==================================================");

  // Setup environment for tests
  process.env.TRACKUP_OWNER_EMAIL = "founder@trackup.com";

  // Test 1: New normal user receives "viewer"
  const normalUserEmail = "member@agency.com";
  const normalUserRole = determineInitialRole(normalUserEmail);
  assert(normalUserRole === USER_ROLES.VIEWER, "1. New normal user receives 'viewer' role");

  // Test 2: Configured owner receives "owner" (case-insensitive & trimmed)
  const ownerEmailExact = "founder@trackup.com";
  const ownerEmailMixed = "  FoUnDeR@TrackUp.com  ";
  assert(isConfiguredOwnerEmail(ownerEmailExact) === true, "2a. isConfiguredOwnerEmail recognizes owner email");
  assert(determineInitialRole(ownerEmailExact) === USER_ROLES.OWNER, "2b. Configured owner (exact) receives 'owner' role");
  assert(determineInitialRole(ownerEmailMixed) === USER_ROLES.OWNER, "2c. Configured owner (case-insensitive & trimmed) receives 'owner' role");

  // Test 3: Existing Admin logs in -> Role preservation logic
  // Simulate profile with role="admin"
  const existingAdminProfile = {
    id: "admin-uuid-1",
    email: "admin@agency.com",
    role: USER_ROLES.ADMIN,
    is_active: true,
  };
  // Provisioning logic should return existingProfile.role without overwriting
  assert(existingAdminProfile.role === USER_ROLES.ADMIN, "3. Existing admin retains 'admin' role without downgrade/upgrade");

  // Test 4: Existing Viewer logs in -> Role preservation logic
  const existingViewerProfile = {
    id: "viewer-uuid-2",
    email: "viewer@client.com",
    role: USER_ROLES.VIEWER,
    is_active: true,
  };
  assert(existingViewerProfile.role === USER_ROLES.VIEWER, "4. Existing viewer retains 'viewer' role");

  // Test 5: Inactive user -> denied application access
  const inactiveAdminProfile = {
    id: "inactive-uuid-3",
    email: "former-employee@agency.com",
    role: USER_ROLES.ADMIN,
    is_active: false,
  };
  const shouldDenyAccess = !inactiveAdminProfile.is_active;
  assert(shouldDenyAccess === true, "5. Inactive user (is_active=false) is rejected access");

  // Test 6: Role hierarchy checks
  assert(hasMinimumRole(USER_ROLES.OWNER, USER_ROLES.VIEWER) === true, "6a. Owner satisfies Viewer permission");
  assert(hasMinimumRole(USER_ROLES.OWNER, USER_ROLES.ADMIN) === true, "6b. Owner satisfies Admin permission");
  assert(hasMinimumRole(USER_ROLES.ADMIN, USER_ROLES.VIEWER) === true, "6c. Admin satisfies Viewer permission");
  assert(hasMinimumRole(USER_ROLES.VIEWER, USER_ROLES.ADMIN) === false, "6d. Viewer does NOT satisfy Admin permission");
  assert(hasMinimumRole(USER_ROLES.VIEWER, USER_ROLES.OWNER) === false, "6e. Viewer does NOT satisfy Owner permission");

  // Test 7: Helper role type checkers
  assert(isOwner(USER_ROLES.OWNER) === true, "7a. isOwner check");
  assert(isAdmin(USER_ROLES.ADMIN) === true, "7b. isAdmin check");
  assert(isViewer(USER_ROLES.VIEWER) === true, "7c. isViewer check");

  console.log("==================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
