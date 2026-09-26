/**
 * TEMPORARY FORENSIC HARNESS (diagnosis only — will be deleted or replaced
 * by the final regression test).
 *
 * Imports the REAL production route handlers and middleware, stubs all
 * outbound network (ClickUp OAuth + Supabase REST), and reproduces the
 * exact production OAuth callback contract:
 *
 *   1. GET /api/auth/clickup        -> capture authorize redirect + state cookie
 *   2. GET /api/auth/clickup/callback (cross-site navigation simulation)
 *                                   -> capture status / Location / Set-Cookie
 *   3. middleware("/dashboard")      -> capture whether the fresh session is accepted
 *
 * NODE_ENV is forced to "production" so cookie attributes match the Vercel build.
 */
import { NextRequest, NextResponse } from "next/server";

// --- Environment: must be set BEFORE importing app modules -------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(process.env as any).NODE_ENV = "production";
process.env.CLICKUP_CLIENT_ID = "test-client-id";
process.env.CLICKUP_CLIENT_SECRET = "test-client-secret";
process.env.TRACKUP_SESSION_SECRET = "forensic-session-secret-0123456789abcdef";
process.env.TRACKUP_OWNER_EMAIL = "owner@trackup.test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://trackup-forensic.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "forensic-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "forensic-service-role-key";
// Deliberately do NOT set NEXT_PUBLIC_APP_URL: the Vercel deployment may or may
// not have it; the code's fallback (https://trakeup.vercel.app) then applies.
process.env.CLICKUP_REDIRECT_URI = "https://trakeup.vercel.app/api/auth/clickup/callback";

const PROD_ORIGIN = "https://trakeup.vercel.app";

// --- Stub every outbound fetch ------------------------------------------------
type FetchLog = { url: string; method: string };
const fetchLog: FetchLog[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function stubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  fetchLog.push({ url, method });

  // ClickUp OAuth token exchange
  if (url.startsWith("https://api.clickup.com/api/v2/oauth/token")) {
    return jsonResponse({ access_token: "cu_access_token_forensic", token_type: "Bearer" });
  }
  // ClickUp authorized teams
  if (url.startsWith("https://api.clickup.com/api/v2/team")) {
    if (new URL(url).pathname === "/api/v2/team") {
      return jsonResponse({ teams: [{ id: "9001", name: "Forensic Workspace" }] });
    }
    // per-team member/space fetches during sync
    return jsonResponse({ members: [] });
  }
  // ClickUp spaces for sync
  if (url.startsWith("https://api.clickup.com/api/v2/space")) {
    return jsonResponse({ spaces: [] });
  }
  // ClickUp user identity
  if (url.startsWith("https://api.clickup.com/api/v2/user")) {
    return jsonResponse({ user: { id: 4242, email: "mobile-user@trackup.test", username: "Mobile Forensic" } });
  }

  // Supabase REST: route by table + method
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (url.startsWith(supabaseUrl)) {
    const path = new URL(url).pathname; // /rest/v1/<table>
    const table = path.split("/").pop() ?? "";

    if (method === "GET" && table === "profiles") {
      return jsonResponse([
        {
          id: "profile-forensic-0001",
          email: "mobile-user@trackup.test",
          role: "viewer",
          is_active: true,
          name: "Mobile Forensic",
          clickup_user_id: "4242",
        },
      ]);
    }
    if (method === "GET" && table === "workspaces") {
      return jsonResponse([]);
    }
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      if (table === "workspaces") {
        return jsonResponse([{ id: 777, clickup_team_id: "9001", name: "Forensic Workspace" }], 201);
      }
      return jsonResponse([], 201);
    }
    // auth/v1 (supabase.auth.getUser in middleware)
    if (url.includes("/auth/v1/")) {
      return jsonResponse({ error: "no session" }, 401);
    }
    return jsonResponse([], 200);
  }

  console.error("UNSTUBBED FETCH:", method, url);
  return jsonResponse({ error: "unstubbed" }, 500);
}

(globalThis as { fetch: typeof fetch }).fetch = stubFetch as typeof fetch;

// --- Helper: parse Set-Cookie from a NextResponse -----------------------------
function describeCookies(response: NextResponse): string {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.length
    ? raw.map((c) => `    ${c}`).join("\n")
    : "    (none)";
}

function cookieValueFrom(setCookies: string[], name: string): string | null {
  for (const raw of setCookies) {
    if (raw.startsWith(`${name}=`)) {
      return raw.split(";")[0].slice(name.length + 1);
    }
  }
  return null;
}

