"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Flame,
  PartyPopper,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { checkTypedAnswer } from "@/lib/answer-checking";
import { getNextLesson } from "@/lib/content";
import {
  capitalizeDisplayText,
  formatPromptDisplay,
  formatRomanizedDisplay,
} from "@/lib/display-text";
import { playPronunciation } from "@/lib/pronunciation";
import { useProgress } from "@/lib/progress-store";
import { playFeedbackSound } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";
import type { AudioPrompt, Exercise, Lesson, MatchingPair, Phrase } from "@/types/learning";
import { HistoryIcon } from "@/components/lesson/history-icon";
import { SpeakerButton } from "@/components/lesson/speaker-button";
import { AnswerButton, AppButton } from "@/components/ui/app-button";
import { ExerciseCard } from "@/components/ui/exercise-card";
import { ProgressHeader } from "@/components/ui/progress-header";

type LessonStep =
  | { id: string; type: "intro"; lesson: Lesson; title: string; body: string }
  | { id: string; type: "learn"; phrase: Phrase; position: number; total: number }
  | { id: string; type: "speak"; phrase: Phrase; prompt: string }
  | {
      id: string;
      type: "recognize";
      phrase: Phrase;
      options: string[];
      prompt: string;
    }
  | {
      // English meaning shown, pick the correct word/phrase in the target language.
      id: string;
      type: "produce";
      phrase: Phrase;
      options: string[];
      prompt: string;
    }
  | {
      // Arrange a shuffled word bank into the correct phrase order.
      id: string;
      type: "order";
      phrase: Phrase;
      tokens: string[];
      prompt: string;
    }
  | {
      // Complete the sentence: one word is blanked; pick it from a word bank.
      id: string;
      type: "complete";
      phrase: Phrase;
      before: string;
      after: string;
      answer: string;
      hint: string;
      options: string[];
      prompt: string;
    }
  | { id: string; type: "exercise"; exercise: Exercise };

type AnswerState = "idle" | "correct" | "wrong" | "skipped";

export function LessonFlow({ lesson }: { lesson: Lesson }) {
  if (lesson.curriculumId === "history") {
    return <HistoryStoryFlow lesson={lesson} />;
  }

  return <PracticeLessonFlow lesson={lesson} />;
}

function HistoryStoryFlow({ lesson }: { lesson: Lesson }) {
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
  const nextLesson = getNextLesson(lesson.id);
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
      <section className="animate-soft-rise relative overflow-hidden rounded-[36px] bg-gradient-to-br from-violet-700 via-slate-900 to-cyan-800 p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.3)] ring-1 ring-white/20 sm:p-8">
        <div className="celebration-burst" aria-hidden="true" />
        <div className="relative z-10">
          <span className="warm-glow grid size-16 place-items-center rounded-3xl bg-white text-violet-700">
            <PartyPopper size={28} />
          </span>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-violet-100">
            Story complete
          </p>
          <h2 className="mt-2 text-4xl font-black">Chapter added to your timeline.</h2>
          <p className="mt-3 max-w-xl text-violet-50">
            {isTravelStory
              ? "You finished a Peru chapter and moved your travel story forward."
              : "You read the chapter, connected the key idea, and earned XP for this History path."}
          </p>
          <div className="mt-6 grid gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-inner sm:grid-cols-4">
            <div>
              <p className="text-sm font-bold text-violet-100">Chapter</p>
              <p className="text-3xl font-black">Read</p>
            </div>
            <div>
              <p className="text-sm font-bold text-violet-100">XP earned</p>
              <p className="text-3xl font-black">10</p>
            </div>
            <div>
              <p className="text-sm font-bold text-violet-100">Gems earned</p>
              <p className="text-3xl font-black">{earnedGems}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-violet-100">Timeline</p>
              <p className="text-3xl font-black">Updated</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {nextLesson ? (
              <Link
                href={`/practice/${nextLesson.id}`}
                className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-1"
              >
                Continue <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href="/lessons"
                className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-1"
              >
                Back to timeline <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
            )}
            <Link
              href="/lessons"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-950/70 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-violet-950 active:translate-y-1"
            >
              Story path
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <ExerciseCard>
      <div className="sticky top-[73px] z-10 -mx-2 mb-6 rounded-2xl bg-white/95 px-2 py-2 backdrop-blur transition-colors duration-300 dark:bg-slate-950/90 sm:top-[81px]">
        <ProgressHeader current={1} total={1} />
      </div>
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
              Complete chapter <ArrowRight size={18} />
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
            Complete chapter <ArrowRight size={18} />
          </AppButton>
        </div>
      </div>
      )}
    </ExerciseCard>
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

