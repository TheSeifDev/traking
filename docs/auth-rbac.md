# TrackUp Authentication and RBAC

## Authentication Flow

TrackUp uses ClickUp OAuth as the only sign-in path. `/api/auth/clickup` starts OAuth, creates a random `trackup_oauth_state` cookie, and redirects to ClickUp's authorization URL, `https://app.clickup.com/api`. `/api/auth/clickup/callback` validates the returned state, exchanges the code at `https://api.clickup.com/api/v2/oauth/token`, verifies authorized Workspaces at `https://api.clickup.com/api/v2/team`, fetches the ClickUp user identity, provisions or loads the matching `profiles` row, and writes HTTP-only cookies.

`trackup_user` is a signed session cookie. It is used only to identify the profile row to reload from the database. Authorization always uses the fresh database role and `is_active` value, not a client-supplied role. `trackup_token` stores the ClickUp access token server-side as an HTTP-only cookie.

## ClickUp OAuth Flow

Required ClickUp variables are `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET`, and `CLICKUP_REDIRECT_URI`. The callback rejects missing codes, provider errors, invalid state, token exchange failures, missing access tokens, missing/unauthorized Workspaces, and invalid ClickUp identities.

## Database Structure

`profiles` stores TrackUp users:

- `id`
- `clickup_user_id`
- `name`
- `email`
- `role`: `owner`, `admin`, or `viewer`
- `is_active`
- timestamps

`role_change_audit` stores immutable role-change audit entries with target user, changer, previous role, new role, and timestamp.

## Roles and Permissions

`owner` has all permissions: user reads/management, video reads/creates/updates/deletes, analytics reads, admin management, settings management, and system management.

`admin` can read users, read analytics, and create/update/delete videos. Admins cannot manage roles, settings, system configuration, or owner-only pages.

`viewer` can read videos and analytics. Viewers cannot access admin/owner pages or perform write operations.

## Protected Routes

Authenticated routes: `/dashboard`, `/videos`, `/analytics`, `/profile`, `/settings`.

Admin routes: `/admin/*`, guarded by `guardAdmin()`.

Owner routes: `/owner/*`, guarded by `guardOwner()`.

Middleware performs only a signed-cookie fast-path redirect. Server component guards perform database-backed authorization.

## Owner Configuration

`TRACKUP_OWNER_EMAIL` is read only on the server. A brand-new user whose ClickUp email matches it is provisioned as `owner`; every other new user is provisioned as `viewer`. Existing roles are preserved on later logins.

Owner cannot be assigned through role management, cannot modify self, and cannot be deactivated or deleted by app APIs.

## Role Management

Viewer to admin promotion and admin to viewer demotion are allowed only through owner-only server code. Requested roles are validated against the managed-role set: `admin` and `viewer` only. `owner` is rejected.

## Authorization Architecture

Core checks live in `src/lib/auth/rbac.ts`, `src/lib/auth/session.ts`, `src/lib/auth/guards.ts`, `src/lib/auth/api-handler.ts`, and `src/lib/auth/role-management.ts`.

Route handlers use `withPermission()`. Server Actions delegate to `role-management.ts`; they do not trust form data, cookies, URL params, or client state for authorization.

## RLS

RLS is enabled on `profiles` and `role_change_audit`. Authenticated clients may select their own profile, and admins/owners may select all profiles through RLS helper functions. Direct authenticated inserts, updates, and deletes on `profiles` are denied. Profile provisioning, role changes, status changes, and ClickUp identity sync use the server-only service-role client.

`role_change_audit` is readable by owners and writable only through the service-role client. SECURITY DEFINER helper functions revoke execution from `PUBLIC` and grant only to `authenticated`.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLICKUP_CLIENT_ID`
- `CLICKUP_CLIENT_SECRET`
- `CLICKUP_REDIRECT_URI`: set to `https://trakeup.vercel.app/api/auth/clickup/callback` in production and register the exact URI in the ClickUp OAuth app.
- `TRACKUP_OWNER_EMAIL`
- `TRACKUP_SESSION_SECRET`: at least 32 random characters
- `NEXT_PUBLIC_APP_URL`: public application origin; set to `https://trakeup.vercel.app` in production. The server rejects loopback values in production and uses that canonical origin as a safe fallback.

Never prefix service-role, ClickUp secret, owner email, or session secret variables with `NEXT_PUBLIC_`.

## Testing Instructions

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If the Supabase CLI is installed and the project is linked/configured, also run the local migration validation command available in `supabase migration --help`. Live ClickUp OAuth and live Supabase RLS behavior require real credentials and a configured project.
