import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LessonFlow } from "@/components/lesson/lesson-flow";
import { getLesson, lessons } from "@/lib/content";
import { createPageMetadata } from "@/lib/site-metadata";

// Prerender the smaller curricula at build time. The full Spanish course (786
// lessons) is large, so those pages render on demand and are cached instead of
// being baked into the build (dynamicParams stays on by default).
export function generateStaticParams() {
  return lessons
    .filter((lesson) => lesson.curriculumId !== "spanish")
    .map((lesson) => ({ lessonId: lesson.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  const lesson = getLesson(lessonId);

  if (!lesson) {
    return createPageMetadata({
      title: "Lesson",
      description: "Lesson practice on Learning for Rachel.",
      path: `/practice/${lessonId}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: lesson.title,
    description: lesson.summary,
    path: `/practice/${lesson.id}`,
    noIndex: true,
  });
}

export default async function PracticePage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = getLesson(lessonId);

  if (!lesson) {
    notFound();
  }

  // A running lesson is deliberately chrome-free: LessonFlow renders its own
  // exit + progress bar and nothing else, so there is no page header here.
  return <LessonFlow key={lesson.id} lesson={lesson} />;
}