function PracticeLessonFlow({ lesson }: { lesson: Lesson }) {
  const steps = useMemo(() => buildLessonSteps(lesson), [lesson]);
  const {
    activeCurriculumId,
    completeLesson,
    progress,
    recordEncounteredPhrase,
    recordLessonPosition,
    recordMistake,
    recordSkippedListening,
    setActiveCurriculumId,
  } = useProgress();
  const restoredStepIndex =
    progress.lastLessonId === lesson.id &&
    !progress.completedLessons.includes(lesson.id)
      ? Math.min(Math.max(progress.lastStepIndex, 0), Math.max(steps.length - 1, 0))
      : 0;
  const [stepIndex, setStepIndex] = useState(restoredStepIndex);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [orderTokens, setOrderTokens] = useState<number[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [earnedGems, setEarnedGems] = useState(0);
  const isRestoringStepRef = useRef(false);
  const step = steps[stepIndex];
  const lessonCurriculumId = lesson.curriculumId ?? activeCurriculumId;
  const isHistoryLesson = lessonCurriculumId === "history";
  const nextLesson = getNextLesson(lesson.id);
  const audioPromptsById = useMemo(
    () =>
      new Map(
        (lesson.audioPrompts ?? []).map((audioPrompt) => [
          audioPrompt.id,
          audioPrompt,
        ]),
      ),
    [lesson.audioPrompts],
  );

  useEffect(() => {
    if (lesson.curriculumId && lesson.curriculumId !== activeCurriculumId) {
      setActiveCurriculumId(lesson.curriculumId);
    }
  }, [activeCurriculumId, lesson.curriculumId, setActiveCurriculumId]);

  useEffect(() => {
    if (isComplete || progress.completedLessons.includes(lesson.id)) {
      return;
    }

    if (progress.lastLessonId !== lesson.id) {
      return;
    }

    const savedStepIndex = Math.min(
      Math.max(progress.lastStepIndex, 0),
      Math.max(steps.length - 1, 0),
    );

    if (savedStepIndex === stepIndex) {
      return;
    }

    isRestoringStepRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      setStepIndex(savedStepIndex);
      isRestoringStepRef.current = false;
    });

    return () => {
      window.cancelAnimationFrame(frame);
      isRestoringStepRef.current = false;
    };
  }, [
    isComplete,
    lesson.id,
    progress.completedLessons,
    progress.lastLessonId,
    progress.lastStepIndex,
    stepIndex,
    steps.length,
  ]);

  useEffect(() => {
    if (step.type === "learn") {
      recordEncounteredPhrase(step.phrase.id, lessonCurriculumId);
    }
  }, [lessonCurriculumId, recordEncounteredPhrase, step]);

  function resetInteraction() {
    setAnswerState("idle");
    setSelectedAnswer("");
    setTypedAnswer("");
    setMatches({});
    setOrderTokens([]);
    setStreakMilestone(null);
  }

  useEffect(() => {
    if (!isComplete && !isRestoringStepRef.current) {
      recordLessonPosition(lesson.id, stepIndex, lessonCurriculumId);
    }
  }, [
    isComplete,
    lesson.id,
    lessonCurriculumId,
    recordLessonPosition,
    stepIndex,
  ]);

  function moveNext() {
    if (stepIndex + 1 >= steps.length) {
      setEarnedGems(progress.completedLessons.includes(lesson.id) ? 0 : 25);
      completeLesson(lesson.id, lesson.unitNumber, correctCount, lessonCurriculumId);
      playFeedbackSound("complete");
      setIsComplete(true);
      return;
    }

    const nextStepIndex = stepIndex + 1;
    recordLessonPosition(lesson.id, nextStepIndex, lessonCurriculumId);
    setStepIndex(nextStepIndex);
    resetInteraction();
  }

  function finishQuestion(isCorrect: boolean, wrongAnswer: string, correctAnswer: string) {
    setAnswerState(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      applyCorrectFeedback();

      return;
    }

    setCorrectStreak(0);
    recordMistake(
      {
        exerciseId: step.id,
        lessonId: lesson.id,
        prompt: getStepPrompt(step),
        correctAnswer,
        wrongAnswer: wrongAnswer || "No answer",
      },
      lessonCurriculumId,
    );
  }

  function applyCorrectFeedback() {
    const nextStreak = correctStreak + 1;
    setCorrectCount((count) => count + 1);
    setCorrectStreak(nextStreak);

    const milestone = getStreakMilestone(nextStreak);

    if (milestone) {
      setStreakMilestone(milestone);
      playFeedbackSound(`streak-${milestone}` as const);
    } else {
      playFeedbackSound("correct");
    }
  }

  function finishSpeakingPractice() {
    applyCorrectFeedback();
    moveNext();
  }

  function skipSpeakingPractice() {
    if (step.type !== "speak") {
      return;
    }

    recordSkippedListening(
      {
        exerciseId: step.id,
        kind: "speaking",
        lessonId: lesson.id,
        prompt: getStepPrompt(step),
      },
      lessonCurriculumId,
    );
    moveNext();
  }

  function skipListening() {
    if (answerState !== "idle") {
      return;
    }

    if (!isListeningStep(step)) {
      return;
    }

    setAnswerState("skipped");
    recordSkippedListening(
      {
        exerciseId: step.id,
        kind: "listening",
        lessonId: lesson.id,
        prompt: getStepPrompt(step),
      },
      lessonCurriculumId,
    );
  }

  function checkAnswer() {
    if (answerState !== "idle") {
      return;
    }

    if (step.type === "recognize") {
      finishQuestion(selectedAnswer === step.phrase.english, selectedAnswer, step.phrase.english);
    }

    if (step.type === "produce") {
      finishQuestion(
        selectedAnswer === step.phrase.romanized,
        selectedAnswer,
        step.phrase.romanized,
      );
    }

    if (step.type === "complete") {
      finishQuestion(selectedAnswer === step.answer, selectedAnswer, step.answer);
    }

    if (step.type === "order") {
      const assembled = orderTokens.map((tokenIndex) => step.tokens[tokenIndex]).join(" ");
      const isCorrect = checkTypedAnswer(assembled, step.phrase.romanized).isCorrect;
      finishQuestion(isCorrect, assembled, step.phrase.romanized);
    }

    if (step.type === "exercise" && step.exercise.type === "multiple-choice") {
      finishQuestion(
        selectedAnswer === step.exercise.answer,
        selectedAnswer,
        step.exercise.answer,
      );
    }

    if (
      step.type === "exercise" &&
      (step.exercise.type === "translation" ||
        step.exercise.type === "listen-type" ||
        step.exercise.type === "fill-blank")
    ) {
      const acceptedAnswers = [
        step.exercise.answer,
        ...(step.exercise.acceptedAnswers ?? []),
      ];
      const isCorrect = acceptedAnswers.some(
        (answer) => checkTypedAnswer(typedAnswer, answer).isCorrect,
      );
      finishQuestion(isCorrect, typedAnswer, step.exercise.answer);
    }

    if (step.type === "exercise" && step.exercise.type === "matching") {
      const pairs = step.exercise.pairs ?? [];
      const isCorrect = pairs.every((pair) => matches[pair.left] === pair.right);
      const wrongAnswer = Object.entries(matches)
        .map(([left, right]) => `${left} -> ${right}`)
        .join(", ");
      const correctAnswer = pairs
        .map((pair) => `${pair.left} -> ${pair.right}`)
        .join(", ");

      finishQuestion(isCorrect, wrongAnswer, correctAnswer);
    }
  }

  const canCheck = useMemo(() => {
    if (step.type === "recognize" || step.type === "produce" || step.type === "complete") {
      return selectedAnswer.length > 0;
    }

    if (step.type === "order") {
      return orderTokens.length === step.tokens.length;
    }

    if (step.type !== "exercise") {
      return false;
    }

    if (step.exercise.type === "translation") {
      return typedAnswer.trim().length > 0;
    }

    if (step.exercise.type === "listen-type" || step.exercise.type === "fill-blank") {
      return typedAnswer.trim().length > 0;
    }

    if (step.exercise.type === "multiple-choice") {
      return selectedAnswer.length > 0;
    }

    return (step.exercise.pairs ?? []).every((pair) => matches[pair.left]);
  }, [matches, orderTokens, selectedAnswer, step, typedAnswer]);

  if (isComplete) {
    return (
      <section className="animate-soft-rise relative overflow-hidden rounded-[36px] bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white shadow-[0_28px_90px_rgba(5,150,105,0.3)] ring-1 ring-white/20 sm:p-8">
        <div className="celebration-burst" aria-hidden="true" />
        <div className="relative z-10">
          <span className="warm-glow grid size-16 place-items-center rounded-3xl bg-white text-emerald-700">
            <PartyPopper size={28} />
          </span>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
            {isHistoryLesson ? "Story complete" : "Lesson complete"}
          </p>
          <h2 className="mt-2 text-4xl font-black">Nice work, Rachel.</h2>
          <p className="mt-3 max-w-xl text-emerald-50">
            {isHistoryLesson
              ? `You connected this story moment and earned XP. Missed recap questions are waiting in review.`
              : `You got ${correctCount} practice checks right and earned XP. Missed questions are waiting in review.`}
          </p>
          <div className="mt-6 grid gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-inner sm:grid-cols-4">
            <div>
              <p className="text-sm font-bold text-emerald-100">
                {isHistoryLesson ? "Story checks" : "Correct checks"}
              </p>
              <p className="text-3xl font-black">{correctCount}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-100">XP earned</p>
              <p className="text-3xl font-black">{10 + correctCount * 5}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-100">Gems earned</p>
              <p className="text-3xl font-black">{earnedGems}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-100">Review</p>
              <p className="text-3xl font-black">Ready</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {nextLesson ? (
              <Link
                href={`/practice/${nextLesson.id}`}
                className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-emerald-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:bg-emerald-50 active:translate-y-1"
              >
                Next lesson <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href="/review"
                className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-emerald-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:bg-emerald-50 active:translate-y-1"
              >
                Review mistakes <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
            )}
            <Link
              href="/lessons"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-800/80 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-emerald-900 active:translate-y-1"
            >
              Lesson path
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <ExerciseCard>
      <div className="sticky top-[56px] z-10 -mx-2 mb-4 rounded-2xl bg-white/95 px-2 py-2 backdrop-blur transition-colors duration-300 dark:bg-slate-950/90 sm:top-[64px]">
        <ProgressHeader current={stepIndex + 1} total={steps.length} />
      </div>

      {streakMilestone && (
        <div
          className={cn(
            "milestone-spark mb-5 flex items-center gap-3 rounded-3xl border border-orange-200 bg-gradient-to-r from-amber-50 via-orange-50 to-fuchsia-50 p-3 font-black text-orange-900 shadow-[0_14px_30px_rgba(245,158,11,0.16)] dark:border-orange-300/30 dark:from-amber-400/18 dark:via-orange-400/16 dark:to-fuchsia-400/14 dark:text-orange-100",
            streakMilestone >= 10 && "scale-[1.02] ring-4 ring-amber-300/25",
            streakMilestone === 5 && "ring-2 ring-orange-300/20",
          )}
        >
          <span
            className={cn(
              "warm-glow grid place-items-center rounded-2xl bg-amber-400 text-white transition-all",
              streakMilestone >= 10 ? "size-12" : "size-10",
            )}
          >
            <Flame size={18} className="flame-dance" fill="currentColor" />
          </span>
          <span>{streakMilestone} correct in a row</span>
          <span className="xp-pop ml-auto rounded-full bg-white px-3 py-1 text-xs text-violet-800 shadow-sm dark:bg-white/12 dark:text-violet-100">
            +{streakMilestone >= 10 ? 10 : 5} XP rush
          </span>
        </div>
      )}

      {step.type === "intro" && (
        <IntroStep
          title={step.title}
          lesson={step.lesson}
          onContinue={moveNext}
        />
      )}

      {step.type === "learn" && (
        <LearnStep locale={lesson.locale} step={step} onContinue={moveNext} />
      )}

      {step.type === "speak" && (
        <SpeakPracticeStep
          locale={lesson.locale}
          onDone={finishSpeakingPractice}
          onSkip={skipSpeakingPractice}
          step={step}
        />
      )}

      {step.type === "recognize" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          correctAnswer={step.phrase.english}
          onCheck={checkAnswer}
          onContinue={moveNext}
          onSkip={skipListening}
          skipLabel="Skip for now"
        >
          <h2 className="text-xl font-black sm:text-2xl">
            {formatPromptDisplay(step.prompt)}
          </h2>
          <p className="mt-1 hidden text-sm font-semibold text-slate-600 dark:text-slate-300 sm:block">
            Listen to the phrase, then choose the English meaning.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-3xl border border-cyan-100 bg-cyan-50 p-3 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12 sm:mt-4 sm:p-4">
            <p className="text-2xl font-black sm:text-3xl">
              {formatRomanizedDisplay(step.phrase.romanized)}
            </p>
            <SpeakerButton
              audioFile={step.phrase.audioFile}
              audioUrl={step.phrase.audioUrl}
              locale={lesson.locale}
              romanized={step.phrase.romanized}
              script={step.phrase.bengaliScript}
            />
          </div>
          <MultipleChoiceOptions
            options={step.options}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            isLocked={answerState !== "idle"}
          />
        </QuestionStep>
      )}

      {step.type === "produce" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          correctAnswer={step.phrase.romanized}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Choose the word
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.prompt)}
          </h2>
          <div className="mt-3 rounded-3xl border border-violet-100 bg-violet-50 p-4 shadow-inner dark:border-violet-300/20 dark:bg-violet-400/12">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
              English
            </p>
            <p className="mt-1 text-2xl font-black">
              {capitalizeDisplayText(step.phrase.english)}
            </p>
          </div>
          <MultipleChoiceOptions
            formatOption={formatRomanizedDisplay}
            options={step.options}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            isLocked={answerState !== "idle"}
          />
        </QuestionStep>
      )}

      {step.type === "complete" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          correctAnswer={step.answer}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Complete the sentence
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.prompt)}
          </h2>
          <div className="mt-4 rounded-3xl border border-violet-100 bg-violet-50 p-4 text-xl font-black dark:border-violet-300/20 dark:bg-violet-400/12">
            {step.before && (
              <span>{formatRomanizedDisplay(step.before)} </span>
            )}
            <span className="mx-1 inline-block min-w-16 rounded-xl border-b-4 border-violet-400 px-3 text-center text-violet-700 dark:text-violet-200">
              {answerState === "idle" ? "..." : formatRomanizedDisplay(selectedAnswer || "...")}
            </span>
            {step.after && (
              <span> {formatRomanizedDisplay(step.after)}</span>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Meaning: {capitalizeDisplayText(step.hint)}
          </p>
          <MultipleChoiceOptions
            formatOption={formatRomanizedDisplay}
            options={step.options}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            isLocked={answerState !== "idle"}
          />
        </QuestionStep>
      )}

      {step.type === "order" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          correctAnswer={step.phrase.romanized}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Arrange the words
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.prompt)}
          </h2>
          <div className="mt-3 rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
              English
            </p>
            <p className="mt-1 text-xl font-black">
              {capitalizeDisplayText(step.phrase.english)}
            </p>
          </div>
          <WordOrderExercise
            tokens={step.tokens}
            selected={orderTokens}
            setSelected={setOrderTokens}
            isLocked={answerState !== "idle"}
          />
        </QuestionStep>
      )}

      {step.type === "exercise" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          correctAnswer={getCorrectAnswerLabel(step.exercise)}
          onCheck={checkAnswer}
          onContinue={moveNext}
          onSkip={isListeningStep(step) ? skipListening : undefined}
          skipLabel="Skip for now"
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            {getExerciseMode(step.exercise)}
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.exercise.prompt)}
          </h2>

          {step.exercise.audioPromptId && (
            <ExerciseAudioPrompt
              audioPrompt={audioPromptsById.get(step.exercise.audioPromptId)}
              locale={lesson.locale}
            />
          )}

          {step.exercise.type === "multiple-choice" && (
            <MultipleChoiceOptions
              formatOption={(option) =>
                formatMultipleChoiceOption(step.exercise, option)
              }
              options={step.exercise.options ?? []}
              selectedAnswer={selectedAnswer}
              setSelectedAnswer={setSelectedAnswer}
              isLocked={answerState !== "idle"}
            />
          )}

          {(step.exercise.type === "translation" ||
            step.exercise.type === "listen-type" ||
            step.exercise.type === "fill-blank") && (
            <>
              {step.exercise.type === "fill-blank" && (
                <div className="mt-5 rounded-3xl border border-violet-100 bg-violet-50 p-4 text-xl font-black dark:border-violet-300/20 dark:bg-violet-400/12">
                  {formatRomanizedDisplay(step.exercise.before ?? "")}
                  <span className="mx-2 inline-block min-w-16 rounded-xl border-b-4 border-violet-400 px-3 text-center text-violet-700 dark:text-violet-200">
                    ...
                  </span>
                  {formatRomanizedDisplay(step.exercise.after ?? "")}
                </div>
              )}
            <input
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder={
                step.exercise.type === "listen-type"
                  ? "Type what you hear"
                  : "Type your answer"
              }
              disabled={answerState !== "idle"}
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg font-bold shadow-inner outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-violet-400/20"
            />
            </>
          )}

          {step.exercise.type === "matching" && (
            <MatchingExercise
              pairs={step.exercise.pairs ?? []}
              matches={matches}
              setMatches={setMatches}
              isLocked={answerState !== "idle"}
            />
          )}
        </QuestionStep>
      )}
    </ExerciseCard>
  );
}

