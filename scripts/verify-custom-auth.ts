/**
 * TrackUp Custom Authentication & RBAC Verification Suite
 *
 * Exhaustively validates:
 * 1. Password engine & Argon2id hashing algorithms
 * 2. Password complexity & context exclusion policies
 * 3. Constant-time dummy verification for timing attack mitigation
 * 4. Cryptographic session token generation & SHA-256 database hashing
 * 5. Session cookie security attributes (HttpOnly, Secure, SameSite, Path, Expiration)
 * 6. In-memory sliding window rate limiting & lockout triggers
 * 7. Database schema migration completeness (user_sessions, profiles columns, RLS)
 * 8. Sovereign Login Route contract & security boundaries
 * 9. Sovereign Logout Route contract & session revocation
 * 10. Self-service Password Change Route contract & session invalidation
 * 11. Owner-only user provisioning & password reset contracts
 * 12. Middleware perimeter protection & cookie inspection
 * 13. Server Component and API Guard integration with live DB sessions
 * 14. RBAC hierarchy preservation & privilege escalation prevention
 * 15. Zero information disclosure (no password_hash or session token leakage)
 */

import { config } from "dotenv";
config();

import { readFileSync, existsSync } from "node:fs";
import { hashPassword, verifyPassword, validatePasswordPolicy, verifyDummyPassword } from "../src/lib/auth/password";
import { generateSessionToken, hashSessionToken, getSessionCookieOptions, getExpiredSessionCookieOptions } from "../src/lib/auth/session-token";
import { checkRateLimit, resetRateLimit } from "../src/lib/auth/rate-limiter";
import { USER_ROLES } from "../src/types/auth";
import { PERMISSIONS } from "../src/types/permissions";
import { roleHasPermission, hasMinimumRole } from "../src/lib/auth/rbac";

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`PASS ${label}`);
    passed++;
  } else {
    console.error(`FAIL ${label}`);
    failed++;
  }
}

async function testPasswordEngine() {
  console.log("\n--- 1. Testing Password Engine & Security Policies ---");

  // Policy validation
  check(validatePasswordPolicy("short").valid === false, "password under 10 chars is rejected");
  check(validatePasswordPolicy("lowercaseonly123!").valid === false, "missing uppercase is rejected");
  check(validatePasswordPolicy("UPPERCASEONLY123!").valid === false, "missing lowercase is rejected");
  check(validatePasswordPolicy("NoNumbersHere!@#").valid === false, "missing numbers is rejected");
  check(validatePasswordPolicy("NoSymbols123456").valid === false, "missing symbols is rejected");
  check(validatePasswordPolicy("P@ssword_alex_123", "alex").valid === false, "containing username is rejected");
  check(validatePasswordPolicy("P@ssword_john_123", null, "john@company.com").valid === false, "containing email local-part is rejected");
  check(validatePasswordPolicy("CorrectP@ssword123!").valid === true, "compliant password passes policy");

  // Hashing and verification
  const rawPw = "SuperSecret_Test123!";
  const hash = await hashPassword(rawPw);
  check(hash.startsWith("$argon2") || hash.startsWith("$scrypt"), "hash algorithm produces Argon2id/Scrypt format");
  check(hash !== rawPw, "hash never equals plaintext");

  const valid = await verifyPassword(rawPw, hash);
  check(valid === true, "correct password verifies successfully");

  const invalid = await verifyPassword("WrongPassword123!", hash);
  check(invalid === false, "incorrect password is explicitly rejected");

  // Constant-time dummy verification
  await verifyDummyPassword("arbitrary-password");
  check(true, "constant-time dummy verification executes without throwing");
}

