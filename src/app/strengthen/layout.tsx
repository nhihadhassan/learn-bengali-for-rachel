import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Strengthen",
  description: "Strengthen the phrases your review schedule says need attention.",
  path: "/strengthen",
  noIndex: true,
});

export default function StrengthenLayout({ children }: { children: ReactNode }) {
  return children;
}
