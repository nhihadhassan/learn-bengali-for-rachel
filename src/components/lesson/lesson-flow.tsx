"use client";

/**
 * The lesson runner: sequencing, answer checking, and persistence.
 *
 * Responsibilities are deliberately split:
 *  - `@/lib/lesson-steps`            decides *what* steps a lesson contains
 *  - `./steps/exercise-steps`        renders each step type
 *  - `./lesson-complete`             the end-of-session screen
 *  - `./history-story-flow`          history courses, which are read, not drilled
 *  - this file                       state, answers, XP/memory persistence
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { checkTypedAnswer } from "@/lib/answer-checking";
import { findFollowingLesson } from "@/lib/course-index";
import { getCapabilities } from "@/lib/courses";
import { FEATURES } from "@/lib/feature-flags";
import {
  capitalizeDisplayText,
  formatPromptDisplay,
  formatRomanizedDisplay,
} from "@/lib/display-text";
import {
  adaptUpcomingSteps,
  applyMistakeRecycling,
  buildLessonSteps,
  countCompletedWorkSteps,
  countQuestionSteps,
  countWorkSteps,
  formatMultipleChoiceOption,
  getCorrectAnswerLabel,
  getExerciseMode,
  getStepExplanation,
  getStepConceptIds,
  getStepPhraseId,
  getStepProductionFormat,
  getStepPrompt,
  getStreakMilestone,
  isListeningStep,
  type LessonStep,
} from "@/lib/lesson-steps";
import { snapshotLearner } from "@/lib/learner-model";
import { useProgress } from "@/lib/progress-store";
import { playFeedbackSound } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/types/learning";
import { DialogueAvatar } from "@/components/lesson/dialogue-avatar";
import { HistoryStoryFlow } from "@/components/lesson/history-story-flow";
import { LessonChrome } from "@/components/lesson/lesson-chrome";
import { LessonCompleteScreen } from "@/components/lesson/lesson-complete";
import { SpeakerButton } from "@/components/lesson/speaker-button";
import {
  DialogueHistory,
  ExerciseAudioPrompt,
  GrammarStep,
  IntroStep,
  LearnStep,
  MatchingExercise,
  MultipleChoiceOptions,
  NoticeStep,
  PronounceStep,
  QuestionStep,
  SpeakPracticeStep,
  StoryStep,
  WordOrderExercise,
  type AnswerState,
} from "@/components/lesson/steps/exercise-steps";
import { ExerciseCard } from "@/components/ui/exercise-card";

export function LessonFlow({
  lesson,
  reviewMode = false,
}: {
  lesson: Lesson;
  reviewMode?: boolean;
}) {
  // History courses are read, not drilled — the capability decides, not the id.
  const isStoryCourse = lesson.curriculumId
    ? getCapabilities(lesson.curriculumId).kind === "history"
    : false;

  if (isStoryCourse) {
    return <HistoryStoryFlow lesson={lesson} />;
  }

  return <PracticeLessonFlow lesson={lesson} reviewMode={reviewMode} />;
}

function PracticeLessonFlow({
  lesson,
  reviewMode = false,
}: {
  lesson: Lesson;
  reviewMode?: boolean;
}) {
  // The step list is state, not a memo, for two reasons: it is rebuilt once on
  // mount against the learner's *snapshotted* progress, and a wrong answer
  // rewrites a reserved slot later in the lesson (see `applyMistakeRecycling`).
  const [steps, setSteps] = useState<LessonStep[]>(() =>
    buildLessonSteps(lesson, { reviewMode }),
  );
  const {
    activeCurriculumId,
    completeLesson,
    completeReview,
    progress,
    recordAnswer,
    recordConceptResult,
    recordEncounteredPhrase,
    recordLessonPosition,
    recordMistake,
    recordPhraseResult,
    recordSkippedListening,
    setActiveCurriculumId,
  } = useProgress();
  const restoredStepIndex =
    !reviewMode &&
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
  // Rolling record of the last few answers, for support adaptation.
  const [recentResults, setRecentResults] = useState<boolean[]>([]);
  const plannedForLessonRef = useRef<string | null>(null);
  const step = steps[stepIndex];
  const lessonCurriculumId = lesson.curriculumId ?? activeCurriculumId;
  const nextLesson = findFollowingLesson(lesson.id);
  // Progress ignores the intro card, so a lesson reads 0% until real work
  // starts rather than jumping to "1 of 14" on the title screen.
  const workStepCount = useMemo(() => countWorkSteps(steps), [steps]);
  const questionCount = useMemo(() => countQuestionSteps(steps), [steps]);
  const completedWorkSteps = countCompletedWorkSteps(steps, stepIndex);
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

  // Plan the session once per lesson, against a snapshot of what the learner
  // knows right now. It has to happen after mount (localStorage isn't there
  // during the server render) and it must NOT re-run as answers change memory,
  // or the lesson would reshuffle underneath the learner mid-session.
  useEffect(() => {
    if (plannedForLessonRef.current === lesson.id) {
      return;
    }

    plannedForLessonRef.current = lesson.id;
    setSteps(
      buildLessonSteps(lesson, {
        reviewMode,
        learner: snapshotLearner(progress),
      }),
    );
    // `progress` is read once on purpose; see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, reviewMode]);

  useEffect(() => {
    if (reviewMode || isComplete || progress.completedLessons.includes(lesson.id)) {
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
    reviewMode,
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
    if (!reviewMode && !isComplete && !isRestoringStepRef.current) {
      recordLessonPosition(lesson.id, stepIndex, lessonCurriculumId);
    }
  }, [
    isComplete,
    lesson.id,
    lessonCurriculumId,
    recordLessonPosition,
    reviewMode,
    stepIndex,
  ]);

  function moveNext() {
    if (stepIndex + 1 >= steps.length) {
      if (reviewMode) {
        completeReview(10 + correctCount * 5, lessonCurriculumId);
      } else {
        setEarnedGems(progress.completedLessons.includes(lesson.id) ? 0 : 25);
        completeLesson(lesson.id, lesson.unitNumber, correctCount, lessonCurriculumId);
      }
      playFeedbackSound("complete");
      setIsComplete(true);
      return;
    }

    const nextStepIndex = stepIndex + 1;
    if (!reviewMode) {
      recordLessonPosition(lesson.id, nextStepIndex, lessonCurriculumId);
    }
    setStepIndex(nextStepIndex);
    resetInteraction();
  }

  function finishQuestion(isCorrect: boolean, wrongAnswer: string, correctAnswer: string) {
    setAnswerState(isCorrect ? "correct" : "wrong");
    recordAnswer(isCorrect, lessonCurriculumId);

    const phraseId = getStepPhraseId(step);
    if (phraseId) {
      // Producing the Spanish is a different achievement from recognising it,
      // and the difficulty ladder needs to know which one just happened.
      recordPhraseResult(phraseId, isCorrect, lessonCurriculumId, {
        produced: Boolean(getStepProductionFormat(step)),
      });
    }

    recordConceptResult(getStepConceptIds(step), isCorrect, lessonCurriculumId);

    const results = [...recentResults, isCorrect].slice(-6);
    setRecentResults(results);

    if (isCorrect) {
      applyCorrectFeedback();
      return;
    }

    setCorrectStreak(0);
    recordMistake(
      {
        exerciseId: step.id,
        lessonId: lesson.id,
        phraseId,
        prompt: getStepPrompt(step),
        correctAnswer,
        wrongAnswer: wrongAnswer || "No answer",
      },
      lessonCurriculumId,
    );

    // Bring the missed item back later, in a different format, by rewriting a
    // slot that already exists — so the lesson never gets longer and the same
    // question is never re-asked seconds after the correction.
    setSteps((current) => {
      const recycled = applyMistakeRecycling(current, stepIndex, step, lesson);
      return adaptUpcomingSteps(recycled, stepIndex + 1, { recentResults: results }, lesson);
    });
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

  function finishMatching() {
    if (answerState !== "idle") {
      return;
    }

    setAnswerState("correct");
    applyCorrectFeedback();
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

    if (step.type === "order" || step.type === "translate" || step.type === "listen") {
      // At the lowest scaffold level a translation is typed, not tapped. Same
      // answer check either way — `checkTypedAnswer` already forgives accents
      // and punctuation.
      const assembled =
        step.type === "translate" && step.typed
          ? typedAnswer
          : orderTokens.map((tokenIndex) => step.tokens[tokenIndex]).join(" ");
      const isCorrect = checkTypedAnswer(assembled, step.phrase.romanized).isCorrect;
      finishQuestion(isCorrect, assembled, step.phrase.romanized);
    }

    if (step.type === "dialogue" || step.type === "choice") {
      finishQuestion(selectedAnswer === step.answer, selectedAnswer, step.answer);
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
    if (
      step.type === "recognize" ||
      step.type === "produce" ||
      step.type === "complete" ||
      step.type === "dialogue" ||
      step.type === "choice"
    ) {
      return selectedAnswer.length > 0;
    }

    if (step.type === "order") {
      return orderTokens.length === step.tokens.length;
    }

    if (step.type === "translate" && step.typed) {
      return typedAnswer.trim().length > 0;
    }

    if (step.type === "translate" || step.type === "listen") {
      // Distractors mean not every token is used; just need something built.
      return orderTokens.length > 0;
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
      <LessonCompleteScreen
        correctCount={correctCount}
        gemsEarned={earnedGems}
        kind={reviewMode ? "practice" : "lesson"}
        mistakeCount={questionCount - correctCount}
        nextHref={
          reviewMode
            ? "/practice"
            : nextLesson
              ? `/practice/${nextLesson.id}`
              : "/practice"
        }
        nextLabel={
          reviewMode ? "More practice" : nextLesson ? "Next lesson" : "Practice"
        }
        questionCount={questionCount}
        secondaryHref="/lessons"
        secondaryLabel={reviewMode ? "Lesson path" : "Back to path"}
        streak={progress.streak}
        xpEarned={10 + correctCount * 5}
      />
    );
  }

  const explanation = FEATURES.explainMyAnswer
    ? getStepExplanation(step, lesson)
    : undefined;

  return (
    <>
      <LessonChrome
        current={completedWorkSteps}
        exitHref={reviewMode ? "/practice" : "/lessons"}
        exitLabel={reviewMode ? "Exit practice" : "Exit lesson"}
        total={workStepCount}
      />
      <div className="mx-auto max-w-2xl px-4">
      <ExerciseCard className="mt-4">

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

      {step.type === "grammar" && (
        <GrammarStep locale={lesson.locale} step={step} onContinue={moveNext} />
      )}

      {step.type === "notice" && (
        <NoticeStep locale={lesson.locale} step={step} onContinue={moveNext} />
      )}

      {step.type === "story" && (
        <StoryStep locale={lesson.locale} step={step} onContinue={moveNext} />
      )}

      {step.type === "pronounce" && (
        <PronounceStep locale={lesson.locale} step={step} onContinue={moveNext} />
      )}

      {step.type === "choice" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          /* A prediction's explanation *is* the rule, so it wins over the
             generic "why" the engine would otherwise assemble — and it opens
             on its own, because the learner has just earned it. */
          explanation={step.explanation ?? explanation}
          explanationLabel={step.explanation ? "Here's why" : "Explain"}
          explanationOpen={Boolean(step.explanation)}
          correctAnswer={step.answer}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
            Work it out
          </p>
          <h2 className="mt-2 text-xl font-black sm:text-2xl">
            {formatPromptDisplay(step.prompt)}
          </h2>
          {step.audioTarget && (
            <div className="mt-3 flex items-center justify-between rounded-3xl border border-amber-100 bg-amber-50 p-3 shadow-inner dark:border-amber-300/20 dark:bg-amber-400/12 sm:p-4">
              <p className="text-2xl font-black sm:text-3xl">
                {formatRomanizedDisplay(step.audioTarget)}
              </p>
              <SpeakerButton locale={lesson.locale} romanized={step.audioTarget} />
            </div>
          )}
          <MultipleChoiceOptions
            options={step.options}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
            isLocked={answerState !== "idle"}
          />
        </QuestionStep>
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
          explanation={explanation}
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
          explanation={explanation}
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
          explanation={explanation}
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
              <span>
                {/^[.,;:!?]/.test(step.after) ? "" : " "}
                {formatRomanizedDisplay(step.after)}
              </span>
            )}
          </div>
          {step.grammarNote && (
            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-100">
              {step.grammarNote}
            </p>
          )}
          {/* The English meaning is a scaffold, and some lesson types take it
              away on purpose (see `showMeaningHint` in lesson-profiles). */}
          {step.hint && (
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Meaning: {capitalizeDisplayText(step.hint)}
            </p>
          )}
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
          explanation={explanation}
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

      {step.type === "translate" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          explanation={explanation}
          correctAnswer={step.phrase.romanized}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Translate
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.prompt)}
          </h2>
          <div className="mt-3 rounded-3xl border border-violet-100 bg-violet-50 p-4 shadow-inner dark:border-violet-300/20 dark:bg-violet-400/12">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
              In English
            </p>
            <p className="mt-1 text-xl font-black">
              {capitalizeDisplayText(step.phrase.english)}
            </p>
          </div>
          {step.typed ? (
            <div className="mt-4">
              <label
                className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
                htmlFor="translate-typed"
              >
                Your answer
              </label>
              <input
                id="translate-typed"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-violet-400 disabled:opacity-70 dark:border-white/12 dark:bg-white/[0.06] dark:text-slate-50"
                disabled={answerState !== "idle"}
                onChange={(event) => setTypedAnswer(event.target.value)}
                placeholder="Escribe en español…"
                value={typedAnswer}
              />
            </div>
          ) : (
            <WordOrderExercise
              tokens={step.tokens}
              selected={orderTokens}
              setSelected={setOrderTokens}
              isLocked={answerState !== "idle"}
            />
          )}
        </QuestionStep>
      )}

      {step.type === "listen" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          explanation={explanation}
          correctAnswer={step.phrase.romanized}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
            Listen
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.prompt)}
          </h2>
          <div className="mt-3 flex items-center justify-center rounded-3xl border border-cyan-100 bg-cyan-50 p-5 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
            <SpeakerButton
              audioFile={step.phrase.audioFile}
              audioUrl={step.phrase.audioUrl}
              locale={lesson.locale}
              romanized={step.phrase.romanized}
              script={step.phrase.bengaliScript}
            />
          </div>
          {/* Saying it aloud helps, and the learner should know the app is not
              listening: nothing here records or scores speech. */}
          <p className="mt-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            Try saying it out loud too — nothing is recorded or scored.
          </p>
          <WordOrderExercise
            tokens={step.tokens}
            selected={orderTokens}
            setSelected={setOrderTokens}
            isLocked={answerState !== "idle"}
          />
        </QuestionStep>
      )}

      {step.type === "dialogue" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          explanation={explanation}
          correctAnswer={step.answer}
          onCheck={checkAnswer}
          onContinue={moveNext}
        >
          <p className="text-sm font-black uppercase tracking-[0.14em] text-fuchsia-700 dark:text-fuchsia-300">
            {step.scenario ?? "Reply"}
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {formatPromptDisplay(step.prompt)}
          </h2>
          {step.history && <DialogueHistory turns={step.history} />}
          {step.promptReceptive && (
            /* The prompt deliberately uses something not taught yet. Say so,
               rather than letting the learner think they forgot it. */
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
              New expression — just understand it for now
            </p>
          )}
          <div className="mt-3 flex items-end gap-2 sm:gap-3">
            <DialogueAvatar
              seed={step.promptRomanized.length}
              className="size-14 sm:size-16"
            />
            <div className="relative max-w-[80%] rounded-3xl rounded-bl-md border border-slate-200 bg-slate-100 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.08]">
              {/* Speech-bubble tail pointing back to the avatar. */}
              <span
                aria-hidden="true"
                className="absolute -left-1.5 bottom-3 size-3 rotate-45 border-b border-l border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.08]"
              />
              {step.speaker && (
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {step.speaker}
                </p>
              )}
              <p className="text-lg font-black">
                {formatRomanizedDisplay(step.promptRomanized)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {capitalizeDisplayText(step.promptEnglish)}
              </p>
            </div>
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

      {step.type === "exercise" && (
        <QuestionStep
          answerState={answerState}
          canCheck={canCheck}
          explanation={explanation}
          correctAnswer={getCorrectAnswerLabel(step.exercise)}
          onCheck={checkAnswer}
          onContinue={moveNext}
          onSkip={isListeningStep(step) ? skipListening : undefined}
          skipLabel="Skip for now"
          // Matching auto-completes when every pair is tapped, so it needs no
          // Check button — just a hint while the learner works.
          showCheck={step.exercise.type !== "matching"}
          idleHint={
            step.exercise.type === "matching"
              ? "Tap a word on each side to match them."
              : undefined
          }
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
              key={step.exercise.id}
              pairs={step.exercise.pairs ?? []}
              matches={matches}
              setMatches={setMatches}
              isLocked={answerState !== "idle"}
              onComplete={finishMatching}
            />
          )}
        </QuestionStep>
      )}
      </ExerciseCard>
      </div>
    </>
  );
}
