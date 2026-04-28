"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { checkTypedAnswer } from "@/lib/answer-checking";
import { useProgress } from "@/lib/progress-store";
import type { MatchingPair, Mistake } from "@/types/learning";
import { AppButton } from "@/components/ui/app-button";
import { ExerciseCard } from "@/components/ui/exercise-card";

export function MistakeReview() {
  const [index, setIndex] = useState(0);
  const { activeMistakes } = useProgress();
  const currentIndex = Math.min(index, Math.max(activeMistakes.length - 1, 0));
  const currentMistake = activeMistakes[currentIndex];

  if (activeMistakes.length === 0 || !currentMistake) {
    return (
      <section className="animate-soft-rise rounded-[34px] bg-gradient-to-br from-emerald-600 to-cyan-600 p-6 text-white shadow-[0_24px_80px_rgba(5,150,105,0.25)] ring-1 ring-white/20 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          Mistake review
        </p>
        <h1 className="mt-2 text-4xl font-black">Nothing to review yet.</h1>
        <p className="mt-3 max-w-xl text-emerald-50">
          Missed answers will show up here after a lesson, so Rachel can repeat
          weak phrases before moving on.
        </p>
        <Link
          href="/lessons"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-emerald-800"
        >
          Go to lessons
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="animate-soft-rise rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-rose-100">
          Mistake review
        </p>
        <h1 className="mt-2 text-4xl font-black">Practice the sticky parts.</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Retry missed questions one at a time. A correct answer clears the
          mistake and earns a little XP.
        </p>
      </section>

      <div className="mx-auto max-w-2xl">
        <MistakeCard
          key={currentMistake.id}
          currentIndex={currentIndex}
          mistake={currentMistake}
          onMoveNext={() =>
            setIndex((current) =>
              Math.min(current + 1, Math.max(activeMistakes.length - 2, 0)),
            )
          }
          total={activeMistakes.length}
        />
      </div>
    </div>
  );
}

function MistakeCard({
  currentIndex,
  mistake,
  onMoveNext,
  total,
}: {
  currentIndex: number;
  mistake: Mistake;
  onMoveNext: () => void;
  total: number;
}) {
  const [answer, setAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const { resolveMistake } = useProgress();
  const matchingPairs = useMemo(
    () => parseMatchingAnswer(mistake.correctAnswer),
    [mistake.correctAnswer],
  );
  const check = useMemo(
    () => checkTypedAnswer(answer, mistake.correctAnswer),
    [answer, mistake.correctAnswer],
  );
  const hasMatchingReview = matchingPairs.length > 0;
  const canCheck = hasMatchingReview
    ? matchingPairs.every((pair) => matches[pair.left])
    : answer.trim().length > 0;

  function checkReviewAnswer() {
    const isCorrect = hasMatchingReview
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
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700">
            <RotateCcw size={20} />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
              Mistake {currentIndex + 1} of {total}
            </p>
            <h2 className="mt-1 text-xl font-black">{mistake.prompt}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Last answer: {mistake.wrongAnswer}
            </p>
          </div>
        </div>
      </div>

      {hasMatchingReview ? (
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
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold shadow-inner outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        />
      )}

      <AppButton
        type="button"
        disabled={!canCheck}
        onClick={checkReviewAnswer}
        className="mt-4"
      >
        Check
      </AppButton>

      {feedback === "correct" && (
        <p className="streak-pop mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 font-bold text-emerald-800 shadow-sm">
          <Check size={18} /> Cleared
        </p>
      )}

      {feedback === "wrong" && (
        <div className="streak-pop mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 font-bold text-rose-800 shadow-sm">
          <p>Correct answer: {formatCorrectAnswer(mistake.correctAnswer)}</p>
          <p className="mt-1 text-sm font-semibold text-rose-700">
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
          Skip for now <ArrowRight size={18} />
        </AppButton>
      )}
    </ExerciseCard>
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
