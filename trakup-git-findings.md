
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

The documentation-only commit `85654a6` also passed GitHub Quality run `32585517054` / job `97061176512`: install, type check, lint, tests, and production build all completed successfully.

## Phase 4 boundary re-audit — workspace and organization isolation

Gate 0 was revalidated on branch `fix/restore-workspace-contract` at commit `9604b16`: the working tree was clean, the comparison diff passed `git diff --check`, and local typecheck, lint, tests, and production build all passed. The latest local suite reported route authorization `56/56` and security hardening `43/43`; the only build warning remains Next.js's middleware-to-proxy deprecation.

Architecture evidence is consistent and explicit. `profiles` stores one global `role` and `is_active` per ClickUp user. `workspaces` stores ClickUp teams. `clickup_connections` is keyed by `(profile_id, workspace_id)` and stores the server-side access token. OAuth provisions or loads one global profile, persists the first authorized ClickUp team as the MVP primary connection, and the dashboard/settings pages derive a single primary workspace from that connection. Video queries and mutations are scoped by that primary workspace id. No table, helper, or authorization function currently represents a per-workspace membership or a workspace-specific role.

Decision: do not add a partial membership model. For the current single-primary-workspace MVP, the global profile role does not block the existing product flow because each authenticated user is routed to one primary workspace and all video operations use that workspace. It would become a confirmed product/security requirement if users can connect or switch between multiple organizations, if the same profile can hold different roles in different workspaces, or if owners/admins must manage members of one workspace without seeing another. Implementing that future model requires a complete design for membership keys, unique constraints, role scope, OAuth provisioning, workspace selection, session context, every protected query, migrations/rollback, and tests; it is intentionally deferred rather than partially introduced.

Confirmed minimal regression: the settings page had a stale reconnect CTA pointing to `/auth/clickup` although the implemented route is `/api/auth/clickup`. It was corrected in the working tree with no architectural change.

## Provider capability evidence — official docs

The current WatchPlayer implementation renders YouTube and Vimeo as iframes but does not load either provider SDK. The official YouTube IFrame Player API documents `getCurrentTime()` and `getDuration()` plus `onStateChange` states for ended, playing, paused, and buffering; this means granular telemetry is technically available only after integrating the SDK/protocol, not from the current iframe alone. The official Vimeo Player SDK reference documents playback-position and duration methods and playback events including bufferstart/bufferend, ended, pause, play, progress, seeked, and timeupdate; the current iframe-only implementation does not consume them.

Sources inspected: https://developers.google.com/youtube/iframe_api_reference and https://developer.vimeo.com/player/sdk/reference.

The official Telegram Bot API page describes an HTTP bot interface and media/message fields, but it does not expose a browser embedded-player control/event contract comparable to YouTube IFrame API or Vimeo Player SDK. The official Google Drive API reference describes the Drive REST resource service and file/resource access; it does not provide an embedded preview player event API or a current playback-position contract. Therefore the current direct iframe treatment for Drive and Telegram cannot prove current position, play/pause/seek/buffer/end, watched ranges, or a real heatmap.

Sources inspected: https://core.telegram.org/bots/api and https://developers.google.com/workspace/drive/api/reference/rest/v3.

## RBAC audit — read routes and reconnect flow

Confirmed problem: three read-oriented routes relied on `withAuth` even though their contracts are permissioned reads, and ClickUp task search exposed a token-backed workspace query to every authenticated role. The latter is part of the task-association workflow and is not used by the viewer experience.

Root cause: authentication and authorization wrappers were mixed at the route layer. The current role map already grants `videos.read` to owner/admin/viewer and reserves video mutation/task association for owner/admin, so changing wrappers does not remove an intended current capability; it makes the route contract enforce the central permission map.

Minimal safe fix: `/api/videos` GET and `/api/videos/[id]` GET now use `withPermission(PERMISSIONS.VIDEOS_READ)`. `/api/clickup/tasks` GET now uses `withPermission(PERMISSIONS.VIDEOS_UPDATE)`, matching the association mutation it supports. The settings reconnect CTA was also corrected to `/api/auth/clickup`.

Evidence and regression: local typecheck, lint, tests, and build passed after the changes. `verify-routes.ts` now checks the three permission wrappers and the settings CTA; route authorization increased to `60/60`, while security hardening remained `43/43`.

## Viewer-link security audit

Confirmed controls: the public watch page resolves the opaque link server-side and returns `notFound()` for invalid, expired, or revoked links; the page exposes only title/source metadata to `WatchPlayer`; link tokens are generated by the database and are returned only to authenticated management callers; session creation re-checks revoke/expiry immediately before insert; event/end writes require the separate per-session capability and return a generic 404 on mismatch. Existing sessions intentionally remain readable only to protected analytics and are not deleted when a link is revoked.

Confirmed remaining boundary: revocation prevents future sessions but does not invalidate already-issued session capabilities. That is a deliberate lifecycle choice for preserving existing analytics; if product policy requires immediate termination, a separate `watch_sessions` invalidation state and policy must be designed.

## Provider capability audit

The current implementation uses native HTML5 events only for `direct_url`. YouTube, Vimeo, Google Drive, and Telegram are rendered as iframes without SDK/event integration. Official YouTube documentation confirms that an IFrame API can expose current time, duration, and play/pause/buffering/ended states; official Vimeo documentation confirms a Player SDK can expose position, duration, buffer, play, pause, seek, ended, progress, and timeupdate events. Those capabilities are not present in the current code. The official Google Drive API is a REST resource/file API and does not provide the preview iframe playback contract needed here; the official Telegram Bot API likewise does not provide an embedded-player telemetry contract.

Therefore the current system can support session start/end for every provider, reliable native playback events only for direct URLs, and no proven watched-range or heatmap for any provider at present. Any completion/watch-time figures produced from the current iframe sessions must not be presented as provider-accurate.

## Tracking correctness audit — confirmed fixes

Confirmed problem 1: the API payload calls the field `from_position`, but `recordTrackingEvent` wrote that value into the database column `duration`; the current `watch_events` schema had no `from_position` column. Root cause was a contract mismatch between client payload semantics and the historical schema. Impact: seek-origin information was mislabeled and future watched-range reconstruction could not distinguish it correctly. Minimal safe fix: additive migration `20260822000006_add_watch_event_from_position.sql`, matching manual database/domain types, and writing the value to `from_position`. Historical `duration` remains untouched for compatibility.

Confirmed problem 2: WatchPlayer added `(Date.now() - playStart)` on every heartbeat while `playStart` remained the beginning of the play segment, causing cumulative overcount (for example, 5 seconds plus 10 seconds instead of 10 seconds). It also initialized the timer at session creation, which could count time before playback. Minimal safe fix: explicit elapsed play segments are flushed on heartbeat, pause, end, and cleanup; heartbeat resumes from the flush timestamp, and session creation no longer starts the playback timer. Regression assertions cover these behaviors.

Evidence: local typecheck, lint, test, and build passed. Security hardening passed `52/52`; route authorization remained `60/60`. No mocks, fake success, or type assertions were introduced.
