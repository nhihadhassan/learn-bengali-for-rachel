import { PracticeHub } from "@/components/practice/practice-hub";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Practice",
  description:
    "Review mistakes, strengthen due phrases, revisit vocabulary, and keep learning in short practice sessions.",
  path: "/practice",
});

export default function PracticePage() {
  return <PracticeHub />;
}
