import type { MetadataRoute } from "next";

const BASE_URL = "https://trakeup.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block any authenticated, internal, or invite-flow routes from indexing.
        disallow: [
          "/api/",
          "/admin/",
          "/owner/",
          "/dashboard",
          "/dashboard/*",
          "/videos",
          "/videos/*",
          "/watch-links",
          "/watch-links/*",
          "/analytics",
          "/analytics/*",
          "/spaces",
          "/spaces/*",
          "/organizations",
          "/organizations/*",
          "/settings",
          "/settings/*",
          "/profile",
          "/profile/*",
          "/invite",
          "/invite/*",
          "/watch/",
          "/login",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}