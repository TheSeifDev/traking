# TrackUp Custom Auth & ClickUp Decoupling: Forensic Architecture Audit

**Target File:** `TRACKUP_CUSTOM_AUTH_MIGRATION_AUDIT.md`  
**Execution Context:** Repository Root (`c:\Users\seift\Downloads\Phantoms\2nd\websites\traking`)  
**Audit Scope:** Entire repository (Authentication, Session Management, RBAC, Database Schema, API Routes, Pages, Components, Observability, Analytics, Tests, Build Configurations)  
**Status:** Read-Only Audit & Forensic Blueprint (No application logic modified)

---

## 1. Executive Summary

TrackUp is undergoing a foundational transition from a ClickUp-dependent companion tool to a fully sovereign, enterprise-grade video intelligence product. Currently, ClickUp is embedded not merely as an optional integration, but as the **exclusive authentication identity provider**, the **tenant boundary (`workspaces` table)**, the **space hierarchy driver**, and the **user roster authority**.

This audit provides an exhaustive forensic map of every ClickUp dependency in the codebase and defines the precise technical blueprint for introducing **Custom Authentication**:
- **Independent Identity**: Every user exists natively in TrackUp's database before they can authenticate.
- **Mandatory User Attributes**: `id`, `username` (unique), `email` (unique), `password_hash`, `role` (`owner`, `admin`, `viewer`), and `is_active` (boolean).
- **Zero Public Registration**: No self-signup mechanism, open registration endpoint, or self-service account creation will exist.
- **Strict Owner-Only Provisioning**: Only an authorized user holding the `owner` role can create new users.
- **Strict RBAC Preservation**: The established three-tier RBAC (`owner`, `admin`, `viewer`) and all associated permission maps (`ROLE_PERMISSIONS`), guards, and API wrappers remain 100% intact.
- **Complete ClickUp Elimination**: Permanent deprecation and subsequent deletion of ClickUp OAuth endpoints, ClickUp API client modules, synchronization background routines, ClickUp database tables/columns, task-linking mechanisms, and all ClickUp-centric UI copy and graphics.

---

## 2. Current Authentication Architecture

### 2.1 The Current ClickUp OAuth 2.0 Flow
The existing authentication cycle is hard-wired to ClickUp:
1. **Initiation (`/api/auth/clickup/route.ts`)**:
   - The user visits `/login` and clicks "Continue with ClickUp".
   - The client navigates to `/api/auth/clickup`, which reads `CLICKUP_CLIENT_ID` (or legacy `CLIENT_ID`) and `CLICKUP_REDIRECT_URI`.
   - Generates a cryptographically random `trackup_oauth_state` (UUIDv4) and stores it in an HTTP-only cookie.
   - Saves a sanitized `trackup_auth_return` cookie (defaulting to `/dashboard`).
   - Issues a `307/302` redirect to `https://app.clickup.com/api?client_id=...&redirect_uri=...&state=...`.
2. **Callback Handling (`/api/auth/clickup/callback/route.ts`)**:
   - ClickUp redirects back with `?code=...&state=...`.
   - The route validates `state` against the `trackup_oauth_state` cookie.
   - Exchanges `code` for an access token via `POST https://api.clickup.com/api/v2/oauth/token`.
   - Parallelizes two HTTP calls to ClickUp API:
     - `GET https://api.clickup.com/api/v2/team` (fetches authorized ClickUp workspaces/teams).
     - `GET https://api.clickup.com/api/v2/user` (fetches ClickUp user identity: `id`, `email`, `username`).
   - Executes provisioning logic via `provisionClickUpUser()` in `src/lib/auth/provisioning.ts` (or `acceptInvitationForClickUpUser()` if accepting an invite).
   - Persists workspace access tokens in `public.clickup_connections` via `upsertClickUpConnections()`.
   - Triggers Space/Team roster sync via `syncClickUpAuthorizedTeams()` in `src/lib/clickup/sync.ts`.
   - Mints a signed session cookie `trackup_user` and redirects to the target destination.

### 2.2 Session Management & Cryptographic Signing
- **Session Cookie (`trackup_user`)**:
  - Implemented in `src/lib/auth/session-cookie.ts`.
  - Encoded format: `<base64url(payload)>.<base64url(hmac_signature)>`.
  - Signature: HMAC-SHA256 computed using Web Crypto API (`crypto.subtle`) keyed by `process.env.TRACKUP_SESSION_SECRET` (minimum 32 characters).
  - Lifetime: 7 days (`SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7`).
  - Current Payload:
    ```typescript
    type CookiePayload = {
      id: string; // UUID of public.profiles row
      email: string;
      role: UserRole; // 'owner' | 'admin' | 'viewer'
      is_active: boolean;
      name: string | null;
      clickup_user_id: string | null;
      exp: number; // UNIX timestamp in seconds
    };
    ```

### 2.3 Fast-Path vs. Database-Backed Verification
TrackUp enforces a two-tier defense model:
1. **Middleware Fast-Path (`middleware.ts`)**:
   - Intercepts all requests matching `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)`.
   - Validates the HMAC signature and timestamp of `trackup_user` via `verifySignedSessionCookie()`.
   - Bounces unauthenticated requests attempting to access protected prefixes (`/dashboard`, `/videos`, `/analytics`, `/profile`, `/admin`, `/owner`) to `/login?redirect=...`.
   - Enforces preliminary route-prefix RBAC (e.g. non-owners accessing `/owner/*` or `/admin/users` are redirected to `/dashboard?error=forbidden`).
   - Performs no database queries to ensure edge latency remains sub-millisecond.
2. **Server-Side Authorization (`src/lib/auth/guards.ts` & `src/lib/auth/api-handler.ts`)**:
   - Server Components invoke `guardAuth()`, `guardAdmin()`, or `guardOwner()`.
   - Route Handlers wrap endpoints with `withAuth()`, `withRole()`, `withPermission()`, or `withDashboardAuth()`.
   - These delegate to `requireAuth()` (`src/lib/auth/session.ts`), which unpacks the cookie `id`, queries `public.profiles` via the Supabase service-role client (`createAdminClient()`), and verifies that the account is active (`is_active = true`) and that the live database role satisfies the required permission level. Client cookies are **never** trusted for final authorization.

