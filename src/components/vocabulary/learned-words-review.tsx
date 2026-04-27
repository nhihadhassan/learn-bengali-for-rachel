"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { getLearnedWords, getVocabularyUnitOptions } from "@/lib/learned-words";
import { useProgress } from "@/lib/progress-store";
import { SpeakerButton } from "@/components/lesson/speaker-button";

export function LearnedWordsReview() {
  const { progress } = useProgress();
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const learnedWords = useMemo(() => getLearnedWords(progress), [progress]);
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
        word.phrase.bengaliScript ?? "",
        word.lessonTitle,
        word.unitTitle,
      ]
        .join(" ")
        .toLowerCase();

      return matchesUnit && searchable.includes(normalizedQuery);
    });
  }, [learnedWords, query, unitFilter]);

  if (learnedWords.length === 0) {
    return (
      <section className="rounded-[32px] bg-slate-950 p-6 text-white shadow-[0_20px_70px_rgba(15,23,42,0.18)] sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-white/10 text-emerald-100">
          <BookOpen size={28} />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          Vocabulary
        </p>
        <h1 className="mt-2 text-4xl font-black">Your word bank is ready.</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Complete a lesson to start building your word bank.
        </p>
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
      <section className="rounded-[32px] bg-slate-950 p-6 text-white shadow-[0_20px_70px_rgba(15,23,42,0.18)] sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-100">
          Learned Words
        </p>
        <h1 className="mt-2 text-4xl font-black">Rachel&apos;s word bank</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Review every Bengali word and phrase you have encountered so far.
        </p>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="relative block">
            <span className="sr-only">Search vocabulary</span>
            <Search
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search English, romanized Bengali, or Bengali script"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#fffdfa] px-11 py-3 font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="sr-only">Filter by unit</span>
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-[#fffdfa] px-4 py-3 font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="all">All units</option>
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
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-2xl font-black">No matching words</h2>
          <p className="mt-2 text-slate-600">
            Try a different English meaning, romanized spelling, or Bengali script.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWords.map((word) => (
            <article
              key={word.phrase.id}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-4xl font-black leading-tight">
                    {word.phrase.bengaliScript ?? word.phrase.romanized}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {word.phrase.romanized}
                  </p>
                </div>
                <SpeakerButton
                  audioUrl={word.phrase.audioUrl}
                  romanized={word.phrase.romanized}
                  script={word.phrase.bengaliScript}
                />
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                    Meaning
                  </p>
                  <p className="mt-1 text-xl font-black">{word.phrase.english}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Source
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    Unit {word.unitNumber}: {word.unitTitle} · {word.lessonTitle}
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
