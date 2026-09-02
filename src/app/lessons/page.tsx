import { LearningHome } from "@/components/lesson/learning-home";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Lessons",
  description:
    "Follow a clear learning path through Bengali, Spanish, Malayalam, and history lessons.",
  path: "/lessons",
});

export default function LessonsPage() {
  return <LearningHome />;
}
