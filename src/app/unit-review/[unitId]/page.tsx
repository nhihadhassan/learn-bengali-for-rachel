"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
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

  const backLink = (
    <Link
      href="/lessons"
      aria-label="Back to lessons"
      className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 sm:size-10"
    >
      <ArrowLeft size={18} />
    </Link>
  );

  if (!reviewLesson) {
    return (
      <div className="flex items-center gap-3">
        {backLink}
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
          This unit isn&apos;t ready to review yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {backLink}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-xs font-black uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">
            <RefreshCw size={13} /> Unit review
          </p>
          <h1 className="truncate text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
            {reviewLesson.title}
          </h1>
        </div>
      </div>

      <LessonFlow key={reviewLesson.id} lesson={reviewLesson} reviewMode />
    </div>
  );
}
