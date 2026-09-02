import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Settings",
  description: "Manage appearance, offline use, and saved learning data.",
  path: "/settings",
  noIndex: true,
});

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
