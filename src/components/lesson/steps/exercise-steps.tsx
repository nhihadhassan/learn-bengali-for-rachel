"use client";

/**
 * The exercise renderers — one component per step type, plus the shared answer
 * bar. They are presentational: what a step *is* comes from
 * `@/lib/lesson-steps`, and answer checking/persistence lives in
 * `lesson-flow.tsx`. Keeping them here stops the lesson engine file from
 * absorbing every question layout in the app.
 */

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Lightbulb,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  capitalizeDisplayText,
  formatRomanizedDisplay,
} from "@/lib/display-text";
import type { LessonStep } from "@/lib/lesson-steps";
import { playPronunciation } from "@/lib/pronunciation";
import { playFeedbackSound } from "@/lib/sound-effects";
import { shuffle } from "@/lib/text-tokens";
import { cn } from "@/lib/utils";
import type { AudioPrompt, Lesson, MatchingPair, Phrase } from "@/types/learning";
import { HistoryIcon } from "@/components/lesson/history-icon";
import { SpeakerButton } from "@/components/lesson/speaker-button";
import { AnswerButton, AppButton } from "@/components/ui/app-button";

/** Where a learner is on the current question. */
export type AnswerState = "idle" | "correct" | "wrong" | "skipped";

export function ExerciseAudioPrompt({
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

export function IntroStep({
  lesson,
  onContinue,
  title,
}: {
  lesson: Lesson;
  onContinue: () => void;
  title: string;
}) {
  // Story lessons carry their own narrative payload; that is the signal.
  if (lesson.history) {
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
          Connect the story <ArrowRight size={18} aria-hidden="true" />
        </AppButton>
      </div>
    );
  }

  const estimatedMinutes = lesson.metadata?.estimatedMinutes ?? 5;
  const goal = lesson.objectives?.[0] ?? lesson.summary;

  return (
    <div className="py-2 text-center sm:py-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
        About {estimatedMinutes} min
      </p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
        {title}
      </h2>
      {goal && (
        <p className="mx-auto mt-3 max-w-md text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">
          {capitalizeDisplayText(goal)}
        </p>
      )}

      <AppButton
        type="button"
        onClick={onContinue}
        className="mt-7 min-h-14 w-full text-base sm:w-auto sm:min-w-56"
      >
        Start <ArrowRight size={20} aria-hidden="true" />
      </AppButton>

      {/* Objectives, grammar notes and the phrase list stay available, but
          below the fold and below the CTA — useful, never a gate. */}
      <LessonTips lesson={lesson} />
    </div>
  );
}

// Guidebook-style tips shown before a lesson: what you'll be able to do, plus any
// grammar notes and the phrases you'll meet. All from existing lesson content.
function LessonTips({ lesson }: { lesson: Lesson }) {
  const objectives = lesson.objectives ?? [];
  const grammar = lesson.grammar ?? [];
  const keyPhrases = lesson.phrases.slice(0, 5);

  if (objectives.length === 0 && grammar.length === 0 && keyPhrases.length === 0) {
    return null;
  }

  return (
    <details className="group mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-left shadow-inner dark:border-white/10 dark:bg-white/[0.06]">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-black text-slate-600 marker:content-[''] dark:text-slate-300">
        <Lightbulb size={17} aria-hidden="true" />
        What you&apos;ll learn
        <ChevronDown
          size={17}
          aria-hidden="true"
          className="ml-auto transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="mt-4 grid gap-4">
        {objectives.length > 0 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
              By the end you can
            </p>
            <ul className="mt-2 grid gap-1.5">
              {objectives.map((objective) => (
                <li
                  key={objective}
                  className="flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  <Check size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  {capitalizeDisplayText(objective)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {grammar.length > 0 && (
          <div className="grid gap-2">
            {grammar.map((point) => (
              <div
                key={point.point}
                className="rounded-2xl bg-white/85 p-3 shadow-sm dark:bg-white/10"
              >
                <p className="text-sm font-black text-slate-950 dark:text-slate-50">
                  {point.point}
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  {point.notes}
                </p>
              </div>
            ))}
          </div>
        )}

        {keyPhrases.length > 0 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
              Phrases you&apos;ll meet
            </p>
            <div className="mt-2 grid gap-1.5">
              {keyPhrases.map((phrase) => (
                <div
                  key={phrase.id}
                  className="flex items-baseline justify-between gap-3 rounded-2xl bg-white/85 px-3 py-2 shadow-sm dark:bg-white/10"
                >
                  <span className="font-black text-slate-950 dark:text-slate-50">
                    {formatRomanizedDisplay(phrase.romanized)}
                  </span>
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {capitalizeDisplayText(phrase.english)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * The grammar card: a rule in a sentence or two, then examples built from words
 * the learner already has.
 *
 * Deliberately small. A grammar point that needs a page of explanation doesn't
 * belong inside a five-minute lesson — the drills right after this card are
 * where the pattern actually gets learned, and it comes back in ordinary
 * sentences in later lessons.
 */
export function GrammarStep({
  locale,
  onContinue,
  step,
}: {
  locale?: string;
  onContinue: () => void;
  step: Extract<LessonStep, { type: "grammar" }>;
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
        Pattern
      </p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950 dark:text-slate-50">
        {step.focus.title}
      </h2>
      <p className="mt-3 text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">
        {step.focus.explanation}
      </p>

      <div className="mt-5 grid gap-2">
        {step.focus.examples.map((example) => (
          <div
            key={example.target}
            className="flex items-start justify-between gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-inner dark:border-emerald-300/20 dark:bg-emerald-400/12"
          >
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-950 dark:text-slate-50">
                {example.target}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {capitalizeDisplayText(example.english)}
              </p>
              {example.note && (
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">
                  {example.note}
                </p>
              )}
            </div>
            <SpeakerButton locale={locale} romanized={example.target} />
          </div>
        ))}
      </div>

      <AppButton type="button" onClick={onContinue} className="mt-6 w-full sm:w-auto">
        Try it <ArrowRight size={18} aria-hidden="true" />
      </AppButton>
    </div>
  );
}

/**
 * The turns already exchanged in a dialogue, so a multi-turn scenario reads as
 * one conversation instead of a series of unrelated prompts.
 */
export function DialogueHistory({
  turns,
}: {
  turns: NonNullable<Extract<LessonStep, { type: "dialogue" }>["history"]>;
}) {
  if (turns.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-1.5">
      {turns.map((turn, index) => (
        <div
          key={`${turn.romanized}-${index}`}
          className={cn(
            "max-w-[85%] rounded-2xl px-3 py-2",
            turn.speaker === "you"
              ? "ml-auto bg-violet-100 text-right dark:bg-violet-400/15"
              : "bg-slate-100 dark:bg-white/[0.07]",
          )}
        >
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {turn.romanized}
          </p>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {capitalizeDisplayText(turn.english)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function LearnStep({
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
          <h2 className="mt-3 flex flex-wrap items-center gap-3 text-5xl font-black leading-tight text-slate-950 dark:text-slate-50">
            {/* Meaning support that isn't a translation. Concrete nouns only —
                the curriculum omits it where an emoji would be a riddle. */}
            {step.phrase.emoji && (
              <span aria-hidden className="text-5xl leading-none">
                {step.phrase.emoji}
              </span>
            )}
            {formatRomanizedDisplay(step.phrase.romanized)}
          </h2>
          {/* The native script, under the romanization the learner actually
              reads from. It is here to be recognised on a shop sign and to make
              the pronunciation honest — never to be decoded, and never required
              to move on, which is why it sits below and smaller rather than
              competing for the headword. */}
          {step.phrase.bengaliScript && (
            <p
              lang="bn"
              className="mt-2 text-2xl font-semibold text-slate-500 dark:text-slate-400"
            >
              {step.phrase.bengaliScript}
            </p>
          )}
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
        {/* The word inside a sentence the learner can already mostly read.
            Shown above the gloss on purpose: "Tengo sed. Quiero agua." carries
            the meaning, and the English line below is the safety net rather
            than the lesson. */}
        {step.phrase.context && (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-inner dark:border-amber-300/20 dark:bg-amber-400/12">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
                  In use
                </p>
                <p className="mt-1 text-xl font-black text-slate-950 dark:text-slate-50">
                  {step.phrase.context.target}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {capitalizeDisplayText(step.phrase.context.english)}
                </p>
              </div>
              <SpeakerButton
                locale={locale}
                romanized={step.phrase.context.target}
              />
            </div>
          </div>
        )}
        <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-4 shadow-inner dark:border-cyan-300/20 dark:bg-cyan-400/12">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-200">
            Meaning
          </p>
          <p className="mt-1 text-2xl font-black">
            {capitalizeDisplayText(step.phrase.english)}
          </p>
        </div>
        {/* Generated courses have no pronunciation guide; don't show an
            empty labelled box where one would go. */}
        {step.phrase.pronunciation.trim().length > 0 && (
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.08]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Pronunciation
            </p>
            <p className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-200">
              {step.phrase.pronunciation}
            </p>
          </div>
        )}
        <WordBreakdown phrase={step.phrase} />
      </div>

      <AppButton
        type="button"
        onClick={onContinue}
        className="mt-5 w-full sm:mt-6 sm:w-auto"
      >
        Practice it <ArrowRight size={18} aria-hidden="true" />
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

export function SpeakPracticeStep({
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
          <VolumeX size={18} aria-hidden="true" />
          Skip for now
        </AppButton>
        <AppButton type="button" variant="secondary" onClick={playAgain}>
          <Volume2 size={18} />
          Play again
        </AppButton>
        <AppButton type="button" onClick={onDone}>
          I said it <ArrowRight size={18} aria-hidden="true" />
        </AppButton>
      </div>
    </div>
  );
}

export function QuestionStep({
  answerState,
  canCheck,
  children,
  correctAnswer,
  explanation,
  explanationLabel = "Explain",
  explanationOpen = false,
  idleHint,
  onCheck,
  onContinue,
  onSkip,
  showCheck = true,
  skipLabel,
}: {
  answerState: AnswerState;
  canCheck: boolean;
  children: ReactNode;
  correctAnswer: string;
  explanation?: string;
  /** Heading on the disclosure. A discovery reveal is not an "Explain". */
  explanationLabel?: string;
  /**
   * Open the explanation without a click.
   *
   * On an ordinary question the "why" is optional — most learners want to move
   * on. On a pattern-discovery question the rule *is* the payoff: the learner
   * has just guessed a form nobody taught them, and hiding the answer behind a
   * disclosure wastes the one moment they are most ready to read it.
   */
  explanationOpen?: boolean;
  idleHint?: string;
  onCheck: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  showCheck?: boolean;
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
              <Check size={20} aria-hidden="true" />
            ) : answerState === "skipped" ? (
              <VolumeX size={20} aria-hidden="true" />
            ) : (
              <X size={20} aria-hidden="true" />
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

        {isAnswered && explanation && (
          <details
            open={explanationOpen}
            className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.06]"
          >
            <summary className="cursor-pointer font-black text-slate-700 marker:text-violet-500 dark:text-slate-200">
              {explanationLabel}
            </summary>
            <p className="mt-2 font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {explanation}
            </p>
          </details>
        )}

        <div className="flex items-center gap-3">
          {answerState === "idle" ? (
            showCheck || onSkip ? (
              <>
                {onSkip && (
                  <AppButton
                    type="button"
                    variant="secondary"
                    onClick={onSkip}
                    className="flex-1"
                  >
                    <VolumeX size={18} aria-hidden="true" />
                    {skipLabel}
                  </AppButton>
                )}
                {showCheck && (
                  <AppButton
                    type="button"
                    disabled={!canCheck}
                    onClick={onCheck}
                    className="flex-1"
                  >
                    Check
                  </AppButton>
                )}
              </>
            ) : (
              <p className="w-full py-1 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                {idleHint}
              </p>
            )
          ) : (
            <AppButton
              type="button"
              onClick={onContinue}
              variant={answerState === "skipped" ? "primary" : "success"}
              className="w-full"
            >
              Continue <ArrowRight size={18} aria-hidden="true" />
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}

export function MultipleChoiceOptions({
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

type MatchSelection = { side: "left" | "right"; value: string };

export function MatchingExercise({
  isLocked = false,
  matches,
  onComplete,
  pairs,
  setMatches,
}: {
  isLocked?: boolean;
  matches: Record<string, string>;
  onComplete: () => void;
  pairs: MatchingPair[];
  setMatches: (matches: Record<string, string>) => void;
}) {
  const [selection, setSelection] = useState<MatchSelection | null>(null);
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);
  const rightOptions = useMemo(
    () => shuffle(pairs.map((pair) => pair.right)),
    [pairs],
  );

  const matchedLeft = new Set(Object.keys(matches));
  const matchedRight = new Set(Object.values(matches));

  function attempt(side: "left" | "right", value: string) {
    if (isLocked) {
      return;
    }

    if (side === "left" ? matchedLeft.has(value) : matchedRight.has(value)) {
      return;
    }

    setWrong(null);

    // First tap, or switching selection within the same column.
    if (!selection || selection.side === side) {
      setSelection({ side, value });
      return;
    }

    // One tile from each column is now chosen — test the pairing.
    const leftValue = side === "left" ? value : selection.value;
    const rightValue = side === "right" ? value : selection.value;
    const isPair = pairs.some(
      (pair) => pair.left === leftValue && pair.right === rightValue,
    );

    setSelection(null);

    if (isPair) {
      const nextMatches = { ...matches, [leftValue]: rightValue };
      setMatches(nextMatches);
      playFeedbackSound("correct");

      if (Object.keys(nextMatches).length === pairs.length) {
        onComplete();
      }
    } else {
      setWrong({ left: leftValue, right: rightValue });
      window.setTimeout(() => setWrong(null), 650);
    }
  }

  function tileState(side: "left" | "right", value: string) {
    if (side === "left" ? matchedLeft.has(value) : matchedRight.has(value)) {
      return "matched" as const;
    }

    if (
      wrong &&
      (side === "left" ? wrong.left === value : wrong.right === value)
    ) {
      return "wrong" as const;
    }

    if (selection && selection.side === side && selection.value === value) {
      return "selected" as const;
    }

    return "idle" as const;
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="grid content-start gap-3">
        {pairs.map((pair) => (
          <MatchTile
            key={`left-${pair.left}`}
            state={tileState("left", pair.left)}
            disabled={isLocked}
            onClick={() => attempt("left", pair.left)}
          >
            {formatRomanizedDisplay(pair.left)}
          </MatchTile>
        ))}
      </div>
      <div className="grid content-start gap-3">
        {rightOptions.map((right) => (
          <MatchTile
            key={`right-${right}`}
            state={tileState("right", right)}
            disabled={isLocked}
            onClick={() => attempt("right", right)}
          >
            {capitalizeDisplayText(right)}
          </MatchTile>
        ))}
      </div>
    </div>
  );
}

function MatchTile({
  children,
  disabled,
  onClick,
  state,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  state: "idle" | "selected" | "matched" | "wrong";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "matched"}
      className={cn(
        "min-h-14 rounded-2xl border-2 px-3 py-3 text-center text-sm font-black break-words transition duration-150 ease-out focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal-200 active:translate-y-0.5",
        state === "idle" &&
          "border-slate-200 bg-white text-slate-800 shadow-[0_4px_0_#e2e8f0] hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_4px_0_rgba(255,255,255,0.08)] dark:hover:border-violet-300/40 dark:hover:bg-violet-400/15",
        state === "selected" &&
          "border-violet-500 bg-violet-100 text-violet-900 shadow-[0_4px_0_#c4b5fd] dark:border-violet-300 dark:bg-violet-400/25 dark:text-violet-50",
        state === "matched" &&
          "border-emerald-300 bg-emerald-100 text-emerald-700 opacity-70 dark:border-emerald-300/40 dark:bg-emerald-400/20 dark:text-emerald-100",
        state === "wrong" &&
          "match-shake border-rose-400 bg-rose-100 text-rose-700 dark:border-rose-300/50 dark:bg-rose-400/20 dark:text-rose-100",
      )}
    >
      {children}
    </button>
  );
}

export function WordOrderExercise({
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

/**
 * Pattern discovery: examples and nothing else.
 *
 * There is deliberately no rule on this card. The learner reads three examples
 * and is then asked for a fourth form nobody taught them; the rule arrives as
 * the explanation on that question. Putting it here instead would turn a
 * discovery into a paragraph to skim.
 */
export function NoticeStep({
  locale,
  onContinue,
  step,
}: {
  locale?: string;
  onContinue: () => void;
  step: Extract<LessonStep, { type: "notice" }>;
}) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
        Notice
      </p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950 dark:text-slate-50">
        {step.card.title}
      </h2>
      <p className="mt-3 text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">
        Read these. What do they have in common?
      </p>

      <div className="mt-5 grid gap-2">
        {step.card.examples.map((example) => (
          <div
            key={example.target}
            className="flex items-start justify-between gap-3 rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-inner dark:border-amber-300/20 dark:bg-amber-400/12"
          >
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-950 dark:text-slate-50">
                {example.target}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {capitalizeDisplayText(example.english)}
              </p>
              {example.note && (
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-300">
                  {example.note}
                </p>
              )}
            </div>
            <SpeakerButton locale={locale} romanized={example.target} />
          </div>
        ))}
      </div>

      <AppButton type="button" onClick={onContinue} className="mt-6 w-full sm:w-auto">
        Work it out <ArrowRight size={18} aria-hidden="true" />
      </AppButton>
    </div>
  );
}

/**
 * A mini-story, heard before it is read.
 *
 * The English is behind a disclosure on purpose. A translation sitting beside
 * every line means the learner reads the English and skims the Spanish, which
 * is the opposite of comprehensible input — so the first pass is Spanish and
 * audio, and the transcript is there for anyone who needs it.
 */
export function StoryStep({
  locale,
  onContinue,
  step,
}: {
  locale?: string;
  onContinue: () => void;
  step: Extract<LessonStep, { type: "story" }>;
}) {
  const [showEnglish, setShowEnglish] = useState(false);

  function playAll() {
    // One line at a time would need sequencing the speech queue; playing the
    // joined text is what the browser voice handles reliably.
    void playPronunciation({
      debug: true,
      locale,
      romanized: step.story.lines.map((line) => line.target).join(" "),
    });
  }

  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
        Story
      </p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950 dark:text-slate-50">
        {step.story.title}
      </h2>
      {step.story.setup && (
        <p className="mt-3 text-base font-semibold leading-7 text-slate-600 dark:text-slate-300">
          {step.story.setup}
        </p>
      )}

      <div className="mt-5 grid gap-2">
        {step.story.lines.map((line, index) => (
          <div
            key={`${step.story.id}-${index}`}
            className="flex items-start justify-between gap-3 rounded-3xl border border-violet-100 bg-violet-50 p-4 shadow-inner dark:border-violet-300/20 dark:bg-violet-400/12"
          >
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-950 dark:text-slate-50">
                {line.target}
              </p>
              {showEnglish && (
                <p className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {capitalizeDisplayText(line.english)}
                </p>
              )}
              {line.receptive && !showEnglish && (
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-violet-700 dark:text-violet-300">
                  New expression — just understand it for now
                </p>
              )}
            </div>
            <SpeakerButton locale={locale} romanized={line.target} />
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
        <AppButton
          type="button"
          variant="secondary"
          onClick={() => setShowEnglish((shown) => !shown)}
        >
          <Lightbulb size={18} aria-hidden="true" />
          {showEnglish ? "Hide English" : "Show English"}
        </AppButton>
        <AppButton type="button" variant="secondary" onClick={playAll}>
          <Volume2 size={18} />
          Play again
        </AppButton>
        <AppButton type="button" onClick={onContinue}>
          I understood it <ArrowRight size={18} aria-hidden="true" />
        </AppButton>
      </div>
    </div>
  );
}

/**
 * Say it out loud.
 *
 * Nothing here is recorded, scored, or compared to anything. The app has no
 * speech recognition, and a step that looked like it was listening would be a
 * lie the learner would believe — so the copy says plainly that nobody is
 * checking, and the only button is "I said it".
 */
export function PronounceStep({
  locale,
  onContinue,
  step,
}: {
  locale?: string;
  onContinue: () => void;
  step: Extract<LessonStep, { type: "pronounce" }>;
}) {
  function playAgain() {
    void playPronunciation({
      audioFile: step.phrase.audioFile,
      audioUrl: step.phrase.audioUrl,
      debug: true,
      locale,
      romanized: step.phrase.romanized,
    });
  }

  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-fuchsia-700 dark:text-fuchsia-200">
        Out loud
      </p>
      <h2 className="mt-2 text-2xl font-black">{step.prompt}</h2>
      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        Nothing is being recorded or scored — this one is just for your mouth.
      </p>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-fuchsia-100 bg-fuchsia-50 p-5 shadow-inner dark:border-fuchsia-300/20 dark:bg-fuchsia-400/12">
        <div className="min-w-0">
          <p className="text-3xl font-black leading-tight sm:text-4xl">
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
        />
      </div>

      <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap sm:justify-end">
        <AppButton type="button" variant="secondary" onClick={playAgain}>
          <Volume2 size={18} />
          Play again
        </AppButton>
        <AppButton type="button" onClick={onContinue}>
          I said it <ArrowRight size={18} aria-hidden="true" />
        </AppButton>
      </div>
    </div>
  );
}
