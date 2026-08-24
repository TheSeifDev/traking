import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeOwnerLog, sanitizeOwnerMetadata } from "../src/lib/observability/logger";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

function pass(name: string) {
  console.log(`PASS ${name}`);
}

const sanitized = sanitizeOwnerMetadata({
  source_type: "youtube",
  provider_code: 153,
  session_token: "must-not-survive",
  authorization: "Bearer secret",
  nested: { cookie: "secret", state: "buffering", position: 12 },
  values: ["safe", 2, true],
});
assert.equal(sanitized.source_type, "youtube");
assert.equal(sanitized.provider_code, 153);
assert.equal("session_token" in sanitized, false);
assert.equal("authorization" in sanitized, false);
assert.match(JSON.stringify(sanitized), /buffering/);
assert.doesNotMatch(JSON.stringify(sanitized), /must-not-survive|Bearer secret|cookie/);
pass("metadata sanitizer strips secret-shaped keys and preserves safe primitives");

const normalized = normalizeOwnerLog({
  level: "ERROR",
  category: "DATABASE",
  action: "database_failure",
  userId: "not-a-uuid",
  sessionId: "not-a-uuid",
  status: 503,
  durationMs: 42,
  metadata: { message: "bounded" },
});
assert.equal(normalized.user_id, null);
assert.equal(normalized.session_id, null);
assert.equal(normalized.status, 503);
assert.equal(normalized.duration_ms, 42);
pass("log normalization bounds ids/status/duration");

const ownerRoutes = [
  "app/api/owner/observability/overview/route.ts",
  "app/api/owner/observability/logs/route.ts",
  "app/api/owner/observability/sessions/route.ts",
  "app/api/owner/observability/sessions/[sessionId]/route.ts",
  "app/api/owner/observability/system/route.ts",
  "app/api/owner/control-room/route.ts",
];
for (const file of ownerRoutes) {
  const source = read(file);
  assert.match(source, /withRole\(USER_ROLES\.OWNER/);
  assert.doesNotMatch(source, /withPermission\(|PERMISSIONS\./);
  assert.doesNotMatch(source, /session_token|watch_link_token|capability/i);
  pass(`owner-only route contract ${file}`);
}

const authWrapper = read("src/lib/auth/api-handler.ts");
assert.match(authWrapper, /requireRole\(minimumRole\)/);
assert.match(authWrapper, /unauthenticated/);
assert.match(authWrapper, /inactive_account/);
assert.match(authWrapper, /forbidden/);
pass("unauthenticated, inactive, and forbidden API states remain server-mapped");

const controlRoomRoute = read("app/api/owner/control-room/route.ts");
assert.match(controlRoomRoute, /withRole\(USER_ROLES\.OWNER/);
assert.match(controlRoomRoute, /range|organization_id|space_id|provider/);
assert.doesNotMatch(controlRoomRoute, /request\.json|sql|session_token|access_token|authorization/i);
pass("Control Room endpoint is owner-only, filterable, and does not accept request-controlled SQL or secrets");

const controlRoomService = read("src/lib/observability/control-room.ts");
assert.match(controlRoomService, /MAX_ORGANIZATIONS = 500/);
assert.match(controlRoomService, /MAX_SESSIONS = 5000/);
assert.match(controlRoomService, /from\(\"organizations\"\)/);
assert.match(controlRoomService, /from\(\"spaces\"\)/);
assert.match(controlRoomService, /organization_name/);
assert.match(controlRoomService, /execution_status: \"not_observed\"/);
assert.doesNotMatch(controlRoomService, /session_token|access_token|authorization|cookie/i);
pass("Control Room service uses bounded persisted queries and keeps Organization, Space, and unobserved cron execution distinct");

const observabilityService = read("src/lib/observability/service.ts");
assert.match(observabilityService, /getWorkspaceAnalytics/);
assert.match(observabilityService, /OWNER_QUERY_LIMIT = 100/);
assert.match(observabilityService, /OWNER_QUERY_MAX_OFFSET = 5000/);
assert.match(observabilityService, /range\(offset, offset \+ limit - 1\)/);
assert.doesNotMatch(observabilityService, /session_token|watch_link_token|capability/i);
pass("owner service reuses bounded analytics and does not expose capabilities");

const analyticsService = read("src/lib/videos/service.ts");
assert.match(analyticsService, /buildPlaybackHeatmap/);
assert.match(analyticsService, /sequence_number/);
assert.match(analyticsService, /from_position/);
pass("session inspector is contractually attached to existing event ordering/range logic");

const migration = read("supabase/migrations/20260824000006_create_owner_logs.sql");
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.owner_logs/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /USING \(false\)/);
assert.match(migration, /owner_logs_metadata_bounded/);
assert.match(migration, /idx_owner_logs_created_at/);
assert.doesNotMatch(migration, /session_token|watch_link_token|access_token|refresh_token|authorization/i);
pass("owner_logs migration is additive, bounded, indexed, and deny-by-default");

const trackingService = read("src/lib/tracking/service.ts");
assert.match(trackingService, /viewer_profile_id === viewerIdentity/);
assert.match(trackingService, /writeOwnerLog/);
assert.match(trackingService, /provider_error_reported/);
pass("tracking authorization and real lifecycle observability hooks remain present");

console.log("Owner Observability Verification: all checks passed");