function ExerciseAudioPrompt({
  audioPrompt,
  locale,
}: {
  audioPrompt: AudioPrompt | undefined;
  locale?: string;
}) {
  if (!audioPrompt) {
    return null;
  }

  return (
    <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
          Audio
        </p>
        <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
          Listen, then choose the matching phrase.
        </p>
      </div>
      <SpeakerButton
        audioFile={audioPrompt.audioFile}
        audioUrl={audioPrompt.audioUrl}
        locale={audioPrompt.locale ?? locale}
        romanized={audioPrompt.roman}
        script={audioPrompt.textBn}
      />
    </div>
  );
}

function IntroStep({
  lesson,
  onContinue,
  title,
}: {
  lesson: Lesson;
  onContinue: () => void;
  title: string;
}) {
  if (lesson.curriculumId === "history" && lesson.history) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
          <HistoryIcon name={lesson.history.icon} size={25} />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
          Story moment
        </p>
        <h2 className="mt-2 text-3xl font-black">{title}</h2>
        <div className="mt-5 grid gap-3">
          {lesson.history.story.map((sentence, index) => (
            <div
              key={sentence}
              className="grid grid-cols-[auto_1fr] gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-inner dark:border-amber-300/20 dark:bg-amber-400/12"
            >
              <span className="mt-1 grid size-7 place-items-center rounded-full bg-white text-sm font-black text-amber-700 shadow-sm dark:bg-white/12 dark:text-amber-100">
                {index + 1}
              </span>
              <p className="text-base leading-7 text-slate-700 dark:text-slate-200">{sentence}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-3xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-300/20 dark:bg-violet-400/12">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
            Key takeaway
          </p>
          <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-50">
            {lesson.history.keyTakeaway}
          </p>
          {lesson.history.whyItMatters && (
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {lesson.history.whyItMatters}
            </p>
          )}
        </div>
        <AppButton
          type="button"
          onClick={onContinue}
          className="mt-6"
        >
          Connect the story <ArrowRight size={18} />
        </AppButton>
      </div>
    );
  }

  const estimatedMinutes = lesson.metadata?.estimatedMinutes ?? 5;

  return (
    <div>
      <div className="rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 px-5 py-4 shadow-inner dark:border-violet-300/20 dark:from-violet-400/12 dark:via-white/[0.08] dark:to-cyan-400/10">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
          Ready to practice · {estimatedMinutes} min
        </p>
        <h2 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{title}</h2>
      </div>
      <AppButton
        type="button"
        onClick={onContinue}
        className="mt-5 min-h-14 w-full text-base sm:w-auto"
      >
        Start <ArrowRight size={20} />
      </AppButton>
    </div>
  );
}

function LearnStep({
  locale,
  onContinue,
  step,
}: {
  locale?: string;
  onContinue: () => void;
  step: Extract<LessonStep, { type: "learn" }>;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
            New Phrase
          </p>
          <h2 className="mt-3 text-5xl font-black leading-tight text-slate-950 dark:text-slate-50">
            {formatRomanizedDisplay(step.phrase.romanized)}
          </h2>
        </div>
        <SpeakerButton
          audioFile={step.phrase.audioFile}
          audioUrl={step.phrase.audioUrl}
          locale={locale}
          romanized={step.phrase.romanized}
          script={step.phrase.bengaliScript}
        />
      </div>

      <div className="mt-6 grid gap-3">
        <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
            Meaning
          </p>
          <p className="mt-1 text-2xl font-black">
            {capitalizeDisplayText(step.phrase.english)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.08]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Pronunciation
          </p>
          <p className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-200">
            {step.phrase.pronunciation}
          </p>
        </div>
        <WordBreakdown phrase={step.phrase} />
      </div>

      <AppButton
        type="button"
        onClick={onContinue}
        className="mt-5 w-full sm:mt-6 sm:w-auto"
      >
        Practice it <ArrowRight size={18} />
      </AppButton>
    </div>
  );
}

function WordBreakdown({ phrase }: { phrase: Phrase }) {
  if (!phrase.breakdown?.length) {
    return null;
  }

  return (
    <details className="rounded-3xl border border-violet-100 bg-violet-50 p-4 shadow-inner open:pb-5 dark:border-violet-300/20 dark:bg-violet-400/12">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.14em] text-violet-700 marker:text-violet-500 dark:text-violet-200">
        Word Breakdown
      </summary>
      <div className="mt-3 grid gap-2">
        {phrase.breakdown.map((item) => (
          <div
            key={`${phrase.id}-${item.word}`}
            className="grid gap-1 rounded-2xl bg-white/85 px-4 py-3 shadow-sm dark:bg-white/10 sm:grid-cols-[1fr_1.2fr_1.2fr] sm:items-center"
          >
            <p className="font-black text-slate-950 dark:text-slate-50">
              {formatRomanizedDisplay(item.word)}
            </p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-200">
              {item.pronunciation}
            </p>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {capitalizeDisplayText(item.meaning)}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function SpeakPracticeStep({
  locale,
  onDone,
  onSkip,
  step,
}: {
  locale?: string;
  onDone: () => void;
  onSkip: () => void;
  step: Extract<LessonStep, { type: "speak" }>;
}) {
  function playAgain() {
    void playPronunciation({
      audioFile: step.phrase.audioFile,
      audioUrl: step.phrase.audioUrl,
      debug: true,
      locale,
      romanized: step.phrase.romanized,
      script: step.phrase.bengaliScript,
    });
  }

  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-fuchsia-700 dark:text-fuchsia-200">
        Speak
      </p>
      <h2 className="mt-2 text-2xl font-black">{step.prompt}</h2>
      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        Say it out loud. No microphone needed.
      </p>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-fuchsia-100 bg-fuchsia-50 p-5 shadow-inner dark:border-fuchsia-300/20 dark:bg-fuchsia-400/12">
        <div>
          <p className="text-4xl font-black leading-tight">
            {formatRomanizedDisplay(step.phrase.romanized)}
          </p>
          <p className="mt-2 text-lg font-bold text-slate-600 dark:text-slate-300">
            {capitalizeDisplayText(step.phrase.english)}
          </p>
        </div>
        <SpeakerButton
          audioFile={step.phrase.audioFile}
          audioUrl={step.phrase.audioUrl}
          locale={locale}
          romanized={step.phrase.romanized}
          script={step.phrase.bengaliScript}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
        <AppButton type="button" variant="secondary" onClick={onSkip}>
          <VolumeX size={18} />
          Skip for now
        </AppButton>
        <AppButton type="button" variant="secondary" onClick={playAgain}>
          <Volume2 size={18} />
          Play again
        </AppButton>
        <AppButton type="button" onClick={onDone}>
          I said it <ArrowRight size={18} />
        </AppButton>
      </div>
    </div>
  );
}

function QuestionStep({
  answerState,
  canCheck,
  children,
  correctAnswer,
  onCheck,
  onContinue,
  onSkip,
  skipLabel,
}: {
  answerState: AnswerState;
  canCheck: boolean;
  children: ReactNode;
  correctAnswer: string;
  onCheck: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const isAnswered = answerState !== "idle";

  return (
    <div>
      {children}

      {/* Action bar pinned to the bottom of the viewport so Check/Continue is
          always reachable without scrolling, no matter how many options. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-5 rounded-b-[24px] border-t border-slate-200/70 bg-white/95 px-4 pb-4 pt-3 backdrop-blur transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/92 sm:-mx-7 sm:-mb-7 sm:rounded-b-[30px] sm:px-7 sm:pb-6 sm:pt-4">
        {isAnswered && (
          <div
            className={cn(
              "streak-pop mb-3 flex items-start gap-3 rounded-2xl p-3 font-bold shadow-sm",
              answerState === "correct"
                ? "correct-pop border border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/14 dark:text-emerald-100"
                : answerState === "skipped"
                  ? "border border-violet-100 bg-violet-50 text-violet-800 dark:border-violet-300/25 dark:bg-violet-400/14 dark:text-violet-100"
                  : "border border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-300/25 dark:bg-rose-400/14 dark:text-rose-100",
            )}
          >
            {answerState === "correct" ? (
              <Check size={20} />
            ) : answerState === "skipped" ? (
              <VolumeX size={20} />
            ) : (
              <X size={20} />
            )}
            <div>
              <p>
                {answerState === "correct"
                  ? "Correct"
                  : answerState === "skipped"
                    ? "Skipped"
                    : "Not quite"}
                {answerState === "correct" && (
                  <span className="xp-pop ml-2 text-sm font-black text-emerald-700 dark:text-emerald-200">
                    +5 XP
                  </span>
                )}
              </p>
              {answerState === "skipped" && (
                <p className="mt-1 text-sm font-semibold">
                  Skipped. You can review this practice later.
                </p>
              )}
              {answerState === "wrong" && (
                <p className="mt-1 text-sm font-semibold">
                  Correct answer: {capitalizeDisplayText(correctAnswer)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {answerState === "idle" ? (
            <>
              {onSkip && (
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={onSkip}
                  className="flex-1"
                >
                  <VolumeX size={18} />
                  {skipLabel}
                </AppButton>
              )}
              <AppButton
                type="button"
                disabled={!canCheck}
                onClick={onCheck}
                className="flex-1"
              >
                Check
              </AppButton>
            </>
          ) : (
            <AppButton
              type="button"
              onClick={onContinue}
              variant={answerState === "skipped" ? "primary" : "success"}
              className="w-full"
            >
              Continue <ArrowRight size={18} />
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}

function MultipleChoiceOptions({
  formatOption = capitalizeDisplayText,
  isLocked = false,
  options,
  selectedAnswer,
  setSelectedAnswer,
}: {
  formatOption?: (option: string) => string;
  isLocked?: boolean;
  options: string[];
  selectedAnswer: string;
  setSelectedAnswer: (answer: string) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
      {options.map((option) => (
        <AnswerButton
          key={option}
          type="button"
          onClick={() => setSelectedAnswer(option)}
          isSelected={selectedAnswer === option}
          disabled={isLocked}
        >
          {formatOption(option)}
        </AnswerButton>
      ))}
    </div>
  );
}

function MatchingExercise({
  isLocked = false,
  pairs,
  matches,
  setMatches,
}: {
  isLocked?: boolean;
  pairs: MatchingPair[];
  matches: Record<string, string>;
  setMatches: (matches: Record<string, string>) => void;
}) {
  const rightOptions = [...pairs.map((pair) => pair.right)].sort();

  return (
    <div className="mt-5 grid gap-3">
      {pairs.map((pair) => (
        <div
          key={pair.left}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.08] sm:grid-cols-[1fr_1fr]"
        >
          <div className="rounded-xl bg-white px-4 py-3 text-lg font-black shadow-sm dark:bg-white/10">
            {formatRomanizedDisplay(pair.left)}
          </div>
          <select
            value={matches[pair.left] ?? ""}
            onChange={(event) =>
              setMatches({ ...matches, [pair.left]: event.target.value })
            }
            disabled={isLocked}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-50 dark:focus:ring-violet-400/20"
          >
            <option value="">Choose meaning</option>
            {rightOptions.map((right) => (
              <option key={right} value={right}>
                {capitalizeDisplayText(right)}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function WordOrderExercise({
  isLocked = false,
  selected,
  setSelected,
  tokens,
}: {
  isLocked?: boolean;
  selected: number[];
  setSelected: (next: number[]) => void;
  tokens: string[];
}) {
  const usedSet = new Set(selected);

  function pickToken(index: number) {
    if (isLocked || usedSet.has(index)) {
      return;
    }

    setSelected([...selected, index]);
  }

  function removeAt(position: number) {
    if (isLocked) {
      return;
    }

    setSelected(selected.filter((_, current) => current !== position));
  }

  return (
    <div className="mt-5">
      <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.06]">
        {selected.length === 0 ? (
          <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
            Tap the words below to build the phrase.
          </span>
        ) : (
          selected.map((tokenIndex, position) => (
            <button
              key={`chosen-${tokenIndex}-${position}`}
              type="button"
              onClick={() => removeAt(position)}
              disabled={isLocked}
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-black text-slate-900 shadow-sm transition active:scale-95 disabled:opacity-70 dark:border-violet-300/30 dark:bg-white/10 dark:text-slate-50"
            >
              {formatRomanizedDisplay(tokens[tokenIndex])}
            </button>
          ))
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tokens.map((token, index) => (
          <button
            key={`bank-${token}-${index}`}
            type="button"
            onClick={() => pickToken(index)}
            disabled={isLocked || usedSet.has(index)}
            className={cn(
              "rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-black shadow-sm transition active:scale-95 dark:border-white/10 dark:bg-white/10 dark:text-slate-50",
              usedSet.has(index) && "pointer-events-none opacity-30",
            )}
          >
            {formatRomanizedDisplay(token)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pronunciation / speaking practice is archived: there is no reliable way to
// verify a spoken answer yet. The SpeakPracticeStep component and its handlers
// are kept intact — flip this flag back to true to re-enable the flow.
const INCLUDE_SPEAKING_PRACTICE = false;

const MAX_ORDER_STEPS = 2;
const MAX_COMPLETE_STEPS = 2;

function buildLessonSteps(lesson: Lesson): LessonStep[] {
  const introducedPhrases = lesson.phrases.slice(0, 5);
  const phraseMeanings = introducedPhrases.map((phrase) => phrase.english);
  const targetPhrasePool = introducedPhrases.map((phrase) => phrase.romanized);
  const wordPool = buildWordPool(introducedPhrases);
  const steps: LessonStep[] = [
    {
      id: `${lesson.id}-intro`,
      type: "intro",
      lesson,
      title: lesson.title,
      body: lesson.summary,
    },
  ];

  introducedPhrases.forEach((phrase, index) => {
    steps.push({
      id: `${lesson.id}-learn-${phrase.id}`,
      type: "learn",
      phrase,
      position: index + 1,
      total: introducedPhrases.length,
    });

    // Alternate the comprehension direction so learners both recognize
    // (target -> English) and produce (English -> target).
    if (index % 2 === 0) {
      steps.push({
        id: `${lesson.id}-recognize-${phrase.id}`,
        type: "recognize",
        phrase,
        prompt: `What does "${formatRomanizedDisplay(phrase.romanized)}" mean?`,
        options: buildMeaningOptions(phrase.english, phraseMeanings),
      });
    } else {
      steps.push({
        id: `${lesson.id}-produce-${phrase.id}`,
        type: "produce",
        phrase,
        prompt: `Which one means "${capitalizeDisplayText(phrase.english)}"?`,
        options: buildTargetOptions(phrase.romanized, targetPhrasePool),
      });
    }

    if (INCLUDE_SPEAKING_PRACTICE && (index === 1 || index === 3)) {
      steps.push({
        id: `${lesson.id}-speak-${phrase.id}`,
        type: "speak",
        phrase,
        prompt: "Practice saying this phrase.",
      });
    }
  });

  const multiWordPhrases = introducedPhrases.filter(
    (phrase) => splitWords(phrase.romanized).length >= 2,
  );

  // Word-bank ordering: arrange a shuffled phrase into the correct order.
  multiWordPhrases.slice(0, MAX_ORDER_STEPS).forEach((phrase) => {
    steps.push({
      id: `${lesson.id}-order-${phrase.id}`,
      type: "order",
      phrase,
      tokens: shuffleTokens(splitWords(phrase.romanized)),
      prompt: "Tap the words in the correct order.",
    });
  });

  // Sentence completion: blank one word and pick it from a word bank. Use
  // different phrases than the ordering steps where possible to reduce repeats.
  [...multiWordPhrases]
    .reverse()
    .slice(0, MAX_COMPLETE_STEPS)
    .forEach((phrase) => {
      const completeStep = buildCompleteStep(lesson.id, phrase, wordPool);

      if (completeStep) {
        steps.push(completeStep);
      }
    });

  steps.push(...lesson.exercises.map((exercise) => ({
    id: `${lesson.id}-review-${exercise.id}`,
    type: "exercise" as const,
    exercise,
  })));

  return steps;
}

function splitWords(romanized: string): string[] {
  return romanized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function shuffleTokens(words: string[]): string[] {
  if (words.length < 2) {
    return words;
  }

  const original = words.join(" ");

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shuffled = shuffle(words);

    if (shuffled.join(" ") !== original) {
      return shuffled;
    }
  }

  return [...words].reverse();
}

function buildWordPool(phrases: Phrase[]): string[] {
  const words = new Set<string>();

  phrases.forEach((phrase) => {
    splitWords(phrase.romanized).forEach((word) => words.add(word));
  });

  return [...words];
}

function buildTargetOptions(answer: string, pool: string[]): string[] {
  const candidates = pool.filter((option) => option !== answer);
  const unique = Array.from(new Set([answer, ...candidates])).slice(0, 4);

  return shuffle(unique);
}

function buildCompleteStep(
  lessonId: string,
  phrase: Phrase,
  wordPool: string[],
): Extract<LessonStep, { type: "complete" }> | null {
  const words = splitWords(phrase.romanized);

  if (words.length < 2) {
    return null;
  }

  const blankIndex = words.length - 1;
  const answer = words[blankIndex];
  const distractors = wordPool.filter((word) => word !== answer);
  const options = shuffle(
    Array.from(new Set([answer, ...distractors])).slice(0, 4),
  );

  return {
    id: `${lessonId}-complete-${phrase.id}`,
    type: "complete",
    phrase,
    before: words.slice(0, blankIndex).join(" "),
    after: words.slice(blankIndex + 1).join(" "),
    answer,
    hint: phrase.english,
    options,
    prompt: "Pick the missing word to finish the phrase.",
  };
}

function formatMultipleChoiceOption(exercise: Exercise, option: string) {
  if (
    exercise.sourceType === "listenSelect" ||
    exercise.sourceType === "quickReply"
  ) {
    return formatRomanizedDisplay(option);
  }

  return capitalizeDisplayText(option);
}

function buildMeaningOptions(answer: string, allMeanings: string[]) {
  const fillers = ["please", "thank you", "where", "rice", "water", "father"];
  const candidates = [...allMeanings, ...fillers].filter(
    (option) => option !== answer,
  );
  const uniqueOptions = Array.from(new Set([answer, ...candidates])).slice(0, 4);

  return uniqueOptions.sort();
}

function getStepPrompt(step: LessonStep) {
  if (
    step.type === "recognize" ||
    step.type === "produce" ||
    step.type === "order" ||
    step.type === "complete" ||
    step.type === "speak"
  ) {
    return step.prompt;
  }

  if (step.type === "exercise") {
    return step.exercise.prompt;
  }

  return "Lesson step";
}

function getExerciseMode(exercise: Exercise) {
  if (exercise.sourceType?.startsWith("history-")) {
    return "Story check";
  }

  if (exercise.type === "multiple-choice") {
    return "Choose";
  }

  if (exercise.type === "translation") {
    return "Type";
  }

  if (exercise.type === "listen-type") {
    return "Listen";
  }

  if (exercise.type === "fill-blank") {
    return "Practice";
  }

  if (exercise.type === "speaking") {
    return "Speak";
  }

  return "Match";
}

function getStreakMilestone(streak: number): 3 | 5 | 10 | null {
  if (streak === 3 || streak === 5 || streak === 10) {
    return streak;
  }

  return null;
}

function isListeningStep(step: LessonStep) {
  return (
    step.type === "recognize" ||
    (step.type === "exercise" &&
      (Boolean(step.exercise.audioPromptId) ||
        step.exercise.sourceType === "listenSelect" ||
        step.exercise.type === "listen-type"))
  );
}

function getCorrectAnswerLabel(exercise: Exercise) {
  if (exercise.type === "matching") {
    return (exercise.pairs ?? [])
      .map((pair) => `${pair.left} -> ${pair.right}`)
      .join(", ");
  }

  return exercise.answer;
}
