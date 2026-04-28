"use client";

import Link from "next/link";
import { Check, Circle, Play, Sparkles } from "lucide-react";
import type { Lesson, Unit } from "@/types/learning";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";
import { HistoryIcon } from "@/components/lesson/history-icon";

export function LessonPath({ units }: { units: Unit[] }) {
  const { progress } = useProgress();
  const completed = new Set(progress.completedLessons);
  const allLessons = units.flatMap((unit) => unit.lessons);
  const isHistory = allLessons[0]?.curriculumId === "history";
  const currentLessonId =
    allLessons.find((lesson) => !completed.has(lesson.id))?.id ?? allLessons[0]?.id;

  return (
    <div className="space-y-6">
      {units.map((unit) => (
        <section
          key={unit.id}
          className="animate-soft-rise overflow-hidden rounded-[30px] border border-white/80 bg-white/95 shadow-[0_22px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 backdrop-blur"
        >
          <div
            className={cn(
              "border-b border-slate-100 p-5 sm:p-6",
              isHistory
                ? "bg-[linear-gradient(120deg,#fff7ed,#f5f3ff_54%,#ecfeff)]"
                : "bg-[linear-gradient(120deg,#f5f3ff,#ecfeff_54%,#fff7ed)]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700">
                  Unit {unit.number}
                </p>
                <h2 className="mt-1 text-2xl font-black">{unit.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {unit.description}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-900/5">
                {unit.lessons.length}{" "}
                {isHistory
                  ? unit.lessons.length === 1 ? "event" : "events"
                  : unit.lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 p-4 sm:p-5",
              isHistory ? "relative md:grid-cols-1" : "md:grid-cols-2",
            )}
          >
            {isHistory && (
              <span
                aria-hidden="true"
                className="absolute bottom-7 left-10 top-7 hidden w-1 rounded-full bg-gradient-to-b from-violet-200 via-cyan-200 to-amber-200 md:block"
              />
            )}
            {unit.lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                isCompleted={completed.has(lesson.id)}
                isCurrent={lesson.id === currentLessonId}
                isHistory={isHistory}
                lesson={lesson}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LessonCard({
  isCompleted,
  isCurrent,
  isHistory,
  lesson,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  isHistory: boolean;
  lesson: Lesson;
}) {
  const statusLabel = isCompleted
    ? "Completed"
    : isCurrent
      ? "Recommended"
      : "Open";
  const StatusIcon = isCompleted ? Check : isCurrent ? Sparkles : Circle;

  return (
    <Link
      href={`/practice/${lesson.id}`}
      className={cn(
        "group relative flex min-h-36 items-center justify-between gap-4 overflow-hidden rounded-3xl border-2 p-4 transition duration-200 ease-out focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal-200 active:translate-y-1",
        "before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-white/80 before:content-['']",
        isHistory && "ml-0 md:ml-8 md:min-h-28",
        isCompleted &&
          "border-emerald-200 bg-emerald-50 shadow-[0_6px_0_#a7f3d0,0_16px_32px_rgba(16,185,129,0.12)] hover:-translate-y-1 hover:shadow-[0_9px_0_#a7f3d0,0_22px_40px_rgba(16,185,129,0.18)]",
        isCurrent &&
          !isCompleted &&
          "border-violet-200 bg-violet-50 shadow-[0_6px_0_#ddd6fe,0_16px_32px_rgba(124,58,237,0.12)] hover:-translate-y-1 hover:shadow-[0_9px_0_#ddd6fe,0_22px_40px_rgba(124,58,237,0.18)]",
        !isCompleted &&
          !isCurrent &&
          "border-slate-200 bg-[#fffdfa] shadow-[0_6px_0_#e2e8f0,0_14px_28px_rgba(15,23,42,0.06)] hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_9px_0_#ddd6fe,0_22px_40px_rgba(15,23,42,0.1)]",
      )}
    >
      {isHistory && (
        <span className="absolute -left-8 top-1/2 hidden size-6 -translate-y-1/2 rounded-full border-4 border-white bg-violet-500 shadow-[0_0_0_4px_rgba(124,58,237,0.14)] transition group-hover:scale-110 md:block" />
      )}
      <div className="min-w-0">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] shadow-sm",
            isCompleted && "bg-white text-emerald-700 [&>svg]:animate-pulse",
            isCurrent && !isCompleted && "bg-white text-violet-700 [&>svg]:animate-pulse",
            !isCompleted && !isCurrent && "bg-slate-100 text-slate-500",
          )}
        >
          <StatusIcon size={14} />
          {statusLabel}
        </span>
        <h3 className="mt-3 text-lg font-black leading-tight">{lesson.title}</h3>
        <p className="mt-2 text-sm leading-5 text-slate-600">
          {isHistory ? lesson.history?.keyTakeaway ?? lesson.summary : lesson.summary}
        </p>
        {isHistory && lesson.history?.whyItMatters && (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-violet-600">
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
              : "bg-slate-950 shadow-slate-950/20",
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
