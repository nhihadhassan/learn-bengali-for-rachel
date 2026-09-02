"use client";

/**
 * History courses are read-through story chapters, not drills, so they get
 * their own presentation instead of being special-cased inside the language
 * lesson engine.
 */

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { findFollowingLesson } from "@/lib/course-index";
import { useProgress } from "@/lib/progress-store";
import { playFeedbackSound } from "@/lib/sound-effects";
import type { Lesson } from "@/types/learning";
import { HistoryIcon } from "@/components/lesson/history-icon";
import { LessonChrome } from "@/components/lesson/lesson-chrome";
import { LessonCompleteScreen } from "@/components/lesson/lesson-complete";
import { AppButton } from "@/components/ui/app-button";
import { ExerciseCard } from "@/components/ui/exercise-card";

export function HistoryStoryFlow({ lesson }: { lesson: Lesson }) {
  const [isComplete, setIsComplete] = useState(false);
  const [earnedGems, setEarnedGems] = useState(0);
  const {
    activeCurriculumId,
    completeLesson,
    progress,
    recordLessonPosition,
    setActiveCurriculumId,
  } = useProgress();
  const lessonCurriculumId = lesson.curriculumId ?? activeCurriculumId;
  const nextLesson = findFollowingLesson(lesson.id);
  const history = lesson.history;
  const isTravelStory = history?.layout === "travel-story";

  useEffect(() => {
    if (lesson.curriculumId && lesson.curriculumId !== activeCurriculumId) {
      setActiveCurriculumId(lesson.curriculumId);
    }
  }, [activeCurriculumId, lesson.curriculumId, setActiveCurriculumId]);

  useEffect(() => {
    if (!isComplete) {
      recordLessonPosition(lesson.id, 0, lessonCurriculumId);
    }
  }, [isComplete, lesson.id, lessonCurriculumId, recordLessonPosition]);

  function completeChapter() {
    setEarnedGems(progress.completedLessons.includes(lesson.id) ? 0 : 25);
    completeLesson(lesson.id, lesson.unitNumber, 0, lessonCurriculumId);
    playFeedbackSound("complete");
    setIsComplete(true);
  }

  if (isComplete) {
    return (
      <LessonCompleteScreen
        correctCount={0}
        gemsEarned={earnedGems}
        kind="story"
        mistakeCount={0}
        nextHref={nextLesson ? `/practice/${nextLesson.id}` : "/lessons"}
        nextLabel={nextLesson ? "Next chapter" : "Back to the timeline"}
        questionCount={0}
        secondaryHref="/lessons"
        secondaryLabel="Story path"
        streak={progress.streak}
        xpEarned={10}
      />
    );
  }

  return (
    <>
      <LessonChrome current={0} total={1} exitLabel="Exit chapter" />
      <div className="mx-auto max-w-2xl px-4">
      <ExerciseCard className="mt-4">
      {isTravelStory ? (
        <article className="animate-soft-rise mx-auto max-w-3xl">
          <div className="rounded-[30px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-5 shadow-inner dark:border-violet-300/20 dark:from-violet-400/12 dark:via-white/[0.08] dark:to-cyan-400/10 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-4xl font-black leading-tight text-slate-950 dark:text-slate-50">
                {lesson.title}
              </h1>
              <span className="grid size-14 shrink-0 place-items-center rounded-3xl bg-violet-600 text-white shadow-[0_14px_30px_rgba(124,58,237,0.22)]">
                <HistoryIcon name={history?.icon} size={28} />
              </span>
            </div>

            <div className="mt-7 space-y-5 text-lg leading-8 text-slate-700 dark:text-slate-200">
              {(history?.story ?? [lesson.summary]).map((paragraph, index) => (
                <p key={`${lesson.id}-paragraph-${index}`}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <AppButton type="button" onClick={completeChapter}>
              Complete chapter <ArrowRight size={18} aria-hidden="true" />
            </AppButton>
          </div>
        </article>
      ) : (
      <div className="animate-soft-rise">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
              Chapter
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-slate-950 dark:text-slate-50">
              {lesson.title}
            </h1>
          </div>
          <span className="grid size-14 place-items-center rounded-3xl bg-amber-50 text-amber-700 shadow-inner dark:bg-amber-400/15 dark:text-amber-200">
            <HistoryIcon name={history?.icon} size={28} />
          </span>
        </div>

        <div className="mt-6 rounded-[28px] border border-violet-100 bg-violet-50 p-5 shadow-inner dark:border-violet-300/20 dark:bg-violet-400/12">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
            Hook
          </p>
          <p className="mt-2 text-2xl font-black leading-snug text-slate-950 dark:text-slate-50">
            {history?.hook ?? lesson.summary}
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {(history?.story ?? [lesson.summary]).map((sentence, index) => (
            <div
              key={`${lesson.id}-story-${index}`}
              className="story-fade grid grid-cols-[auto_1fr] gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.08]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="mt-1 grid size-8 place-items-center rounded-full bg-slate-950 text-sm font-black text-white shadow-sm dark:bg-violet-500">
                {index + 1}
              </span>
              <p className="text-base leading-7 text-slate-700 dark:text-slate-200">{sentence}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-cyan-100 bg-cyan-50 p-5 dark:border-cyan-300/20 dark:bg-cyan-400/12">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
            Key takeaway
          </p>
          <p className="mt-2 text-lg font-black leading-7 text-slate-900 dark:text-slate-50">
            {history?.keyTakeaway ?? lesson.summary}
          </p>
        </div>

        {history?.remember && (
          <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50 p-5 dark:border-amber-300/20 dark:bg-amber-400/12">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
              Remember this
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {history.remember.person && (
                <RememberItem label="Person" value={history.remember.person} />
              )}
              {history.remember.place && (
                <RememberItem label="Place" value={history.remember.place} />
              )}
              {history.remember.theme && (
                <RememberItem label="Theme" value={history.remember.theme} />
              )}
              {history.remember.consequence && (
                <RememberItem label="Consequence" value={history.remember.consequence} />
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AppButton type="button" onClick={completeChapter}>
              Complete chapter <ArrowRight size={18} aria-hidden="true" />
          </AppButton>
        </div>
      </div>
      )}
      </ExerciseCard>
      </div>
    </>
  );
}

function RememberItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-white/10">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}
