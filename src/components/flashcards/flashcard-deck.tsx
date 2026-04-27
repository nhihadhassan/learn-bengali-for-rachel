"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { Phrase } from "@/types/learning";

export function FlashcardDeck({ phrases }: { phrases: Phrase[] }) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const phrase = phrases[index];

  function move(offset: number) {
    setIsFlipped(false);
    setIndex((current) => (current + offset + phrases.length) % phrases.length);
  }

  if (!phrase) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-700">
            Flashcards
          </p>
          <h2 className="text-2xl font-black">Learn the phrases</h2>
        </div>
        <p className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
          {index + 1} / {phrases.length}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setIsFlipped((value) => !value)}
        className="min-h-64 w-full rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-6 text-left transition hover:border-cyan-400"
      >
        <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-cyan-700">
          <RotateCw size={15} />
          Tap to flip
        </span>

        {isFlipped ? (
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
              English
            </p>
            <p className="mt-2 text-4xl font-black">{phrase.english}</p>
            <p className="mt-5 rounded-xl bg-white p-4 text-sm font-semibold text-slate-700">
              Pronunciation: {phrase.pronunciation}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
              Bengali in English letters
            </p>
            <p className="mt-2 text-5xl font-black leading-tight">
              {phrase.romanized}
            </p>
            {phrase.bengaliScript && (
              <p className="mt-3 text-2xl font-black text-slate-400">
                {phrase.bengaliScript}
              </p>
            )}
          </div>
        )}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => move(-1)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-black text-white transition hover:bg-slate-800"
        >
          Next <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