### 2.4 Logout Architecture (`app/api/auth/logout/route.ts`)
- The logout endpoint deletes the `trackup_user` cookie and redirects to `/login`.
- However, stale ClickUp access tokens stored in `public.clickup_connections` remain in the database indefinitely.

---

## 3. Current ClickUp Dependency Graph

The diagram below traces how ClickUp identity and workspace IDs permeate the entire architecture:

```
[ ClickUp OAuth Service (api.clickup.com) ]
         |
         v
[ app/api/auth/clickup/callback/route.ts ]
   |                  |                   |
   |                  v                   v
   |       [ upsertClickUpConnections ] [ syncClickUpAuthorizedTeams ]
   |                  |                           |
   v                  v                           v
[ profiles ]   [ workspaces ]              [ spaces ]
(clickup_user_id) (clickup_team_id)          (clickup_space_id)
   |                  |                           |
   +------------------+                           |
   |                  |                           |
   v                  v                           v
[ session ]    [ videos ] <-----------------------+
(clickup_user) (workspace_id: FK)           (space_id: FK)
                      |
                      v
             [ video_clickup_tasks ]
             (clickup_task_id)
```

### Direct ClickUp API Calls:
1. `POST https://api.clickup.com/api/v2/oauth/token` (`app/api/auth/clickup/callback/route.ts:101`)
2. `GET https://api.clickup.com/api/v2/team` (`app/api/auth/clickup/callback/route.ts:116`, `src/lib/clickup/client.ts:48,149`)
3. `GET https://api.clickup.com/api/v2/user` (`app/api/auth/clickup/callback/route.ts:117`)
4. `GET https://api.clickup.com/api/v2/team/{team_id}/space?archived=false` (`src/lib/clickup/client.ts:77`)
5. `GET https://api.clickup.com/api/v2/team/{team_id}/task?...` (`src/lib/clickup/client.ts:119`)

---

## 4. Authentication Dependency Graph

```
Incoming HTTP Request
        │
        ▼
[ middleware.ts ] ──► reads 'trackup_user' cookie ──► verifySignedSessionCookie()
        │                                                     │
   (Valid HMAC?)                                        [ Web Crypto HMAC-SHA256 ]
   ┌────┴────────────────────────┐
   ▼                             ▼
[ Public Route ]          [ Protected Route ]
(e.g., /watch/*, /login)         │
                                 ▼
                     [ Page / Route Guard ]
                     - guardAuth() / guardOwner()
                     - withAuth() / withRole()
                                 │
                                 ▼
                     [ src/lib/auth/session.ts ]
                     requireAuth() ──► createAdminClient()
                                             │
                                             ▼
                                     [ Supabase DB ]
                                     SELECT * FROM profiles WHERE id = session.id
                                     - Verify is_active = true
                                     - Verify live role matches requirement
```

---

## 5. Database Dependency Analysis

### 5.1 Entities Whose Existence is Caused Solely by ClickUp (Target: DROP / REMOVE)

| Entity Name | Type | Original Purpose | Migration Action |
|---|---|---|---|
| `public.clickup_connections` | Table | Stores OAuth access tokens mapped to `profile_id` and `workspace_id`. | **DROP TABLE** |
| `public.video_clickup_tasks` | Table | Stores mappings between TrackUp videos and ClickUp task IDs. | **DROP TABLE** |
| `public.workspaces` | Table | MVP surrogate for ClickUp teams (`clickup_team_id`). | **REFACTOR / DECOUPLE** (See Section 5.3) |
| `profiles.clickup_user_id` | Column | Stores ClickUp numerical user ID as text. | **DROP COLUMN** |
| `organizations.clickup_workspace_id` | Column | Foreign key linking organization to ClickUp workspace row. | **DROP COLUMN** |
| `organizations.clickup_sync_status` | Column | Sync status enum (`never`, `running`, `success`, `partial`, `failed`). | **DROP COLUMN** |
| `organizations.clickup_last_synced_at`| Column | Timestamp of last ClickUp synchronization run. | **DROP COLUMN** |
| `organizations.clickup_sync_error` | Column | Error message from ClickUp API sync failures. | **DROP COLUMN** |
| `spaces.clickup_workspace_id` | Column | Legacy foreign key to `workspaces`. | **DROP COLUMN** |
| `spaces.clickup_space_id` | Column | ClickUp Space identifier string. | **DROP COLUMN** |
| `spaces.clickup_sync_status` | Column | Sync status enum for child space. | **DROP COLUMN** |
| `spaces.clickup_last_synced_at` | Column | Timestamp of last child space sync. | **DROP COLUMN** |
| `spaces.clickup_sync_error` | Column | Error text from child space sync. | **DROP COLUMN** |
| `space_members.source` | Column | Flag indicating if member was added via `'manual'` or `'clickup'`. | **DROP COLUMN** |
| `space_members.clickup_user_id` | Column | ClickUp ID of space member. | **DROP COLUMN** |
| `space_members.last_synced_at` | Column | Timestamp member was verified via ClickUp roster. | **DROP COLUMN** |

### 5.2 Core Entities to Retain in the Sovereign TrackUp Product

| Entity Name | Purpose in Sovereign Product |
|---|---|
| `public.profiles` | Sovereign user identities (augmented with `username` and `password_hash`). |
| `public.role_change_audit` | Immutable audit log recording every role transition and actor ID. |
| `public.organizations` | Sovereign top-level tenant boundaries created and managed by Owners. |
| `public.organization_members` | Sovereign user memberships and organization-level roles (`admin`, `member`). |
| `public.spaces` | Multi-tenant project/team boundaries within organizations. |
| `public.space_members` | Sovereign space memberships and space-level roles (`admin`, `member`). |
| `public.videos` | Video metadata, provider embed URLs, and durations. |
| `public.watch_links` | Private, revocable access tokens for video viewing. |
| `public.watch_sessions` | Granular viewing sessions with device/browser telemetry and capability tokens. |
| `public.watch_events` | Second-by-second playback telemetry (play, pause, seek, progress, rate changes). |
| `public.viewer_identities` | Normalized viewer profile records. |
| `public.owner_logs` | Centralized platform audit and diagnostic event logs. |
| `public.cron_executions` | Execution proofs and health status records for system background tasks. |

