import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/practice/",
        "/placement",
        "/review",
        "/roleplay",
        "/settings",
        "/strengthen",
        "/unit-review/",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
