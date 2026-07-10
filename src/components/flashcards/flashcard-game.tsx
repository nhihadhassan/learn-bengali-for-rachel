"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Brain, Check, Clock3, Flame, RotateCcw, Sparkles } from "lucide-react";
import { getCurriculum } from "@/lib/content";
import {
  FLASHCARD_SESSION_SIZE,
  getFlashcardQueue,
  getFlashcardStats,
  getNextReviewLabel,
  type FlashcardRating,
} from "@/lib/flashcard-scheduler";
import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { useProgress } from "@/lib/progress-store";
import type { Curriculum, FlashcardReview, Phrase } from "@/types/learning";
import { SpeakerButton } from "@/components/lesson/speaker-button";
import { AppButton } from "@/components/ui/app-button";
import { ProgressHeader } from "@/components/ui/progress-header";

const ratingOptions: Array<{
  rating: FlashcardRating;
  label: string;
  tone: string;
}> = [
  {
    rating: "again",
    label: "Again",
    tone: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-300/25 dark:bg-rose-400/12 dark:text-rose-100 dark:hover:bg-rose-400/20",
  },
  {
    rating: "hard",
    label: "Hard",
    tone: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-300/25 dark:bg-amber-400/12 dark:text-amber-100 dark:hover:bg-amber-400/20",
  },
  {
    rating: "good",
    label: "Good",
    tone: "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-300/25 dark:bg-cyan-400/12 dark:text-cyan-100 dark:hover:bg-cyan-400/20",
  },
  {
    rating: "easy",
    label: "Easy",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-300/25 dark:bg-emerald-400/12 dark:text-emerald-100 dark:hover:bg-emerald-400/20",
  },
];

export function FlashcardGame() {
  const { activeCurriculumId } = useProgress();

  return (
    <FlashcardGameForCurriculum
      key={activeCurriculumId}
      curriculumId={activeCurriculumId}
    />
  );
}

function FlashcardGameForCurriculum({ curriculumId }: { curriculumId: Curriculum["id"] }) {
  const { recordFlashcardReview, store } = useProgress();
  const activeCurriculumId = curriculumId;
  const curriculum = getCurriculum(activeCurriculumId);
  const phrases = useMemo(
    () => curriculum.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.phrases)),
    [curriculum],
  );
  const curriculumProgress = store.byCurriculum[activeCurriculumId];
  const reviews = useMemo(
    () => curriculumProgress.flashcards ?? [],
    [curriculumProgress.flashcards],
  );
  const reviewMap = useMemo(
    () => new Map(reviews.map((review) => [review.phraseId, review])),
    [reviews],
  );
  const phraseMap = useMemo(
    () => new Map(phrases.map((phrase) => [phrase.id, phrase])),
    [phrases],
  );
  const deckStats = useMemo(
    () => getFlashcardStats(phrases, reviews),
    [phrases, reviews],
  );
  const readyCards = useMemo(
    () => getFlashcardQueue(phrases, reviews, new Date(), FLASHCARD_SESSION_SIZE),
    [phrases, reviews],
  );
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [feedback, setFeedback] = useState("");
  const currentPhrase = phraseMap.get(sessionIds[0]);
  const currentReview = currentPhrase ? reviewMap.get(currentPhrase.id) : undefined;
  const completedCount = Math.max(0, sessionTotal - sessionIds.length);
  const isStarted = sessionTotal > 0;
  const isComplete = isStarted && sessionIds.length === 0;

  if (curriculum.mode !== "language") {
    return <LanguageOnlyState />;
  }

  function startRun() {
    const nextIds = readyCards.map((phrase) => phrase.id);

    if (nextIds.length === 0) {
      return;
    }

    setSessionIds(nextIds);
    setSessionTotal(nextIds.length);
    setIsFlipped(false);
    setFeedback("");
  }

  function rateCard(rating: FlashcardRating) {
    if (!currentPhrase || !isFlipped) {
      return;
    }

    const nextReviewLabel = getNextReviewLabel(rating, currentReview);
    recordFlashcardReview(currentPhrase.id, rating, activeCurriculumId);
    setFeedback(
      `${rating === "again" ? "Keep it close" : "Nice recall"}. +${rating === "again" ? 1 : rating === "hard" ? 2 : rating === "good" ? 3 : 4} XP. Back in ${nextReviewLabel}.`,
    );
    setIsFlipped(false);
    setSessionIds((currentIds) =>
      rating === "again"
        ? [...currentIds.slice(1), currentPhrase.id]
        : currentIds.slice(1),
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(124,58,237,0.32),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(6,182,212,0.18),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.06),transparent_48%)]"
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-sm font-bold text-violet-100">
              <Brain size={16} /> Spaced repetition
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-[1.04] sm:text-5xl">
              Remember it when you need it.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              A quick {curriculum.shortLabel} recall game that brings phrases back before they fade.
              Learn the phrase, flip the card, and be honest about how it felt.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <DeckStat icon={<Sparkles size={16} />} label="Ready" value={deckStats.dueCount} />
            <DeckStat icon={<Check size={16} />} label="Mastered" value={deckStats.masteredCount} />
            <DeckStat icon={<Flame size={16} />} label="Deck" value={deckStats.totalCount} />
          </div>
        </div>
      </section>

      {!isStarted && (
        <section className="rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)] dark:ring-white/10 sm:p-7">
          {deckStats.dueCount > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                  Today&apos;s run
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {deckStats.dueCount} {deckStats.dueCount === 1 ? "card is" : "cards are"} ready.
                </h2>
                <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
                  Start with {Math.min(FLASHCARD_SESSION_SIZE, deckStats.dueCount)} cards. Due phrases come first, then new cards join the rotation.
                </p>
                <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-2"><Clock3 size={16} /> Short daily sessions</span>
                  <span className="inline-flex items-center gap-2"><RotateCcw size={16} /> Honest ratings set the pace</span>
                </div>
              </div>
              <AppButton type="button" onClick={startRun} className="min-h-14 px-6 text-base">
                Start the run <ArrowRight size={19} />
              </AppButton>
            </div>
          ) : (
            <DeckRestingState nextDueAt={deckStats.nextDueAt} />
          )}
        </section>
      )}

      {isStarted && !isComplete && currentPhrase && (
        <FlashcardSession
          completedCount={completedCount}
          currentPhrase={currentPhrase}
          currentReview={currentReview}
          feedback={feedback}
          isFlipped={isFlipped}
          curriculum={curriculum}
          onFlip={() => setIsFlipped(true)}
          onRate={rateCard}
          sessionTotal={sessionTotal}
        />
      )}

      {isComplete && (
        <SessionComplete
          masteredCount={deckStats.masteredCount}
          onStartAgain={startRun}
          readyCount={deckStats.dueCount}
          sessionTotal={sessionTotal}
        />
      )}
    </div>
  );
}

