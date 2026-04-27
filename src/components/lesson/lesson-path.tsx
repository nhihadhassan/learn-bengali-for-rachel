"use client";

import Link from "next/link";
import { Check, Circle, Play, Sparkles } from "lucide-react";
import type { Lesson, Unit } from "@/types/learning";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";

export function LessonPath({ units }: { units: Unit[] }) {
  const { progress } = useProgress();
  const completed = new Set(progress.completedLessons);
  const allLessons = units.flatMap((unit) => unit.lessons);
  const currentLessonId =
    allLessons.find((lesson) => !completed.has(lesson.id))?.id ?? allLessons[0]?.id;

  return (
    <div className="space-y-6">
      {units.map((unit) => (
        <section
          key={unit.id}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-5 sm:p-6">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700">
              Unit {unit.number}
            </p>
            <h2 className="mt-1 text-2xl font-black">{unit.title}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              {unit.description}
            </p>
          </div>

          <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
            {unit.lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                isCompleted={completed.has(lesson.id)}
                isCurrent={lesson.id === currentLessonId}
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
  lesson,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
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
        "group relative flex min-h-36 items-center justify-between gap-4 rounded-3xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lg",
        isCompleted &&
          "border-emerald-200 bg-emerald-50 shadow-[0_5px_0_#a7f3d0]",
        isCurrent &&
          !isCompleted &&
          "border-cyan-200 bg-cyan-50 shadow-[0_5px_0_#bae6fd]",
        !isCompleted &&
          !isCurrent &&
          "border-slate-200 bg-[#fffdfa] shadow-[0_5px_0_#e2e8f0]",
      )}
    >
      <div className="min-w-0">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]",
            isCompleted && "bg-white text-emerald-700",
            isCurrent && !isCompleted && "bg-white text-cyan-700",
            !isCompleted && !isCurrent && "bg-slate-100 text-slate-500",
          )}
        >
          <StatusIcon size={14} />
          {statusLabel}
        </span>
        <h3 className="mt-3 text-lg font-black leading-tight">{lesson.title}</h3>
        <p className="mt-2 text-sm leading-5 text-slate-600">{lesson.summary}</p>
      </div>

      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl text-white transition group-hover:scale-105",
          isCompleted ? "bg-emerald-600" : "bg-slate-950",
        )}
      >
        {isCompleted ? <Check size={22} /> : <Play size={22} fill="currentColor" />}
      </span>
    </Link>
  );
}
