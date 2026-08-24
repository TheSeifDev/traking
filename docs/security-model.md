# TrackUp Security Model

## Scope and security posture

TrackUp uses server-side authorization for every internal page and API. The browser may hide navigation, but a hidden button or route is never treated as authorization. Requests are authenticated from the signed HTTP-only TrackUp session cookie; the server reloads the active profile from the database and derives the effective role from that profile rather than trusting a role supplied by the client.

The application uses a Supabase service-role client only in server-side code for the application data layer. The service-role credential is not returned to the browser. Supabase tables have Row Level Security enabled, while the application performs the authoritative resource authorization and tenancy checks before using the server client.

## Role and permission matrix

| Capability | Public | Viewer | Authenticated member | Admin | Owner |
|---|---:|---:|---:|---:|---:|
| Public landing and authentication | View | View | View | View | View |
| Specific authenticated Watch Link playback | No, unless the current link entry flow authorizes it | View/use only for the authorized link | View/use only when authorized | View/use when authorized | View/use when authorized |
| Dashboard and internal navigation | No | No | No | View | View |
| Authorized organization/Space directory | No | No | Only through authorized organization/Space routes | Organization-scoped | Authorized organizations plus Owner scope |
| Video read/create/update/delete | No | No internal library access | Per current resource permissions | Organization/Space-scoped | Authorized organization/Space-scoped |
| Watch-link read/create/revoke | No | No | Per current resource permissions | Organization/Space-scoped | Authorized organization/Space-scoped |
| Analytics and session detail | No | No | Only where the organization/Space route permits it | Organization/Space-scoped | Authorized organization/Space-scoped and Owner observability |
| Organization member management | No | No | No | Only in an organization where the caller has admin membership | Authorized organizations |
| Platform-wide user/role/status management | No | No | No | No | Owner only |
| ClickUp sync and management | No | No | Only through an explicitly authorized organization/Space operation | Organization/Space-scoped | Authorized organizations plus Owner controls |
| Owner Control Room, observability, cron evidence | No | No | No | No | Owner only |

The `users.read`, `users.manage`, and `admins.manage` permissions are platform-wide permissions and are therefore Owner-only. Organization and Space member operations use their existing organization/Space membership checks and are not a replacement for a new membership architecture.

## Authentication and authorization flow

1. ClickUp OAuth callback validates the OAuth state and exact environment-aware redirect URI.
2. The callback exchanges the code, verifies the authorized ClickUp Workspace, retrieves the ClickUp identity, and provisions or loads the matching TrackUp profile.
3. The signed session cookie contains the session identity, but each protected request reloads the active profile and role from the database.
4. API wrappers (`withAuth`, `withRole`, `withPermission`, and `withDashboardAuth`) reject unauthenticated, inactive, or insufficient-role requests before invoking route handlers.
5. Resource services then enforce organization, Space, membership, and resource predicates. A client-supplied UUID is never sufficient by itself.

## Organization and Space boundaries

Organization-scoped requests resolve the caller's accessible organizations first. Space-scoped requests verify that the Space belongs to the selected organization and that the caller has access to that Space. Video, watch-link, session, event, and analytics reads are constrained by the authorized parent resource. Invalid organization or Space selectors do not fall back to an unscoped global read.

Owner `All Spaces` is a virtual active-context represented only by an HTTP-only preference value in the form `all:<organization-uuid>`. It is never a database Space, ClickUp Space, fake UUID, or ambiguous `NULL`. The server authorizes the selected Organization and its linked ClickUp Workspace, then uses an explicit organization data scope for dashboard, video, watch-link, session, event, and analytics reads. That scope includes every organization-owned resource, including preserved historical Organization-container rows. Legacy Organization-container rows remain excluded from normal child-Space presentation and Space selection; they are not silently discarded from the Owner organization-wide scope.

## Viewer boundary and Watch Links

The viewer surface is intentionally narrow. A viewer may use only the specific authenticated Watch Link flow and the playback/tracking operations required for that link. Viewer pages and tracking writes do not accept browser-supplied viewer names or emails as authoritative identity. The server binds the viewing activity to the authenticated TrackUp profile/session and the authorized watch-link/video relationship.

Watch-link tokens are opaque and stored as hashes where applicable. Analytics responses do not include raw watch-link tokens, session capability tokens, ClickUp access tokens, or service credentials. Revoked and expired links must fail closed, and a session capability is checked against its intended session/link before tracking mutations are accepted.

Legacy guest-viewer tables/columns may remain in the production database for historical compatibility, but the current application does not reintroduce guest identity creation or use them as an authorization path.

## Database security

Production migrations enable RLS on profiles, organizations, organization members, workspaces, Spaces, Space members, videos, watch links, sessions, events, invitations, viewer identities, owner logs, and cron evidence. Direct client access is not the application authorization path. Server-side services use explicit authorization checks before service-role queries.

The security-hardening migration `20260824000011_harden_function_security.sql` revokes `EXECUTE` from `anon` and `authenticated` for RLS helper and trigger functions, revokes the legacy `rls_auto_enable()` helper when present, and pins the trigger function's `search_path` to `public`. Migration `20260824000012_harden_legacy_rls_ingestion.sql` removes the legacy anonymous watch-session/event insert policies, revokes table grants for `anon` and `authenticated`, and changes direct workspace reads to deny-by-default. The server-side service-role flow remains the only application write path.

## Browser security headers

The application sends a baseline CSP compatible with the YouTube IFrame API, Referrer-Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a restrictive Permissions-Policy. YouTube frame/script/connect domains are explicitly allowed where required by the existing embedded player; no broad frame embedding policy is enabled. Vercel supplies Strict-Transport-Security on the HTTPS production deployment.

## CSRF and state-changing requests

The signed session and OAuth state cookies use `HttpOnly`, `Secure` in production, `SameSite=Lax`, a root path, and bounded lifetimes. The OAuth callback requires the short-lived state cookie to match the returned state before token exchange. State-changing internal requests are also protected by the role/resource authorization wrappers and are expected to be same-origin browser requests. The application does not currently implement a separate synchronizer token or explicit Origin/Referer allowlist; this remains a hardening limitation for future threat-model review, especially if cookie policy or cross-origin embedding changes.

## Rate limiting and abuse controls

The application validates session capabilities, link lifecycle, event payloads, and resource relationships. A distributed production rate limiter is not currently available in the architecture. No in-memory limiter is presented as production-safe. Authentication, watch-link access, tracking ingestion, ClickUp sync, and expensive analytics remain operational abuse-control limitations requiring a shared durable limiter or edge/provider control before being described as rate-limit protected.

## Known limitations

Cross-organization browser E2E requires a second real organization and identity; the available production account currently provides only one Owner and one Organization, so that scenario is not independently verified. Admin-specific browser E2E also requires a separate Admin identity. Provider telemetry remains capability-dependent: unsupported providers must continue to report unavailable metrics rather than fabricated playback precision. The database contains historical guest-viewer and legacy-container artifacts that are preserved but are not active authorization paths.
