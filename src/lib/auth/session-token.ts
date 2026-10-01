/**
 * TrackUp Session Token & Cookie Security Engine
 *
 * Implements cryptographically secure, random 256-bit opaque session tokens.
 * Only the SHA-256 hash of the session token is stored in the database.
 */

import crypto from "node:crypto";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_COOKIE_NAME = "trackup_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Generates an opaque, cryptographically random session token (256 bits of entropy).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Computes the SHA-256 cryptographic hash of a session token.
 * This hash is the ONLY token representation stored in the database.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Constant-time comparison helper to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Returns standard TrackUp session cookie security options.
 */
export function getSessionCookieOptions(expiresAt?: Date): Partial<ResponseCookie> {
  const isProduction = process.env.NODE_ENV === "production";
  const expiry = expiresAt ?? new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiry,
  };
}

/**
 * Returns options to immediately clear/expire the session cookie.
 */
export function getExpiredSessionCookieOptions(): Partial<ResponseCookie> {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
