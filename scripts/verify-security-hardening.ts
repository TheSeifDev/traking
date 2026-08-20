import { readFileSync } from "node:fs";
import { createSignedSessionCookie, verifySignedSessionCookie } from "../src/lib/auth/session-cookie";
import { USER_ROLES, type AuthenticatedUser } from "../src/types/auth";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed += 1;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed += 1;
  }
}

function section(title: string): void {
  console.log(`\n-- ${title}`);
}

process.env.TRACKUP_SESSION_SECRET = "test_secret_with_at_least_32_characters";

const viewer: AuthenticatedUser = {
  id: "viewer-user-uuid",
  email: "viewer@trackup.io",
  role: USER_ROLES.VIEWER,
  is_active: true,
  name: "Viewer",
  clickup_user_id: "cu_viewer",
};

async function runTests(): Promise<void> {
  section("Signed TrackUp session cookie");

  const signed = await createSignedSessionCookie(viewer);
  const verified = await verifySignedSessionCookie(signed);
  assert(verified?.id === viewer.id, "valid signed session verifies");
  assert(verified?.role === USER_ROLES.VIEWER, "verified session preserves role");
  assert(!signed.includes(viewer.email), "cookie payload is base64url encoded, not raw JSON");

  const [payload, signature] = signed.split(".");
  const forgedPayload = payload.slice(0, -1) + (payload.endsWith("A") ? "B" : "A");
  assert(await verifySignedSessionCookie(`${forgedPayload}.${signature}`) === null, "payload tampering is rejected");
  assert(await verifySignedSessionCookie(`${payload}.invalidsignature`) === null, "signature tampering is rejected");
  assert(await verifySignedSessionCookie(JSON.stringify(viewer)) === null, "legacy unsigned JSON cookie is rejected");

  section("RLS migration hardening");

  const migration = readFileSync("supabase/migrations/20260820000001_create_rbac_and_profiles.sql", "utf8");
  assert(migration.includes('CREATE POLICY "No direct profile updates"'), "profile UPDATE is denied to authenticated clients");
  assert(migration.includes('CREATE POLICY "No direct profile inserts"'), "profile INSERT is denied to authenticated clients");
  assert(migration.includes('CREATE POLICY "No direct profile deletes"'), "profile DELETE is denied to authenticated clients");
  assert(!migration.includes('CREATE POLICY "Only owners can delete profiles"'), "owner profile deletion policy is absent");
  assert(migration.includes("REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC"), "SECURITY DEFINER helper execute is revoked from PUBLIC");

  section("OAuth state and service-role checks");

  const oauthStart = readFileSync("app/api/auth/clickup/route.ts", "utf8");
  const oauthCallback = readFileSync("app/api/auth/clickup/callback/route.ts", "utf8");
  const adminClient = readFileSync("utils/supabase/admin.ts", "utf8");

assert(oauthStart.includes("trackup_oauth_state"), "OAuth start stores state cookie");
assert(oauthStart.includes("https://app.clickup.com/api?"), "OAuth start uses ClickUp authorization URL");
assert(oauthCallback.includes("state !== expectedState"), "OAuth callback validates returned state");
assert(oauthCallback.includes("https://api.clickup.com/api/v2/oauth/token"), "OAuth callback uses ClickUp token URL");
assert(oauthCallback.includes("https://api.clickup.com/api/v2/team"), "OAuth callback verifies authorized Workspaces");
assert(oauthCallback.includes("Authorization: `Bearer ${tokens.access_token}`"), "OAuth API requests use Bearer token header");
assert(oauthCallback.includes("createSignedSessionCookie"), "OAuth callback writes signed session cookie");
assert(!adminClient.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;"), "admin client does not fall back to public key");

  const total = passed + failed;
  console.log(`\n${"=".repeat(56)}`);
  console.log(`TrackUp Security Hardening: ${passed}/${total} tests passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