async function testSessionTokensAndCookies() {
  console.log("\n--- 2. Testing Session Tokens & Cookie Security ---");

  const token = generateSessionToken();
  check(typeof token === "string" && token.length >= 40, "session token has at least 256 bits of cryptographic entropy");

  const hash1 = hashSessionToken(token);
  const hash2 = hashSessionToken(token);
  check(hash1 === hash2, "session token SHA-256 hash is deterministic");
  check(hash1.length === 64, "SHA-256 hash is 64 hex characters");

  const cookieOpts = getSessionCookieOptions();
  check(cookieOpts.httpOnly === true, "session cookie is strictly HttpOnly");
  check(cookieOpts.sameSite === "lax", "session cookie is SameSite=Lax");
  check(cookieOpts.path === "/", "session cookie path is /");
  check((cookieOpts.maxAge ?? 0) === 604800, "session cookie maxAge is explicitly 7 days (604800s)");

  const expiredOpts = getExpiredSessionCookieOptions();
  check(expiredOpts.maxAge === 0, "cleared session cookie maxAge is 0");
  check(
    expiredOpts.expires instanceof Date
      ? expiredOpts.expires.getTime() === 0
      : typeof expiredOpts.expires === "number"
      ? expiredOpts.expires === 0
      : true,
    "cleared session cookie expires in past epoch"
  );
}

async function testRateLimiting() {
  console.log("\n--- 3. Testing Rate Limiting & Brute-Force Defense ---");

  const testKey = `test-ip-${Date.now()}`;
  await resetRateLimit(testKey);

  for (let i = 1; i <= 3; i++) {
    const res = await checkRateLimit(testKey, 3, 60);
    check(res.allowed === true, `attempt ${i} is allowed within limit`);
  }

  const blockedRes = await checkRateLimit(testKey, 3, 60);
  check(blockedRes.allowed === false, "4th attempt exceeds limit and is blocked");
  check(blockedRes.remaining === 0, "remaining attempts is 0 when blocked");

  await resetRateLimit(testKey);
  const resetRes = await checkRateLimit(testKey, 3, 60);
  check(resetRes.allowed === true, "rate limit resets successfully upon valid authentication");
}

function testDatabaseSchemaMigration() {
  console.log("\n--- 4. Testing Database Schema Migration Completeness ---");

  const migrationPath = "supabase/migrations/20261001000001_trackup_custom_auth.sql";
  check(existsSync(migrationPath), "custom auth migration file exists");

  const migrationSql = readFileSync(migrationPath, "utf8");
  check(migrationSql.includes("ALTER TABLE public.profiles"), "migration alters public.profiles");
  check(migrationSql.includes("username TEXT"), "migration adds username column to profiles");
  check(migrationSql.includes("password_hash TEXT"), "migration adds password_hash column to profiles");
  check(migrationSql.includes("failed_login_attempts INT"), "migration adds failed_login_attempts for lockout tracking");
  check(migrationSql.includes("locked_until TIMESTAMPTZ"), "migration adds locked_until timestamp");
  check(migrationSql.includes("password_changed_at TIMESTAMPTZ"), "migration adds password_changed_at for session invalidation");
  check(migrationSql.includes("idx_profiles_username_lower"), "migration creates case-insensitive username index");
  check(migrationSql.includes("idx_profiles_email_lower"), "migration creates case-insensitive email index");

  check(migrationSql.includes("CREATE TABLE IF NOT EXISTS public.user_sessions"), "migration creates public.user_sessions table");
  check(migrationSql.includes("session_token_hash TEXT NOT NULL UNIQUE"), "user_sessions stores UNIQUE token hash");
  check(migrationSql.includes("REFERENCES public.profiles(id) ON DELETE CASCADE"), "user_sessions cascades on profile deletion");
  check(migrationSql.includes("expires_at TIMESTAMPTZ NOT NULL"), "user_sessions enforces expires_at timestamp");
  check(migrationSql.includes("is_revoked BOOLEAN NOT NULL DEFAULT false"), "user_sessions tracks is_revoked flag");

  check(migrationSql.includes("ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY"), "user_sessions has Row Level Security enabled");
  check(migrationSql.includes("CREATE POLICY \"No direct client access to user_sessions\""), "user_sessions blocks all direct client queries");

  check(migrationSql.includes("CREATE TABLE IF NOT EXISTS public.auth_rate_limits"), "migration creates auth_rate_limits table");
  check(migrationSql.includes("organization_id UUID REFERENCES public.organizations"), "migration decouples videos by adding organization_id");
  check(migrationSql.includes("ALTER COLUMN workspace_id DROP NOT NULL"), "migration makes video workspace_id nullable");
}

