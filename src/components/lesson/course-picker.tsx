"use client";

/**
 * The platform home: every course Rachel is learning, in one place.
 *
 * This is the screen that makes the app "Learning for Rachel" rather than "a
 * Bengali app that also has other things" — Bengali is simply the first card.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame } from "lucide-react";
import { getCourseOutline } from "@/lib/course-index";
import { COURSES } from "@/lib/courses";
import { useProgress } from "@/lib/progress-store";
import type { CurriculumId } from "@/types/learning";
import { cn } from "@/lib/utils";

export function CoursePicker() {
  const router = useRouter();
  const { activeCurriculumId, setActiveCurriculumId, store } = useProgress();

  const totals = useMemo(() => {
    const completed = COURSES.reduce(
      (total, course) =>
        total + (store.byCurriculum[course.id]?.completedLessons.length ?? 0),
      0,
    );
    const bestStreak = COURSES.reduce(
      (best, course) =>
        Math.max(best, store.byCurriculum[course.id]?.streak ?? 0),
      0,
    );

    return { completed, bestStreak };
  }, [store.byCurriculum]);

  function choose(id: CurriculumId) {
    setActiveCurriculumId(id);
    router.push("/lessons");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="relative isolate overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.34),transparent_40%),radial-gradient(circle_at_85%_12%,rgba(6,182,212,0.2),transparent_38%)]"
        />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
            Learning for Rachel
          </p>
          <h1 className="mt-3 text-3xl font-black leading-[1.1] [text-wrap:balance] sm:text-4xl">
            What are we learning today?
          </h1>
          {totals.completed > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-300">
              <span>{totals.completed} lessons finished</span>
              {totals.bestStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 text-orange-300">
                  <Flame size={15} fill="currentColor" />
                  {totals.bestStreak} day streak
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {COURSES.map((course) => {
          const outline = getCourseOutline(course.id);
          const completed =
            store.byCurriculum[course.id]?.completedLessons.length ?? 0;
          const percent =
            outline.lessonCount > 0
              ? Math.min(100, Math.round((completed / outline.lessonCount) * 100))
              : 0;
          const isActive = course.id === activeCurriculumId;

          return (
            <button
              key={course.id}
              type="button"
              onClick={() => choose(course.id)}
              className={cn(
                "group flex flex-col rounded-3xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:bg-white/[0.05]",
                isActive
                  ? "border-violet-300 dark:border-violet-400/40"
                  : "border-slate-200 dark:border-white/10",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-2xl text-2xl",
                    course.accent.tile,
                  )}
                  aria-hidden="true"
                >
                  {course.accent.emoji}
                </span>
                {isActive && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-400/20 dark:text-violet-200">
                    Current
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-xl font-black leading-tight text-slate-950 dark:text-slate-50">
                {course.label}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                {course.description}
              </p>

              <div className="mt-4 flex-1" />

              {completed > 0 && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className={cn("h-full rounded-full", course.accent.bar)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  {completed > 0
                    ? `${percent}% · ${completed}/${outline.lessonCount}`
                    : `${outline.lessonCount} ${course.nouns.lessons}`}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-black text-violet-700 transition group-hover:gap-2 dark:text-violet-300">
                  {completed > 0 ? "Continue" : "Start"}
                  <ArrowRight size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
