"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Search } from "lucide-react";
import { getCurriculum } from "@/lib/content";
import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { getLearnedWords, getVocabularyUnitOptions } from "@/lib/learned-words";
import { useProgress } from "@/lib/progress-store";
import { HistoryIcon } from "@/components/lesson/history-icon";
import { SpeakerButton } from "@/components/lesson/speaker-button";

export function LearnedWordsReview() {
  const { activeCurriculumId, progress } = useProgress();
  const curriculum = getCurriculum(activeCurriculumId);
  const languageLabel =
    activeCurriculumId === "history"
      ? "History"
      : activeCurriculumId === "spanish-peru"
        ? "Spanish"
        : activeCurriculumId === "malayalam"
          ? "Malayalam"
          : "Bengali";
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const learnedWords = useMemo(
    () => getLearnedWords(progress, activeCurriculumId),
    [activeCurriculumId, progress],
  );
  const unitOptions = useMemo(
    () => getVocabularyUnitOptions(learnedWords),
    [learnedWords],
  );
  const filteredWords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return learnedWords.filter((word) => {
      const matchesUnit =
        unitFilter === "all" ? true : word.unitId === unitFilter;
      const searchable = [
        word.phrase.english,
        word.phrase.romanized,
        word.lessonTitle,
        word.unitTitle,
      ]
        .join(" ")
        .toLowerCase();

      return matchesUnit && searchable.includes(normalizedQuery);
    });
  }, [learnedWords, query, unitFilter]);

  if (curriculum.mode === "history") {
    return (
      <HistoryRecap
        curriculum={curriculum}
        progress={progress}
        query={query}
        setQuery={setQuery}
        setUnitFilter={setUnitFilter}
        unitFilter={unitFilter}
      />
    );
  }

  if (learnedWords.length === 0) {
    return (
      <section className="animate-soft-rise rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-emerald-100">
          <BookOpen size={28} />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          {languageLabel} Vocabulary
        </p>
        <h1 className="mt-2 text-4xl font-black">Your word bank is ready.</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Complete a lesson to start building your word bank.
        </p>
        <div className="mt-6 max-w-sm rounded-3xl border border-white/10 bg-white/10 p-4 shadow-inner">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-100">
            Preview
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {activeCurriculumId === "malayalam" ? "Namaskaram" : "Assalamualaikum"}
          </p>
          <p className="mt-1 font-bold text-slate-300">
            {activeCurriculumId === "malayalam"
              ? "Hello / respectful greeting"
              : "Hello"}
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-400">
            Words and phrases you meet in lessons will appear here with audio.
          </p>
        </div>
        <Link
          href="/lessons"
          className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-emerald-500 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-400"
        >
          Start a lesson
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="animate-soft-rise rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          Learned Words
        </p>
        <h1 className="mt-2 text-4xl font-black">{languageLabel} word bank</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Review every {languageLabel} word and phrase you have encountered so far.
        </p>
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)] dark:ring-white/10 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="relative block">
            <span className="sr-only">Search vocabulary</span>
            <Search
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search English or ${languageLabel}`}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#fffdfa] px-11 py-3 font-bold shadow-inner outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-emerald-400/20"
            />
          </label>

          <label>
            <span className="sr-only">Filter by topic</span>
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#fffdfa] px-4 py-3 font-bold shadow-inner outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:focus:ring-emerald-400/20"
            >
              <option value="all">All topics</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filteredWords.length === 0 ? (
        <section className="rounded-[30px] border border-white/80 bg-white/95 p-6 text-center shadow-[0_14px_40px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_14px_40px_rgba(0,0,0,0.26)]">
          <h2 className="text-2xl font-black">No matching words</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Try a different English meaning or romanized spelling.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWords.map((word) => (
            <article
              key={word.phrase.id}
              className="group rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_14px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-1 hover:shadow-[0_22px_58px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_14px_42px_rgba(0,0,0,0.26)] dark:ring-white/10 dark:hover:shadow-[0_22px_58px_rgba(0,0,0,0.34)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-4xl font-black leading-tight">
                    {formatRomanizedDisplay(word.phrase.romanized)}
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-500 dark:text-slate-300">
                    {capitalizeDisplayText(word.phrase.english)}
                  </p>
                </div>
                <SpeakerButton
                  audioFile={word.phrase.audioFile}
                  audioUrl={word.phrase.audioUrl}
                  locale={word.locale}
                  romanized={word.phrase.romanized}
                  script={word.phrase.bengaliScript}
                />
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 shadow-inner dark:border-emerald-300/20 dark:bg-emerald-400/12">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                    Meaning
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {capitalizeDisplayText(word.phrase.english)}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.08]">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Source
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {word.unitTitle} · {word.lessonTitle}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryRecap({
  curriculum,
  progress,
  query,
  setQuery,
  setUnitFilter,
  unitFilter,
}: {
  curriculum: ReturnType<typeof getCurriculum>;
  progress: ReturnType<typeof useProgress>["progress"];
  query: string;
  setQuery: (query: string) => void;
  setUnitFilter: (unitId: string) => void;
  unitFilter: string;
}) {
  const completed = new Set(progress.completedLessons);
  const lessons = curriculum.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({ lesson, unit })),
  );
  const unitOptions = curriculum.units.map((unit) => ({
    id: unit.id,
    label: unit.title,
  }));
  const filteredLessons = lessons.filter(({ lesson, unit }) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesUnit = unitFilter === "all" ? true : unit.id === unitFilter;
    const searchable = [
      lesson.title,
      lesson.summary,
      lesson.history?.keyTakeaway,
      lesson.history?.whyItMatters,
      unit.title,
    ]
      .join(" ")
      .toLowerCase();

    return matchesUnit && searchable.includes(normalizedQuery);
  });

  return (
    <div className="space-y-6">
      <section className="animate-soft-rise rounded-[34px] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-100">
          Timeline recap
        </p>
        <h1 className="mt-2 text-4xl font-black">History story map</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Revisit completed moments, scan key takeaways, and jump back into any
          event card when you want the story again.
        </p>
      </section>

      <section className="rounded-[30px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_18px_55px_rgba(0,0,0,0.28)] dark:ring-white/10 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="relative block">
            <span className="sr-only">Search history recap</span>
            <Search
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events, causes, or consequences"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#fffdfa] px-11 py-3 font-bold shadow-inner outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-violet-400/20"
            />
          </label>

          <label>
            <span className="sr-only">Filter by topic</span>
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#fffdfa] px-4 py-3 font-bold shadow-inner outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:focus:ring-violet-400/20"
            >
              <option value="all">All topics</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredLessons.map(({ lesson, unit }) => {
          const isCompleted = completed.has(lesson.id);

          return (
            <Link
              key={lesson.id}
              href={`/practice/${lesson.id}`}
              className="group rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_14px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-1 hover:shadow-[0_22px_58px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_14px_42px_rgba(0,0,0,0.26)] dark:ring-white/10 dark:hover:shadow-[0_22px_58px_rgba(0,0,0,0.34)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white dark:bg-violet-400/15 dark:text-violet-200 dark:group-hover:bg-violet-500">
                    <HistoryIcon name={lesson.history?.icon} size={22} />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      {unit.title}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{lesson.title}</h2>
                  </div>
                </div>
                {isCompleted && (
                  <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={19} />
                  </span>
                )}
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {lesson.history?.keyTakeaway ?? lesson.summary}
              </p>
              {lesson.history?.whyItMatters && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 dark:bg-amber-400/14 dark:text-amber-100">
                  {lesson.history.whyItMatters}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
