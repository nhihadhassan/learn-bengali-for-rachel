"use client";

/**
 * Practice: one place for everything that isn't a new lesson.
 *
 * The app has several practice mechanisms — spaced repetition, mistake review,
 * skipped audio prompts, unit checkpoints, the word bank — and a learner should
 * not have to know which is which. This screen ranks them by what would help
 * most right now and describes them in plain language.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Music,
  RefreshCw,
  RotateCcw,
  Sparkles,
  VolumeX,
} from "lucide-react";
import { getCourseOutline } from "@/lib/course-index";
import { getCourse } from "@/lib/courses";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";

export function PracticeHub() {
  const {
    activeCurriculumId,
    activeMistakes,
    activeSkippedListening,
    duePhraseCount,
    memorySummary,
    progress,
    reviewPhraseIds,
  } = useProgress();
  const course = getCourse(activeCurriculumId);
  const outline = getCourseOutline(activeCurriculumId);
  const nouns = course.nouns;
  const isHistory = course.capabilities.kind === "history";

  const completedLessonIds = useMemo(
    () => new Set(progress.completedLessons),
    [progress.completedLessons],
  );

  const completedUnits = useMemo(
    () =>
      outline.units.filter(
        (unit) =>
          unit.lessons.length > 0 &&
          unit.lessons.every((lesson) => completedLessonIds.has(lesson.id)),
      ),
    [completedLessonIds, outline.units],
  );

  const hasSomethingToPractice = reviewPhraseIds.length > 0;
  const hasStarted = progress.completedLessons.length > 0 || memorySummary.tracked > 0;

  if (!hasStarted) {
    return (
      <div className="space-y-4">
        <PracticeHeader courseLabel={course.label} />
        <EmptyPractice nouns={nouns.lesson} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PracticeHeader courseLabel={course.label} />

      {/* The headline action: what spaced repetition says is worth doing now. */}
      {!isHistory && (
        <PracticeCard
          accent="violet"
          description={
            duePhraseCount > 0
              ? `${duePhraseCount} ${duePhraseCount === 1 ? "phrase is" : "phrases are"} ready to come back — the schedule says now is when they stick.`
              : hasSomethingToPractice
                ? `Nothing is due yet. You can still drill your ${reviewPhraseIds.length} weakest ${reviewPhraseIds.length === 1 ? "phrase" : "phrases"}.`
                : `Finish a ${nouns.lesson} and your phrases will start showing up here.`
          }
          disabled={!hasSomethingToPractice}
          href="/strengthen"
          icon={<Brain size={22} />}
          label={duePhraseCount > 0 ? `${duePhraseCount} due` : undefined}
          primary
          title={duePhraseCount > 0 ? "Review what's due" : "Strengthen weak phrases"}
        />
      )}

      {activeMistakes.length > 0 && (
        <PracticeCard
          accent="rose"
          description="Retry the questions you got wrong. Getting one right clears it."
          href="/review"
          icon={<RotateCcw size={22} />}
          label={`${activeMistakes.length}`}
          title={`Fix ${activeMistakes.length} ${activeMistakes.length === 1 ? "mistake" : "mistakes"}`}
        />
      )}

      {activeSkippedListening.length > 0 && (
        <PracticeCard
          accent="cyan"
          description="Audio prompts you set aside. Come back when sound is convenient."
          href="/review"
          icon={<VolumeX size={22} />}
          label={`${activeSkippedListening.length}`}
          title="Skipped audio practice"
        />
      )}

      {!isHistory && completedUnits.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200">
              <RefreshCw size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-50">
                {nouns.unit === "unit" ? "Unit" : "Section"} checkpoints
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Mix a finished {nouns.unit} back together.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {completedUnits.slice(-4).reverse().map((unit) => (
              <Link
                key={unit.id}
                href={`/unit-review/${unit.id}`}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/10"
              >
                <span className="truncate">
                  {unit.number}. {unit.title}
                </span>
                <ArrowRight size={16} className="shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <PracticeCard
          accent="slate"
          compact
          description={`Every ${isHistory ? "moment" : "word and phrase"} you've met, searchable.`}
          href="/vocabulary"
          icon={<BookOpen size={20} />}
          title={nouns.wordBank}
        />
        {course.capabilities.music && (
          <PracticeCard
            accent="slate"
            compact
            description="Sing along to simple practice songs with synced lyrics."
            href="/music"
            icon={<Music size={20} />}
            title="Music"
          />
        )}
      </div>

      {memorySummary.tracked > 0 && (
        <p className="px-1 pb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
          {memorySummary.tracked} {memorySummary.tracked === 1 ? "phrase" : "phrases"} in
          your memory · {memorySummary.strong} going strong ·{" "}
          <Link href="/progress" className="font-black text-violet-700 underline dark:text-violet-300">
            see progress
          </Link>
        </p>
      )}
    </div>
  );
}

function PracticeHeader({ courseLabel }: { courseLabel: string }) {
  return (
    <header className="px-1">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
        {courseLabel}
      </p>
      <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50 sm:text-3xl">
        Practice
      </h1>
    </header>
  );
}

const ACCENTS = {
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
} as const;

function PracticeCard({
  accent,
  compact = false,
  description,
  disabled = false,
  href,
  icon,
  label,
  primary = false,
  title,
}: {
  accent: keyof typeof ACCENTS;
  compact?: boolean;
  description: string;
  disabled?: boolean;
  href: string;
  icon: React.ReactNode;
  label?: string;
  primary?: boolean;
  title: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl",
          compact ? "size-10" : "size-12",
          ACCENTS[accent],
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "font-black text-slate-900 dark:text-slate-50",
              compact ? "text-sm" : "text-base sm:text-lg",
            )}
          >
            {title}
          </span>
          {label && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white">
              {label}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      </span>
      {!disabled && (
        <ArrowRight size={18} className="shrink-0 self-center text-slate-400" />
      )}
    </>
  );

  const className = cn(
    "flex min-h-16 items-start gap-3 rounded-3xl border p-4 transition",
    primary
      ? "border-violet-200 bg-violet-50 shadow-[0_4px_0_#ddd6fe] hover:-translate-y-0.5 dark:border-violet-400/30 dark:bg-violet-400/10 dark:shadow-[0_4px_0_rgba(167,139,250,0.2)]"
      : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]",
    disabled && "pointer-events-none opacity-55",
  );

  if (disabled) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}

/**
 * Never a dead end: with nothing learned yet, point at the one thing that
 * unlocks practice.
 */
function EmptyPractice({ nouns }: { nouns: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/[0.05]">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
        <Sparkles size={26} />
      </span>
      <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-slate-50">
        Practice unlocks as you learn
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
        Finish your first {nouns} and the phrases you meet start showing up here
        on a spaced-repetition schedule — right before you would have forgotten
        them.
      </p>
      <Link
        href="/lessons"
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 font-black text-white shadow-[0_5px_0_#5b21b6] transition hover:-translate-y-0.5 active:translate-y-0.5"
      >
        Start a {nouns} <ArrowRight size={18} />
      </Link>
    </section>
  );
}
