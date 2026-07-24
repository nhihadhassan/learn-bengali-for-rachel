"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { LessonFlow } from "@/components/lesson/lesson-flow";
import { getCurriculum, getPhrase } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import type { Lesson, Phrase } from "@/types/learning";

export default function StrengthenPage() {
  const { activeCurriculumId, reviewPhraseIds } = useProgress();
  const curriculum = getCurriculum(activeCurriculumId);

  // Snapshot the queue once, after the persisted store has loaded, so that
  // answering (which changes memory, and therefore reviewPhraseIds) doesn't
  // rebuild the session mid-way through. This intentionally latches the first
  // non-empty value from the external store.
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (sessionIds === null && reviewPhraseIds.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time latch of an async-loaded store value
      setSessionIds(reviewPhraseIds);
    }
  }, [reviewPhraseIds, sessionIds]);

  const phrases = useMemo(
    () =>
      (sessionIds ?? [])
        .map((id) => getPhrase(id, activeCurriculumId))
        .filter((phrase): phrase is Phrase => Boolean(phrase)),
    [sessionIds, activeCurriculumId],
  );

  const reviewLesson = useMemo<Lesson>(
    () => ({
      id: `review-${activeCurriculumId}`,
      unitId: "review",
      unitNumber: 0,
      title: "Practice",
      difficulty: "review",
      summary: "Strengthen the words you've learned.",
      phrases,
      exercises: [],
      curriculumId: activeCurriculumId,
      locale: curriculum.locale,
    }),
    [activeCurriculumId, curriculum.locale, phrases],
  );

  const backLink = (
    <Link
      href="/lessons"
      aria-label="Back to lessons"
      className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 sm:size-10"
    >
      <ArrowLeft size={18} />
    </Link>
  );

  // Still snapshotting the queue on first mount.
  if (sessionIds === null) {
    return (
      <div className="flex items-center gap-3">
        {backLink}
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          Loading practice…
        </p>
      </div>
    );
  }

  if (phrases.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {backLink}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">
              Practice
            </p>
            <h1 className="text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
              Nothing to practice yet
            </h1>
          </div>
        </div>
        <div className="rounded-3xl border border-cyan-100 bg-cyan-50/70 p-6 text-center shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan-500 text-white">
            <Dumbbell size={26} />
          </span>
          <p className="mt-4 font-black text-slate-800 dark:text-slate-100">
            Finish a lesson first.
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Words you learn show up here so you can strengthen them over time.
          </p>
          <Link
            href="/lessons"
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 font-black text-white shadow-[0_6px_0_#155e75] transition hover:-translate-y-0.5 active:translate-y-1"
          >
            Go to lessons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {backLink}
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">
            {curriculum.label} · Practice
          </p>
          <h1 className="truncate text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
            Strengthen your words
          </h1>
        </div>
      </div>

      <LessonFlow key={reviewLesson.id} lesson={reviewLesson} reviewMode />
    </div>
  );
}