### 5.3 The `videos.workspace_id` Architectural Entanglement
**Critical Forensic Finding**: In the initial MVP migration (`20260822000001_mvp_core_product_tables.sql`), `public.videos` was created with:
```sql
workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
```
When `organizations` and `spaces` were introduced later, `videos.space_id` was added as an optional foreign key (`REFERENCES public.spaces(id)`). Consequently, every video mutation today (`createVideo`) still requires a `workspaceId` originating from the ClickUp workspace connection.

**Decoupling Solution**:
1. Add `organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE` to `public.videos`.
2. Populate `videos.organization_id` using `spaces.organization_id` for all existing videos.
3. Make `videos.workspace_id` nullable, and subsequently drop the foreign key constraint to `public.workspaces`.
4. Update `createVideo()` and `listVideos()` to scope by `organization_id` and `space_id` directly, completely bypassing the legacy `workspaces` table.

---

## 6. Route/API Dependency Analysis

### 6.1 Routes to DELETE
- `app/api/auth/clickup/route.ts`: Starts OAuth flow.
- `app/api/auth/clickup/callback/route.ts`: Processes OAuth callback.
- `app/api/clickup/tasks/route.ts`: Queries ClickUp tasks API.
- `app/api/clickup/tasks/[taskId]/route.ts`: Links ClickUp tasks to videos.
- `app/api/owner/clickup/sync/route.ts`: Manual ClickUp hierarchy sync.
- `app/api/spaces/[spaceId]/sync-clickup/route.ts`: Space-level ClickUp sync.
- `app/api/invitations/start/route.ts`: Starts ClickUp OAuth for invitees.

### 6.2 Routes to CREATE
- `app/api/auth/login/route.ts`: Custom credentials authentication endpoint. Accepts `{ identifier, password }` (where identifier can be either username or email), validates credentials against `profiles.password_hash`, checks `is_active`, and issues the signed `trackup_user` session cookie.
- `app/api/owner/users/route.ts`: Owner-only user provisioning endpoint. Enforces `role === "owner"`. Accepts `{ username, email, password, role }`. Validates that username and email are unique, hashes password, and creates the profile.

### 6.3 Routes to MODIFY
- `app/api/auth/logout/route.ts`: Clean up cookie deletion to ensure only TrackUp session cookies are cleared.
- `app/api/videos/route.ts`: Remove `resolveMutationScopeForUser` dependency on `clickup_workspace_id`; allow direct video creation under valid Organization/Space IDs.
- `app/api/videos/[id]/route.ts`: Remove `video_clickup_tasks` join from video queries.
- `app/api/spaces/route.ts`: Remove ClickUp workspace validation on Space creation.
- `app/api/spaces/[spaceId]/route.ts`: Remove ClickUp mapping fields.
- `app/api/organizations/route.ts`: Remove ClickUp workspace link requirements.
- `app/api/owner/control-room/route.ts`: Remove ClickUp sync health indicators and ClickUp sync metrics.
- `app/api/admin/users/route.ts`: Re-route user creation to use sovereign provisioning instead of sending ClickUp-bound invitations.

### 6.4 Routes that Operate Independently After Custom Auth
- `app/api/auth/presence/route.ts` (Last-seen touch)
- `app/api/videos/[id]/analytics/route.ts` (Session & viewer rollups)
- `app/api/videos/[id]/watch-link/route.ts` (Watch link creation/revocation)
- `app/api/tracking/session/route.ts` (Tracking session capability creation)
- `app/api/tracking/event/route.ts` (Telemetry event ingestion)
- `app/api/tracking/session/[sessionId]/end/route.ts` (Session lifecycle finalization)
- `app/api/tracking/provider-error/route.ts` (Player error telemetry)
- `app/api/health/db/route.ts` (Database probe & cron observability)
- `app/api/owner/observability/*` (Logs, systems, overview)
- `app/api/owner/users/[id]/role/route.ts` (Owner role transitions)
- `app/api/owner/users/[id]/status/route.ts` (Owner active/inactive toggles)
- `app/watch/[token]/page.tsx` (Internal secure video player)

---

## 7. Component Dependency Analysis

### 7.1 Components to DELETE
- `src/components/login/ClickUpLogo.tsx`: ClickUp SVG logo.
- `src/components/login/IntegrationVisual.tsx`: Graphic depicting ClickUp-to-TrackUp integration.

### 7.2 Components to REFACTOR / REDESIGN
- `src/components/login/LoginCard.tsx`:
  - **Current**: Features ClickUp logo, "Continue with ClickUp" OAuth anchor tag, and ClickUp-specific bullet points ("We never store your ClickUp password").
  - **Target**: High-aesthetic username/email and password credential form with loading state, validation feedback, and clear error banners.
- `src/components/login/LoginHero.tsx`:
  - **Current**: Headline "Connect with ClickUp to Get Started", copy referencing ClickUp workspace connections.
  - **Target**: Sovereign TrackUp authentication headline ("Sign In to TrackUp Video Intelligence"), platform feature highlights.
- `src/components/login/login-content.ts`:
  - **Current**: Contains `LOGIN_STEPS` describing ClickUp OAuth redirection.
  - **Target**: Platform security guarantees (Zero Third-Party Tracking, Encrypted Telemetry, RBAC Protection).
- `src/components/navigation/Nav.tsx` & `MobileNav.tsx`:
  - **Current**: "Continue with ClickUp" button linking to `/login`.
  - **Target**: Clean "Sign In" button linking to `/login`.
- `src/components/spaces/SpacesDirectory.tsx`:
  - **Current**: Shows "ClickUp link: Connected / Not linked" badge; form notes "ClickUp linking can be added from Space settings".
  - **Target**: Remove all ClickUp link indicators and text.
- `src/components/spaces/SpaceMembersManager.tsx`:
  - **Current**: Contains "Sync ClickUp" button and displays `ClickUp {id}` badges next to member names.
  - **Target**: Remove sync button and ClickUp ID tags.
- `src/components/spaces/SpaceDashboard.tsx`:
  - **Current**: Renders `DisconnectedState` warning when `clickup_workspace_id` is null ("This Space has no optional ClickUp Workspace link").
  - **Target**: Remove `DisconnectedState` entirely; render video and telemetry cards directly.
- `src/components/organizations/OrganizationsDirectory.tsx`:
  - **Current**: Displays "ClickUp relationship: Linked / Optional".
  - **Target**: Clean organization cards without ClickUp status.
