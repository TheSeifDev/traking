# TrackUp Custom Auth Login & Owner Seed Forensic Report

**Date**: 2026-10-01  
**Environment**: Local Next.js 16.3.0 App connected to Remote Supabase (`takexozckbnugupxnhuf.supabase.co`)  
**Status**: INVESTIGATION COMPLETE — ISSUE REPRODUCED, ROOT CAUSE ISOLATED, FIXED, AND FORENSICALLY VERIFIED

---

## 1. Root Cause

The 401 Unauthorized failure upon login and the discrepancy where the seeded username was assigned `owner` instead of `seif_tanjiro` were caused by a **missing CLI argument parser in [scripts/seed-owner.ts](file:///c:/Users/seift/Downloads/Phantoms/2nd/websites/traking/scripts/seed-owner.ts)**.

### Detailed Root Cause Breakdown
1. **Unparsed CLI Arguments**: In [scripts/seed-owner.ts](file:///c:/Users/seift/Downloads/Phantoms/2nd/websites/traking/scripts/seed-owner.ts), the execution block previously called `seedOwner()` with no arguments (`seedOwner()`). It completely ignored `process.argv`.
2. **Fallback to Hardcoded Defaults**: Because no arguments were passed into `seedOwner()`, the function defaulted to:
   - `username = "owner"`
   - `password = "TrackUpOwner2026!"`
3. **Password Hash Mismatch**: The remote profile for `seif.tanjiro@gmail.com` had its `password_hash` column updated with an Argon2id hash derived from the hardcoded default `"TrackUpOwner2026!"`, rather than the password supplied on the CLI (`YOUR_NEW_PASSWORD`).
4. **Login Rejection (401)**: When the user attempted to sign in via the browser/API using `identifier: "seif.tanjiro@gmail.com"` and `password: "YOUR_NEW_PASSWORD"`, `app/api/auth/login/route.ts` successfully retrieved the profile record, but `verifyPassword(password, profile.password_hash)` evaluated to `false`.
5. **Lockout Counter Increment**: Lines 152–175 of [app/api/auth/login/route.ts](file:///c:/Users/seift/Downloads/Phantoms/2nd/websites/traking/app/api/auth/login/route.ts) incremented `failed_login_attempts` to `4` (just one attempt short of the 5-attempt temporary lockout) and returned `401 Unauthorized` with `{ error: "invalid_credentials" }`.

---

## 2. Evidence

### A. Initial Code Inspection of `scripts/seed-owner.ts`
Prior to fix:
```typescript
if (process.argv[1]?.includes("seed-owner.ts")) {
  seedOwner() // <--- CRITICAL BUG: Zero arguments passed! process.argv was never inspected.
    .then((owner) => {
      console.log("Successfully seeded owner:", owner);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
```

### B. Hash Verification Test
Before fixing the script, a read-only script evaluated the stored hash in the database:
- `verifyPassword("TrackUpOwner2026!", storedHash)` → **`true`** [FACT]
- `verifyPassword("YOUR_NEW_PASSWORD", storedHash)` → **`false`** [FACT]

This proved definitively that the stored password hash belonged to the hardcoded default password, not the user's CLI argument.

---

## 3. Seed Script Argument Behavior

### Before Fix
- Execution of `npx tsx scripts/seed-owner.ts --email="seif.tanjiro@gmail.com" --username="seif_tanjiro" --password="YOUR_NEW_PASSWORD"` discarded all three arguments.
- It defaulted to:
  - `email`: `"owner@trackup.dev"` (or `process.env.TRACKUP_OWNER_EMAIL`)
  - `username`: `"owner"`
  - `password`: `"TrackUpOwner2026!"`
- Because `process.env.TRACKUP_OWNER_EMAIL` in `.env.local` was set to `seif.tanjiro@gmail.com`, the email appeared correct, but username became `"owner"` and the password became the default string.

### After Fix
A robust CLI argument parser was implemented in [scripts/seed-owner.ts](file:///c:/Users/seift/Downloads/Phantoms/2nd/websites/traking/scripts/seed-owner.ts):
- Supports `--email=value`, `--email value`
- Supports `--username=value`, `--username value`
- Supports `--password=value`, `--password value`
- Automatically strips outer enclosing quotes (`"..."`, `'...'`)
- Validates password against `validatePasswordPolicy` before attempting hashing or database mutation
- Safely reports the resulting account metadata without printing secrets or hashes:
```json
{
  "id": "4dcace12-b9a4-4042-8eaa-896b0e581a6b",
  "username": "seif_tanjiro",
  "email": "seif.tanjiro@gmail.com",
  "role": "owner"
}
```

---

## 4. Database Verification

Using read-only queries against the live database, the profile row for `seif.tanjiro@gmail.com` was inspected:

| Attribute | Verified Value |
|---|---|
| **id** | `4dcace12-b9a4-4042-8eaa-896b0e581a6b` (Original profile preserved; no duplicate created) |
| **username** | `seif_tanjiro` |
| **email** | `seif.tanjiro@gmail.com` |
| **role** | `owner` |
| **is_active** | `true` |
| **failed_login_attempts** | `0` (Reset from 4 upon successful seed/login) |
| **locked_until** | `null` |
| **has_password_hash** | `true` |
| **hash_algorithm_prefix** | `$argon2id$` |
| **created_at** | `2026-08-22T11:22:50.792201+00:00` |
| **updated_at** | `2026-10-01T14:18:53.710675+00:00` |

*(Note: In accordance with security constraints, no plaintext password or raw password hash was exposed).*

---

## 5. Environment & Project Verification

- **Seed Script Database Connection**:
  - Config: Loads `.env.local` using `dotenv`.
  - Endpoint: `takexozckbnugupxnhuf.supabase.co` via `createAdminClient()`.
- **Next.js Application Database Connection**:
  - Config: Loads `.env.local` in Next.js runtime.
  - Endpoint: `takexozckbnugupxnhuf.supabase.co` via `createAdminClient()`.
- **Verdict**: **`seed script DB == local Next.js app DB` [FACT]**. Both connect to the exact same remote Supabase project.

---

## 6. Login Route Audit

We traced the execution flow of [app/api/auth/login/route.ts](file:///c:/Users/seift/Downloads/Phantoms/2nd/websites/traking/app/api/auth/login/route.ts):

```
LoginForm (submits identifier & password)
  ↓
POST /api/auth/login
  ↓
Credential parsing:
  - identifier = "seif.tanjiro@gmail.com" -> cleanIdentifier = "seif.tanjiro@gmail.com"
  - password present and non-empty
  ↓
IP & User Rate Limiter:
  - Both rate limit buckets within limits
  ↓
Profile Lookup:
  - .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier}`)
  - Profile found (id: 4dcace12-b9a4-4042-8eaa-896b0e581a6b)
  ↓
Account State Checks:
  - profile.is_active === true (PASSED)
  - profile.locked_until === null (PASSED)
  ↓
Password Verification:
  - verifyPassword(password, profile.password_hash)
  - BEFORE FIX: Evaluated to FALSE because the hash was generated from "TrackUpOwner2026!".
    Branch executed: lines 152–175.
    failed_login_attempts incremented to 4.
    Returned 401 Unauthorized { error: "invalid_credentials" }.
  - AFTER FIX: Evaluated to TRUE.
  ↓
Successful Login Handling:
  - failed_login_attempts reset to 0.
  - locked_until set to null.
  - last_login_at updated to nowIso.
  - createSession(profile.id) generates cryptographically secure token & inserts SHA-256 hash to public.user_sessions.
  - Response sets HttpOnly, Secure, SameSite=Lax trackup_session cookie.
  - Returns 200 OK with sanitized AuthenticatedUser metadata (no hashes or tokens exposed).
```

---

## 7. Exact Code Changes

### [scripts/seed-owner.ts](file:///c:/Users/seift/Downloads/Phantoms/2nd/websites/traking/scripts/seed-owner.ts)

1. **Added `parseArgs()` Function**:
   Parses `--email`, `--username`, and `--password` flags supporting both `--key=value` and `--key value` formats, and cleans wrapping quotes.
2. **Added Password Policy Validation**:
   Calls `validatePasswordPolicy(password, username, email)` before hashing.
3. **Smart Profile Lookup**:
   Looks up the existing profile first by email, then fallback by username.
4. **Targeted In-Place Update**:
   Updates the existing profile (preserving primary key ID `4dcace12-b9a4-4042-8eaa-896b0e581a6b`), resetting `failed_login_attempts: 0` and `locked_until: null`, preserving `role: 'owner'` and setting `is_active: true`.
5. **Main Execution Block**:
   ```typescript
   if (process.argv[1]?.includes("seed-owner")) {
     const cliOptions = parseArgs();
     seedOwner(cliOptions)
       .then((owner) => {
         console.log("Successfully seeded owner account:", {
           id: owner.id,
           username: owner.username,
           email: owner.email,
           role: owner.role,
         });
         process.exit(0);
       })
       ...
   ```

---

## 8. Tests Executed & Real Local Verification

### A. Real Local HTTP End-to-End Test (`scripts/test-real-login.ts`)
Executed against the running local Next.js server (`http://localhost:3000`):
1. **Login via Email (`seif.tanjiro@gmail.com`)**:
   - Status: `200 OK`
   - User returned: `{ id: '4dcace12-b9a4-4042-8eaa-896b0e581a6b', username: 'seif_tanjiro', email: 'seif.tanjiro@gmail.com', role: 'owner', is_active: true }`
   - `set-cookie`: `trackup_session` issued (HttpOnly, SameSite=Lax, Path=/, Max-Age=604800).
2. **Dashboard Access**:
   - `GET /dashboard` with `trackup_session` cookie returned `200 OK` (Server-side rendering completed with owner permissions).
3. **Login via Username (`seif_tanjiro`)**:
   - Status: `200 OK`
   - User returned: `{ id: '4dcace12-b9a4-4042-8eaa-896b0e581a6b', username: 'seif_tanjiro', email: 'seif.tanjiro@gmail.com', role: 'owner' }`.
4. **Logout Execution**:
   - `POST /api/auth/logout` with session cookie returned `200 OK`.
   - Cookie expired via `trackup_session=; Max-Age=0`.
   - Record in `public.user_sessions` marked `is_revoked = true`.
5. **Access After Logout (Revocation Check)**:
   - `GET /dashboard` with revoked session cookie returned `307 Temporary Redirect` to `/login?error=unauthenticated`.
6. **Re-Login After Logout**:
   - `POST /api/auth/login` returned `200 OK` with a new valid active session.

### B. Static Analysis & Verification Suites
1. **TypeScript Typecheck**:
   - Command: `npm run typecheck` (`tsc --noEmit`)
   - Result: `0 errors` (Exit code 0).
2. **ESLint**:
   - Command: `npm run lint` (`eslint`)
   - Result: `0 errors` (Exit code 0).
3. **Custom Auth Suite**:
   - Command: `npx tsx scripts/verify-custom-auth.ts`
   - Result: `95 passed, 0 failed` (Exit code 0).
4. **Full Test Suite (13 Verification Suites)**:
   - Command: `npm test`
   - Result: All 13 suites passed (`verify-provisioning`, `verify-rbac`, `verify-role-management`, `verify-routes`, `verify-security-hardening`, `verify-invitations`, `verify-analytics`, `verify-owner-observability`, `verify-spaces`, `verify-role-visibility-fixes`, `verify-health`, `verify-creation-flow`, `verify-custom-auth`).
5. **Production Build**:
   - Command: `npm run build` (`next build`)
   - Result: Compiled all 53 routes successfully in 3.3s; Turbopack & TypeScript verified (Exit code 0).

---

## 9. Remaining Risks

1. **User Lockout Policy**:
   - Users entering wrong passwords 5 times within 15 minutes will be locked out for 15 minutes (`locked_until`). The Owner seed script automatically resets lockout state, which is safe for administrative resets.
2. **Password Policy Enforcement**:
   - Passwords must be at least 10 characters long, contain uppercase, lowercase, numbers, and symbols, and cannot contain the username or email local-part. The seed script now enforces this explicitly and will refuse non-compliant passwords with informative errors before touching the database.

---

## FINAL STATUS

| Check | Status | Evidence |
|---|---|---|
| **Seed argument handling** | **PASS** | CLI flags `--email`, `--username`, `--password` correctly parsed and honored |
| **Correct owner row** | **PASS** | Profile updated in place (ID: `4dcace12...`), username `seif_tanjiro`, no duplicate rows |
| **Password verification** | **PASS** | Stored Argon2id hash verifies against custom password and rejects wrong password |
| **Login endpoint** | **PASS** | `POST /api/auth/login` returns 200 OK for both email and username identifiers |
| **Session creation** | **PASS** | Session record persisted in `public.user_sessions`, `trackup_session` cookie issued |
| **Logout** | **PASS** | `POST /api/auth/logout` revokes session in DB, expires cookie, rejects subsequent requests |
| **RBAC** | **PASS** | Owner role preserved; all 95 custom auth & RBAC contracts verified |
| **Build** | **PASS** | `npm run build` completed with code 0 across all 53 routes |