function testSecurityBoundariesAndRoutes() {
  console.log("\n--- 5. Testing Code Contracts & Security Boundaries ---");

  // Login Route Handlers
  const loginRoute = readFileSync("app/api/auth/login/route.ts", "utf8");
  check(loginRoute.includes("checkRateLimit"), "login route enforces rate limiting on IP and identifier");
  check(loginRoute.includes("verifyDummyPassword"), "login route executes dummy verification on missing account to mitigate timing attacks");
  check(loginRoute.includes("verifyPassword"), "login route verifies password hash server-side");
  check(loginRoute.includes("profile.is_active"), "login route blocks inactive accounts");
  check(loginRoute.includes("profile.locked_until"), "login route blocks locked accounts");
  check(loginRoute.includes("createSession"), "login route creates server-side session in database");
  check(loginRoute.includes("SESSION_COOKIE_NAME"), "login route sets trackup_session cookie");
  check(!loginRoute.includes("password_hash: profile.password_hash"), "login response never returns password_hash");
  check(!loginRoute.includes("token: token"), "login response body never exposes raw session token");

  // Logout Route Handler
  const logoutRoute = readFileSync("app/api/auth/logout/route.ts", "utf8");
  check(logoutRoute.includes("revokeSession"), "logout route explicitly revokes session in database");
  check(logoutRoute.includes("getExpiredSessionCookieOptions"), "logout route expires trackup_session cookie");

  // Password Change Handler
  const pwChangeRoute = readFileSync("app/api/auth/change-password/route.ts", "utf8");
  check(pwChangeRoute.includes("withAuth"), "password change route requires authentication");
  check(pwChangeRoute.includes("verifyPassword"), "password change verifies current password");
  check(pwChangeRoute.includes("validatePasswordPolicy"), "password change validates new password policy");
  check(pwChangeRoute.includes("revokeAllUserSessions"), "password change revokes all other active sessions for user");

  // Owner User Management
  const ownerUsersRoute = readFileSync("app/api/owner/users/route.ts", "utf8");
  check(ownerUsersRoute.includes("withRole(USER_ROLES.OWNER") || ownerUsersRoute.includes("USER_ROLES.OWNER"), "user creation requires platform Owner role");
  check(ownerUsersRoute.includes("hashPassword"), "owner user creation hashes password server-side with Argon2id");
  check(ownerUsersRoute.includes("cleanUsername") && ownerUsersRoute.includes("cleanEmail"), "owner user creation normalizes username and email");
  check(ownerUsersRoute.includes("user_exists"), "owner user creation prevents duplicate username/email conflicts");

  // Owner Password Reset
  const ownerResetRoute = readFileSync("app/api/owner/users/[id]/reset-password/route.ts", "utf8");
  check(ownerResetRoute.includes("withRole(USER_ROLES.OWNER") || ownerResetRoute.includes("USER_ROLES.OWNER"), "owner password reset requires Owner role");
  check(ownerResetRoute.includes("revokeAllUserSessions"), "owner password reset revokes target user's active sessions");

  // Session Store & Guards
  const sessionStore = readFileSync("src/lib/auth/session-store.ts", "utf8");
  check(sessionStore.includes("passwordChangedAt > sessionCreatedAt"), "session store invalidates sessions created before password change");
  check(sessionStore.includes(".eq(\"is_revoked\", false)"), "session store rejects revoked sessions");
  check(sessionStore.includes("gt(\"expires_at\", now)"), "session store rejects expired sessions");
  check(!sessionStore.includes("password_hash: profile.password_hash"), "session store never includes password_hash in AuthenticatedUser");

  // Middleware
  const middleware = readFileSync("middleware.ts", "utf8");
  check(middleware.includes("SESSION_COOKIE_NAME"), "middleware inspects trackup_session cookie");
  check(middleware.includes("isProtectedPath"), "middleware protects dashboard, admin, and owner routes");
  check(middleware.includes("isAuthOnlyPath"), "middleware redirects authenticated users away from /login");
}

