"use client";

/**
 * Progress: what has actually been learned.
 *
 * XP, gems and streaks still appear — they are motivating — but they are the
 * garnish, not the meal. The headline numbers are course completion, how many
 * phrases are in memory and how strong they are, accuracy, and which topics
 * keep going wrong. Every figure here is derived from real stored data; nothing
 * is invented to fill a card.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  Flame,
  Gem,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { getCourseOutline, locateLesson } from "@/lib/course-index";
import { getCourse } from "@/lib/courses";
import { localDayKey, shiftedDayKey } from "@/lib/date-keys";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";

const ACTIVITY_DAYS = 14;

export function ProgressSummary() {
  const {
    activeCurriculumId,
    activeMistakes,
    memorySummary,
    progress,
    restoreStreak,
  } = useProgress();
  const course = getCourse(activeCurriculumId);
  const outline = getCourseOutline(activeCurriculumId);
  const nouns = course.nouns;

  const completedLessonIds = useMemo(
    () => new Set(progress.completedLessons),
    [progress.completedLessons],
  );

  const completedCount = outline.units
    .flatMap((unit) => unit.lessons)
    .filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const completionPercent =
    outline.lessonCount > 0
      ? Math.round((completedCount / outline.lessonCount) * 100)
      : 0;

  const accuracy =
    progress.answeredTotal > 0
      ? Math.round((progress.answeredCorrect / progress.answeredTotal) * 100)
      : null;

  // Weak topics: unresolved mistakes grouped by the unit they came from. Real
  // signal — these are questions this learner actually got wrong.
  const weakUnits = useMemo(() => {
    const counts = new Map<string, { title: string; count: number; unitId: string }>();

    for (const mistake of activeMistakes) {
      const location = locateLesson(mistake.lessonId);

      if (!location) {
        continue;
      }

      const entry = counts.get(location.unit.id) ?? {
        title: location.unit.title,
        count: 0,
        unitId: location.unit.id,
      };
      entry.count += 1;
      counts.set(location.unit.id, entry);
    }

    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [activeMistakes]);

  const activity = useMemo(() => {
    const practiced = new Set(progress.practiceDays);
    const today = localDayKey();

    return Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
      const key = shiftedDayKey(index - (ACTIVITY_DAYS - 1), new Date());
      return { key, active: practiced.has(key), isToday: key === today };
    });
  }, [progress.practiceDays]);

  const hasStarted = completedCount > 0 || memorySummary.tracked > 0;
  const canRestoreStreak =
    progress.streakRestoreAvailable &&
    progress.lastStreakBeforeMiss > 0 &&
    progress.gems >= 400;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
          {course.label}
        </p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50 sm:text-3xl">
          Progress
        </h1>
      </header>

      {!hasStarted ? (
        <EmptyProgress lessonNoun={nouns.lesson} />
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-slate-50">
                  Course completion
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {completedCount} of {outline.lessonCount} {nouns.lessons} ·{" "}
                  {outline.unitCount} {nouns.units}
                </p>
              </div>
              <p className="text-3xl font-black leading-none text-violet-700 dark:text-violet-300">
                {completionPercent}%
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className="progress-shine h-full rounded-full transition-[width] duration-700"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              icon={Brain}
              label={course.capabilities.kind === "history" ? "Facts in memory" : "Phrases learned"}
              sub={
                memorySummary.tracked > 0
                  ? `${memorySummary.strong} going strong`
                  : "Nothing tracked yet"
              }
              value={memorySummary.tracked.toString()}
            />
            <MetricCard
              icon={Target}
              label="Recall strength"
              sub={
                memorySummary.due > 0
                  ? `${memorySummary.due} due for review`
                  : "Nothing due right now"
              }
              value={`${memorySummary.averageStrength}%`}
            />
            <MetricCard
              icon={Check}
              label="Accuracy"
              sub={
                accuracy === null
                  ? "Answer a question to start"
                  : `${progress.answeredCorrect} of ${progress.answeredTotal} answers`
              }
              value={accuracy === null ? "—" : `${accuracy}%`}
            />
            <MetricCard
              icon={Flame}
              label="Streak"
              sub={progress.streak > 0 ? "days in a row" : "Practice today to start"}
              value={progress.streak.toString()}
            />
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-50">
              Recent activity
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              The last {ACTIVITY_DAYS} days.
            </p>
            <div className="mt-4 flex items-end gap-1.5">
              {activity.map((day) => (
                <span
                  key={day.key}
                  title={day.key}
                  className={cn(
                    "h-9 flex-1 rounded-lg transition-colors",
                    day.active
                      ? "bg-violet-500 dark:bg-violet-400"
                      : "bg-slate-100 dark:bg-white/10",
                    day.isToday &&
                      "ring-2 ring-violet-300 ring-offset-2 ring-offset-white dark:ring-violet-400/50 dark:ring-offset-[#171426]",
                  )}
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-50">
              {weakUnits.length > 0 ? "Worth another look" : "Nothing is sticking out"}
            </h2>
            {weakUnits.length > 0 ? (
              <>
                <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  The {nouns.units} your open mistakes came from.
                </p>
                <ul className="mt-3 grid gap-2">
                  {weakUnits.map((unit) => (
                    <li
                      key={unit.unitId}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-rose-50 px-3 py-2 dark:bg-rose-400/10"
                    >
                      <span className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                        {unit.title}
                      </span>
                      <span className="shrink-0 text-xs font-black text-rose-700 dark:text-rose-300">
                        {unit.count} to fix
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/review"
                  className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-rose-600 px-4 font-black text-white transition hover:-translate-y-0.5 active:translate-y-0.5"
                >
                  Review mistakes <ArrowRight size={17} />
                </Link>
              </>
            ) : (
              <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                No open mistakes in this course. Keep practicing to stay ahead of
                the review schedule.
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.05]">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-50">
              Rewards
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <RewardPill
                icon={<Trophy size={16} className="text-amber-500" />}
                value={`${progress.xp} XP`}
              />
              <RewardPill
                icon={<Gem size={16} className="text-cyan-500" />}
                value={`${progress.gems} gems`}
              />
            </div>
            {progress.streakRestoreAvailable && progress.lastStreakBeforeMiss > 0 && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.06]">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  You missed a day and lost a {progress.lastStreakBeforeMiss}-day
                  streak. 400 gems will bring it back.
                </p>
                <button
                  type="button"
                  disabled={!canRestoreStreak}
                  onClick={() => {
                    if (
                      window.confirm("Restore your streak for 400 gems?")
                    ) {
                      restoreStreak();
                    }
                  }}
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canRestoreStreak
                    ? "Restore for 400 gems"
                    : `Need ${400 - progress.gems} more gems`}
                </button>
              </div>
            )}
          </section>

          <p className="px-1 pb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            Progress is saved in this browser.{" "}
            <Link
              href="/settings"
              className="font-black text-violet-700 underline dark:text-violet-300"
            >
              Manage your data
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  sub,
  value,
}: {
  icon: typeof Brain;
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
        <Icon size={14} />
        {label}
      </p>
      <p className="mt-2 text-3xl font-black leading-none text-slate-900 dark:text-slate-50">
        {value}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {sub}
      </p>
    </section>
  );
}

function RewardPill({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-50 px-3.5 text-sm font-black text-slate-800 dark:bg-white/10 dark:text-slate-100">
      {icon}
      {value}
    </span>
  );
}

function EmptyProgress({ lessonNoun }: { lessonNoun: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/[0.05]">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
        <Sparkles size={26} />
      </span>
      <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-slate-50">
        Nothing to measure yet
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
        After your first {lessonNoun} this page fills in with completion, how
        many phrases you know, how strong your recall is, and what needs another
        look.
      </p>
      <Link
        href="/lessons"
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 font-black text-white shadow-[0_5px_0_#5b21b6] transition hover:-translate-y-0.5 active:translate-y-0.5"
      >
        Start learning <ArrowRight size={18} />
      </Link>
    </section>
  );
}
