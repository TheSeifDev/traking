import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as getDatabaseHealth } from "../app/api/health/db/route";
import { checkDatabaseHealth } from "../src/lib/health/db";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const pass = (name: string) => console.log(`PASS ${name}`);

const healthRoute = read("app/api/health/db/route.ts");
assert.match(healthRoute, /export async function GET\(request: NextRequest\)/);
assert.match(healthRoute, /process\.env\.CRON_SECRET/);
assert.match(healthRoute, /authorization/);
assert.match(healthRoute, /timingSafeEqual/);
assert.match(healthRoute, /isTrustedVercelCron/);
assert.match(healthRoute, /startCronExecution/);
assert.match(healthRoute, /finishCronExecution/);
assert.match(healthRoute, /idempotent_replay/);
assert.match(healthRoute, /status: "ok"/);
assert.match(healthRoute, /status: "degraded"/);
assert.match(healthRoute, /status: 401/);
assert.match(healthRoute, /statusCode = health\.status === "degraded" \? 503 : 200/);
assert.match(healthRoute, /status: statusCode/);
assert.doesNotMatch(healthRoute, /req\.body|request\.json|rawSql|from\(.*request/i);
assert.doesNotMatch(healthRoute, /watch_sessions|watch_events|analytics|profiles.*insert|videos.*update/i);
pass("health route is protected, bounded, and does not expose a user-controlled query or tracking mutation");

async function verifyRuntimeFailurePaths() {
  const originalCronSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const unauthorized = await getDatabaseHealth(new NextRequest("https://trakeup.vercel.app/api/health/db"));
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { error: "unauthorized" });
  const malformed = await getDatabaseHealth(new NextRequest("https://trakeup.vercel.app/api/health/db", { headers: { authorization: "Basic not-a-cron-token" } }));
  assert.equal(malformed.status, 401);
  pass("missing and malformed cron authorization are rejected without probing Supabase");

  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const unavailable = await checkDatabaseHealth();
  assert.equal(unavailable.status, "degraded");
  assert.equal(unavailable.error, "database_unavailable");
  assert.ok(Number.isFinite(unavailable.latency_ms));
  assert.match(unavailable.checked_at, /^\d{4}-\d{2}-\d{2}T/);
  pass("missing Supabase configuration produces a safe degraded result without throwing or leaking details");

  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
}

const probe = read("src/lib/health/db.ts");
const executableProbe = probe.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
assert.match(executableProbe, /createAdminClient/);
assert.match(executableProbe, /from\("profiles"\)/);
assert.match(executableProbe, /select\("id", \{ head: true \}\)/);
assert.match(executableProbe, /catch/);
assert.match(executableProbe, /database_unavailable/);
assert.doesNotMatch(executableProbe, /insert\(|update\(|upsert\(|delete\(/);
assert.doesNotMatch(executableProbe, /watch_sessions|watch_events|watch_links|analytics|spaces|space_members/i);
pass("shared probe uses the existing server-only Supabase client and one read-only profiles head query");

const cronExecutionService = read("src/lib/health/cron-executions.ts");
assert.match(cronExecutionService, /x-vercel-cron-schedule/);
assert.match(cronExecutionService, /execution_key/);
assert.match(cronExecutionService, /MAX_HISTORY = 100/);
assert.doesNotMatch(cronExecutionService, /access_token|authorization.*metadata|watch_events|watch_sessions/i);
pass("cron execution evidence is schedule-bound, idempotent, bounded, and free of provider/tracking secrets");

const config = JSON.parse(read("vercel.json")) as { crons?: Array<{ path?: string; schedule?: string }> };
assert.ok(Array.isArray(config.crons));
assert.equal(config.crons?.length, 1);
assert.deepEqual(config.crons?.[0], { path: "/api/health/db", schedule: "0 3 * * *" });
assert.equal(config.crons?.[0]?.schedule?.trim().split(/\s+/).length, 5);
pass("exactly one daily five-field Vercel cron targets the health endpoint");

const observability = read("src/lib/observability/service.ts");
assert.match(observability, /checkDatabaseHealth/);
assert.match(observability, /database_status/);
assert.match(observability, /database_latency_ms/);
assert.match(observability, /database_error/);
pass("Owner Observability reuses the shared health probe and exposes bounded status metadata");

const ownerConsole = read("src/components/owner/OwnerControlRoomPanel.tsx");
assert.match(ownerConsole, /database_status/);
assert.match(ownerConsole, /database_latency_ms/);
assert.match(ownerConsole, /Database \$\{databaseLabel\.toLowerCase\(\)\}/);
assert.match(ownerConsole, /does not write tracking, sessions, analytics/);
pass("Owner Console displays real database status and latency without claiming scheduler evidence");

void verifyRuntimeFailurePaths()
  .then(() => console.log("TrackUp Health Verification: all checks passed"))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
