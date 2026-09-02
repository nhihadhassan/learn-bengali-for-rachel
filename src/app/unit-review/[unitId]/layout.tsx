import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unitId: string }>;
}): Promise<Metadata> {
  const { unitId } = await params;

  return createPageMetadata({
    title: "Unit Review",
    description: "Review the phrases and ideas from a completed unit.",
    path: `/unit-review/${unitId}`,
    noIndex: true,
  });
}

export default function UnitReviewIdLayout({ children }: { children: ReactNode }) {
  return children;
}