- `src/components/organizations/OrganizationDashboard.tsx`:
  - **Current**: Shows summary card "ClickUp: Linked / Optional".
  - **Target**: Remove ClickUp summary card.
- `src/components/organizations/OrganizationMembersManager.tsx`:
  - **Current**: Displays `ClickUp {candidate.clickup_user_id}` in search results.
  - **Target**: Search and filter by username, name, and email only.
- `src/components/owner/OwnerControlRoomPanel.tsx`:
  - **Current**: Contains "ClickUp hierarchy" panel with "Preview sync" and "Apply sync" buttons, ClickUp sync health pills, and ClickUp ID columns in tables.
  - **Target**: Purge sync panel and columns; keep core telemetry metrics (Sessions, Views, Watch Time, Completion).
- `src/components/dashboard/WatchLinksManager.tsx`:
  - **Current**: Renders `<EmptyState title="Connect a ClickUp workspace" ... />` when `hasWorkspace` is false.
  - **Target**: Remove workspace connection requirement; allow link generation whenever videos exist.
- `app/watch/[token]/page.tsx`:
  - **Current**: Unauthenticated state displays "This TrackUp viewer requires an active ClickUp-connected account" with a "Continue with ClickUp" button.
  - **Target**: Display "Sign In to Watch This Video" with a direct link to the custom credentials login page.
- `app/(dashboard)/settings/page.tsx`:
  - **Current**: Section "Space & ClickUp connection" displaying ClickUp Team ID and a "Connect ClickUp" CTA.
  - **Target**: Redesign to focus on sovereign Space settings, member roster, and security parameters.
- `app/(public)/integrations/page.tsx` & `src/components/integrations/FeaturedIntegration.tsx`:
  - **Current**: Features ClickUp as the central, prominent integration.
  - **Target**: Repurpose to feature supported video media providers (YouTube, Vimeo, Google Drive, Telegram, Direct URL).

---

## 8. RBAC Preservation Analysis

The TrackUp authorization engine is governed by strict, hierarchical RBAC rules that must remain completely intact throughout and after the migration:

### 8.1 Roles and Hierarchy
Defined in `src/types/auth.ts` and `src/lib/auth/rbac.ts`:
```
owner (3)  >  admin (2)  >  viewer (1)
```

### 8.2 Permission Matrix (`ROLE_PERMISSIONS`)
| Permission | Viewer | Admin | Owner |
|---|:---:|:---:|:---:|
| `users.read` | ❌ | ❌ | ✅ |
| `users.manage` | ❌ | ❌ | ✅ |
| `videos.read` | ✅ | ✅ | ✅ |
| `videos.create` | ❌ | ✅ | ✅ |
| `videos.update` | ❌ | ✅ | ✅ |
| `videos.delete` | ❌ | ✅ | ✅ |
| `analytics.read` | ✅ | ✅ | ✅ |
| `admins.manage` | ❌ | ❌ | ✅ |
| `settings.manage` | ❌ | ❌ | ✅ |
| `system.manage` | ❌ | ❌ | ✅ |

### 8.3 Preservation of Role Invariants
1. **Owner Immutability**:
   - The owner role cannot be assigned through standard role management.
   - An owner cannot be demoted, deactivated, or deleted by any API route or Server Action (`src/lib/auth/role-management.ts:156,256`).
   - Self-modification of roles or active status remains blocked (`role-management.ts:137,234`).
2. **Owner-Only User Provisioning**:
   - In the new custom auth system, user creation is gated strictly on `isOwner(user.role)` / `PERMISSIONS.USERS_MANAGE`.
   - Admins can manage videos and view analytics, but **cannot** create users.
   - Viewers remain strictly read-only for videos and scoped analytics.
3. **Database-Backed Enforcement**:
   - All authorization checks verify the live database row via `requireAuth()` (`src/lib/auth/session.ts`).
   - Tampered or client-manipulated session cookies fail HMAC verification in middleware and fail database lookups in guards.

---

## 9. ClickUp Removal Inventory