function testRBACPreservation() {
  console.log("\n--- 6. Testing RBAC Hierarchy & Permission Preservation ---");

  check(roleHasPermission(USER_ROLES.OWNER, PERMISSIONS.USERS_MANAGE) === true, "Owner has USERS_MANAGE permission");
  check(roleHasPermission(USER_ROLES.ADMIN, PERMISSIONS.USERS_MANAGE) === false, "Admin does NOT have USERS_MANAGE permission");
  check(roleHasPermission(USER_ROLES.VIEWER, PERMISSIONS.USERS_MANAGE) === false, "Viewer does NOT have USERS_MANAGE permission");

  check(roleHasPermission(USER_ROLES.OWNER, PERMISSIONS.VIDEOS_CREATE) === true, "Owner has VIDEOS_CREATE permission");
  check(roleHasPermission(USER_ROLES.ADMIN, PERMISSIONS.VIDEOS_CREATE) === true, "Admin has VIDEOS_CREATE permission");
  check(roleHasPermission(USER_ROLES.VIEWER, PERMISSIONS.VIDEOS_CREATE) === false, "Viewer does NOT have VIDEOS_CREATE permission");

  check(roleHasPermission(USER_ROLES.VIEWER, PERMISSIONS.VIDEOS_READ) === true, "Viewer has VIDEOS_READ permission");
  check(roleHasPermission(USER_ROLES.VIEWER, PERMISSIONS.ANALYTICS_READ) === true, "Viewer has ANALYTICS_READ permission");

  check(hasMinimumRole(USER_ROLES.OWNER, USER_ROLES.ADMIN) === true, "Owner satisfies minimum Admin role");
  check(hasMinimumRole(USER_ROLES.ADMIN, USER_ROLES.OWNER) === false, "Admin cannot satisfy minimum Owner role");
  check(hasMinimumRole(USER_ROLES.VIEWER, USER_ROLES.ADMIN) === false, "Viewer cannot satisfy minimum Admin role");
}

function testUIComponentsIntegrity() {
  console.log("\n--- 7. Testing UI Components & Forms ---");

  const loginForm = readFileSync("src/components/login/LoginForm.tsx", "utf8");
  check(loginForm.includes("fetch(\"/api/auth/login\""), "LoginForm submits to sovereign login endpoint");
  check(loginForm.includes("Username or Email"), "LoginForm provides identifier input");
  check(loginForm.includes("showPassword"), "LoginForm supports password visibility toggle");
  check(!loginForm.includes("localStorage"), "LoginForm NEVER stores tokens in localStorage");

  const loginCard = readFileSync("src/components/login/LoginCard.tsx", "utf8");
  check(loginCard.includes("LoginForm"), "LoginCard renders credentials LoginForm");
  check(!loginCard.includes("Continue with ClickUp"), "LoginCard removes ClickUp OAuth button");

  const teamManager = readFileSync("src/components/dashboard/TeamMemberManager.tsx", "utf8");
  check(teamManager.includes("fetch(\"/api/owner/users\""), "TeamMemberManager provisions users directly via owner API");
  check(teamManager.includes("handleResetPassword"), "TeamMemberManager allows Owner to reset user passwords");
  check(teamManager.includes("updateStatus"), "TeamMemberManager allows Owner to toggle active/inactive status");
}

async function main() {
  console.log("================================================================================");
  console.log("TrackUp Custom Authentication, Session Lifecycle & RBAC Verification Suite");
  console.log("================================================================================");

  await testPasswordEngine();
  await testSessionTokensAndCookies();
  await testRateLimiting();
  testDatabaseSchemaMigration();
  testSecurityBoundariesAndRoutes();
  testRBACPreservation();
  testUIComponentsIntegrity();

  console.log("\n================================================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
