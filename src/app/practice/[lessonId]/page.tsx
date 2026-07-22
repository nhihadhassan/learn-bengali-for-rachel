import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LessonFlow } from "@/components/lesson/lesson-flow";
import { getCurriculumForLesson, getLesson, lessons } from "@/lib/content";

export function generateStaticParams() {
  return lessons.map((lesson) => ({ lessonId: lesson.id }));
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
  const curriculum = getCurriculumForLesson(lesson.id);
  const topic = curriculum.units.find((unit) => unit.id === lesson.unitId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Link
          href="/lessons"
          aria-label="Back to lesson path"
          className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 sm:size-10"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
            {topic?.title ?? curriculum.label}
          </p>
          <h1 className="truncate text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
            {lesson.title}
          </h1>
        </div>
      </div>

      <LessonFlow key={lesson.id} lesson={lesson} />
    </div>
  );
}
