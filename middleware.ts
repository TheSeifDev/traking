import { type NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseMiddlewareClient } from "@/utils/supabase/middleware";
import { isValidRole } from "@/src/types/auth";
import { hasMinimumRole } from "@/src/lib/auth/rbac";
import { USER_ROLES } from "@/src/types/auth";
import { verifySignedSessionCookie } from "@/src/lib/auth/session-cookie";

const PUBLIC_PREFIXES = [
  "/",
  "/features",
  "/how-it-works",
  "/integrations",
  "/use-cases",
  "/faq",
  "/api/auth",
  "/api/tracking",
  "/watch",
  "/_next",
  "/favicon.ico",
  "/logo",
  "/public",
];

const AUTH_ONLY_PATHS = ["/login"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/videos",
  "/analytics",
  "/profile",
  "/admin",
  "/owner",
];

const ADMIN_PREFIXES = ["/admin"];
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

interface CookieSession {
  id: string;
  role: string;
}

async function readSessionCookieFast(request: NextRequest): Promise<CookieSession | null> {
  const raw = request.cookies.get("trackup_user")?.value;
  const verified = await verifySignedSessionCookie(raw);
  return verified ? { id: verified.id, role: verified.role } : null;
}

function getSupabaseResponse(request: NextRequest): NextResponse {
  // TrackUp authentication is based on the signed trackup_user cookie and
  // server-side profile validation. Supabase SSR token refresh is optional.
  // Public/OAuth routes must not crash when a deployment omits public Supabase
  // variables; protected pages still perform their own server guard.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }

  try {
    return createSupabaseMiddlewareClient(request);
  } catch {
    return NextResponse.next();
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseResponse = getSupabaseResponse(request);

  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  const session = await readSessionCookieFast(request);
  const isAuthenticated = session !== null;

  if (isAuthOnlyPath(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

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
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