| Module / Artifact | Path | Verdict | Rationale & Replacement Plan |
|---|---|:---:|---|
| OAuth Start Route | `app/api/auth/clickup/route.ts` | **DELETE** | ClickUp OAuth entry point. Not used in custom auth. |
| OAuth Callback Route | `app/api/auth/clickup/callback/route.ts` | **DELETE** | Handles ClickUp token exchange and roster sync. Replaced by `app/api/auth/login/route.ts`. |
| ClickUp Tasks Route | `app/api/clickup/tasks/route.ts` | **DELETE** | Searches tasks in ClickUp team. ClickUp integration is being removed. |
| ClickUp Task Detail Route | `app/api/clickup/tasks/[taskId]/route.ts` | **DELETE** | Associates video with ClickUp task. Replaced by native TrackUp metadata if needed. |
| Owner Sync Route | `app/api/owner/clickup/sync/route.ts` | **DELETE** | Manual sync trigger for ClickUp workspaces. Deprecated. |
| Space Sync Route | `app/api/spaces/[spaceId]/sync-clickup/route.ts`| **DELETE** | Space-level ClickUp sync. Deprecated. |
| Invitation Start Route | `app/api/invitations/start/route.ts` | **DELETE** | Sets invitation cookie and redirects to ClickUp OAuth. |
| ClickUp API Client | `src/lib/clickup/client.ts` | **DELETE** | Low-level fetch wrappers calling `api.clickup.com`. |
| ClickUp Sync Engine | `src/lib/clickup/sync.ts` | **DELETE** | 260 lines of logic syncing teams, spaces, and members from ClickUp. |
| ClickUp Workspace Lib | `src/lib/clickup/workspace.ts` | **DELETE** | Persists tokens to `clickup_connections`. |
| ClickUp Logo Component | `src/components/login/ClickUpLogo.tsx` | **DELETE** | Proprietary SVG logo of ClickUp. |
| Integration Visual | `src/components/login/IntegrationVisual.tsx` | **DELETE** | Visual graphic connecting TrackUp to ClickUp. |
| OAuth Callback Test | `scripts/forensic-oauth-callback.ts` | **DELETE** | Mocks ClickUp OAuth callback flow. |
| Next.js OAuth Rewrite | `next.config.ts` (lines 68-73) | **REFACTOR** | Delete rewrite mapping `/auth/clickup` to `/api/auth/clickup`. |
| Next.js CSP Policy | `next.config.ts` (line 39) | **REFACTOR** | Remove `https://api.clickup.com` from `connect-src`. |
| App URL OAuth Helpers | `src/lib/app-url.ts` | **REFACTOR** | Remove `getClickUpRedirectUri`, `DEVELOPMENT_CLICKUP_REDIRECT_URI`, `PRODUCTION_CLICKUP_REDIRECT_URI`. |
| User Provisioning Lib | `src/lib/auth/provisioning.ts` | **REPLACE** | Replace `provisionClickUpUser()` with sovereign owner provisioning `createTrackUpUser()`. |
| Login Page | `app/(auth)/login/page.tsx` | **REFACTOR** | Replace OAuth redirect link with credential form. |
| Login Card | `src/components/login/LoginCard.tsx` | **REPLACE** | Replace ClickUp OAuth button with Username/Password form. |
| Login Hero | `src/components/login/LoginHero.tsx` | **REFACTOR** | Update copy to remove all ClickUp branding. |
| Login Content Config | `src/components/login/login-content.ts` | **REFACTOR** | Update features and step descriptions to sovereign product benefits. |
| Space Access Resolver | `src/lib/spaces/access.ts` | **REFACTOR** | Remove `clickup_workspace_id` validation from `resolveMutationScopeForUser()`. |
| Space Data Scope | `src/lib/spaces/data-scope.ts` | **REFACTOR** | Remove requirement for `clickup_workspace_id` to build valid video data scope. |
| Video Domain Service | `src/lib/videos/service.ts` | **REFACTOR** | Remove `associateClickUpTask()`, decouple queries from `workspace_id`. |
| Observability Control Room | `src/lib/observability/control-room.ts` | **REFACTOR** | Remove `clickup_sync_health`, sync status enums, and sync error aggregation. |
| Settings Page | `app/(dashboard)/settings/page.tsx` | **REFACTOR** | Remove ClickUp connection panels and reconnect CTAs. |
| Space Dashboard | `src/components/spaces/SpaceDashboard.tsx` | **REFACTOR** | Remove `DisconnectedState` warning component. |
| Owner Control Room UI | `src/components/owner/OwnerControlRoomPanel.tsx` | **REFACTOR** | Remove ClickUp hierarchy preview/apply buttons and ClickUp ID table columns. |
| Public Navbars | `src/components/navigation/Nav.tsx`, `MobileNav.tsx`| **REFACTOR** | Change "Continue with ClickUp" CTA to "Sign In". |
| Public Integrations Page | `app/(public)/integrations/page.tsx` | **REFACTOR** | Remove ClickUp as featured integration; focus on video media providers. |

---

## 10. Custom Auth Required Components

To achieve complete independence, the following core software components must be implemented:

### 10.1 Cryptographic Password Engine (`src/lib/auth/password.ts`)
- Modern, timing-safe password hashing.
- Implementation choice: Use Node.js built-in `node:crypto.scrypt` (or standard `bcryptjs` / `@node-rs/argon2`).
- Contract:
  ```typescript
  export async function hashPassword(plainText: string): Promise<string>;
  export async function verifyPassword(plainText: string, storedHash: string): Promise<boolean>;
  ```
- Salting: Generates a cryptographically secure 16-byte random salt per password.
- Timing-attack defense: Uses `crypto.timingSafeEqual` during hash comparison.

### 10.2 Sovereign User Provisioning Engine (`src/lib/auth/user-creation.ts` or in `provisioning.ts`)
- Enforces user creation requirements:
  - Caller must hold `USER_ROLES.OWNER`.
  - `username`: 3-30 characters, alphanumeric and hyphens/underscores only, lowercase normalized, unique.
  - `email`: RFC 5322 compliant, lowercase normalized, unique.
  - `password`: Minimum 8 characters (recommending mixed case, numbers, symbols).
  - `role`: Restricted to `admin` or `viewer` (cannot provision secondary `owner`).
  - `is_active`: Default `true`.
- Writes directly to `public.profiles` using the service-role client.

### 10.3 Credentials Login API Route (`app/api/auth/login/route.ts`)
- Accepts `POST` with JSON body: `{ identifier: string, password: string }`.
- Resolves user by either `username = lower(trim(identifier))` OR `email = lower(trim(identifier))`.
- If user not found: Returns generic `401 Unauthorized` with error `"invalid_credentials"` (preventing user enumeration).
- If `!profile.is_active`: Returns `403 Forbidden` with error `"account_inactive"`.
- If password mismatch: Returns `401 Unauthorized` with error `"invalid_credentials"`.
- On success:
  - Updates `last_seen_at = now()`.
  - Mints signed session cookie `trackup_user` containing `{ id, username, email, role, is_active, name }`.
  - Returns `{ success: true, redirect: "/dashboard" }`.

### 10.4 Owner User Management UI (`src/components/owner/CreateUserModal.tsx` or in `app/admin/users/page.tsx`)
- Intuitive modal or inline form available only to the Owner.
- Fields: Full Name, Username, Email, Temporary Password, Role (`Admin` or `Viewer`).
- Submits to `POST /api/owner/users` or dedicated Server Action.

---

## 11. Files to DELETE

```text
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\auth\clickup\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\auth\clickup\callback\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\clickup\tasks\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\clickup\tasks\[taskId]\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\owner\clickup\sync\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\spaces\[spaceId]\sync-clickup\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\invitations\start\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\clickup\client.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\clickup\sync.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\clickup\workspace.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\login\ClickUpLogo.tsx
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\login\IntegrationVisual.tsx
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\scripts\forensic-oauth-callback.ts
```

---

## 12. Files to MODIFY

1. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\middleware.ts`
   - Maintain fast-path signed session verification. Ensure `/api/auth/login` is recognized as public.
2. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\next.config.ts`
   - Remove `https://api.clickup.com` from CSP `connect-src`.
   - Remove `/auth/clickup` rewrite rule.
3. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\types\auth.ts`
   - Update `Profile` interface: add `username: string`, remove `clickup_user_id`.
   - Update `AuthenticatedUser` interface: add `username: string`, remove `clickup_user_id`.
4. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\types\database.ts`
   - Update TypeScript database types for `profiles` (add `username`, `password_hash`).
   - Remove `clickup_connections` and `video_clickup_tasks` table definitions.
   - Remove ClickUp columns from `organizations` and `spaces`.
5. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\types\space.ts`
   - Remove ClickUp metadata properties from `Organization` and `Space`.
6. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\types\video.ts`
   - Remove `clickup_tasks` from `Video` interface.
7. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\app-url.ts`
   - Purge `getClickUpRedirectUri` and associated OAuth constants.
8. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\auth\session-cookie.ts`
   - Update `CookiePayload` and validator `parsePayload` to replace `clickup_user_id` with `username`.
9. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\auth\session.ts`
   - Ensure `getCurrentUser()` and `requireAuth()` select and populate `username`.
10. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\auth\provisioning.ts`
    - Replace ClickUp OAuth user provisioning with `createTrackUpUser()` enforcing owner authorization, unique username/email, and password hashing.
11. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\auth\rbac.ts`
    - Remove `determineInitialRole` based on `TRACKUP_OWNER_EMAIL` login matching.
12. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\spaces\access.ts`
    - Decouple `resolveMutationScopeForUser()` from `clickup_workspace_id`.
13. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\spaces\data-scope.ts`
    - Build data scopes directly from Organization ID and Space ID without requiring ClickUp workspace IDs.
14. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\spaces\service.ts`
    - Remove ClickUp workspace lookups and fields from Space management methods.
15. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\videos\service.ts`
    - Decouple video queries from `workspace_id`. Remove `associateClickUpTask()`.
16. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\observability\control-room.ts`
    - Remove ClickUp health probes and sync counters.
17. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\(auth)\login\page.tsx`
    - Remove OAuth redirect URL calculation; pass credentials submit handler.
18. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\login\LoginCard.tsx`
    - Implement the Username/Email + Password credentials form.
19. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\login\LoginHero.tsx`
    - Update headline and copy to reflect native TrackUp authentication.
20. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\login\login-content.ts`
    - Replace ClickUp-centric steps with TrackUp security and video intelligence highlights.
21. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\navigation\Nav.tsx` & `MobileNav.tsx`
    - Change button label from "Continue with ClickUp" to "Sign In".
22. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\spaces\SpacesDirectory.tsx`
    - Remove ClickUp connection badges and helper text.
23. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\spaces\SpaceMembersManager.tsx`
    - Remove "Sync ClickUp" button and ClickUp ID badges.
24. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\spaces\SpaceDashboard.tsx`
    - Remove `DisconnectedState` warning component.
25. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\owner\OwnerControlRoomPanel.tsx`
    - Remove ClickUp sync hierarchy controls and ClickUp ID table columns.
26. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\(dashboard)\settings\page.tsx`
    - Remove ClickUp connection panels and reconnect triggers.
27. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\watch\[token]\page.tsx`
    - Replace ClickUp login prompt copy with TrackUp credential login.
28. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\scripts\verify-provisioning.ts`
    - Rewrite to test custom user creation, username validation, and password hash presence.
29. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\scripts\verify-security-hardening.ts`
    - Remove ClickUp redirect URI tests; update CSP assertion for removed `api.clickup.com`.
30. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\scripts\verify-routes.ts`
    - Remove ClickUp OAuth route tests; add `/api/auth/login` credential testing.
31. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\scripts\verify-spaces.ts`
    - Remove expectations of ClickUp Space and Workspace IDs.
32. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\scripts\verify-creation-flow.ts`
    - Update video creation tests to scope by Organization/Space rather than ClickUp Workspace.
33. `c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\docs\auth-rbac.md` & `docs\security-model.md`
    - Revise architectural documentation to reflect sovereign authentication.

---

## 13. Files to CREATE

```text
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\lib\auth\password.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\auth\login\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\app\api\owner\users\route.ts
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\src\components\owner\CreateUserDialog.tsx
c:\Users\seift\Downloads\Phantoms\2nd\websites\traking\supabase\migrations\20261001000001_trackup_custom_auth.sql
```

---

## 14. Database Migration Requirements

A single comprehensive migration file `20261001000001_trackup_custom_auth.sql` must execute the following operations in strict order:

```sql
-- 1. ADD USERNAME AND PASSWORD_HASH TO PROFILES
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. BACKFILL USERNAMES FOR EXISTING PROFILES
-- Derive username from existing name or email prefix, ensuring unique lower-case values
UPDATE public.profiles
SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9_-]', '', 'g'))
WHERE username IS NULL;

-- Ensure no duplicate or empty usernames remain
UPDATE public.profiles
SET username = 'user_' || substr(id::text, 1, 8)
WHERE username IS NULL OR char_length(username) < 3;

-- Enforce UNIQUE and NOT NULL constraints on username
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT profiles_username_unique UNIQUE (username),
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_-]{3,30}$');

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 3. DECOUPLE VIDEOS FROM WORKSPACES TABLE
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill organization_id on videos from spaces
UPDATE public.videos v
SET organization_id = s.organization_id
FROM public.spaces s
WHERE v.space_id = s.id AND v.organization_id IS NULL;

-- Make workspace_id nullable on videos
ALTER TABLE public.videos
  ALTER COLUMN workspace_id DROP NOT NULL;

-- 4. DROP CLICKUP-SPECIFIC TABLES
DROP TABLE IF EXISTS public.video_clickup_tasks CASCADE;
DROP TABLE IF EXISTS public.clickup_connections CASCADE;

-- 5. DROP OR DEPRECATE CLICKUP-SPECIFIC COLUMNS
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS clickup_user_id;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS clickup_workspace_id,
  DROP COLUMN IF EXISTS clickup_sync_status,
  DROP COLUMN IF EXISTS clickup_last_synced_at,
  DROP COLUMN IF EXISTS clickup_sync_error;

ALTER TABLE public.spaces
  DROP COLUMN IF EXISTS clickup_workspace_id,
  DROP COLUMN IF EXISTS clickup_space_id,
  DROP COLUMN IF EXISTS clickup_sync_status,
  DROP COLUMN IF EXISTS clickup_last_synced_at,
  DROP COLUMN IF EXISTS clickup_sync_error;

ALTER TABLE public.space_members
  DROP COLUMN IF EXISTS clickup_user_id,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS source;

-- 6. DROP CLICKUP-BOUND RPC FUNCTION
DROP FUNCTION IF EXISTS public.accept_invitation(UUID, TEXT, TEXT, TEXT, TEXT);
```

