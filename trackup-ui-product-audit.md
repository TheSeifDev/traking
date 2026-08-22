# TrackUp UI/Product Audit — MVP boundary

## Existing backend and product contracts

| Product area | Confirmed implementation | Safe UI decision in this pass |
| --- | --- | --- |
| Workspace/auth | `guardAuth`, `guardAdmin`, `guardOwner`, primary workspace lookup, signed session cookie | Reused existing guards and did not add membership architecture. |
| Video API | `GET/POST /api/videos`, `GET/PUT/DELETE /api/videos/[id]`, workspace-scoped service queries | Built the library and detail UX on the existing endpoints. Server authorization remains authoritative. |
| Watch links | `POST/DELETE /api/videos/[id]/watch-link`, workspace ownership checks, `revoked_at`, expiry/revocation enforcement | Added create/copy/revoke feedback, active/expired/revoked states, confirmation, and read-only viewer behavior. |
| Viewer | `/watch/[token]` resolves the link server-side and renders `WatchPlayer` | Kept the internal viewer route. YouTube remains an internal `youtube.com/embed/...` iframe and never redirects viewers to YouTube. |
| Tracking | Session capability token, HTML5 direct URL events, session-only behavior for iframe providers | Added session preparation/error/retry UI and explicit provider capability copy without claiming unsupported telemetry. |
| Analytics | Workspace/video analytics services and routes; direct URL playback metrics only | Existing provider-honest analytics is preserved; unsupported completion remains unavailable rather than zero. |
| Team/member read | `GET /api/admin/users` returns profiles through `listAllUsers()`; actual list implementation is owner-only and global | Added an owner-only team manager. Admins see the exact limitation instead of a fabricated directory. |
| Team/member mutation | Owner-only promote/demote via `/api/owner/admins`; owner-only activation via `/api/owner/users/[id]/status` | Added real promote/demote and activate/deactivate controls with server error/success states. Owner and self actions are disabled in UI; backend remains the enforcement boundary. |
| Invites | `POST /api/admin/users` intentionally returns `501 not_implemented` | No invite control is presented as functional. The backend gap is shown explicitly. |

## Implemented MVP UI

The `/videos` route now provides a searchable responsive video library with cards, YouTube thumbnails derived from the source video ID, provider badges, link-lifecycle status, view/link/completion summaries, empty and no-match states, retryable loading errors, create/share/delete actions for owner/admin, and read-only browse behavior for viewers. Unsupported `avg_completion` values render as an em dash rather than a misleading zero. Non-YouTube sources use an honest placeholder because the current schema has no thumbnail field.

The video detail route now shows source and description context, duration, provider-honest analytics, an internal viewer action when an active link exists, and the upgraded watch-link panel. The panel uses the existing POST/DELETE contracts, copies returned URLs when the endpoint provides one, handles clipboard failures, confirms revocation, and displays active, expired, and revoked states.

The public `/watch/[token]` architecture is unchanged and remains server-resolved and non-indexable. The client player now provides a real retry state for session creation, a preparation overlay, an internal iframe for YouTube/Vimeo/Drive/Telegram, and a clear distinction between native direct-URL telemetry and iframe session-only behavior. No provider SDK, heatmap, watched-range claim, or fake event is introduced.

The dashboard navigation now exposes `/watch-links` for workspace-scoped link management and `/owner/admins` for owners. The Watch Links page reuses `listVideos` and `WatchLinkPanel`; it does not introduce a second link service. `/owner/admins` uses the same dashboard shell and a real team manager. The manager calls the existing owner APIs only. `/admin/users` is no longer a blank placeholder: it explains why the current admin list/invite capabilities are unavailable and links owners to the supported owner flow.

## Known backend boundaries

The current team list is global and owner-only despite the general `users.read` permission mapping. This is displayed as a limitation rather than converted into a per-workspace model. Invite/create is intentionally unsupported with a real `501`. YouTube, Vimeo, Google Drive, and Telegram remain iframe/session-only in the current player implementation; only `direct_url` has native HTML5 playback telemetry. Analytics therefore keeps completion/watch-time unavailable for iframe providers.

Production URL hardening is included in the same branch: production fallback is `https://trakeup.vercel.app`, loopback production values are rejected, and OAuth start/watch-link/logout code uses the canonical helper. Vercel environment values and the exact ClickUp OAuth allowlist still require authenticated production configuration and a post-deploy live verification; code checks alone do not prove that deployment configuration.
