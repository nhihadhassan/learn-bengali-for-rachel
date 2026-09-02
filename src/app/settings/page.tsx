"use client";

/**
 * Settings: appearance, offline behaviour, and the data controls.
 *
 * Resetting progress used to be a bare button at the bottom of the Progress
 * screen, one tap from wiping everything. It lives here now, behind an explicit
 * typed-scope confirmation, next to the explanation of where progress is stored.
 */

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CloudDownload,
  Database,
  Gauge,
  Moon,
  Palette,
} from "lucide-react";
import { COURSES, getCourse } from "@/lib/courses";
import { getCourseOutline } from "@/lib/course-index";
import { useProgress } from "@/lib/progress-store";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function SettingsPage() {
  const {
    activeCurriculumId,
    progress,
    resetAllProgress,
    resetProgress,
    store,
  } = useProgress();
  const course = getCourse(activeCurriculumId);
  const [confirming, setConfirming] = useState<"course" | "all" | null>(null);
  const [message, setMessage] = useState("");

  const totalCompleted = COURSES.reduce(
    (total, item) =>
      total + (store.byCurriculum[item.id]?.completedLessons.length ?? 0),
    0,
  );

  function confirmReset() {
    if (confirming === "course") {
      resetProgress(activeCurriculumId);
      setMessage(`${course.label} progress was reset.`);
    } else if (confirming === "all") {
      resetAllProgress();
      setMessage("All course progress was reset.");
    }

    setConfirming(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="px-1">
        <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50 sm:text-3xl">
          Settings
        </h1>
      </header>

      <SettingsCard icon={<Palette size={20} aria-hidden="true" />} title="Appearance">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
              Light / dark mode
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Follows your device unless you choose.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </SettingsCard>

      {course.capabilities.placement && (
        <SettingsCard icon={<Gauge size={20} aria-hidden="true" />} title="Placement">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                Test out of {course.label}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                A short adaptive quiz that opens the path at your level. It only
                adds progress — nothing is hidden or deleted.
              </p>
            </div>
            <Link
              href="/placement"
              className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-white/15 dark:hover:bg-white/25"
            >
              Take the test
            </Link>
          </div>
        </SettingsCard>
      )}

      <SettingsCard icon={<CloudDownload size={20} aria-hidden="true" />} title="Offline">
        <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          This app works offline for {course.nouns.lessons} you have already
          opened. Add it to your Home Screen (Share → Add to Home Screen) to open
          it like an app.
        </p>
      </SettingsCard>

      <SettingsCard icon={<Database size={20} aria-hidden="true" />} title="Your data">
        <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          Progress lives in this browser only — there is no account and nothing
          is uploaded. Clearing your browser data, or using a different device or
          browser, starts you fresh.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <DataRow
            label={`${course.label} completed`}
            value={`${progress.completedLessons.length} / ${getCourseOutline(activeCurriculumId).lessonCount}`}
          />
          <DataRow label="Completed everywhere" value={String(totalCompleted)} />
          <DataRow label="XP in this course" value={String(progress.xp)} />
          <DataRow
            label="Phrases tracked"
            value={String(Object.keys(progress.phraseMemory).length)}
          />
        </dl>

        {message && (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
            {message}
          </p>
        )}

        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-400/25 dark:bg-rose-400/10">
          <p className="flex items-center gap-2 text-sm font-black text-rose-800 dark:text-rose-200">
            <AlertTriangle size={16} />
            Reset progress
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-rose-700/90 dark:text-rose-200/80">
            This cannot be undone. XP, streaks, completed {course.nouns.lessons},
            mistakes and review memory are all cleared.
          </p>

          {confirming ? (
            <div className="mt-4 rounded-2xl bg-white p-3 dark:bg-white/10">
              <p className="text-sm font-black text-slate-900 dark:text-slate-50">
                {confirming === "course"
                  ? `Really reset all ${course.label} progress?`
                  : "Really reset progress for every course?"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmReset}
                  className="inline-flex min-h-11 items-center rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-500"
                >
                  Yes, reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setConfirming("course");
                }}
                className="inline-flex min-h-11 items-center rounded-xl border border-rose-300 bg-white px-4 text-sm font-black text-rose-700 transition hover:bg-rose-100 dark:border-rose-400/30 dark:bg-white/10 dark:text-rose-200 dark:hover:bg-rose-400/20"
              >
                Reset {course.label}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setConfirming("all");
                }}
                className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black text-rose-700 transition hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-400/20"
              >
                Reset every course
              </button>
            </div>
          )}
        </div>
      </SettingsCard>

      <p className="px-1 pb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Moon size={12} aria-hidden="true" className="mr-1 inline" />
        Learning for Rachel · {COURSES.length} courses
      </p>
    </div>
  );
}

function SettingsCard({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]">
      <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900 dark:text-slate-50">
        <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-white/[0.06]">
      <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-black text-slate-900 dark:text-slate-50">
        {value}
      </dd>
    </div>
  );
}
