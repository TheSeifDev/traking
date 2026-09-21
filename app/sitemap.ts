import type { MetadataRoute } from "next";

const BASE_URL = "https://trakeup.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Public marketing routes only. Authenticated dashboard, admin, owner, and
  // invite routes are deliberately excluded — they must not be indexed.
  const publicRoutes = [
    "",
    "/features",
    "/how-it-works",
    "/integrations",
    "/use-cases",
    "/faq",
    "/privacy",
    "/terms",
    "/contact",
  ];

  return publicRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : 0.7,
  }));
}