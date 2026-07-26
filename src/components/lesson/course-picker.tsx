"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap } from "lucide-react";
import { curricula } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import type { CurriculumId } from "@/types/learning";
import { cn } from "@/lib/utils";

type Accent = {
  flag: string;
  tile: string;
  bar: string;
  ring: string;
};

// Per-course flag + accent so each card is instantly recognizable.
const ACCENTS: Record<CurriculumId, Accent> = {
  bengali: {
    flag: "🇧🇩",
    tile: "bg-violet-500",
    bar: "bg-violet-500",
    ring: "hover:border-violet-300 dark:hover:border-violet-400/50",
  },
  "spanish-peru": {
    flag: "🇵🇪",
    tile: "bg-amber-500",
    bar: "bg-amber-500",
    ring: "hover:border-amber-300 dark:hover:border-amber-400/50",
  },
  spanish: {
    flag: "🇪🇸",
    tile: "bg-rose-500",
    bar: "bg-rose-500",
    ring: "hover:border-rose-300 dark:hover:border-rose-400/50",
  },
  malayalam: {
    flag: "🇮🇳",
    tile: "bg-cyan-500",
    bar: "bg-cyan-500",
    ring: "hover:border-cyan-300 dark:hover:border-cyan-400/50",
  },
  history: {
    flag: "📜",
    tile: "bg-orange-500",
    bar: "bg-orange-500",
    ring: "hover:border-orange-300 dark:hover:border-orange-400/50",
  },
};

export function CoursePicker() {
  const router = useRouter();
  const { activeCurriculumId, setActiveCurriculumId, store } = useProgress();

  function choose(id: CurriculumId) {
    setActiveCurriculumId(id);
    router.push("/lessons");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="relative isolate overflow-hidden rounded-[32px] bg-slate-950 px-6 py-8 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(124,58,237,0.36),transparent_36%),radial-gradient(circle_at_86%_12%,rgba(6,182,212,0.22),transparent_34%),radial-gradient(circle_at_50%_92%,rgba(251,191,36,0.16),transparent_36%)]"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-sm font-bold text-violet-100 shadow-inner">
            <GraduationCap size={16} /> For Rachel
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] [text-wrap:balance] sm:text-5xl">
            Pick a course to begin.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
            Choose a language or subject and jump straight into the lessons. You
            can switch anytime from the menu.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {curricula.map((curriculum) => {
          const accent = ACCENTS[curriculum.id];
          const lessons = curriculum.units.flatMap((unit) => unit.lessons);
          const lessonCount = lessons.length;
          const isHistory = curriculum.mode === "history";
          const completed = store.byCurriculum[curriculum.id]?.completedLessons.length ?? 0;
          const percent =
            lessonCount > 0 ? Math.min(100, Math.round((completed / lessonCount) * 100)) : 0;
          const isActive = curriculum.id === activeCurriculumId;

          return (
            <button
              key={curriculum.id}
              type="button"
              onClick={() => choose(curriculum.id)}
              className={cn(
                "group flex flex-col rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.05]",
                accent.ring,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "grid size-14 shrink-0 place-items-center rounded-2xl text-3xl shadow-inner",
                    accent.tile,
                  )}
                  aria-hidden="true"
                >
                  {accent.flag}
                </span>
                {isActive && (
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
                    Current
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 dark:text-slate-50">
                {curriculum.label}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                {curriculum.description}
              </p>

              <div className="mt-4 flex-1" />

              {completed > 0 && (
                <div className="mb-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className={cn("h-full rounded-full", accent.bar)}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-black uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  {isHistory
                    ? `${lessonCount} ${lessonCount === 1 ? "story" : "stories"}`
                    : `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`}
                  {completed > 0 && ` · ${percent}% done`}
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
