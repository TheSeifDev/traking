/**
 * TrackUp Root Middleware
 *
 * Responsibility: FAST cookie-presence check + pathname-based redirects.
 * This middleware must never do database calls – it runs on every request.
 *
 * Deep authorization (role / permission) is delegated to:
 *   - Server Component page guards  →  src/lib/auth/guards.ts
 *   - API Route Handler wrappers    →  src/lib/auth/api-handler.ts
 *
 * Route classification:
 *   PUBLIC_PATHS     – always accessible (landing, login, public pages, API OAuth)
 *   AUTH_PATHS       – redirect to /dashboard when already authenticated
 *   PROTECTED_PATHS  – require `trackup_user` cookie; redirect to /login if absent
 *   ADMIN_PATHS      – additionally require admin or owner (cookie-fast-path only;
 *                      real DB validation happens in the page guard)
 *   OWNER_PATHS      – additionally require owner (cookie-fast-path only)
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseMiddlewareClient } from "@/utils/supabase/middleware";
import { isValidRole } from "@/src/types/auth";
import { hasMinimumRole } from "@/src/lib/auth/rbac";
import { USER_ROLES } from "@/src/types/auth";
import { verifySignedSessionCookie } from "@/src/lib/auth/session-cookie";

// ---------------------------------------------------------------------------
// Path classification helpers
// ---------------------------------------------------------------------------

/** Always reachable without authentication */
const PUBLIC_PREFIXES = [
  "/",               // landing page (exact, handled below)
  "/features",
  "/how-it-works",
  "/integrations",
  "/use-cases",
  "/faq",
  "/api/auth",       // OAuth routes
  "/api/tracking",   // Public tracking endpoints (watch sessions/events)
  "/watch",          // Public watch pages
  "/_next",
  "/favicon.ico",
  "/logo",
  "/public",
];

/** Login page – redirect authenticated users away */
const AUTH_ONLY_PATHS = ["/login"];

/** Requires at minimum a session cookie */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/videos",
  "/analytics",
  "/profile",
  "/admin",
  "/owner",
];

/** Requires admin or owner role (cookie fast-path; DB check in page guard) */
const ADMIN_PREFIXES = ["/admin"];

/** Requires owner role (cookie fast-path; DB check in page guard) */
const OWNER_PREFIXES = ["/owner"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix)
  );
}

function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isOwnerPath(pathname: string): boolean {
  return OWNER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Cookie fast-path session reader  (no DB – middleware must stay fast)
// ---------------------------------------------------------------------------

interface CookieSession {
  id: string;
  role: string;
}

async function readSessionCookieFast(request: NextRequest): Promise<CookieSession | null> {
  const raw = request.cookies.get("trackup_user")?.value;
  const verified = await verifySignedSessionCookie(raw);
  return verified ? { id: verified.id, role: verified.role } : null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Let Supabase SSR helper refresh any Auth tokens on the response
  const supabaseResponse = createSupabaseMiddlewareClient(request);

  // 2. Public paths – pass through immediately
  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  const session = await readSessionCookieFast(request);
  const isAuthenticated = session !== null;

  // 3. Login page – redirect authenticated users to dashboard
  if (isAuthOnlyPath(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // 4. Protected paths – redirect unauthenticated users to login
  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 5. Fast-path role check for /admin/* and /owner/*
    //    Full DB validation happens in the page guard; this is a first-line fence.
    const role = session.role;

    if (isOwnerPath(pathname)) {
      if (!isValidRole(role) || !hasMinimumRole(role, USER_ROLES.OWNER)) {
        return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.url));
      }
    } else if (isAdminPath(pathname)) {
      if (!isValidRole(role) || !hasMinimumRole(role, USER_ROLES.ADMIN)) {
        return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - Files with extensions (images, fonts etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
