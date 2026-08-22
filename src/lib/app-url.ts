const PRODUCTION_APP_URL = "https://trakeup.vercel.app";
const DEVELOPMENT_APP_URL = "http://localhost:3000";

function normalizeAppUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLocalAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * Returns the canonical public origin for server-generated absolute URLs.
 * Production never falls back to a loopback origin, even when an old or
 * missing Vercel variable is encountered.
 */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    const normalized = normalizeAppUrl(configured);
    if (process.env.NODE_ENV === "production" && isLocalAppUrl(normalized)) {
      return PRODUCTION_APP_URL;
    }
    if (normalized) return normalized;
  }

  return process.env.NODE_ENV === "production" ? PRODUCTION_APP_URL : DEVELOPMENT_APP_URL;
}

/**
 * Returns the callback URI sent to ClickUp and used during token exchange.
 * A localhost callback is valid for local development only; production uses
 * the public Trakeup callback even if an old Vercel value still says localhost.
 */
export function getClickUpRedirectUri(): string {
  const configured = process.env.CLICKUP_REDIRECT_URI;
  if (configured) {
    const normalized = normalizeAppUrl(configured);
    if (normalized && (process.env.NODE_ENV !== "production" || !isLocalAppUrl(normalized))) {
      return normalized;
    }
  }

  return `${getAppUrl()}/api/auth/clickup/callback`;
}

export const PRODUCTION_APP_ORIGIN = PRODUCTION_APP_URL;
