import type { MetadataRoute } from "next";
import { songs } from "@/lib/music";
import { absoluteSiteUrl } from "@/lib/site-metadata";

const publicPaths = [
  "/",
  "/lessons",
  "/practice",
  "/progress",
  "/vocabulary",
  "/music",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...publicPaths.map((path) => ({ url: absoluteSiteUrl(path) })),
    ...songs.map((song) => ({
      url: absoluteSiteUrl(`/music/${song.id}`),
    })),
  ];
}
