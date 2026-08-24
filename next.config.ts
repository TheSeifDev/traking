import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://player.vimeo.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' blob: https:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://drive.google.com https://t.me https://telegram.me; connect-src 'self' https://*.supabase.co https://api.clickup.com https://www.youtube.com https://*.youtube.com https://*.googlevideo.com https://*.vimeo.com https://player.vimeo.com https://drive.google.com https://t.me https://telegram.me;" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
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
