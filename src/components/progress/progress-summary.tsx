"use client";

import type { ComponentType } from "react";
import { useMemo } from "react";
import { Flame, RotateCcw, Trophy } from "lucide-react";
import { lessons } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";

export function ProgressSummary() {
  const { activeMistakes, progress, resetProgress } = useProgress();
  const lessonIds = useMemo(
    () => new Set(lessons.map((lesson) => lesson.id)),
    [],
  );
  const completedCurrentLessons = progress.completedLessons.filter((lessonId) =>
    lessonIds.has(lessonId),
  );
  const completionPercent = Math.round(
    (completedCurrentLessons.length / lessons.length) * 100,
  );

  return (
    <div className="space-y-5">
      <section className="animate-soft-rise overflow-hidden rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-100">
          Rachel&apos;s progress
        </p>
        <h1 className="mt-2 text-4xl font-black">Keep the streak alive.</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Progress is saved in this browser for now. The Supabase boundary is in
          place for account-based progress later.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Trophy} label="XP" value={progress.xp.toString()} />
        <MetricCard icon={Flame} label="Streak" value={`${progress.streak} days`} />
        <MetricCard
          icon={RotateCcw}
          label="Active mistakes"
          value={activeMistakes.length.toString()}
        />
      </div>

      <section className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Lesson completion</h2>
            <p className="text-sm text-slate-600">
              {completedCurrentLessons.length} of {lessons.length} lessons complete
            </p>
          </div>
          <p className="text-2xl font-black text-violet-700">
            {completionPercent}%
          </p>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-1 ring-slate-900/5">
          <div
            className="progress-shine h-full rounded-full transition-all duration-700"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={resetProgress}
        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 font-black text-rose-700 shadow-[0_5px_0_#fecdd3] transition hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-[0_7px_0_#fecdd3,0_14px_24px_rgba(244,63,94,0.12)] active:translate-y-1"
      >
        Reset demo progress
      </button>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <section className="group rounded-3xl border border-white/80 bg-white/95 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.1)]">
      <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700 transition group-hover:scale-105 group-hover:bg-violet-100">
        <Icon size={22} />
      </div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </section>
  );
}
