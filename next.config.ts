import type { NextConfig } from "next";

/**
 * Baseline `script-src` sources.
 *
 * 'unsafe-eval' is intentionally absent from the production policy: shipped
 * bundles never evaluate code at runtime. React's *development* runtime
 * (react-server-dom-turbopack) probes indirect eval once per RSC stream to
 * reconstruct server-component call stacks, so the development server alone
 * appends 'unsafe-eval' — see contentSecurityPolicy().
 */
const SCRIPT_SRC =
  "'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://player.vimeo.com";

/**
 * Content-Security-Policy applied to every route.
 *
 * NODE_ENV is read at call time (not module load) so the verification
 * scripts can exercise both variants. Fail direction is strict: only an
 * explicit development run may extend script-src; production and any unset
 * NODE_ENV get the pinned production policy.
 */
function contentSecurityPolicy(): string {
  const scriptSrc =
    process.env.NODE_ENV === "development" ? `${SCRIPT_SRC} 'unsafe-eval'` : SCRIPT_SRC;
  return (
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "media-src 'self' blob: https:",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com https://t.me https://telegram.me",
      "connect-src 'self' https://*.supabase.co https://api.clickup.com https://www.youtube.com https://*.youtube.com https://*.googlevideo.com https://*.vimeo.com https://player.vimeo.com https://drive.google.com https://t.me https://telegram.me",
    ].join("; ") + ";"
  );
}

/**
 * Baseline browser hardening headers applied to every route.
 */
function securityHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/auth/clickup",
        destination: "/api/auth/clickup",
      },
    ];
  },
};

export default nextConfig;