function LanguageOnlyState() {
  return (
    <section className="mx-auto max-w-2xl rounded-[30px] border border-white/80 bg-white/95 p-6 text-center shadow-[0_22px_70px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_22px_70px_rgba(0,0,0,0.3)] dark:ring-white/10 sm:p-10">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
        <Brain size={30} />
      </span>
      <p className="mt-6 text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
        Language practice
      </p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">Flashcards are for language courses.</h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
        Choose Bengali, Spanish, or Malayalam from the curriculum switcher, then come back for a spaced-repetition run.
      </p>
      <Link
        href="/lessons"
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white shadow-[0_6px_0_#5b21b6] transition hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-1"
      >
        Choose a language <ArrowRight size={18} />
      </Link>
    </section>
  );
}

function FlashcardSession({
  completedCount,
  currentPhrase,
  currentReview,
  curriculum,
  feedback,
  isFlipped,
  onFlip,
  onRate,
  sessionTotal,
}: {
  completedCount: number;
  currentPhrase: Phrase;
  currentReview?: FlashcardReview;
  curriculum: Curriculum;
  feedback: string;
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (rating: FlashcardRating) => void;
  sessionTotal: number;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_22px_70px_rgba(0,0,0,0.3)] dark:ring-white/10 sm:p-7">
      <div className="mb-6 flex items-end justify-between gap-4">
        <ProgressHeader current={completedCount} total={sessionTotal} className="min-w-0 flex-1" />
        <span className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Card {Math.min(completedCount + 1, sessionTotal)} of {sessionTotal}
        </span>
      </div>

      <article className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-5 shadow-inner dark:border-violet-300/20 dark:from-violet-400/12 dark:via-white/[0.08] dark:to-cyan-400/10 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
              {isFlipped ? "Check your recall" : "Say it before you flip"}
            </p>
            <h2 className="mt-4 break-words text-4xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
              {formatRomanizedDisplay(currentPhrase.romanized)}
            </h2>
            <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-300">
              {currentPhrase.pronunciation}
            </p>
          </div>
          <SpeakerButton
            audioFile={currentPhrase.audioFile}
            audioUrl={currentPhrase.audioUrl}
            locale={curriculum.locale}
            romanized={currentPhrase.romanized}
            script={currentPhrase.bengaliScript}
          />
        </div>

        {isFlipped ? (
          <div className="mt-7 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-300/20 dark:bg-emerald-400/12">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
              Meaning
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-50">
              {capitalizeDisplayText(currentPhrase.english)}
            </p>
            <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-100">
              Rate how well you remembered it below. The next interval is based on your answer.
            </p>
          </div>
        ) : (
          <AppButton type="button" onClick={onFlip} className="mt-8 min-h-14 w-full text-base">
            Reveal meaning <ArrowRight size={19} />
          </AppButton>
        )}
      </article>

      <div className="mt-5" aria-live="polite">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label="Rate your recall">
          {ratingOptions.map((option) => (
            <button
              key={option.rating}
              type="button"
              disabled={!isFlipped}
              onClick={() => onRate(option.rating)}
              className={`min-h-16 rounded-2xl border-2 px-3 py-3 text-center transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 ${option.tone}`}
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-1 block text-xs font-bold opacity-75">
                {getNextReviewLabel(option.rating, currentReview)}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 min-h-5 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
          {feedback || (isFlipped ? "Choose the rating that feels honest." : "Flip the card to rate your recall.")}
        </p>
      </div>
    </section>
  );
}

function DeckStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-white shadow-inner sm:p-4">
      <span className="grid size-8 place-items-center rounded-xl bg-white/10 text-violet-200">{icon}</span>
      <p className="mt-3 text-xl font-black sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-300">{label}</p>
    </div>
  );
}

function DeckRestingState({ nextDueAt }: { nextDueAt: string | null }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
        Deck complete for now
      </p>
      <h2 className="mt-2 text-3xl font-black">Your phrases are resting.</h2>
      <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
        Come back when the next card is due. A lesson is always available if you want to add more phrases today.
      </p>
      {nextDueAt && (
        <p className="mt-4 text-sm font-black text-violet-700 dark:text-violet-200">
          Next review {formatRelativeDue(nextDueAt)}
        </p>
      )}
      <Link
        href="/lessons"
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-black text-white shadow-[0_6px_0_#5b21b6] transition hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-1"
      >
        Learn more phrases <ArrowRight size={18} />
      </Link>
    </div>
  );
}

function SessionComplete({
  masteredCount,
  onStartAgain,
  readyCount,
  sessionTotal,
}: {
  masteredCount: number;
  onStartAgain: () => void;
  readyCount: number;
  sessionTotal: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[30px] bg-emerald-600 p-6 text-white shadow-[0_24px_70px_rgba(5,150,105,0.24)] sm:p-8">
      <div className="relative z-10">
        <span className="grid size-14 place-items-center rounded-3xl bg-white text-emerald-700 shadow-lg">
          <Check size={27} />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          Run complete
        </p>
        <h2 className="mt-2 text-4xl font-black">That recall is getting stronger.</h2>
        <p className="mt-3 max-w-xl text-emerald-50">
          You reviewed {sessionTotal} {sessionTotal === 1 ? "card" : "cards"}. Your next session will be shaped by what you remembered today.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {readyCount > 0 && (
            <AppButton type="button" onClick={onStartAgain} className="bg-white text-emerald-800 shadow-[0_6px_0_rgba(255,255,255,0.45)] hover:bg-emerald-50">
              Keep going <ArrowRight size={18} />
            </AppButton>
          )}
          <Link
            href="/lessons"
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-800/80 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-emerald-900 active:translate-y-1"
          >
            Back to lessons <ArrowRight size={18} />
          </Link>
        </div>
        <p className="mt-5 text-sm font-bold text-emerald-100">
          {masteredCount} {masteredCount === 1 ? "phrase" : "phrases"} mastered in this deck.
        </p>
      </div>
    </section>
  );
}

function formatRelativeDue(isoDate: string) {
  const difference = Math.max(1, new Date(isoDate).getTime() - Date.now());
  const minutes = Math.ceil(difference / (60 * 1000));

  if (minutes < 60) {
    return `in ${minutes} min`;
  }

  const hours = Math.ceil(minutes / 60);

  if (hours < 24) {
    return `in ${hours} hr`;
  }

  const days = Math.ceil(hours / 24);
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}
