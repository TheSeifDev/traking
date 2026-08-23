import { readFileSync } from "node:fs";
import { createInvitationContextCookie, verifyInvitationContextCookie } from "../src/lib/auth/invitation-cookie";
import { hashInvitationToken } from "../src/lib/auth/invitations";
import { sendTransactionalEmail } from "../src/lib/email/resend";

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string): void {
  if (condition) { console.log(`[PASS] ${label}`); passed++; }
  else { console.error(`[FAIL] ${label}`); failed++; }
}

const service = readFileSync("src/lib/auth/invitations.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260824000001_create_invitations_and_profile_presence.sql", "utf8");
const acceptance = readFileSync("supabase/migrations/20260824000002_add_invitation_acceptance_rpc.sql", "utf8");
const presence = readFileSync("supabase/migrations/20260824000003_add_profile_last_seen_rpc.sql", "utf8");
const adminRoute = readFileSync("app/api/admin/users/route.ts", "utf8");
const presenceRoute = readFileSync("app/api/auth/presence/route.ts", "utf8");
const startRoute = readFileSync("app/api/invitations/start/route.ts", "utf8");

assert(service.includes("randomBytes(32)") && service.includes("createHash(\"sha256\")"), "creation uses cryptographically random raw token and SHA-256 digest");
assert(!service.includes("token: rawToken") && !service.includes("raw_token: rawToken"), "database insert does not persist raw token");
assert(service.includes("requirePermission(permission)") && service.includes("PERMISSIONS.USERS_MANAGE"), "mutations require users.manage server authorization");
assert(migration.includes("token_hash TEXT NOT NULL UNIQUE") && migration.includes("accepted_at") && migration.includes("revoked_at") && migration.includes("expires_at"), "schema persists single-use lifecycle timestamps and unique digest");
assert(migration.includes("role IN ('admin'::public.user_role, 'viewer'::public.user_role)"), "schema rejects owner invitation escalation");
assert(acceptance.includes("accepted_at IS NULL") && acceptance.includes("revoked_at IS NULL") && acceptance.includes("expires_at <= v_now"), "acceptance rejects replay, revoked, and expired invitations");
assert(acceptance.includes("v_invitation.email <> v_email") && acceptance.includes("v_profile.email <> v_email"), "acceptance requires exact normalized same-email identity");
assert(acceptance.includes("FOR UPDATE") && acceptance.includes("SET accepted_at = v_now"), "acceptance locks and marks one invitation atomically");
assert(adminRoute.includes("withPermission") && adminRoute.includes("PERMISSIONS.USERS_MANAGE") && adminRoute.includes("delivery_not_configured"), "creation endpoint is protected and exposes configuration failure honestly");
assert(startRoute.includes("hashInvitationToken") && startRoute.includes("createInvitationContextCookie"), "invite start carries only hashed context through OAuth");
assert(presence.includes("interval '5 minutes'") && presenceRoute.includes("withAuth") && presenceRoute.includes("user.id"), "presence uses authenticated identity and server debounce");
assert(!presenceRoute.includes("request.json") && !presenceRoute.includes("user_id"), "presence route accepts no client-supplied identity");

async function main(): Promise<void> {
  const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM_EMAIL;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;
const noProvider = await sendTransactionalEmail({ to: "controlled@example.com", subject: "test", html: "<p>test</p>", text: "test", idempotencyKey: "test-invitation-boundary" });
assert(!noProvider.success && noProvider.error === "delivery_not_configured", "provider boundary never reports sent without configured credentials");
if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL; else process.env.RESEND_FROM_EMAIL = originalFrom;

const rawToken = "test-token-that-is-never-persisted";
const digest = hashInvitationToken(rawToken);
assert(digest.length === 64 && digest !== rawToken, "token hashing returns a non-reversible-length digest");
process.env.TRACKUP_SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
const context = createInvitationContextCookie("00000000-0000-0000-0000-000000000001", digest);
const verified = verifyInvitationContextCookie(context);
assert(Boolean(verified) && verified?.tokenHash === digest && !context.includes(rawToken), "signed OAuth context verifies without containing raw token");

const total = passed + failed;
console.log(`Invitation verification: ${passed}/${total} tests passed`);
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
