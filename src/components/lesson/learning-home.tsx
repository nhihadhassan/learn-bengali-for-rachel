"use client";

/**
 * Learn: one job — get the learner into the next lesson.
 *
 * A single continue card carries where they are and what's next; the path below
 * is for browsing. Practice, review and stats live in their own tabs so this
 * screen doesn't have to advertise them.
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Dumbbell, Gauge } from "lucide-react";
import {
  findNextLesson,
  getCourseOutline,
  locateLesson,
} from "@/lib/course-index";
import { getCourse } from "@/lib/courses";
import { useProgress } from "@/lib/progress-store";
import { CoursePath } from "@/components/lesson/course-path";

export function LearningHome() {
  const { activeCurriculumId, duePhraseCount, progress } = useProgress();
  const course = getCourse(activeCurriculumId);
  const outline = getCourseOutline(activeCurriculumId);
  const nouns = course.nouns;

  const completedLessonIds = useMemo(
    () => new Set(progress.completedLessons),
    [progress.completedLessons],
  );

  // "Where you are" is the lesson in progress if there is one, otherwise the
  // first unfinished lesson in the path.
  const resumeLessonId =
    progress.lastLessonId && !completedLessonIds.has(progress.lastLessonId)
      ? progress.lastLessonId
      : undefined;
  const nextLesson =
    (resumeLessonId ? locateLesson(resumeLessonId)?.lesson : undefined) ??
    findNextLesson(activeCurriculumId, completedLessonIds);
  const location = nextLesson ? locateLesson(nextLesson.id) : undefined;

  const completedCount = outline.units
    .flatMap((unit) => unit.lessons)
    .filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const percent =
    outline.lessonCount > 0
      ? Math.round((completedCount / outline.lessonCount) * 100)
      : 0;
  const isFinished = outline.lessonCount > 0 && completedCount === outline.lessonCount;
  const canTestOut = course.capabilities.placement && completedCount === 0;

  return (
    <div className="space-y-5">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] sm:p-7">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,58,237,0.32),transparent_42%),radial-gradient(circle_at_88%_10%,rgba(6,182,212,0.2),transparent_38%)]"
        />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-violet-200">
            <span aria-hidden="true">{course.accent.emoji}</span>
            {course.label}
            {location?.unit.section && (
              <span className="text-violet-300/80">
                · Section {location.unit.section.number}
              </span>
            )}
          </p>

          {nextLesson && !isFinished ? (
            <>
              <p className="mt-3 text-sm font-bold text-slate-300">
                {resumeLessonId ? "Pick up where you left off" : "Up next"} ·{" "}
                {location?.unit.title}
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                {nextLesson.title}
              </h1>

              <Link
                href={`/practice/${nextLesson.id}`}
                className="group mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-black text-violet-800 shadow-[0_5px_0_rgba(255,255,255,0.4)] transition hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-0.5 sm:w-auto"
              >
                {resumeLessonId ? "Continue" : "Start"} {nouns.lesson}
                <ArrowRight size={20} className="transition group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                {isFinished
                  ? `You've finished every ${nouns.lesson}.`
                  : `This course is still being written.`}
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-300">
                {isFinished
                  ? "Keep it fresh with spaced-repetition practice."
                  : "New content can be added without resetting your progress."}
              </p>
              <Link
                href="/practice"
                className="mt-5 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-black text-violet-800 shadow-[0_5px_0_rgba(255,255,255,0.4)] transition hover:-translate-y-0.5 active:translate-y-0.5"
              >
                <Dumbbell size={19} />
                Go to practice
              </Link>
            </>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              <span>
                {completedCount} of {outline.lessonCount} {nouns.lessons}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {(canTestOut || duePhraseCount > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {duePhraseCount > 0 && (
                <HeaderChip href="/practice" icon={<Dumbbell size={14} />}>
                  {duePhraseCount} due for review
                </HeaderChip>
              )}
              {canTestOut && (
                <HeaderChip href="/placement" icon={<Gauge size={14} />}>
                  Already know some? Test out
                </HeaderChip>
              )}
            </div>
          )}
        </div>
      </section>

      <CoursePath
        completedLessonIds={completedLessonIds}
        courseId={activeCurriculumId}
        currentLessonId={nextLesson?.id}
      />
    </div>
  );
}

function HeaderChip({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-black text-slate-100 transition hover:bg-white/20"
    >
      {icon}
      {children}
    </Link>
  );
}
