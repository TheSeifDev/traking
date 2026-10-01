/**
 * TrackUp Sovereign Login Route Handler
 * POST /api/auth/login
 *
 * Authenticates users using native database credentials (username or email + password).
 * Mints an HttpOnly secure trackup_session cookie backed by public.user_sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyPassword, verifyDummyPassword } from "@/src/lib/auth/password";
import { createSession } from "@/src/lib/auth/session-store";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/src/lib/auth/session-token";
import { checkRateLimit, resetRateLimit } from "@/src/lib/auth/rate-limiter";
import { writeOwnerLog } from "@/src/lib/observability/logger";
import { isValidRole, type AuthenticatedUser } from "@/src/types/auth";

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown-ip";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown-agent";

  // 1. Parse JSON payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { identifier, password } = body as Record<string, unknown>;

  if (typeof identifier !== "string" || !identifier.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }

  const cleanIdentifier = identifier.trim().toLowerCase();

  // 2. IP Rate limit check
  const ipRateLimit = await checkRateLimit(`ip:${ip}`, 15, 900);
  if (!ipRateLimit.allowed) {
    void writeOwnerLog({
      level: "WARN",
      category: "AUTH",
      action: "auth_rate_limited_ip",
      status: 429,
      metadata: { ip, identifier: cleanIdentifier },
    });
    return NextResponse.json(
      { error: "rate_limited", message: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  // 3. User Identifier Rate limit check
  const userRateLimit = await checkRateLimit(`user:${cleanIdentifier}`, 6, 900);
  if (!userRateLimit.allowed) {
    void writeOwnerLog({
      level: "WARN",
      category: "AUTH",
      action: "auth_rate_limited_user",
      status: 429,
      metadata: { ip, identifier: cleanIdentifier },
    });
    return NextResponse.json(
      { error: "rate_limited", message: "Account temporarily locked due to multiple failed attempts. Try again later." },
      { status: 429 }
    );
  }

  try {
    const supabase = createAdminClient();

    // 4. Query profile by username OR email
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.${cleanIdentifier},email.ilike.${cleanIdentifier}`)
      .maybeSingle();

    // 5. Account not found -> execute dummy hash verification to defeat timing attacks
    if (error || !profile) {
      await verifyDummyPassword(password);
      void writeOwnerLog({
        level: "WARN",
        category: "AUTH",
        action: "auth_login_failed_not_found",
        status: 401,
        metadata: { ip, identifier: cleanIdentifier },
      });
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // 6. Check active status
    if (!profile.is_active) {
      void writeOwnerLog({
        level: "WARN",
        category: "AUTH",
        action: "auth_login_inactive_account",
        userId: profile.id,
        status: 403,
        metadata: { ip, identifier: cleanIdentifier },
      });
      return NextResponse.json({ error: "account_inactive" }, { status: 403 });
    }

    // 7. Check account lockout
    if (profile.locked_until && new Date(profile.locked_until).getTime() > Date.now()) {
      void writeOwnerLog({
        level: "WARN",
        category: "AUTH",
        action: "auth_login_account_locked",
        userId: profile.id,
        status: 423,
        metadata: { ip, identifier: cleanIdentifier, locked_until: profile.locked_until },
      });
      return NextResponse.json(
        { error: "account_locked", message: "Account is temporarily locked due to repeated failed attempts." },
        { status: 423 }
      );
    }

    // 8. Verify password
    if (!profile.password_hash) {
      await verifyDummyPassword(password);
      void writeOwnerLog({
        level: "WARN",
        category: "AUTH",
        action: "auth_login_missing_password_hash",
        userId: profile.id,
        status: 401,
      });
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, profile.password_hash);

    if (!passwordValid) {
      const nextFailedAttempts = (profile.failed_login_attempts ?? 0) + 1;
      const willLock = nextFailedAttempts >= 5;
      const lockedUntil = willLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

      await supabase
        .from("profiles")
        .update({
          failed_login_attempts: nextFailedAttempts,
          locked_until: lockedUntil,
        })
        .eq("id", profile.id);

      void writeOwnerLog({
        level: "WARN",
        category: "AUTH",
        action: willLock ? "auth_account_locked_failed_attempts" : "auth_login_failed_password",
        userId: profile.id,
        status: 401,
        metadata: { ip, failed_attempts: nextFailedAttempts, locked: willLock },
      });

      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    // 9. Password valid: reset failure counters & update last_login_at
    const nowIso = new Date().toISOString();
    await supabase
      .from("profiles")
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: nowIso,
      })
      .eq("id", profile.id);

    // 10. Create database session
    const { token, sessionId, expiresAt } = await createSession(profile.id, {
      ip,
      userAgent,
    });

    // Reset rate limits on success
    void resetRateLimit(`user:${cleanIdentifier}`);

    // Log success
    void writeOwnerLog({
      level: "INFO",
      category: "AUTH",
      action: "auth_login_success",
      userId: profile.id,
      sessionId,
      status: 200,
      metadata: { ip },
    });

    const user: AuthenticatedUser = {
      id: profile.id,
      username: profile.username ?? null,
      email: profile.email,
      role: isValidRole(profile.role) ? profile.role : "viewer",
      is_active: profile.is_active,
      name: profile.name ?? null,
    };

    // 11. Create response & attach secure HttpOnly cookie
    const response = NextResponse.json(
      {
        success: true,
        user,
      },
      { status: 200 }
    );

    const cookieOptions = getSessionCookieOptions(new Date(expiresAt));
    response.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions);

    return response;
  } catch (err) {
    console.error("Login unexpected error:", err);
    void writeOwnerLog({
      level: "ERROR",
      category: "AUTH",
      action: "auth_login_server_exception",
      status: 500,
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
