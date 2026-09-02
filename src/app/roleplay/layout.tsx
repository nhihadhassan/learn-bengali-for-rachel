import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Roleplay",
  description: "Practice conversational language in an interactive session.",
  path: "/roleplay",
  noIndex: true,
});

export default function RoleplayLayout({ children }: { children: ReactNode }) {
  return children;
}
