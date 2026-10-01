/**
 * TrackUp Sovereign Logout Route Handler
 * POST /api/auth/logout
 *
 * Revokes the server-side session in public.user_sessions,
 * expires session cookies, and redirects or returns JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/src/lib/app-url";
import { revokeSession } from "@/src/lib/auth/session-store";
import {
  SESSION_COOKIE_NAME,
  getExpiredSessionCookieOptions,
} from "@/src/lib/auth/session-token";
import { writeOwnerLog } from "@/src/lib/observability/logger";

export async function POST(request?: NextRequest): Promise<NextResponse> {
  const token = request?.cookies?.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await revokeSession(token);
      void writeOwnerLog({
        level: "INFO",
        category: "AUTH",
        action: "auth_logout",
        status: 200,
      });
    } catch {
      // Non-critical: continue clearing cookie even if database revocation errored
    }
  }

  const wantsJson =
    Boolean(request?.headers?.get("accept")?.includes("application/json")) ||
    Boolean(request?.headers?.get("content-type")?.includes("application/json"));

  const response = wantsJson
    ? NextResponse.json({ success: true }, { status: 200 })
    : NextResponse.redirect(new URL("/login", getAppUrl()));

  // Invalidate native TrackUp session cookie
  const expiredOptions = getExpiredSessionCookieOptions();
  response.cookies.set(SESSION_COOKIE_NAME, "", expiredOptions);

  // Invalidate legacy session cookie as well
  response.cookies.delete("trackup_user");

  return response;
}