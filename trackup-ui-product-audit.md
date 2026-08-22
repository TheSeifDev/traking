# TrackUp UI/Product Audit — MVP boundary

## Existing backend and product contracts

| Product area | Confirmed implementation | Safe product decision |
| --- | --- | --- |
| Workspace/auth | `guardAuth`, `guardAdmin`, `guardOwner`, primary workspace lookup, signed session cookie | Reused existing guards and did not add membership architecture. |
| Video API | `GET/POST /api/videos`, `GET/PUT/DELETE /api/videos/[id]`, workspace-scoped service queries | The library and detail UX use the existing endpoints. Server authorization remains authoritative. |
| Video persistence | `videos` rows were present in production, while `listVideos` selected missing post-hardening columns and silently returned `[]` | Applied migrations 00004–00006 in dependency order and made list errors explicit instead of converting DB errors to an empty library. |
| Watch links | `POST/DELETE /api/videos/[id]/watch-link`, workspace ownership checks, `revoked_at`, expiry/revocation enforcement | Create/copy/revoke feedback, active/expired/revoked states, confirmation, and read-only viewer behavior are implemented. |
| Viewer | `/watch/[token]` resolves the link server-side and renders `WatchPlayer` | The internal viewer route is preserved. YouTube remains an internal `youtube.com/embed/...` iframe and never redirects viewers to YouTube. |
| Tracking | Session capability token, HTML5 direct URL events, session-only behavior for iframe providers | Session preparation/error/retry UI remains honest; unsupported telemetry is not claimed. |
| Analytics | Aggregate services now also read `watch_sessions` and `watch_events` | Viewer/session rows expose hashed identity, video, session number/count, start, first play, last activity, end, watch time/completion where direct URL supports it, event timeline where supported, and provider scope. |
| Team/member read | `GET /api/admin/users` returns global profiles through `listAllUsers()`; the current list remains owner-only | Owners get the real manager; admins see the exact RBAC limitation instead of a fabricated directory. |
| Team/member mutation | Owner-only promote/demote via `/api/owner/admins`; owner-only activation via `/api/owner/users/[id]/status` | Real role/status controls remain protected server-side. |
| Invites | `POST /api/admin/users` now pre-provisions a profile by ClickUp email with validated `admin`/`viewer` role and active status | This is a real DB-backed pre-provisioning flow, not an email-sending claim. The user must later authorize ClickUp using the same email. The configured owner email is protected. |

## Implemented MVP UI

The `/videos` route provides a searchable responsive video library with cards, YouTube thumbnails derived from the source video ID, provider badges, link-lifecycle status, view/link/completion summaries, empty and no-match states, retryable loading errors, create/share/delete actions for owner/admin, and read-only browse behavior for viewers. Unsupported `avg_completion` values render as an em dash rather than a misleading zero. Non-YouTube sources use an honest placeholder because the current schema has no thumbnail field.

The video detail route shows source and description context, duration, provider-honest aggregate analytics, a per-session viewer analytics panel, an internal viewer action when an active link exists, and the watch-link panel. The panel uses the existing POST/DELETE contracts, copies returned URLs, handles clipboard failures, confirms revocation, and displays active, expired, and revoked states.

The public `/watch/[token]` architecture remains server-resolved and non-indexable. The player provides retry/preparation states, internal iframes for YouTube/Vimeo/Drive/Telegram, and a clear distinction between native direct-URL telemetry and iframe session-only behavior. No provider SDK, heatmap, watched-range claim, or fake event is introduced.

The dashboard navigation exposes `/watch-links` for workspace-scoped link management, `/analytics` for aggregate plus per-viewer/session activity, and `/owner/admins` for owners. The Watch Links page reuses `listVideos` and `WatchLinkPanel`; it does not introduce a second link service. `/owner/admins` uses the same dashboard shell and a real team manager with profile pre-provisioning and role/status mutations. `/admin/users` explains the owner-only boundary.

## Known backend boundaries

The current team list is global and owner-only despite the general `users.read` permission mapping. No per-workspace membership model was introduced. Admin role/status mutations remain intentionally unavailable under the existing owner-only role-management service.

Pre-provisioning is not an email delivery system. There is no mail provider or invite token in the current architecture; the created profile is linked to the real ClickUp identity when that email completes OAuth. This limitation is stated in the API response and UI.

YouTube, Vimeo, Google Drive, and Telegram remain iframe/session-only in the current player implementation; only `direct_url` has native HTML5 playback telemetry. Analytics therefore keeps watch time, completion, first play, and playback event timeline unavailable for iframe providers.

Production URL hardening remains included: production fallback is `https://trakeup.vercel.app`, loopback production values are rejected, and OAuth start/watch-link/logout code uses the canonical helper. Live migrations 00004–00006 are now applied and schema-verified in Supabase project `takexozckbnugupxnhuf`.
