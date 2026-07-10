"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { checkTypedAnswer } from "@/lib/answer-checking";
import { getNextLesson } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import type { Exercise, Lesson, MatchingPair } from "@/types/learning";
import { cn } from "@/lib/utils";

type AnswerState = "idle" | "correct" | "wrong";

export function QuizRunner({ lesson }: { lesson: Lesson }) {
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [correctCount, setCorrectCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const { completeLesson, recordMistake } = useProgress();
  const exercise = lesson.exercises[index];
  const nextLesson = getNextLesson(lesson.id);

  const progressPercent = Math.round((index / lesson.exercises.length) * 100);

  function resetQuestion() {
    setAnswerState("idle");
    setTypedAnswer("");
    setSelectedAnswer("");
    setMatches({});
  }

  function finishQuestion(isCorrect: boolean, wrongAnswer: string) {
    setAnswerState(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setCorrectCount((count) => count + 1);
      return;
    }

    recordMistake({
      exerciseId: exercise.id,
      lessonId: lesson.id,
      prompt: exercise.prompt,
      correctAnswer: exercise.answer,
      wrongAnswer: wrongAnswer || "No answer",
    });
  }

  function continueLesson() {
    if (index + 1 >= lesson.exercises.length) {
      completeLesson(lesson.id, lesson.unitNumber, correctCount);
      setIsComplete(true);
      return;
    }

    setIndex((current) => current + 1);
    resetQuestion();
  }

  function checkAnswer() {
    if (exercise.type === "translation") {
      finishQuestion(
        checkTypedAnswer(typedAnswer, exercise.answer).isCorrect,
        typedAnswer,
      );
    }

    if (exercise.type === "multiple-choice") {
      finishQuestion(selectedAnswer === exercise.answer, selectedAnswer);
    }

    if (exercise.type === "matching") {
      const isCorrect = (exercise.pairs ?? []).every(
        (pair) => matches[pair.left] === pair.right,
      );
      const wrongAnswer = Object.entries(matches)
        .map(([left, right]) => `${left} -> ${right}`)
        .join(", ");

      finishQuestion(isCorrect, wrongAnswer);
    }
  }

  const canCheck = useMemo(() => {
    if (!exercise) {
      return false;
    }

    if (exercise.type === "translation") {
      return typedAnswer.trim().length > 0;
    }

    if (exercise.type === "multiple-choice") {
      return selectedAnswer.length > 0;
    }

    return (exercise.pairs ?? []).every((pair) => matches[pair.left]);
  }, [exercise, matches, selectedAnswer, typedAnswer]);

  if (isComplete) {
    return (
      <section className="rounded-3xl bg-emerald-600 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          Lesson complete
        </p>
        <h2 className="mt-2 text-4xl font-black">Nice work, Rachel.</h2>
        <p className="mt-3 max-w-xl text-emerald-50">
          You got {correctCount} of {lesson.exercises.length} right and earned XP.
          Missed questions are waiting in review.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {nextLesson ? (
            <Link
              href={`/practice/${nextLesson.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-emerald-800"
            >
              Next lesson <ArrowRight size={18} />
            </Link>
          ) : (
            <Link
              href="/review"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-black text-emerald-800"
            >
              Review mistakes <ArrowRight size={18} />
            </Link>
          )}
          <Link
            href="/lessons"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white"
          >
            Lesson path
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-500">
          <span>
            Question {index + 1} of {lesson.exercises.length}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <h2 className="text-2xl font-black">{exercise.prompt}</h2>

      <div className="mt-5">
        {exercise.type === "multiple-choice" && (
          <MultipleChoiceExercise
            exercise={exercise}
            selectedAnswer={selectedAnswer}
            setSelectedAnswer={setSelectedAnswer}
          />
        )}

        {exercise.type === "translation" && (
          <TranslationExercise
            value={typedAnswer}
            onChange={setTypedAnswer}
          />
        )}

        {exercise.type === "matching" && (
          <MatchingExercise
            pairs={exercise.pairs ?? []}
            matches={matches}
            setMatches={setMatches}
          />
        )}
      </div>

      {answerState !== "idle" && (
        <div
          className={cn(
            "mt-5 flex items-start gap-3 rounded-xl p-4 font-bold",
            answerState === "correct"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800",
          )}
          role="status"
          aria-live="polite"
        >
          {answerState === "correct" ? <Check size={20} /> : <X size={20} />}
          <div>
            <p>{answerState === "correct" ? "Correct" : "Not quite"}</p>
            {answerState === "wrong" && (
              <p className="mt-1 text-sm font-semibold">
                Correct answer: {exercise.answer}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {answerState === "idle" ? (
          <button
            type="button"
            disabled={!canCheck}
            onClick={checkAnswer}
            className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Check
          </button>
        ) : (
          <button
            type="button"
            onClick={continueLesson}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white transition hover:bg-emerald-700"
          >
            Continue <ArrowRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

function MultipleChoiceExercise({
  exercise,
  selectedAnswer,
  setSelectedAnswer,
}: {
  exercise: Exercise;
  selectedAnswer: string;
  setSelectedAnswer: (answer: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(exercise.options ?? []).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setSelectedAnswer(option)}
          className={cn(
            "rounded-xl border px-4 py-4 text-left font-black transition",
            selectedAnswer === option
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-white hover:bg-slate-50",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TranslationExercise({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label htmlFor="quiz-answer" className="sr-only">
        Your answer
      </label>
      <input
        id="quiz-answer"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type the romanized Bengali answer"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-lg font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </>
  );
}

function MatchingExercise({
  pairs,
  matches,
  setMatches,
}: {
  pairs: MatchingPair[];
  matches: Record<string, string>;
  setMatches: (matches: Record<string, string>) => void;
}) {
  const rightOptions = [...pairs.map((pair) => pair.right)].sort();

  return (
    <div className="grid gap-3">
      {pairs.map((pair) => (
        <div
          key={pair.left}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr]"
        >
          <div className="rounded-lg bg-white px-4 py-3 text-lg font-black">
            {pair.left}
          </div>
          <select
            aria-label={`Meaning for ${pair.left}`}
            value={matches[pair.left] ?? ""}
            onChange={(event) =>
              setMatches({ ...matches, [pair.left]: event.target.value })
            }
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
