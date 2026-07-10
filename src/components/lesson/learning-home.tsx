"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Ear,
  Flag,
  Flame,
  MessageCircle,
  Music2,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { getCurriculum } from "@/lib/content";
import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { useProgress } from "@/lib/progress-store";
import type { Unit } from "@/types/learning";
import { HistoryIcon } from "@/components/lesson/history-icon";
import { LessonPath } from "@/components/lesson/lesson-path";

export function LearningHome() {
  const {
    activeCurriculumId,
    activeMistakes,
    activeSkippedListening,
    progress,
  } = useProgress();
  const curriculum = getCurriculum(activeCurriculumId);
  const units = curriculum.units;
  const allLessons = units.flatMap((unit) => unit.lessons);
  const firstLessonId = units[0]?.lessons[0]?.id;
  const lessonCount = allLessons.length;
  const isHistory = curriculum.mode === "history";
  const phraseCount = units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => lesson.phrases),
  ).length;
  const featuredPhrases = units[0]?.lessons[0]?.phrases.slice(0, 3) ?? [];
  const featuredLessons = units[0]?.lessons.slice(0, 3) ?? [];
  const resumeLesson = progress.lastLessonId
    ? allLessons.find(
        (lesson) =>
          lesson.id === progress.lastLessonId &&
          !progress.completedLessons.includes(lesson.id),
      )
    : undefined;
  const resumeLessonNumber = resumeLesson
    ? allLessons.findIndex((lesson) => lesson.id === resumeLesson.id) + 1
    : 0;
  const weakItemCount = activeMistakes.length + activeSkippedListening.length;

  return (
    <div className="space-y-10">
      <section className="relative isolate overflow-hidden rounded-[36px] bg-slate-950 px-5 py-7 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.34),transparent_34%),radial-gradient(circle_at_84%_14%,rgba(6,182,212,0.2),transparent_32%),radial-gradient(circle_at_52%_90%,rgba(251,191,36,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.075),transparent_45%)]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-violet-500/18 to-transparent"
        />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:items-center xl:gap-12">
          <div className="animate-soft-rise max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-sm font-bold text-violet-100 shadow-inner">
              <Sparkles size={16} />
              {curriculum.label} made gentle for beginners
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.04] [text-wrap:balance] sm:text-5xl lg:text-[3.45rem]">
              {activeCurriculumId === "spanish-peru"
                ? "Travel Spanish for the moments that matter."
                : activeCurriculumId === "malayalam"
                  ? "Malayalam made gentle for first conversations."
                : isHistory
                  ? "Follow history like a story map."
                  : "Learn the Bengali Rachel will actually say."}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              {curriculum.description}{" "}
              {isHistory
                ? "Short chapters connect causes, turning points, and consequences."
                : "Bite-size lessons build practical phrases with listening, typing, and review."}
            </p>

            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              {resumeLesson && (
                <Link
                  href={`/practice/${resumeLesson.id}`}
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-violet-800 shadow-[0_7px_0_rgba(255,255,255,0.5),0_20px_36px_rgba(255,255,255,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-violet-50 active:translate-y-1"
                >
                  Resume {isHistory ? "Chapter" : "Lesson"} {resumeLessonNumber}
                  <ArrowRight size={19} className="transition group-hover:translate-x-0.5" />
                </Link>
              )}
              {firstLessonId && (
                <Link
                  href={`/practice/${firstLessonId}`}
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-violet-500 px-5 py-3 font-black text-white shadow-[0_7px_0_#5b21b6,0_20px_36px_rgba(124,58,237,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-fuchsia-500 hover:shadow-[0_9px_0_#5b21b6,0_26px_44px_rgba(217,70,239,0.24)] active:translate-y-1"
                >
                  {isHistory ? "Start Story 1" : "Start Lesson 1"}
                  <ArrowRight size={19} className="transition group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="/vocabulary"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
              >
                <BookOpen size={18} />
                {isHistory ? "Timeline recap" : "Word bank"}
              </Link>
              {!isHistory && (
                <Link
                  href="/flashcards"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-cyan-200/30 bg-cyan-400/15 px-5 py-3 font-black text-cyan-50 shadow-inner transition hover:-translate-y-0.5 hover:bg-cyan-300 hover:text-slate-950"
                >
                  <Brain size={18} />
                  Flashcard run
                </Link>
              )}
              {activeCurriculumId === "spanish-peru" && (
                <Link
                  href="/songs"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-fuchsia-200/30 bg-fuchsia-400/15 px-5 py-3 font-black text-fuchsia-50 shadow-inner transition hover:-translate-y-0.5 hover:bg-fuchsia-300 hover:text-slate-950"
                >
                  <Music2 size={18} />
                  Learn with songs
                </Link>
              )}
            </div>

            {weakItemCount > 0 && (
              <Link
                href="/review"
                className="mt-5 flex max-w-xl items-center gap-3 rounded-3xl border border-white/12 bg-white/10 p-3 text-left shadow-inner transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950">
                  <RotateCcw size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-white">
                    Smart Review
                  </span>
                  <span className="block text-sm font-semibold text-slate-300">
                    Review {weakItemCount} weak{" "}
                    {weakItemCount === 1 ? "item" : "items"}
                  </span>
                </span>
                <ArrowRight size={18} className="ml-auto shrink-0" />
              </Link>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <HeroStat
                icon={MessageCircle}
                label={isHistory ? "Story cards" : "Phrases"}
                value={`${isHistory ? lessonCount : phraseCount}`}
              />
              <HeroStat
                icon={CheckCircle2}
                label={isHistory ? "Units" : "Lessons"}
                value={`${isHistory ? units.length : lessonCount}`}
              />
              <HeroStat icon={Flame} label="Streaks" value="Daily" />
            </div>
          </div>

          {isHistory ? (
            <HistoryHeroPreview lessons={featuredLessons} />
          ) : (
            <HeroPreview phrases={featuredPhrases} />
          )}
        </div>
      </section>

      <LessonPath units={units} />
    </div>
  );
}

function HistoryHeroPreview({
  lessons,
}: {
  lessons: Unit["lessons"];
}) {
  return (
    <div className="animate-soft-rise w-full justify-self-center lg:justify-self-end">
      <div className="rounded-[34px] border border-white/14 bg-white/10 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-4">
        <div className="rounded-[28px] bg-[#fffefa] p-4 text-slate-950 shadow-[0_8px_0_rgba(255,255,255,0.18)] transition-colors duration-300 dark:bg-slate-950/88 dark:text-slate-50 dark:shadow-[0_8px_0_rgba(255,255,255,0.08)] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                Timeline preview
              </p>
              <h2 className="mt-1 text-2xl font-black">Story path</h2>
              <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                Read quick chapters that unfold like a timeline.
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange-400 text-slate-950 shadow-[0_10px_24px_rgba(249,115,22,0.24)]">
              <Flag size={23} fill="currentColor" />
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {lessons.map((lesson, index) => (
              <div
                key={lesson.id}
                className="group grid grid-cols-[auto_1fr] items-start gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-violet-100 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)] dark:hover:border-violet-300/35 dark:hover:bg-violet-400/15"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-500 text-white transition group-hover:scale-105 group-hover:bg-cyan-500">
                  <HistoryIcon name={lesson.history?.icon} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                    Chapter {index + 1}
                  </p>
                  <p className="mt-1 truncate text-xl font-black">
                    {lesson.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-500 dark:text-slate-300">
                    {lesson.history?.keyTakeaway ?? lesson.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl bg-slate-950 p-4 text-white">
            <p className="text-sm font-black text-cyan-100">Cause to effect</p>
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <span className="size-3 rounded-full bg-violet-400" />
              <div className="progress-shine h-3 rounded-full" />
              <span className="size-3 rounded-full bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPreview({
  phrases,
}: {
  phrases: Unit["lessons"][number]["phrases"];
}) {
  return (
    <div className="animate-soft-rise w-full justify-self-center lg:justify-self-end">
      <div className="rounded-[34px] border border-white/14 bg-white/10 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-4">
        <div className="rounded-[28px] bg-[#fffefa] p-4 text-slate-950 shadow-[0_8px_0_rgba(255,255,255,0.18)] transition-colors duration-300 dark:bg-slate-950/88 dark:text-slate-50 dark:shadow-[0_8px_0_rgba(255,255,255,0.08)] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                Lesson preview
              </p>
              <h2 className="mt-1 text-2xl font-black">First greetings</h2>
              <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                Listen, say, and choose the meaning.
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange-400 text-slate-950 shadow-[0_10px_24px_rgba(249,115,22,0.24)]">
              <Flame size={23} fill="currentColor" />
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {phrases.map((phrase, index) => (
              <div
                key={phrase.id}
                className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-violet-100 hover:bg-violet-50 dark:border-white/10 dark:bg-white/10 dark:shadow-[0_8px_24px_rgba(0,0,0,0.24)] dark:hover:border-violet-300/35 dark:hover:bg-violet-400/15"
              >
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black">
                    {formatRomanizedDisplay(phrase.romanized)}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-500 dark:text-slate-300">
                    {capitalizeDisplayText(phrase.english)}
                  </p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-500 text-white transition group-hover:scale-105 group-hover:bg-cyan-500">
                  {index === 0 ? (
                    <Volume2 size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 rounded-3xl bg-slate-950 p-4 text-white sm:grid-cols-[auto_1fr] sm:items-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-cyan-400 text-slate-950">
              <Ear size={22} />
            </span>
            <div>
              <p className="text-sm font-black text-cyan-100">Listen first</p>
              <div className="mt-2 overflow-hidden rounded-full bg-white/15">
                <div className="progress-shine h-3 w-2/3 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.09] p-4 shadow-inner backdrop-blur">
      <div className="mb-3 grid size-10 place-items-center rounded-2xl bg-white text-violet-700 dark:bg-white/12 dark:text-violet-200">
        <Icon size={19} />
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-300">{label}</p>
    </div>
  );
}
