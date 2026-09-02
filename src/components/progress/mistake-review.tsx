"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, VolumeX } from "lucide-react";
import { checkTypedAnswer } from "@/lib/answer-checking";
import { locateLesson } from "@/lib/course-index";
import { getCourse } from "@/lib/courses";
import { loadAuthoredLesson } from "@/lib/course-loader";
import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { useProgress } from "@/lib/progress-store";
import type { Lesson } from "@/types/learning";
import type {
  AudioPrompt,
  MatchingPair,
  Mistake,
  SkippedListeningExercise,
} from "@/types/learning";
import { SpeakerButton } from "@/components/lesson/speaker-button";
import { AnswerButton, AppButton } from "@/components/ui/app-button";
import { ExerciseCard } from "@/components/ui/exercise-card";

export function MistakeReview() {
  const [reviewPosition, setReviewPosition] = useState({
    curriculumId: "",
    index: 0,
  });
  const { activeCurriculumId, activeMistakes, activeSkippedListening } = useProgress();
  const index =
    reviewPosition.curriculumId === activeCurriculumId
      ? reviewPosition.index
      : 0;
  const currentIndex = Math.min(index, Math.max(activeMistakes.length - 1, 0));
  const currentMistake = activeMistakes[currentIndex];
  const currentSkipped = activeSkippedListening[0];

  if (activeMistakes.length === 0 && currentSkipped) {
    return (
      <div className="space-y-5">
        <ReviewHero
          eyebrow="Smart Review"
          title="Catch up on skipped practice."
          body="These are not mistakes. They are listening or speaking prompts Rachel saved for later."
        />

        <div className="mx-auto max-w-2xl">
          <SkippedListeningCard
            skipped={currentSkipped}
            total={activeSkippedListening.length}
          />
        </div>
      </div>
    );
  }

  if (activeMistakes.length === 0 || !currentMistake) {
    return <NothingToFix />;
  }

  return (
    <div className="space-y-5">
      <ReviewHero
        eyebrow="Smart Review"
        title="Practice the sticky parts."
        body={`Retry missed questions one at a time. A correct answer clears the mistake and earns a little XP.${
          activeSkippedListening.length > 0
            ? ` ${activeSkippedListening.length} skipped practice ${activeSkippedListening.length === 1 ? "prompt is" : "prompts are"} waiting after mistakes.`
            : ""
        }`}
      />

      <div className="mx-auto max-w-2xl">
        <MistakeCard
          key={currentMistake.id}
          currentIndex={currentIndex}
          mistake={currentMistake}
          onMoveNext={() =>
            setReviewPosition({
              curriculumId: activeCurriculumId,
              index: Math.min(
                currentIndex + 1,
                Math.max(activeMistakes.length - 2, 0),
              ),
            })
          }
          total={activeMistakes.length}
          curriculumId={activeCurriculumId}
        />
      </div>
    </div>
  );
}

function ReviewHero({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="animate-soft-rise rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
      <p className="text-sm font-black uppercase tracking-[0.14em] text-rose-100">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-4xl font-black">{title}</h1>
      <p className="mt-3 max-w-xl text-slate-300">
        {body}
      </p>
    </section>
  );
}

