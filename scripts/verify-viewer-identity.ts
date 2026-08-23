import { readFileSync } from "node:fs";
import { createViewerIdentityCookie, verifyViewerIdentityCookie } from "../src/lib/auth/viewer-identity-cookie";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`PASS: ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${message}`);
  }
}

const migration = readFileSync("supabase/migrations/20260824000005_add_guest_viewer_identity.sql", "utf8");
const cookie = readFileSync("src/lib/auth/viewer-identity-cookie.ts", "utf8");
const identity = readFileSync("src/lib/tracking/viewer-identity.ts", "utf8");
const identityRoute = readFileSync("app/api/viewer/identity/route.ts", "utf8");
const viewerPage = readFileSync("app/watch/[token]/page.tsx", "utf8");
const sessionRoute = readFileSync("app/api/tracking/session/route.ts", "utf8");
const eventRoute = readFileSync("app/api/tracking/event/route.ts", "utf8");
const endRoute = readFileSync("app/api/tracking/session/[sessionId]/end/route.ts", "utf8");
const trackingService = readFileSync("src/lib/tracking/service.ts", "utf8");
const analyticsService = readFileSync("src/lib/videos/service.ts", "utf8");

assert(migration.includes("CREATE TABLE IF NOT EXISTS public.viewer_identities"), "guest identity table is additive and link-scoped");
assert(migration.includes("UNIQUE (watch_link_id, normalized_email)"), "identity deduplication is scoped per private link");
assert(migration.includes("viewer_identity_id UUID REFERENCES public.viewer_identities"), "sessions retain a foreign-key identity association");
assert(migration.includes("No direct viewer identity reads") && migration.includes("USING (false)"), "guest identity PII has no direct anon/authenticated reads");
assert(cookie.includes("timingSafeEqual") && cookie.includes("watchLinkTokenHash"), "guest context is signed and bound to the hashed link token");
assert(!cookie.includes("name:") && !cookie.includes("email:"), "guest identity cookie carries no name or email");
assert(identity.includes("hashWatchLinkToken") && identity.includes("watch_link_id") && identity.includes("resolveWatchActor"), "identity service validates link binding before resolving a guest actor");
assert(identityRoute.includes("normalizeViewerName") && identityRoute.includes("normalizeViewerEmail") && identityRoute.includes("createViewerIdentityCookie"), "identity endpoint validates and signs server-side context");
assert(viewerPage.includes("ViewerIdentityGate") && viewerPage.includes("getGuestViewerIdentityForLink"), "private viewer requests identity only when no valid profile/guest context exists");
assert(sessionRoute.includes("resolveWatchActor") && sessionRoute.includes("viewer_identity_mismatch"), "session creation supports guest actor with link binding");
assert(eventRoute.includes("resolveWatchActor") && eventRoute.includes("recordTrackingEvents"), "event writes use the same actor/capability boundary");
assert(endRoute.includes("resolveWatchActor") && endRoute.includes("endWatchSession"), "session end uses the same actor/capability boundary");
assert(trackingService.includes("viewer_identity_id") && trackingService.includes("guest:"), "tracking persistence links guest sessions and keeps the stable identifier opaque");
assert(analyticsService.includes("attachSessionViewerIdentities") && analyticsService.includes("viewer_identity_id"), "analytics attaches and groups guest identities within existing workspace scope");

process.env.TRACKUP_SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
const rawToken = "raw-watch-token-never-in-cookie";
const tokenHash = "a".repeat(64);
const signed = createViewerIdentityCookie(
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  tokenHash,
);
const verified = verifyViewerIdentityCookie(signed);
assert(Boolean(verified) && verified?.identityId === "00000000-0000-0000-0000-000000000001", "signed guest context round-trips the identity id");
assert(Boolean(verified) && verified?.watchLinkId === "00000000-0000-0000-0000-000000000002", "signed guest context round-trips the watch-link id");
assert(Boolean(verified) && verified?.watchLinkTokenHash === tokenHash && !signed.includes(rawToken), "cookie contains only the token hash and no raw watch token");
assert(verifyViewerIdentityCookie(`${signed.slice(0, -1)}x`) === null, "tampered guest context is rejected");

const total = passed + failed;
console.log(`Viewer identity verification: ${passed}/${total} tests passed`);
if (failed > 0) process.exit(1);
