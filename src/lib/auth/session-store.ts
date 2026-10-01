/**
 * TrackUp Server-Side Session Storage & Lifecycle Engine
 *
 * Implements database-backed session management in public.user_sessions.
 * Stores only cryptographic SHA-256 hashes of session tokens.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { isValidRole, type AuthenticatedUser, type UserRole } from "@/src/types/auth";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_MAX_AGE_SECONDS,
} from "./session-token";

export interface UserSessionRecord {
  id: string;
  user_id: string;
  session_token_hash: string;
  expires_at: string;
  last_used_at: string;
  created_at: string;
  is_revoked: boolean;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface SessionValidationResult {
  user: AuthenticatedUser;
  sessionId: string;
  expiresAt: string;
}

/**
 * Creates a new active database session for a user.
 * Returns the raw token that MUST be sent to the client in an HttpOnly cookie.
 */
export async function createSession(
  userId: string,
  metadata?: { ip?: string | null; userAgent?: string | null }
): Promise<{ token: string; sessionId: string; expiresAt: string }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: userId,
      session_token_hash: tokenHash,
      expires_at: expiresAt,
      last_used_at: now.toISOString(),
      created_at: now.toISOString(),
      is_revoked: false,
      ip_address: metadata?.ip ?? null,
      user_agent: metadata?.userAgent ? metadata.userAgent.slice(0, 500) : null,
    })
    .select("id, expires_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create session: ${error?.message ?? "unknown database error"}`);
  }

  return {
    token,
    sessionId: data.id,
    expiresAt: data.expires_at,
  };
}

/**
 * Authoritatively validates a raw session token against the database.
 * Returns null if token is invalid, revoked, expired, or account is inactive.
 */
export async function validateSession(rawToken: string | undefined | null): Promise<SessionValidationResult | null> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length < 32) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const now = new Date().toISOString();

  try {
    const supabase = createAdminClient();

    // Query active session and join with profile
    const { data: session, error } = await supabase
      .from("user_sessions")
      .select(`
        id,
        user_id,
        expires_at,
        last_used_at,
        created_at,
        is_revoked,
        profiles!inner (
          id,
          username,
          email,
          role,
          name,
          is_active,
          clickup_user_id,
          password_changed_at
        )
      `)
      .eq("session_token_hash", tokenHash)
      .eq("is_revoked", false)
      .gt("expires_at", now)
      .maybeSingle();

    if (error || !session || !session.profiles) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = session.profiles as any;

    // Reject inactive accounts
    if (!profile.is_active) {
      return null;
    }

    // Reject unrecognized roles
    if (!isValidRole(profile.role)) {
      return null;
    }

    // Invalidate sessions created before a password change
    if (profile.password_changed_at) {
      const passwordChangedAt = new Date(profile.password_changed_at).getTime();
      const sessionCreatedAt = new Date(session.created_at).getTime();
      if (passwordChangedAt > sessionCreatedAt) {
        // Asynchronously mark this session revoked
        void supabase
          .from("user_sessions")
          .update({ is_revoked: true, revoked_at: now })
          .eq("id", session.id);
        return null;
      }
    }

    // Sliding window expiration: if session last used > 12 hours ago, extend by 7 days
    const lastUsedMs = new Date(session.last_used_at).getTime();
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    if (Date.now() - lastUsedMs > twelveHoursMs) {
      const nextExpiry = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
      void supabase
        .from("user_sessions")
        .update({
          last_used_at: now,
          expires_at: nextExpiry,
        })
        .eq("id", session.id);
    }

    const user: AuthenticatedUser = {
      id: profile.id,
      username: profile.username ?? null,
      email: profile.email,
      role: profile.role as UserRole,
      is_active: profile.is_active,
      name: profile.name ?? null,
      clickup_user_id: profile.clickup_user_id ?? null,
    };

    return {
      user,
      sessionId: session.id,
      expiresAt: session.expires_at,
    };
  } catch {
    return null;
  }
}

/**
 * Revokes a single session by its raw token.
 */
export async function revokeSession(rawToken: string | undefined | null): Promise<boolean> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length < 32) {
    return false;
  }

  const tokenHash = hashSessionToken(rawToken);
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("user_sessions")
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq("session_token_hash", tokenHash);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Revokes all active sessions for a user (e.g. on password change, deactivation, or role change).
 */
export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("user_sessions")
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_revoked", false);

    if (exceptSessionId) {
      query = query.neq("id", exceptSessionId);
    }

    const { error } = await query;
    return error ? 0 : 1;
  } catch {
    return 0;
  }
}
