import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Placement Check",
  description: "Find a comfortable starting point in your current course.",
  path: "/placement",
  noIndex: true,
});

export default function PlacementLayout({ children }: { children: ReactNode }) {
  return children;
}
