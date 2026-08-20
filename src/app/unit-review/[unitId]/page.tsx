"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LessonFlow } from "@/components/lesson/lesson-flow";
import { getCurriculum, getUnit } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import type { Lesson, Phrase } from "@/types/learning";

export default function UnitReviewPage() {
  const params = useParams<{ unitId: string }>();
  const unitId = params?.unitId ?? "";
  const { activeCurriculumId } = useProgress();
  const curriculum = getCurriculum(activeCurriculumId);
  const unit = getUnit(unitId, activeCurriculumId);

  const reviewLesson = useMemo<Lesson | null>(() => {
    if (!unit) {
      return null;
    }

    // Everything the unit's lessons touch — which, on a cumulative course,
    // already includes the older units those lessons interleaved. The engine
    // picks which of these to actually ask about based on what the learner's
    // memory says is weak, rather than shuffling and taking the first twelve.
    const seen = new Set<string>();
    const phrases: Phrase[] = [];

    for (const lesson of unit.lessons) {
      for (const phrase of lesson.phrases) {
        if (!seen.has(phrase.id)) {
          seen.add(phrase.id);
          phrases.push(phrase);
        }
      }
    }

    if (phrases.length === 0) {
      return null;
    }

    return {
      id: `unit-review-${unit.id}`,
      unitId: unit.id,
      unitNumber: unit.number,
      title: `Review ${unit.title}`,
      difficulty: "review",
      summary: `Mix everything from ${unit.title}.`,
      phrases,
      exercises: [],
      curriculumId: activeCurriculumId,
      locale: curriculum.locale,
      plan: {
        kind: "review",
        newPhraseIds: [],
        reviewPhraseIds: phrases.map((phrase) => phrase.id),
      },
    };
    // Rebuild only when the unit or curriculum changes, not on every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit?.id, activeCurriculumId, curriculum.locale]);

  if (!reviewLesson) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-4">
        <Link
          href="/practice"
          aria-label="Back to practice"
          className="inline-grid size-11 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft size={20} />
        </Link>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          This unit isn&apos;t ready to review yet.
        </p>
      </div>
    );
  }

  // LessonFlow supplies its own exit + progress chrome in review mode.
  return <LessonFlow key={reviewLesson.id} lesson={reviewLesson} reviewMode />;
}
