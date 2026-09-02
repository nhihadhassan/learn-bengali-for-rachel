import { MistakeReview } from "@/components/progress/mistake-review";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Mistake Review",
  description: "Retry missed questions and clear the sticky parts of your learning.",
  path: "/review",
  noIndex: true,
});

export default function ReviewPage() {
  return <MistakeReview />;
}
