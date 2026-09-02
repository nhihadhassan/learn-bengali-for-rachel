import { ProgressSummary } from "@/components/progress/progress-summary";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Your Progress",
  description:
    "See lesson completion, recall strength, accuracy, streaks, and learning activity saved in this browser.",
  path: "/progress",
});

export default function ProgressPage() {
  return <ProgressSummary />;
}