---

## 15. Environment Variable Changes

### 15.1 Variables to REMOVE Completely
- `CLICKUP_CLIENT_ID`
- `CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`

### 15.2 Variables to RETAIN
- `NEXT_PUBLIC_SUPABASE_URL` (Supabase database URL)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase anon/publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase admin/service key - critical for server guards and provisioning)
- `TRACKUP_SESSION_SECRET` (HMAC-SHA256 signing secret for `trackup_user` session cookies)
- `NEXT_PUBLIC_APP_URL` (Canonical application origin)
- `RESEND_API_KEY` (For system notifications)
- `RESEND_FROM_EMAIL` (Verified outbound email address)
- `RESEND_REPLY_TO` (Optional reply-to address)
- `CRON_SECRET` (Authorization key for database health probe)

### 15.3 Variables to Refactor
- `TRACKUP_OWNER_EMAIL`: In the legacy system, this was read on every OAuth login to dynamically promote a matching user to Owner. In the custom auth system, the Owner is seeded directly in the database. `TRACKUP_OWNER_EMAIL` can remain as an optional bootstrap seed variable for first-time environment provisioning, but is no longer consulted on individual user logins.

---

## 16. Package Dependency Changes

### 16.1 Dependencies to REMOVE
- None. (TrackUp did not use a third-party ClickUp SDK; all ClickUp operations used native `fetch`).

### 16.2 Dependencies to ADD
- For password hashing, two viable options exist:
  1. **Option A (Zero External Dependencies - Recommended)**: Use Node.js standard `node:crypto.scrypt` + `node:crypto.randomBytes` + `node:crypto.timingSafeEqual`. This requires **0** additional npm packages, avoids native compilation issues on Vercel/Windows, and provides robust security.
  2. **Option B (Industry Standard bcrypt)**: `npm install bcryptjs` + `npm install -D @types/bcryptjs`. Pure JavaScript implementation of bcrypt, widely understood and compatible across all environments.

---

## 17. Test Migration Requirements

The current test suite (`cmd /c npm test`) runs 12 verification scripts covering 149 space checks, 31 creation-flow checks, 26 role-visibility checks, and multiple security probes. To reflect Custom Auth, tests must be updated as follows:

| Test Script | Current Behavior | Required Changes for Custom Auth |
|---|---|---|
| `scripts/verify-provisioning.ts` | Tests `determineInitialRole` based on ClickUp email match. | **Rewrite**: Test owner user creation, username validation, password hashing, and active/inactive blocking. |
| `scripts/verify-security-hardening.ts` | Tests ClickUp redirect URIs, OAuth callback error states, and CSP with `api.clickup.com`. | **Modify**: Remove ClickUp OAuth tests. Update pinned CSP assertion to exclude `api.clickup.com`. Add timing-safe password verification tests. |
| `scripts/verify-routes.ts` | Asserts `/api/auth/clickup` and callback route protection. | **Modify**: Assert `/api/auth/login` accepts valid credentials, rejects invalid passwords, and rejects inactive users. |
| `scripts/verify-invitations.ts` | Tests `accept_invitation` RPC requiring ClickUp ID. | **Modify**: Update to test direct owner user creation. |
| `scripts/verify-spaces.ts` | Verifies `clickup_space_id`, `clickup_workspace_id`, and sync routines. | **Modify**: Remove assertions expecting ClickUp identifiers; verify sovereign Spaces and Organizations. |
| `scripts/verify-creation-flow.ts` | Validates `resolveMutationScopeForUser` with ClickUp workspace. | **Modify**: Validate scope resolution directly with Organization ID and Space ID. |
| `scripts/verify-owner-observability.ts` | Asserts `clickup_sync_status` and sync health. | **Modify**: Remove ClickUp sync assertions from Control Room checks. |
| `scripts/forensic-oauth-callback.ts` | End-to-end mock of ClickUp OAuth callback. | **DELETE**. |
| `scripts/verify-rbac.ts` | Tests role hierarchy and permission sets. | **Keep**: Verify existing permission matrix remains identical. |
| `scripts/verify-role-management.ts` | Tests role changes and status changes. | **Keep**: Retain all allowed/blocked role transitions. |
| `scripts/verify-analytics.ts` | Tests video tracking telemetry and heatmaps. | **Keep**: Completely independent of ClickUp. |
| `scripts/verify-health.ts` | Tests database health check probe and cron execution. | **Keep**: Completely independent of ClickUp. |
| `scripts/verify-role-visibility-fixes.ts` | Tests viewer/admin UI visibility. | **Keep**: Retain all checks. |

---

## 18. Data Migration Risks & Mitigations

1. **Risk: Existing Profiles Lack Password Hashes**
   - *Impact*: Current profiles in production have valid `id` and `email` but `password_hash = NULL`. If custom auth is deployed, existing users cannot log in.
   - *Mitigation*: The database migration must seed a known, secure temporary password for the initial Owner account (`process.env.TRACKUP_OWNER_EMAIL`), or execute an administrative CLI script to assign initial passwords before OAuth endpoints are shut down.
2. **Risk: Existing Profiles Lack Usernames**
   - *Impact*: `username` is a mandatory requirement. Existing profiles only have `email` and `name`.
   - *Mitigation*: The migration script generates a clean, unique username from the email prefix (`split_part(email, '@', 1)`), sanitized with regex `[^a-z0-9_-]`, appending random suffix if collisions occur.
3. **Risk: Breaking Video Foreign Keys**
   - *Impact*: `videos.workspace_id` is a non-null foreign key referencing `workspaces(id)`. If `workspaces` is altered or dropped prematurely, video records will become orphaned.
   - *Mitigation*: Ensure `videos.organization_id` is created and backfilled from `spaces.organization_id` before dropping or altering `videos.workspace_id`.
4. **Risk: Orphaned Watch Links and Sessions**
   - *Impact*: Watch links and sessions reference `videos(id)` and `profiles(id)`.
   - *Mitigation*: Watch links and sessions do **not** depend on ClickUp tables directly. Their foreign keys remain 100% valid as long as `videos` and `profiles` primary keys are preserved.

---

