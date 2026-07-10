import type { Metadata } from "next";
import { SongsSection } from "@/components/songs/songs-section";

export const metadata: Metadata = {
  title: "Spanish Songs | Learning Bengali",
  description: "Learn useful Spanish phrases through a curated mix of Spanish-language songs.",
};

export default function SongsPage() {
  return <SongsSection />;
}
