const PRODUCTION_APP_URL = "https://trakeup.vercel.app";
const DEVELOPMENT_APP_URL = "http://localhost:3000";
const CLICKUP_CALLBACK_PATH = "/api/auth/clickup/callback";
const PRODUCTION_CLICKUP_REDIRECT_URI = `${PRODUCTION_APP_URL}${CLICKUP_CALLBACK_PATH}`;
const DEVELOPMENT_CLICKUP_REDIRECT_URI = `https://localhost:3000${CLICKUP_CALLBACK_PATH}`;

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
 * Returns the exact callback URI for the current deployment environment.
 * ClickUp must register both values on the same OAuth app:
 * - local development: https://localhost:3000/api/auth/clickup/callback
 * - production/Vercel: https://trakeup.vercel.app/api/auth/clickup/callback
 *
 * A stale CLICKUP_REDIRECT_URI is ignored when it points at the other
 * environment, preventing production from redirecting to localhost and
 * preventing local development from accidentally using the production URI.
 */
export function getClickUpRedirectUri(): string {
  const configured = process.env.CLICKUP_REDIRECT_URI;
  const expected = process.env.NODE_ENV === "production"
    ? PRODUCTION_CLICKUP_REDIRECT_URI
    : DEVELOPMENT_CLICKUP_REDIRECT_URI;

  if (configured && normalizeAppUrl(configured) === expected) {
    return expected;
  }

  return expected;
}

export const PRODUCTION_APP_ORIGIN = PRODUCTION_APP_URL;
export const PRODUCTION_CLICKUP_CALLBACK_URI = PRODUCTION_CLICKUP_REDIRECT_URI;
export const DEVELOPMENT_CLICKUP_CALLBACK_URI = DEVELOPMENT_CLICKUP_REDIRECT_URI;