## 19. Security Risks & Mitigations

1. **Brute-Force and Credential Stuffing**
   - *Risk*: Moving from OAuth to a local username/password login endpoint exposes the platform to automated brute-force attacks.
   - *Mitigation*:
     - Implement IP and identifier-based rate limiting on `POST /api/auth/login` (e.g. maximum 5 failed attempts per 15 minutes per IP/account).
     - Uniform error responses: Always return `"invalid_credentials"` regardless of whether the identifier or the password was incorrect.
2. **Timing Attacks**
   - *Risk*: Measuring the time taken to reject an invalid username vs. an invalid password allows attackers to enumerate valid usernames.
   - *Mitigation*: Perform a dummy password hash computation even if the user lookup fails, ensuring constant execution time. Use `crypto.timingSafeEqual` for hash comparisons.
3. **Session Secret Invalidation**
   - *Risk*: `TRACKUP_SESSION_SECRET` signs all cookies. If compromised, an attacker can mint Owner cookies.
   - *Mitigation*: Enforce at least 32 high-entropy characters. Maintain database validation on every request so deactivating a profile in the database instantly invalidates active cookies.
4. **Elevation of Privilege via User Creation**
   - *Risk*: An attacker attempts to create an account with `role: "owner"`.
   - *Mitigation*: Hard-code validation in the provisioning logic to allow only `admin` or `viewer` roles to be created. The `owner` role can **never** be requested or provisioned through standard user creation APIs.

---

## 20. Recommended Migration Order

To guarantee zero downtime and prevent broken intermediate states, execute the migration across **8 distinct phases**:

```
Phase 1: Database Schema Expansion
  └── Add username, password_hash to profiles; add organization_id to videos. Backfill existing rows.
Phase 2: Password Engine & Sovereign Provisioning Core
  └── Implement src/lib/auth/password.ts and sovereign createTrackUpUser().
Phase 3: Owner User Management Endpoint & UI
  └── Expose POST /api/owner/users; add user creation modal in Owner/Admin console.
Phase 4: Credentials Login API & UI
  └── Deploy POST /api/auth/login; update /login page to accept credentials.
Phase 5: Decouple Videos and Spaces from ClickUp
  └── Update resolveMutationScopeForUser() and video queries to rely on Organization/Space IDs.
Phase 6: Purge ClickUp Modules, Endpoints, and UI References
  └── Delete ClickUp API clients, sync routines, and task routes. Remove ClickUp UI copy and logos.
Phase 7: Drop ClickUp Database Entities & Clean Environment
  └── DROP TABLE clickup_connections, video_clickup_tasks. Remove CLICKUP_* env vars.
Phase 8: Test Suite Modernization & Verification
  └── Update scripts/verify-*.ts to validate Custom Auth and run full regression suite.
```

---

## 21. Unknowns / Evidence Needed

1. **Initial Owner Password Generation**:
   - *Question*: For the existing Owner account (`founder@trackup.com` / `ceo@trackup.io`), should the initial migration script generate a fixed temporary password (e.g. via an environment variable `INITIAL_OWNER_PASSWORD`), or should a one-off CLI script be provided?
   - *Recommendation*: Support `INITIAL_OWNER_PASSWORD` in `.env.local` to seed the owner password hash during the first run.
2. **User Password Reset Workflow**:
   - *Question*: Requirement 4 states "There is NO public registration" and Requirement 5 states "Only an authorized TrackUp owner can create users." Does the Owner also reset passwords directly on demand (via an "Update Password" action in the Owner console), or should TrackUp support email-based password reset links?
   - *Recommendation*: Start with Owner-controlled password resets in the Owner console, adhering strictly to the closed, owner-governed model.
3. **Internal `workspaces` Table Terminology**:
   - *Question*: TrackUp currently has `organizations`, `spaces`, and the legacy `workspaces` table. Should the `workspaces` table be dropped entirely once `videos.organization_id` is established, or should it be retained under a different name?
   - *Recommendation*: Drop `workspaces` entirely; `organizations` and `spaces` provide a cleaner, more intuitive two-level multi-tenant hierarchy.

---

## 22. Explicit Definition of Done

The Custom Auth migration will be considered 100% complete only when all the following criteria are met and verified:

- [ ] **Database Integrity**:
  - `public.profiles` contains `username` (NOT NULL, UNIQUE) and `password_hash` (NOT NULL).
  - `public.clickup_connections` and `public.video_clickup_tasks` tables are completely dropped.
  - All ClickUp-specific columns are removed from `profiles`, `organizations`, `spaces`, and `space_members`.
  - `public.videos` references `organization_id` and `space_id` directly, with no foreign key dependency on ClickUp.
- [ ] **Authentication & Security**:
  - Direct credentials login (`POST /api/auth/login`) succeeds with username/password and email/password.
  - Inactive accounts (`is_active = false`) are rejected with `403 Forbidden`.
  - Missing/incorrect credentials fail with uniform `401 Unauthorized` without leaking user existence.
  - No public registration route or UI exists anywhere in the application.
  - Only users with `role: "owner"` can create new users.
  - User creation endpoint rejects any attempt to create a user with `role: "owner"`.
- [ ] **RBAC Preservation**:
  - `owner` has full access to user management, admin management, settings, control room, and video operations.
  - `admin` can create, update, delete videos and view analytics, but cannot manage users or settings.
  - `viewer` has read-only access to assigned videos and personal analytics.
  - All RBAC guards (`guardAuth`, `guardAdmin`, `guardOwner`) and API wrappers (`withRole`, `withPermission`) pass without ClickUp tokens.
- [ ] **Codebase Cleanliness**:
  - All ClickUp client libraries (`src/lib/clickup/*`) and routes (`app/api/auth/clickup/*`, `app/api/clickup/*`) are deleted.
  - All ClickUp environment variables (`CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET`, `CLICKUP_REDIRECT_URI`) are removed from config and documentation.
  - `next.config.ts` CSP does not include `api.clickup.com`.
  - All UI surfaces (Navbar, Login, Settings, Spaces, Organizations, Control Room, Watch page) are completely free of ClickUp logos, badges, and mentions.
- [ ] **Testing & Quality**:
  - `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
  - `npm run lint` (`eslint`) passes with 0 errors.
  - All verification test scripts in `scripts/verify-*.ts` pass completely.