async function main(): Promise<void> {
  // --- Import the REAL handlers (after stubbing) --------------------------------
  const initiationRoute = await import("../app/api/auth/clickup/route");
  const callbackRoute = await import("../app/api/auth/clickup/callback/route");
  const { middleware } = await import("../middleware");

  // =============================================================================
  // STEP 1+2: OAuth initiation — same-site navigation from /login
  // =============================================================================
  console.log("==================================================================");
  console.log("STEP 1: GET /api/auth/clickup  (same-site navigation from /login)");
  console.log("==================================================================");
  const initiationRequest = new NextRequest(`${PROD_ORIGIN}/api/auth/clickup`, {
    headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    },
  });
  const initiationResponse = await initiationRoute.GET(initiationRequest);
  const initiationSetCookies = initiationResponse.headers.getSetCookie?.() ?? [];
  console.log("  status:", initiationResponse.status);
  console.log("  Location:", initiationResponse.headers.get("location"));
  console.log("  Set-Cookie:");
  console.log(describeCookies(initiationResponse));

  const stateCookieValue = cookieValueFrom(initiationSetCookies, "trackup_oauth_state");
  const returnCookieValue = cookieValueFrom(initiationSetCookies, "trackup_oauth_return");
  if (!stateCookieValue) {
    console.error("FATAL: initiation did not set trackup_oauth_state");
    process.exit(1);
  }

  // =============================================================================
  // STEP 3-13: OAuth callback — top-level CROSS-SITE navigation from ClickUp
  // =============================================================================
  console.log("");
  console.log("==================================================================");
  console.log("STEP 2: GET /api/auth/clickup/callback?code=...&state=...  (cross-site top-level GET from app.clickup.com)");
  console.log("==================================================================");
  const callbackUrl = `${PROD_ORIGIN}/api/auth/clickup/callback?code=forensic-code&state=${encodeURIComponent(stateCookieValue)}`;
  const callbackRequest = new NextRequest(callbackUrl, {
    headers: {
      // What a browser sends on the cross-site top-level navigation back from ClickUp:
      "cookie": `trackup_oauth_state=${stateCookieValue}; trackup_oauth_return=${returnCookieValue ?? "%2Fdashboard"}`,
      "referer": "https://app.clickup.com/",
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    },
    redirect: "manual",
  });
  const callbackResponse = await callbackRoute.GET(callbackRequest);
  const callbackSetCookies = callbackResponse.headers.getSetCookie?.() ?? [];
  console.log("  status:", callbackResponse.status);
  console.log("  Location:", callbackResponse.headers.get("location"));
  console.log("  Set-Cookie:");
  console.log(describeCookies(callbackResponse));

  const sessionCookieValue = cookieValueFrom(callbackSetCookies, "trackup_user");
  console.log("");
  console.log("  session cookie present:", Boolean(sessionCookieValue));

  if (!sessionCookieValue) {
    console.error("FATAL: callback completed provisioning but did NOT set trackup_user");
    process.exit(1);
  }

  // =============================================================================
  // STEP 14: middleware on the post-callback redirect target (/dashboard)
  // =============================================================================
  console.log("");
  console.log("==================================================================");
  console.log("STEP 3: middleware('/dashboard') with the fresh session cookie");
  console.log("==================================================================");
  const dashboardRequest = new NextRequest(`${PROD_ORIGIN}/dashboard`, {
    headers: {
      "cookie": `trackup_user=${sessionCookieValue}`,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    },
  });
  const middlewareResponse = await middleware(dashboardRequest);
  console.log("  status:", middlewareResponse.status);
  console.log("  Location:", middlewareResponse.headers.get("location"));
  console.log("  middleware let the request through:", middlewareResponse.status === 200);

  // Also simulate the logout route redirect origin
  const logoutRoute = await import("../app/api/auth/logout/route");
  const logoutResponse = await logoutRoute.POST();
  console.log("");
  console.log("logout redirect Location:", logoutResponse.headers.get("location"));

  console.log("");
  console.log("==================================================================");
  console.log("Outbound fetches performed by the callback:");
  console.log("==================================================================");
  for (const call of fetchLog) {
    console.log(`  ${call.method} ${call.url}`);
  }
}

main().catch((err) => {
  console.error("FORENSIC HARNESS FAILED:", err);
  process.exit(1);
});
