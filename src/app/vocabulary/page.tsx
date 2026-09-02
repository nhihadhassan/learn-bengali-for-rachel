import { LearnedWordsReview } from "@/components/vocabulary/learned-words-review";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Vocabulary",
  description:
    "Review the words and phrases you have encountered in your current Learning for Rachel course.",
  path: "/vocabulary",
});

export default function VocabularyPage() {
  return <LearnedWordsReview />;
}
