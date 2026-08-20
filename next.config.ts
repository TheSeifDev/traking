import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
