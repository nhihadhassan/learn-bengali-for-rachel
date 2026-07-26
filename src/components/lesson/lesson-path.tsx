"use client";

import Link from "next/link";
import { Check, Circle, Play, RefreshCw, Sparkles } from "lucide-react";
import type { Lesson, Unit } from "@/types/learning";
import { getCurriculum } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";
import { HistoryIcon } from "@/components/lesson/history-icon";

export function LessonPath({ units }: { units: Unit[] }) {
  const { activeCurriculumId, progress } = useProgress();
  const completed = new Set(progress.completedLessons);
  const allLessons = units.flatMap((unit) => unit.lessons);
  const isHistory = allLessons[0]?.curriculumId === "history";
  // Use the curriculum's real label so new courses never fall back to "Bengali".
  const pathLabel = getCurriculum(activeCurriculumId).label;
  const currentLessonId =
    allLessons.find((lesson) => !completed.has(lesson.id))?.id ?? allLessons[0]?.id;
  const currentLessonIndex = Math.max(
    0,
    allLessons.findIndex((lesson) => lesson.id === currentLessonId),
  );

  return (
    <div className="space-y-6">
      {units.map((unit) => (
        <section
          key={unit.id}
          className="animate-soft-rise overflow-hidden rounded-[30px] border border-white/80 bg-white/95 shadow-[0_22px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 backdrop-blur transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_22px_70px_rgba(0,0,0,0.3)] dark:ring-white/10"
        >
          <div
            className={cn(
              "border-b border-slate-100 p-5 transition-colors duration-300 dark:border-white/10 sm:p-6",
              isHistory
                ? "bg-[linear-gradient(120deg,#fff7ed,#f5f3ff_54%,#ecfeff)] dark:bg-[linear-gradient(120deg,rgba(249,115,22,0.16),rgba(124,58,237,0.16)_54%,rgba(6,182,212,0.12))]"
                : "bg-[linear-gradient(120deg,#f5f3ff,#ecfeff_54%,#fff7ed)] dark:bg-[linear-gradient(120deg,rgba(124,58,237,0.16),rgba(6,182,212,0.12)_54%,rgba(249,115,22,0.12))]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                  {pathLabel} · {unit.title}
                </p>
                <h2 className="mt-1 text-2xl font-black">{unit.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {unit.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
                {unit.lessons.length}{" "}
                {isHistory
                  ? unit.lessons.length === 1 ? "chapter" : "chapters"
                  : unit.lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </div>
          </div>

          {unit.lessons.length === 0 ? (
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm dark:bg-white/10 dark:text-violet-200">
                  <Circle size={22} />
                </span>
                <div>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-50">
                    Coming soon
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    This history path is paused while the Peru story gets built first.
                  </p>
                </div>
              </div>
            </div>
          ) : (
          <div className="relative grid gap-3 p-4 sm:p-5 md:grid-cols-1">
            <span
              aria-hidden="true"
              className="absolute bottom-7 left-10 top-7 hidden w-1 rounded-full bg-gradient-to-b from-violet-200 via-cyan-200 to-amber-200 dark:from-violet-400/70 dark:via-cyan-400/55 dark:to-amber-300/60 md:block"
            />
            {unit.lessons.map((lesson) => {
              const lessonIndex = allLessons.findIndex((item) => item.id === lesson.id);

              return (
                <LessonCard
                  key={lesson.id}
                  isAhead={
                    lessonIndex > currentLessonIndex && !completed.has(lesson.id)
                  }
                  isCompleted={completed.has(lesson.id)}
                  isCurrent={lesson.id === currentLessonId}
                  isHistory={isHistory}
                  lesson={lesson}
                />
              );
            })}
            {!isHistory && unit.lessons.every((lesson) => completed.has(lesson.id)) && (
              <UnitReviewCard unitId={unit.id} unitTitle={unit.title} />
            )}
          </div>
          )}
        </section>
      ))}
      {activeCurriculumId === "bengali" && (
        <section className="animate-soft-rise rounded-[30px] border border-dashed border-violet-200 bg-violet-50/80 p-5 text-violet-900 shadow-inner dark:border-violet-300/25 dark:bg-violet-400/12 dark:text-violet-100 sm:p-6">
          <p className="text-lg font-black">More Bengali lessons coming soon.</p>
          <p className="mt-1 text-sm font-semibold">
            Keep practicing what you&apos;ve learned. New family, travel, and daily conversation topics can slot into this path without resetting progress.
          </p>
        </section>
      )}
      {activeCurriculumId === "malayalam" && (
        <section className="animate-soft-rise rounded-[30px] border border-dashed border-violet-200 bg-violet-50/80 p-5 text-violet-900 shadow-inner dark:border-violet-300/25 dark:bg-violet-400/12 dark:text-violet-100 sm:p-6">
          <p className="text-lg font-black">More Malayalam lessons coming soon.</p>
          <p className="mt-1 text-sm font-semibold">
            Keep practicing what you&apos;ve learned. New Kerala travel, family,
            and food phrases can join this path without resetting progress.
          </p>
        </section>
      )}
    </div>
  );
}

function UnitReviewCard({
  unitId,
  unitTitle,
}: {
  unitId: string;
  unitTitle: string;
}) {
  return (
    <Link
      href={`/unit-review/${unitId}`}
      className="group relative ml-0 flex items-center justify-between gap-4 overflow-hidden rounded-3xl border-2 border-cyan-200 bg-cyan-50 p-4 shadow-[0_6px_0_#a5f3fc,0_16px_32px_rgba(6,182,212,0.12)] transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_9px_0_#a5f3fc,0_22px_40px_rgba(6,182,212,0.18)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal-200 active:translate-y-1 dark:border-cyan-300/30 dark:bg-cyan-400/12 dark:shadow-[0_6px_0_rgba(6,182,212,0.24),0_16px_32px_rgba(0,0,0,0.24)] md:ml-8"
    >
      <span
        aria-hidden="true"
        className="absolute -left-8 top-1/2 hidden size-6 -translate-y-1/2 rounded-full border-4 border-white bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.16)] transition group-hover:scale-110 dark:border-slate-950 md:block"
      />
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-cyan-700 shadow-sm dark:bg-cyan-400/15 dark:text-cyan-100">
          <RefreshCw size={14} />
          Unit review
        </span>
        <h3 className="mt-3 text-lg font-black leading-tight">
          Review {unitTitle}
        </h3>
        <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
          Mix all this unit&apos;s words together to lock them in.
        </p>
      </div>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/25 transition duration-200 group-hover:scale-110 group-hover:rotate-2">
        <RefreshCw size={22} />
      </span>
    </Link>
  );
}

function LessonCard({
  isCompleted,
  isCurrent,
  isAhead,
  isHistory,
  lesson,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  isAhead: boolean;
  isHistory: boolean;
  lesson: Lesson;
}) {
  const statusLabel = isCompleted
    ? "Completed"
    : isCurrent
      ? "Recommended"
      : isAhead
        ? "Ahead"
        : "Open";
  const StatusIcon = isCompleted ? Check : isCurrent ? Sparkles : Circle;

  return (
    <Link
      href={`/practice/${lesson.id}`}
      className={cn(
        "group relative flex min-h-36 items-center justify-between gap-4 overflow-hidden rounded-3xl border-2 p-4 transition duration-200 ease-out focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal-200 active:translate-y-1",
        "before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-white/80 before:content-[''] dark:before:bg-white/10",
        "ml-0 md:ml-8 md:min-h-28",
        isAhead && "opacity-75 hover:opacity-100",
        isCompleted &&
          "border-emerald-200 bg-emerald-50 shadow-[0_6px_0_#a7f3d0,0_16px_32px_rgba(16,185,129,0.12)] hover:-translate-y-1 hover:shadow-[0_9px_0_#a7f3d0,0_22px_40px_rgba(16,185,129,0.18)] dark:border-emerald-300/30 dark:bg-emerald-400/14 dark:shadow-[0_6px_0_rgba(16,185,129,0.24),0_16px_32px_rgba(0,0,0,0.24)]",
        isCurrent &&
          !isCompleted &&
          "border-violet-200 bg-violet-50 shadow-[0_6px_0_#ddd6fe,0_16px_32px_rgba(124,58,237,0.12)] hover:-translate-y-1 hover:shadow-[0_9px_0_#ddd6fe,0_22px_40px_rgba(124,58,237,0.18)] dark:border-violet-300/35 dark:bg-violet-400/16 dark:shadow-[0_6px_0_rgba(167,139,250,0.26),0_16px_32px_rgba(0,0,0,0.24)]",
        !isCompleted &&
          !isCurrent &&
          "border-slate-200 bg-[#fffdfa] shadow-[0_6px_0_#e2e8f0,0_14px_28px_rgba(15,23,42,0.06)] hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_9px_0_#ddd6fe,0_22px_40px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-white/[0.08] dark:shadow-[0_6px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(0,0,0,0.25)] dark:hover:border-violet-300/35",
      )}
    >
      <span
        className={cn(
          "absolute -left-8 top-1/2 hidden size-6 -translate-y-1/2 rounded-full border-4 border-white shadow-[0_0_0_4px_rgba(124,58,237,0.14)] transition group-hover:scale-110 dark:border-slate-950 dark:shadow-[0_0_0_4px_rgba(167,139,250,0.22)] md:block",
          isCompleted
            ? "bg-emerald-500"
            : isCurrent
              ? "bg-violet-500"
              : "bg-slate-300 dark:bg-slate-600",
        )}
      />
      <div className="min-w-0">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] shadow-sm",
            isCompleted &&
              "bg-white text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200 [&>svg]:animate-pulse",
            isCurrent &&
              !isCompleted &&
              "bg-white text-violet-700 dark:bg-violet-400/15 dark:text-violet-200 [&>svg]:animate-pulse",
            !isCompleted &&
              !isCurrent &&
              "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300",
          )}
        >
          <StatusIcon size={14} />
          {statusLabel}
        </span>
        <h3 className="mt-3 text-lg font-black leading-tight">{lesson.title}</h3>
        <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
          {isHistory ? lesson.history?.keyTakeaway ?? lesson.summary : lesson.summary}
        </p>
        {isHistory && lesson.history?.whyItMatters && (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-violet-600 dark:text-violet-300">
            {lesson.history.whyItMatters}
          </p>
        )}
      </div>

      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg transition duration-200 group-hover:scale-110 group-hover:rotate-2",
          isCompleted
            ? "bg-emerald-600 shadow-emerald-600/25"
            : isCurrent
              ? "bg-violet-600 shadow-violet-600/25"
              : "bg-slate-950 shadow-slate-950/20 dark:bg-slate-700 dark:shadow-slate-950/30",
        )}
      >
        {isCompleted ? (
          <Check size={22} />
        ) : isHistory ? (
          <HistoryIcon name={lesson.history?.icon} size={22} />
        ) : (
          <Play size={22} fill="currentColor" />
        )}
      </span>
    </Link>
  );
}
