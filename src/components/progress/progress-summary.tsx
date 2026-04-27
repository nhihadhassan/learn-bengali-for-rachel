"use client";

import type { ComponentType } from "react";
import { Flame, RotateCcw, Trophy } from "lucide-react";
import { lessons } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";

export function ProgressSummary() {
  const { activeMistakes, progress, resetProgress } = useProgress();
  const completionPercent = Math.round(
    (progress.completedLessons.length / lessons.length) * 100,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Lesson completion</h2>
            <p className="text-sm text-slate-600">
              {progress.completedLessons.length} of {lessons.length} lessons complete
            </p>
          </div>
          <p className="text-2xl font-black text-emerald-700">
            {completionPercent}%
          </p>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={resetProgress}
        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-black text-rose-700 transition hover:bg-rose-100"
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon size={22} />
      </div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </section>
  );
}
