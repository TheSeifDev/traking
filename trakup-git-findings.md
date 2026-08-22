
## 2026-08-22 — Anonymous watch-session capability recovery

Confirmed problem: `src/lib/tracking/service.ts` on the PR branch had been truncated by the earlier browser-editor operation; the committed file still contained only a commented fragment and `endWatchSession`, causing the confirmed `TS1005` syntax failure.

Root cause: virtualized GitHub CodeMirror editing with `selectAll`/`execCommand` did not preserve the complete document. The recovery was therefore performed from the clean `origin/main` implementation, followed by a complete capability-aware service replacement rather than a tail-only patch.

Implemented on `fix/restore-workspace-contract` in commit `6cac54e`:

- Restored `resolveWatchLink`, `createWatchSession`, `recordTrackingEvent`, and `endWatchSession`.
- Added an opaque 32-byte random `session_token` generated server-side.
- Added capability verification and scoped event/session updates by both session id and token.
- Updated session, event, and end API routes to require/return the token and use generic 404 failures for invalid capabilities.
- Updated manual Supabase types and WatchPlayer readiness/propagation.
- Added 15 static regression/security assertions covering migration, service, routes, and client propagation.

Evidence:

- Local `npm run typecheck`: passed.
- Local `npm run lint`: passed.
- Local `npm test`: passed; security hardening `34/34`, route authorization `56/56`.
- Local `npm run build`: passed; Next.js generated all application routes.
- GitHub Quality run `32585017767` / job `97059972504` on commit `6cac54e`: `Type check`, `Lint`, `Tests`, and `Production build` all passed.

Known non-blocking warning: Next.js reports that the `middleware` convention is deprecated in favor of `proxy`; this is deferred because it is unrelated to the merge recovery and current build is green.

Deployment gate remains open: the additive migration `20260822000004_harden_watch_session_capabilities.sql` has not yet been applied to the live Supabase database, and live ClickUp OAuth→Dashboard E2E still requires an accessible Vercel deployment with the required environment variables.

## 2026-08-22 — Watch-link lifecycle and owner mutation hardening

Confirmed problems: `/api/owner/admins` returned hard-coded success without mutating a profile; generated watch-link UI fabricated `created_by`, `expires_at`, and `created_at`; there was no server-side revoke lifecycle; and `resolveWatchLink` accepted links after a hypothetical revoke because no revoke state existed.

Root causes: the admin route was an unfinished stub, the client created a local display object instead of consuming the server response, and the historical schema only modeled expiry. The fix stays additive and workspace-scoped: migration `20260822000005_add_watch_link_revocation.sql` adds nullable `revoked_at`, `revokeWatchLink` verifies the video workspace before updating the matching active link, and `resolveWatchLink` rejects revoked links. The panel now consumes returned metadata, renders expired/revoked states, and calls the protected DELETE route. The admin compatibility route delegates to the already-tested `changeUserRole` domain operation.

Evidence:

- Local `npm run typecheck`: passed after correcting the generated-link return type.
- Local `npm run lint`: passed.
- Local `npm test`: passed; security hardening `43/43`, route authorization `56/56`.
- Local `npm run build`: passed; all application routes compiled.
- GitHub Quality run `32585420944` / job `97060943565` on commit `8356bb8`: dependency install, type check, lint, tests, and production build all passed.

The migration is intentionally not marked applied: it remains a deployment gate until the actual Supabase environment is available.

## Phase 4 boundary audit

The final diff is 21 source/config/migration files, with no `.next`, `node_modules`, coverage, or other generated artifacts. The changes remain localized to merge-contract recovery, capability hardening, watch-link lifecycle, owner mutation routing, and their regression checks.

A source audit confirms that video reads and mutations are already scoped by the primary workspace id, and the protected video/watch-link routes use the centralized permission wrapper. However, the current data model has no explicit workspace-membership table: roles live on global `profiles`, while `getPrimaryWorkspace*` derives one workspace from a user's ClickUp connection. Consequently, `listAllUsers()` is intentionally still a global owner view, and cross-workspace membership isolation is not claimed as complete. Introducing memberships would be a schema and provisioning design change, not a safe local merge repair, so it remains a separately scoped follow-up rather than an invented partial model.

The public tracking endpoints now require an unguessable per-session capability, and watch-link expiry/revocation blocks creation of new sessions. A distributed rate limiter is not present; adding an in-memory limiter would be unsafe for serverless instances, so no fake limiter was added. The remaining transparent `POST /api/admin/users` handler returns 501 because invite/user creation is not implemented; unlike the former owner-admin stub, it does not claim a mutation occurred.
