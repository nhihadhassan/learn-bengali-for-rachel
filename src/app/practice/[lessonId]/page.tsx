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

  return (
    <div className="space-y-5">
      <Link
        href="/lessons"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft size={18} /> Lesson path
      </Link>

      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          {curriculum.label} · Unit {lesson.unitNumber}
        </p>
        <h1 className="mt-2 text-4xl font-black">{lesson.title}</h1>
        <p className="mt-3 max-w-xl text-slate-300">{lesson.summary}</p>
      </section>

      <LessonFlow lesson={lesson} />
    </div>
  );
}
