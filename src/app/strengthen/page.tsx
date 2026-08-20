"use client";

/**
 * A spaced-repetition practice session: the phrases the review policy says are
 * weakest or due, mixed into a short lesson-shaped run.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Brain } from "lucide-react";
import { LessonFlow } from "@/components/lesson/lesson-flow";
import { getCurriculum, getPhrase } from "@/lib/content";
import { getCourse } from "@/lib/courses";
import { useProgress } from "@/lib/progress-store";
import type { Lesson, Phrase } from "@/types/learning";

export default function StrengthenPage() {
  const { activeCurriculumId, reviewPhraseIds } = useProgress();
  const curriculum = getCurriculum(activeCurriculumId);
  const course = getCourse(activeCurriculumId);

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
      // Declaring the session kind lets courses that use the cumulative engine
      // apply their "retrieval, no teaching" profile — less scaffolding and
      // harder formats. Courses on the simple strategy ignore it.
      plan: {
        kind: "strengthen",
        newPhraseIds: [],
        reviewPhraseIds: phrases.map((phrase) => phrase.id),
      },
    }),
    [activeCurriculumId, curriculum.locale, phrases],
  );

  // Still snapshotting the queue on first mount.
  if (sessionIds === null) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-4">
        <BackLink />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          Loading practice…
        </p>
      </div>
    );
  }

  if (phrases.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        <BackLink />
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/[0.05]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
            <Brain size={26} />
          </span>
          <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-slate-50">
            Nothing to strengthen yet
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
            Phrases enter your review schedule as you meet them in {course.nouns.lessons}.
          </p>
          <Link
            href="/lessons"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 font-black text-white shadow-[0_5px_0_#5b21b6] transition hover:-translate-y-0.5 active:translate-y-0.5"
          >
            Go to {course.nouns.lessons} <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    );
  }

  // LessonFlow supplies its own exit + progress chrome in review mode.
  return <LessonFlow key={reviewLesson.id} lesson={reviewLesson} reviewMode />;
}

function BackLink() {
  return (
    <Link
      href="/practice"
      aria-label="Back to practice"
      className="inline-grid size-11 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
    >
      <ArrowLeft size={20} />
    </Link>
  );
}
