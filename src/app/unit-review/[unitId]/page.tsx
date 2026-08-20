"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LessonFlow } from "@/components/lesson/lesson-flow";
import { getCurriculum, getUnit } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import type { Lesson, Phrase } from "@/types/learning";

// Deterministic-per-mount shuffle so the mixed order stays stable through the
// session. Content phrases don't change, so a plain useMemo is enough.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

    const phrases: Phrase[] = shuffle(
      unit.lessons.flatMap((lesson) => lesson.phrases),
    ).slice(0, 12);

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
