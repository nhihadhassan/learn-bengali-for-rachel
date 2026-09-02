"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Gauge, X } from "lucide-react";
import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { useProgress } from "@/lib/progress-store";
import { useCourseContent } from "@/lib/use-course-content";
import { cn } from "@/lib/utils";
import type { Phrase } from "@/types/learning";
import { AnswerButton, AppButton } from "@/components/ui/app-button";
import { ExerciseCard } from "@/components/ui/exercise-card";
import { ProgressHeader } from "@/components/ui/progress-header";

const MAX_QUESTIONS = 9;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Question = {
  phrase: Phrase;
  options: string[];
  answer: string;
  unitNumber: number;
};

export default function PlacementPage() {
  const router = useRouter();
  const { activeCurriculumId, applyPlacement } = useProgress();
  const { curriculum, error, isLoading, retry } = useCourseContent(activeCurriculumId);

  const units = useMemo(
    () =>
      curriculum?.units.filter((unit) =>
        unit.lessons.some((lesson) => lesson.phrases.length > 0),
      ) ?? [],
    [curriculum],
  );
  const allMeanings = useMemo(
    () =>
      Array.from(
        new Set(
          units.flatMap((unit) =>
            unit.lessons.flatMap((lesson) =>
              lesson.phrases.map((phrase) => phrase.english),
            ),
          ),
        ),
      ),
    [units],
  );

  // Placement seeds progress for every unit below the estimated level. The
  // progress store deliberately knows nothing about lesson content, so the
  // lesson/phrase ids it needs are collected here.
  const placementSource = useMemo(
    () =>
      curriculum
        ? new Map(
            curriculum.units.map((unit) => [
              unit.number,
              {
                lessonIds: unit.lessons.map((lesson) => lesson.id),
                phraseIds: unit.lessons.flatMap((lesson) =>
                  lesson.phrases.map((phrase) => phrase.id),
                ),
              },
            ]),
          )
        : new Map(),
    [curriculum],
  );

  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro");
  // Binary-search bounds over the unit list, so placement converges even for
  // very long courses (131 Spanish units → ~7 questions) instead of crawling
  // one unit at a time. `levelIndex` is the current midpoint being tested.
  const [levelIndex, setLevelIndex] = useState(0);
  const [lowIndex, setLowIndex] = useState(0);
  const [highIndex, setHighIndex] = useState(0);
  const [asked, setAsked] = useState(0);
  const [bestUnit, setBestUnit] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState("");
  const [answerState, setAnswerState] = useState<"idle" | "correct" | "wrong">("idle");
  const [usedIds] = useState<Set<string>>(() => new Set());

  // Choose wrong answers that look like the right one: a sentence answer gets
  // sentence distractors, a single word gets single-word distractors. Otherwise
  // the option whose length matches the prompt gives itself away.
  function pickDistractors(answer: string): string[] {
    const wordCount = (text: string) => text.trim().split(/\s+/).length;
    const answerLen = wordCount(answer);
    const isPhrase = answerLen >= 3;
    const others = allMeanings.filter((meaning) => meaning !== answer);
    const sameKind = others.filter((meaning) => wordCount(meaning) >= 3 === isPhrase);
    const nearLength = sameKind.filter(
      (meaning) => Math.abs(wordCount(meaning) - answerLen) <= 2,
    );
    const primary =
      nearLength.length >= 3 ? nearLength : sameKind.length >= 3 ? sameKind : others;

    const chosen = shuffle(primary).slice(0, 3);
    // Top up if a narrow pool couldn't supply three.
    for (const meaning of shuffle(others)) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(meaning)) chosen.push(meaning);
    }
    return chosen;
  }

  function makeQuestion(unitIndex: number): Question {
    const unit = units[unitIndex];
    const unitPhrases = unit.lessons.flatMap((lesson) => lesson.phrases);
    const fresh = unitPhrases.filter((phrase) => !usedIds.has(phrase.id));
    const pool = fresh.length > 0 ? fresh : unitPhrases;
    const phrase = pool[Math.floor(Math.random() * pool.length)];
    usedIds.add(phrase.id);

    const distractors = pickDistractors(phrase.english);

    return {
      phrase,
      options: shuffle([phrase.english, ...distractors]),
      answer: phrase.english,
      unitNumber: unit.number,
    };
  }

  function startQuiz() {
    usedIds.clear();
    const low = 0;
    const high = units.length - 1;
    const startIndex = Math.floor((low + high) / 2);
    setLowIndex(low);
    setHighIndex(high);
    setLevelIndex(startIndex);
    setAsked(0);
    setBestUnit(0);
    setSelected("");
    setAnswerState("idle");
    setQuestion(makeQuestion(startIndex));
    setPhase("quiz");
  }

  function check() {
    if (answerState !== "idle" || !selected || !question) {
      return;
    }
    setAnswerState(selected === question.answer ? "correct" : "wrong");
  }

  // "I don't know" is an honest answer: reveal the meaning and count it as not
  // known, so placement steps down instead of rewarding a lucky guess.
  function markUnknown() {
    if (answerState !== "idle" || !question) {
      return;
    }
    setSelected("");
    setAnswerState("wrong");
  }

  function next() {
    if (!question) {
      return;
    }

    const correct = answerState === "correct";
    const nextBest = correct
      ? Math.max(bestUnit, question.unitNumber)
      : bestUnit;

    // Narrow the binary-search window: a right answer looks higher, a wrong one
    // looks lower. This converges on the right level in ~log2(units) questions.
    const nextLow = correct ? levelIndex + 1 : lowIndex;
    const nextHigh = correct ? highIndex : levelIndex - 1;
    const nextAsked = asked + 1;

    setBestUnit(nextBest);

    // Stop once the window is empty (converged) or we hit the question cap.
    if (nextLow > nextHigh || nextAsked >= MAX_QUESTIONS) {
      setPhase("result");
      return;
    }

    const nextIndex = Math.floor((nextLow + nextHigh) / 2);
    setLowIndex(nextLow);
    setHighIndex(nextHigh);
    setLevelIndex(nextIndex);
    setAsked(nextAsked);
    setSelected("");
    setAnswerState("idle");
    setQuestion(makeQuestion(nextIndex));
  }

  const backLink = (
    <Link
      href="/lessons"
      aria-label="Back to lessons"
      className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 sm:size-10"
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </Link>
  );

  const header = (title: string) => (
    <div className="flex items-center gap-3">
      {backLink}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
          <Gauge size={13} aria-hidden="true" /> Placement
        </p>
        <h1 className="truncate text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
          {title}
        </h1>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {header("Placement check unavailable")}
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          This course content could not load. Try again when you are online.
        </p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 font-black text-white transition hover:bg-violet-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading || !curriculum) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
          Placement
        </p>
        <h1 className="text-2xl font-black text-slate-950 dark:text-slate-50">
          Loading placement check…
        </h1>
      </div>
    );
  }

  if (units.length < 2) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
        {header("Not available")}
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          This course is too short to test out of. Jump into lesson 1 instead.
        </p>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {header(`Test out of ${curriculum.label}`)}
        <ExerciseCard>
          <span className="grid size-14 place-items-center rounded-3xl bg-violet-600 text-white shadow-[0_14px_30px_rgba(124,58,237,0.22)]">
            <Gauge size={26} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-2xl font-black leading-tight">
            Already know some {curriculum.label}?
          </h2>
          <p className="mt-2 text-base leading-7 text-slate-600 dark:text-slate-300">
            Answer up to {MAX_QUESTIONS} quick questions. They get harder when
            you&apos;re right and easier when you&apos;re not, so we can start
            you at the right spot. You can always go back to earlier lessons.
          </p>
          <AppButton type="button" onClick={startQuiz} className="mt-6 min-h-14 w-full text-base sm:w-auto">
            Start the check <ArrowRight size={20} aria-hidden="true" />
          </AppButton>
        </ExerciseCard>
      </div>
    );
  }

  if (phase === "result") {
    const estimatedUnit = bestUnit;
    const isBeginner = estimatedUnit <= 1;

    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {header("Your result")}
        <section className="animate-soft-rise relative overflow-hidden rounded-[36px] bg-gradient-to-br from-violet-700 via-slate-900 to-cyan-800 p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.3)] ring-1 ring-white/20 sm:p-8">
          <div className="celebration-burst" aria-hidden="true" />
          <div className="relative z-10">
            <span className="warm-glow grid size-16 place-items-center rounded-3xl bg-white text-violet-700">
              <Gauge size={28} aria-hidden="true" />
            </span>
            {isBeginner ? (
              <>
                <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-violet-100">
                  Best place to begin
                </p>
                <h2 className="mt-2 text-4xl font-black">Start from the beginning.</h2>
                <p className="mt-3 max-w-xl text-violet-50">
                  You&apos;ll build a strong base from lesson 1 — that&apos;s the
                  right call for now.
                </p>
                <Link
                  href="/lessons"
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 active:translate-y-1"
                >
                  Go to lessons <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-violet-100">
                  We&apos;d start you at
                </p>
                <h2 className="mt-2 text-4xl font-black">Unit {estimatedUnit}.</h2>
                <p className="mt-3 max-w-xl text-violet-50">
                  You seem comfortable with the earlier units. Jump ahead and
                  we&apos;ll mark those as done — or start from the beginning if
                  you&apos;d rather.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      applyPlacement(estimatedUnit, placementSource);
                      router.push("/lessons");
                    }}
                    className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 active:translate-y-1"
                  >
                    Start at Unit {estimatedUnit}
                    <ArrowRight size={18} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
                  </button>
                  <Link
                    href="/lessons"
                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-950/70 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-violet-950 active:translate-y-1"
                  >
                    Start from the beginning
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  // phase === "quiz"
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 pt-4">
      {header(`Test out of ${curriculum.label}`)}
      <ExerciseCard>
        <div className="mb-4">
          <ProgressHeader current={asked + 1} total={MAX_QUESTIONS} />
        </div>

        {question && (
          <>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
              What does this mean?
            </p>
            <div className="mt-3 flex items-center justify-between rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
              <p className="text-2xl font-black sm:text-3xl">
                {formatRomanizedDisplay(question.phrase.romanized)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
              {question.options.map((option) => (
                <AnswerButton
                  key={option}
                  type="button"
                  onClick={() => answerState === "idle" && setSelected(option)}
                  isSelected={selected === option}
                  disabled={answerState !== "idle"}
                >
                  {capitalizeDisplayText(option)}
                </AnswerButton>
              ))}
            </div>

            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-5 rounded-b-[24px] border-t border-slate-200/70 bg-white/95 px-4 pb-4 pt-3 backdrop-blur transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/92 sm:-mx-7 sm:-mb-7 sm:rounded-b-[30px] sm:px-7 sm:pb-6 sm:pt-4">
              {answerState !== "idle" && (
                <div
                  className={cn(
                    "mb-3 flex items-start gap-3 rounded-2xl p-3 font-bold shadow-sm",
                    answerState === "correct"
                      ? "border border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/14 dark:text-emerald-100"
                      : "border border-rose-100 bg-rose-50 text-rose-800 dark:border-rose-300/25 dark:bg-rose-400/14 dark:text-rose-100",
                  )}
                >
                  {answerState === "correct" ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
                  <p>
                    {answerState === "correct"
                      ? "Correct"
                      : `Answer: ${capitalizeDisplayText(question.answer)}`}
                  </p>
                </div>
              )}
              {answerState === "idle" ? (
                <div className="space-y-2">
                  <AppButton
                    type="button"
                    disabled={!selected}
                    onClick={check}
                    className="w-full"
                  >
                    Check
                  </AppButton>
                  <button
                    type="button"
                    onClick={markUnknown}
                    className="w-full rounded-2xl py-2 text-sm font-black uppercase tracking-[0.08em] text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    I don&apos;t know
                  </button>
                </div>
              ) : (
                <AppButton
                  type="button"
                  variant={answerState === "correct" ? "success" : "primary"}
                  onClick={next}
                  className="w-full"
                >
                  {asked + 1 >= MAX_QUESTIONS ? "See result" : "Continue"}{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </AppButton>
              )}
            </div>
          </>
        )}
      </ExerciseCard>
    </div>
  );
}
