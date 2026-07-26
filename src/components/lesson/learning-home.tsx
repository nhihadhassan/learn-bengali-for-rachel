"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Dumbbell,
  Gauge,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { getCurriculum } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import { LessonPath } from "@/components/lesson/lesson-path";

export function LearningHome() {
  const {
    activeCurriculumId,
    activeMistakes,
    activeSkippedListening,
    duePhraseCount,
    progress,
    reviewPhraseIds,
  } = useProgress();
  const curriculum = getCurriculum(activeCurriculumId);
  const units = curriculum.units;
  const allLessons = units.flatMap((unit) => unit.lessons);
  const firstLessonId = units[0]?.lessons[0]?.id;
  const lessonCount = allLessons.length;
  const isHistory = curriculum.mode === "history";
  const resumeLesson = progress.lastLessonId
    ? allLessons.find(
        (lesson) =>
          lesson.id === progress.lastLessonId &&
          !progress.completedLessons.includes(lesson.id),
      )
    : undefined;
  const resumeLessonNumber = resumeLesson
    ? allLessons.findIndex((lesson) => lesson.id === resumeLesson.id) + 1
    : 0;
  const completedCount = progress.completedLessons.length;
  const weakItemCount = activeMistakes.length + activeSkippedListening.length;
  const canPractice = !isHistory && reviewPhraseIds.length > 0;
  // Offer "test out" only for language courses that haven't been started yet.
  const canTestOut = !isHistory && completedCount === 0;
  const unitWord = isHistory ? "story" : "lesson";

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-slate-950 px-5 py-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.2)] ring-1 ring-white/10 sm:px-7 sm:py-7">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(124,58,237,0.3),transparent_38%),radial-gradient(circle_at_86%_16%,rgba(6,182,212,0.18),transparent_36%)]"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">
                {curriculum.label}
              </p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                {isHistory ? "Your story path" : "Your lesson path"}
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-300">
                {lessonCount} {isHistory ? "stories" : "lessons"}
                {completedCount > 0 && ` · ${completedCount} done`}
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white shadow-inner transition hover:bg-white hover:text-slate-950"
            >
              <Repeat size={14} /> Change course
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
            {resumeLesson && (
              <Link
                href={`/practice/${resumeLesson.id}`}
                className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800 shadow-[0_6px_0_rgba(255,255,255,0.5)] transition hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-1"
              >
                Resume {isHistory ? "Chapter" : "Lesson"} {resumeLessonNumber}
                <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
            )}
            {firstLessonId && (
              <Link
                href={`/practice/${firstLessonId}`}
                className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 py-3 font-black text-white shadow-[0_6px_0_#5b21b6] transition hover:-translate-y-0.5 hover:bg-fuchsia-500 active:translate-y-1"
              >
                {resumeLesson
                  ? isHistory
                    ? "Story 1"
                    : "Lesson 1"
                  : isHistory
                    ? "Start Story 1"
                    : "Start Lesson 1"}
                <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
            )}
            <Link
              href="/vocabulary"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
            >
              <BookOpen size={17} />
              {isHistory ? "Timeline recap" : "Word bank"}
            </Link>
          </div>

          {(canTestOut || weakItemCount > 0 || canPractice) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {canTestOut && (
                <HeaderChip href="/placement" icon={<Gauge size={15} />}>
                  Test out
                </HeaderChip>
              )}
              {weakItemCount > 0 && (
                <HeaderChip href="/review" icon={<RotateCcw size={15} />}>
                  Review {weakItemCount} weak {weakItemCount === 1 ? "item" : "items"}
                </HeaderChip>
              )}
              {canPractice && (
                <HeaderChip href="/strengthen" icon={<Dumbbell size={15} />}>
                  {duePhraseCount > 0
                    ? `Practice ${duePhraseCount} due`
                    : "Practice"}
                </HeaderChip>
              )}
            </div>
          )}
        </div>
      </section>

      <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {curriculum.label} · {unitWord} path
      </p>

      <LessonPath units={units} />
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
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-black text-slate-100 shadow-inner transition hover:-translate-y-0.5 hover:bg-white/20"
    >
      {icon}
      {children}
    </Link>
  );
}