function SkippedListeningCard({
  skipped,
  total,
}: {
  skipped: SkippedListeningExercise;
  total: number;
}) {
  const { resolveSkippedListening } = useProgress();
  const lesson = locateLesson(skipped.lessonId)?.lesson;

  return (
    <ExerciseCard>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
          <VolumeX size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Skipped {skipped.kind === "speaking" ? "speaking" : "listening"} 1 of {total}
          </p>
          <h2 className="mt-1 text-xl font-black">
            {capitalizeDisplayText(skipped.prompt)}
          </h2>
          {lesson && (
            <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              From {lesson.title}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-violet-100 bg-violet-50 p-4 text-violet-900 dark:border-violet-300/25 dark:bg-violet-400/14 dark:text-violet-100">
        <p className="font-bold">
          This was skipped, not missed. Replay it when practice is convenient.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/practice/${skipped.lessonId}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white shadow-[0_6px_0_#5b21b6] transition hover:-translate-y-0.5 hover:bg-fuchsia-500 active:translate-y-1"
        >
          Open lesson <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <AppButton
          type="button"
          variant="secondary"
          onClick={() => resolveSkippedListening(skipped.id)}
        >
          Clear skip
        </AppButton>
      </div>
    </ExerciseCard>
  );
}

function MistakeCard({
  currentIndex,
  curriculumId,
  mistake,
  onMoveNext,
  total,
}: {
  currentIndex: number;
  curriculumId: Parameters<typeof loadAuthoredLesson>[0];
  mistake: Mistake;
  onMoveNext: () => void;
  total: number;
}) {
  const [answer, setAnswer] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const { resolveMistake } = useProgress();
  const [authoredLesson, setAuthoredLesson] = useState<Lesson | undefined>();

  useEffect(() => {
    let cancelled = false;

    loadAuthoredLesson(curriculumId, mistake.lessonId).then(
      (lesson) => {
        if (!cancelled) {
          setAuthoredLesson(lesson);
        }
      },
      () => {
        if (!cancelled) {
          setAuthoredLesson(undefined);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [curriculumId, mistake.lessonId]);

  const multipleChoiceReview = useMemo(
    () => getMultipleChoiceReview(mistake, authoredLesson),
    [authoredLesson, mistake],
  );
  const matchingPairs = useMemo(
    () => parseMatchingAnswer(mistake.correctAnswer),
    [mistake.correctAnswer],
  );
  const check = useMemo(
    () => checkTypedAnswer(answer, mistake.correctAnswer),
    [answer, mistake.correctAnswer],
  );
  const hasMatchingReview = matchingPairs.length > 0;
  const canCheck = multipleChoiceReview
    ? selectedAnswer.length > 0
    : hasMatchingReview
      ? matchingPairs.every((pair) => matches[pair.left])
      : answer.trim().length > 0;

  function checkReviewAnswer() {
    if (feedback === "correct") {
      return;
    }

    const isCorrect = multipleChoiceReview
      ? selectedAnswer === multipleChoiceReview.answer
      : hasMatchingReview
        ? matchingPairs.every((pair) => matches[pair.left] === pair.right)
        : check.isCorrect;

    if (isCorrect) {
      resolveMistake(mistake.id);
      setFeedback("correct");
      onMoveNext();
      return;
    }

    setFeedback("wrong");
  }

  return (
    <ExerciseCard>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200">
            <RotateCcw size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Mistake {currentIndex + 1} of {total}
            </p>
            <h2 className="mt-1 text-xl font-black">
              {capitalizeDisplayText(mistake.prompt)}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Last answer: {capitalizeDisplayText(mistake.wrongAnswer)}
            </p>
          </div>
        </div>
      </div>

      {multipleChoiceReview ? (
        <MultipleChoiceReview
          review={multipleChoiceReview}
          selectedAnswer={selectedAnswer}
          setSelectedAnswer={(nextAnswer) => {
            setSelectedAnswer(nextAnswer);
            setFeedback("idle");
          }}
        />
      ) : hasMatchingReview ? (
        <MatchingReview
          matches={matches}
          pairs={matchingPairs}
          setMatches={(nextMatches) => {
            setMatches(nextMatches);
            setFeedback("idle");
          }}
        />
      ) : (
        <input
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setFeedback("idle");
          }}
          placeholder="Type the correct answer"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold shadow-inner outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-emerald-400/20"
        />
      )}

      <AppButton
        type="button"
        disabled={!canCheck || feedback === "correct"}
        onClick={checkReviewAnswer}
        className="mt-4"
      >
        Check
      </AppButton>

      {feedback === "correct" && (
        <p className="streak-pop mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 font-bold text-emerald-800 shadow-sm dark:border-emerald-300/25 dark:bg-emerald-400/14 dark:text-emerald-100">
          <Check size={18} aria-hidden="true" /> Cleared
        </p>
      )}

      {feedback === "wrong" && (
        <div className="streak-pop mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 font-bold text-rose-800 shadow-sm dark:border-rose-300/25 dark:bg-rose-400/14 dark:text-rose-100">
          <p>
            Correct answer:{" "}
            {capitalizeDisplayText(formatCorrectAnswer(mistake.correctAnswer))}
          </p>
          <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-200">
            Minor spelling variations are okay, but the answer still needs to
            match the meaning.
          </p>
        </div>
      )}

      {total > 1 && (
        <AppButton
          type="button"
          onClick={onMoveNext}
          variant="secondary"
          className="mt-5"
        >
          Skip for now <ArrowRight size={18} aria-hidden="true" />
        </AppButton>
      )}
    </ExerciseCard>
  );
}

type MultipleChoiceReviewData = {
  answer: string;
  audioPrompt?: AudioPrompt;
  options: string[];
  sourceType?: string;
};

function MultipleChoiceReview({
  review,
  selectedAnswer,
  setSelectedAnswer,
}: {
  review: MultipleChoiceReviewData;
  selectedAnswer: string;
  setSelectedAnswer: (answer: string) => void;
}) {
  return (
    <div>
      {review.audioPrompt && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
              Listen again
            </p>
            <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
              Replay the prompt, then choose the matching answer.
            </p>
          </div>
          <SpeakerButton
            audioFile={review.audioPrompt.audioFile}
            audioUrl={review.audioPrompt.audioUrl}
            locale={review.audioPrompt.locale}
            romanized={review.audioPrompt.roman}
            script={review.audioPrompt.textBn}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {review.options.map((option) => (
          <AnswerButton
            key={option}
            type="button"
            onClick={() => setSelectedAnswer(option)}
            isSelected={selectedAnswer === option}
          >
            {formatReviewOption(review.sourceType, option)}
          </AnswerButton>
        ))}
      </div>
    </div>
  );
}

function MatchingReview({
  matches,
  pairs,
  setMatches,
}: {
  matches: Record<string, string>;
  pairs: MatchingPair[];
  setMatches: (matches: Record<string, string>) => void;
}) {
  const rightOptions = [...pairs.map((pair) => pair.right)].sort();

  return (
    <div className="grid gap-3">
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-50 dark:focus:ring-emerald-400/20"
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

function getMultipleChoiceReview(
  mistake: Mistake,
  lesson: Lesson | undefined,
): MultipleChoiceReviewData | null {
  const exerciseId = mistake.exerciseId.replace(
    `${mistake.lessonId}-review-`,
    "",
  );
  const exercise = lesson?.exercises.find((item) => item.id === exerciseId);

  if (exercise?.type !== "multiple-choice" || !exercise.options?.length) {
    return null;
  }

  return {
    answer: exercise.answer,
    audioPrompt: lesson?.audioPrompts?.find(
      (audioPrompt) => audioPrompt.id === exercise.audioPromptId,
    ),
    options: exercise.options,
    sourceType: exercise.sourceType,
  };
}

function formatReviewOption(sourceType: string | undefined, option: string) {
  if (sourceType === "listenSelect" || sourceType === "quickReply") {
    return formatRomanizedDisplay(option);
  }

  return capitalizeDisplayText(option);
}

function parseMatchingAnswer(answer: string): MatchingPair[] {
  if (!answer.includes(" -> ")) {
    return [];
  }

  return answer
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      const [left, right] = item.split(" -> ").map((part) => part.trim());
      return left && right ? { left, right } : null;
    })
    .filter((pair): pair is MatchingPair => pair !== null);
}

function formatCorrectAnswer(answer: string) {
  const pairs = parseMatchingAnswer(answer);

  if (pairs.length === 0) {
    return answer;
  }

  return pairs.map((pair) => `${pair.left} = ${pair.right}`).join("; ");
}

/**
 * With no mistakes left, Review must not be a dead end: point at the practice
 * that spaced repetition says is actually worth doing.
 */
function NothingToFix() {
  const { activeCurriculumId, duePhraseCount, reviewPhraseIds } = useProgress();
  const course = getCourse(activeCurriculumId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="px-1">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-300">
          {course.label}
        </p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-50 sm:text-3xl">
          Nothing to fix
        </h1>
      </header>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-400/25 dark:bg-emerald-400/10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-600 text-white">
          <Check size={26} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-slate-50">
          No open mistakes in {course.label}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
          Missed questions land here so you can retry them. In the meantime,
          here is what would help most.
        </p>

        <div className="mt-6 grid gap-2 text-left">
          {reviewPhraseIds.length > 0 && (
            <Link
              href="/strengthen"
              className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-slate-100"
            >
              <span className="min-w-0">
                <span className="block text-sm">
                  {duePhraseCount > 0
                    ? `Review ${duePhraseCount} due ${duePhraseCount === 1 ? "phrase" : "phrases"}`
                    : "Strengthen your weakest phrases"}
                </span>
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Spaced repetition picks them for you.
                </span>
              </span>
              <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
            </Link>
          )}
          <Link
            href="/practice"
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-slate-100"
          >
            <span className="min-w-0">
              <span className="block text-sm">All practice options</span>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Checkpoints, {course.nouns.wordBank.toLowerCase()} and more.
              </span>
            </span>
            <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
          </Link>
          <Link
            href="/lessons"
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-white/10 dark:text-slate-100"
          >
            <span className="min-w-0">
              <span className="block text-sm">Carry on learning</span>
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Pick up the next {course.nouns.lesson}.
              </span>
            </span>
            <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
          </Link>
        </div>
      </section>
    </div>
  );
}
