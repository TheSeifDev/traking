const DEFAULT_AUTH_RETURN_PATH = "/dashboard";

/**
 * Accept only an internal relative path for post-auth navigation.
 * Absolute URLs, protocol-relative URLs, login/auth endpoints, and API paths
 * are rejected so OAuth cannot become an open redirect or a redirect loop.
 */
export function getSafeAuthReturnPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_RETURN_PATH,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, "https://trackup.internal");
    if (parsed.origin !== "https://trackup.internal") return fallback;
    if (parsed.pathname === "/login" || parsed.pathname.startsWith("/api/auth")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export const AUTH_RETURN_COOKIE = "trackup_oauth_return";
