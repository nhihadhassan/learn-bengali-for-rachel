"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Flame, GraduationCap, PartyPopper, VolumeX, X } from "lucide-react";
import { checkTypedAnswer } from "@/lib/answer-checking";
import { getNextLesson } from "@/lib/content";
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
  | {
      id: string;
      type: "recognize";
      phrase: Phrase;
      options: string[];
      prompt: string;
    }
  | { id: string; type: "exercise"; exercise: Exercise };

type AnswerState = "idle" | "correct" | "wrong" | "skipped";

export function LessonFlow({ lesson }: { lesson: Lesson }) {
  const steps = useMemo(() => buildLessonSteps(lesson), [lesson]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [correctCount, setCorrectCount] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const {
    activeCurriculumId,
    completeLesson,
    recordEncounteredPhrase,
    recordMistake,
    recordSkippedListening,
    setActiveCurriculumId,
  } = useProgress();
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
    if (step.type === "learn") {
      recordEncounteredPhrase(step.phrase.id, lessonCurriculumId);
    }
  }, [lessonCurriculumId, recordEncounteredPhrase, step]);

  function resetInteraction() {
    setAnswerState("idle");
    setSelectedAnswer("");
    setTypedAnswer("");
    setMatches({});
    setStreakMilestone(null);
  }

  function moveNext() {
    if (stepIndex + 1 >= steps.length) {
      completeLesson(lesson.id, lesson.unitNumber, correctCount, lessonCurriculumId);
      playFeedbackSound("complete");
      setIsComplete(true);
      return;
    }

    setStepIndex((current) => current + 1);
    resetInteraction();
  }

  function finishQuestion(isCorrect: boolean, wrongAnswer: string, correctAnswer: string) {
    setAnswerState(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
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

    if (step.type === "exercise" && step.exercise.type === "multiple-choice") {
      finishQuestion(
        selectedAnswer === step.exercise.answer,
        selectedAnswer,
        step.exercise.answer,
      );
    }

    if (step.type === "exercise" && step.exercise.type === "translation") {
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
    if (step.type === "recognize") {
      return selectedAnswer.length > 0;
    }

    if (step.type !== "exercise") {
      return false;
    }

    if (step.exercise.type === "translation") {
      return typedAnswer.trim().length > 0;
    }

    if (step.exercise.type === "multiple-choice") {
      return selectedAnswer.length > 0;
    }

    return (step.exercise.pairs ?? []).every((pair) => matches[pair.left]);
  }, [matches, selectedAnswer, step, typedAnswer]);

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
          <div className="mt-6 grid gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 shadow-inner sm:grid-cols-3">
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
      <div className="sticky top-[73px] z-10 -mx-2 mb-6 rounded-2xl bg-white/95 px-2 py-2 backdrop-blur sm:top-[81px]">
        <ProgressHeader current={stepIndex + 1} total={steps.length} />
      </div>

      {streakMilestone && (
        <div className="milestone-spark mb-5 flex items-center gap-3 rounded-3xl border border-orange-200 bg-gradient-to-r from-amber-50 via-orange-50 to-fuchsia-50 p-3 font-black text-orange-900 shadow-[0_14px_30px_rgba(245,158,11,0.16)]">
          <span className="warm-glow grid size-10 place-items-center rounded-2xl bg-amber-400 text-white">
            <Flame size={18} className="flame-dance" fill="currentColor" />
          </span>
          <span>{streakMilestone} correct in a row</span>
          <span className="xp-pop ml-auto rounded-full bg-white px-3 py-1 text-xs text-violet-800 shadow-sm">
            +streak
          </span>
        </div>
      )}

      {step.type === "intro" && (
        <IntroStep
          title={step.title}
          body={step.body}
          lesson={step.lesson}
          onContinue={moveNext}
        />
      )}

      {step.type === "learn" && (
        <LearnStep locale={lesson.locale} step={step} onContinue={moveNext} />
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
          <h2 className="text-2xl font-black">{step.prompt}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Listen to the phrase, then choose the English meaning.
          </p>
          <div className="mt-5 flex items-center justify-between rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner">
            <p className="text-3xl font-black">{step.phrase.romanized}</p>
            <SpeakerButton
              audioUrl={step.phrase.audioUrl}
              locale={lesson.locale}
              romanized={step.phrase.romanized}
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
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700">
            {getExerciseMode(step.exercise)}
          </p>
          <h2 className="mt-2 text-2xl font-black">{step.exercise.prompt}</h2>

          {step.exercise.audioPromptId && (
            <ExerciseAudioPrompt
              audioPrompt={audioPromptsById.get(step.exercise.audioPromptId)}
              locale={lesson.locale}
            />
          )}

          {step.exercise.type === "multiple-choice" && (
            <MultipleChoiceOptions
              options={step.exercise.options ?? []}
              selectedAnswer={selectedAnswer}
              setSelectedAnswer={setSelectedAnswer}
              isLocked={answerState !== "idle"}
            />
          )}

          {step.exercise.type === "translation" && (
            <input
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              placeholder="Type your answer"
              disabled={answerState !== "idle"}
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg font-bold shadow-inner outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
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
    <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
          Audio
        </p>
        <p className="mt-1 text-sm font-bold text-slate-600">
          Listen, then choose the matching phrase.
        </p>
      </div>
      <SpeakerButton
        locale={audioPrompt.locale ?? locale}
        romanized={audioPrompt.roman}
      />
    </div>
  );
}

function IntroStep({
  body,
  lesson,
  onContinue,
  title,
}: {
  body: string;
  lesson: Lesson;
  onContinue: () => void;
  title: string;
}) {
  if (lesson.curriculumId === "history" && lesson.history) {
    return (
      <div>
        <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <HistoryIcon name={lesson.history.icon} size={25} />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-amber-700">
          Story moment
        </p>
        <h2 className="mt-2 text-3xl font-black">{title}</h2>
        <div className="mt-5 grid gap-3">
          {lesson.history.story.map((sentence, index) => (
            <div
              key={sentence}
              className="grid grid-cols-[auto_1fr] gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-inner"
            >
              <span className="mt-1 grid size-7 place-items-center rounded-full bg-white text-sm font-black text-amber-700 shadow-sm">
                {index + 1}
              </span>
              <p className="text-base leading-7 text-slate-700">{sentence}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-3xl border border-violet-100 bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
            Key takeaway
          </p>
          <p className="mt-2 text-lg font-black text-slate-900">
            {lesson.history.keyTakeaway}
          </p>
          {lesson.history.whyItMatters && (
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
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

  return (
    <div>
      <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <GraduationCap size={25} />
      </span>
      <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-emerald-700">
        Short lesson
      </p>
      <h2 className="mt-2 text-3xl font-black">{title}</h2>
      <p className="mt-3 text-base leading-7 text-slate-600">{body}</p>
      <AppButton
        type="button"
        onClick={onContinue}
        className="mt-6"
      >
        Start <ArrowRight size={18} />
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
          <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-700">
            New phrase {step.position} of {step.total}
          </p>
          <h2 className="mt-3 text-5xl font-black leading-tight text-slate-950">
            {step.phrase.romanized}
          </h2>
        </div>
        <SpeakerButton
          audioUrl={step.phrase.audioUrl}
          locale={locale}
          romanized={step.phrase.romanized}
        />
      </div>

      <div className="mt-6 grid gap-3">
        <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
            Meaning
          </p>
          <p className="mt-1 text-2xl font-black">{step.phrase.english}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Pronunciation
          </p>
          <p className="mt-1 text-lg font-bold text-slate-700">
            {step.phrase.pronunciation}
          </p>
        </div>
      </div>

      <AppButton
        type="button"
        onClick={onContinue}
        className="mt-6"
      >
        Practice it <ArrowRight size={18} />
      </AppButton>
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
  return (
    <div>
      {children}

      {answerState !== "idle" && (
        <div
          className={cn(
            "streak-pop mt-5 flex items-start gap-3 rounded-2xl p-4 font-bold shadow-sm",
            answerState === "correct"
              ? "correct-pop border border-emerald-100 bg-emerald-50 text-emerald-800"
              : answerState === "skipped"
                ? "border border-violet-100 bg-violet-50 text-violet-800"
                : "border border-rose-100 bg-rose-50 text-rose-800",
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
            </p>
            {answerState === "correct" && (
              <p className="xp-pop mt-1 text-sm font-black text-emerald-700">
                +5 XP energy
              </p>
            )}
            {answerState === "skipped" && (
              <p className="mt-1 text-sm font-semibold">
                Skipped. You can review listening practice later.
              </p>
            )}
            {answerState === "wrong" && (
              <p className="mt-1 text-sm font-semibold">
                Correct answer: {correctAnswer}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {answerState === "idle" ? (
          <>
            {onSkip && (
              <AppButton type="button" variant="secondary" onClick={onSkip}>
                <VolumeX size={18} />
                {skipLabel}
              </AppButton>
            )}
            <AppButton
              type="button"
              disabled={!canCheck}
              onClick={onCheck}
            >
              Check
            </AppButton>
          </>
        ) : (
          <AppButton
            type="button"
            onClick={onContinue}
            variant={answerState === "skipped" ? "primary" : "success"}
          >
            Continue <ArrowRight size={18} />
          </AppButton>
        )}
      </div>
    </div>
  );
}

function MultipleChoiceOptions({
  isLocked = false,
  options,
  selectedAnswer,
  setSelectedAnswer,
}: {
  isLocked?: boolean;
  options: string[];
  selectedAnswer: string;
  setSelectedAnswer: (answer: string) => void;
}) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <AnswerButton
          key={option}
          type="button"
          onClick={() => setSelectedAnswer(option)}
          isSelected={selectedAnswer === option}
          disabled={isLocked}
        >
          {option}
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
          className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:grid-cols-[1fr_1fr]"
        >
          <div className="rounded-xl bg-white px-4 py-3 text-lg font-black shadow-sm">
            {pair.left}
          </div>
          <select
            value={matches[pair.left] ?? ""}
            onChange={(event) =>
              setMatches({ ...matches, [pair.left]: event.target.value })
            }
            disabled={isLocked}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          >
            <option value="">Choose meaning</option>
            {rightOptions.map((right) => (
              <option key={right} value={right}>
                {right}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function buildLessonSteps(lesson: Lesson): LessonStep[] {
  const introducedPhrases = lesson.phrases.slice(0, 5);
  const phraseMeanings = introducedPhrases.map((phrase) => phrase.english);
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

    steps.push({
      id: `${lesson.id}-recognize-${phrase.id}`,
      type: "recognize",
      phrase,
      prompt: `What does "${phrase.romanized}" mean?`,
      options: buildMeaningOptions(phrase.english, phraseMeanings),
    });
  });

  steps.push(...lesson.exercises.map((exercise) => ({
    id: `${lesson.id}-review-${exercise.id}`,
    type: "exercise" as const,
    exercise,
  })));

  return steps;
}

function buildMeaningOptions(answer: string, allMeanings: string[]) {
  const fillers = ["hello", "thank you", "where", "rice", "water", "father"];
  const candidates = [...allMeanings, ...fillers].filter(
    (option) => option !== answer,
  );
  const uniqueOptions = Array.from(new Set([answer, ...candidates])).slice(0, 4);

  return uniqueOptions.sort();
}

function getStepPrompt(step: LessonStep) {
  if (step.type === "recognize") {
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
        step.exercise.sourceType === "listenSelect"))
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
