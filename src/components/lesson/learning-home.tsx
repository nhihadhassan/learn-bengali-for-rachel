import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Ear,
  Flame,
  MessageCircle,
  Sparkles,
  Volume2,
} from "lucide-react";
import { units } from "@/lib/content";
import { LessonPath } from "@/components/lesson/lesson-path";

export function LearningHome() {
  const firstLessonId = units[0]?.lessons[0]?.id;
  const lessonCount = units.flatMap((unit) => unit.lessons).length;
  const phraseCount = units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) => lesson.phrases),
  ).length;
  const featuredPhrases = units[0]?.lessons[0]?.phrases.slice(0, 3) ?? [];

  return (
    <div className="space-y-10">
      <section className="relative isolate overflow-hidden rounded-[36px] bg-slate-950 px-5 py-7 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] ring-1 ring-white/10 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.3),transparent_34%),radial-gradient(circle_at_84%_14%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.075),transparent_45%)]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-emerald-500/18 to-transparent"
        />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:items-center xl:gap-12">
          <div className="animate-soft-rise max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-2 text-sm font-bold text-emerald-100 shadow-inner">
              <Sparkles size={16} />
              Bengali made gentle for beginners
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.04] [text-wrap:balance] sm:text-5xl lg:text-[3.45rem]">
              Learn the Bengali Rachel will actually say.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              Bite-size lessons build from romanized Bengali into script,
              listening, typing, and review, with progress that feels rewarding
              every day.
            </p>

            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              {firstLessonId && (
                <Link
                  href={`/practice/${firstLessonId}`}
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 shadow-[0_7px_0_#047857,0_20px_36px_rgba(16,185,129,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-[0_9px_0_#047857,0_26px_44px_rgba(163,230,53,0.26)] active:translate-y-1"
                >
                  Start Lesson 1
                  <ArrowRight size={19} className="transition group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="/vocabulary"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 font-black text-white shadow-inner transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
              >
                <BookOpen size={18} />
                Word bank
              </Link>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <HeroStat icon={MessageCircle} label="Phrases" value={`${phraseCount}`} />
              <HeroStat icon={CheckCircle2} label="Lessons" value={`${lessonCount}`} />
              <HeroStat icon={Flame} label="Streaks" value="Daily" />
            </div>
          </div>

          <HeroPreview phrases={featuredPhrases} />
        </div>
      </section>

      <LessonPath units={units} />
    </div>
  );
}

function HeroPreview({
  phrases,
}: {
  phrases: typeof units[number]["lessons"][number]["phrases"];
}) {
  return (
    <div className="animate-soft-rise w-full justify-self-center lg:justify-self-end">
      <div className="rounded-[34px] border border-white/14 bg-white/10 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-4">
        <div className="rounded-[28px] bg-[#fffefa] p-4 text-slate-950 shadow-[0_8px_0_rgba(255,255,255,0.18)] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Lesson preview
              </p>
              <h2 className="mt-1 text-2xl font-black">First greetings</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                Listen, read, and choose the meaning.
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950 shadow-[0_10px_24px_rgba(245,158,11,0.24)]">
              <Flame size={23} fill="currentColor" />
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {phrases.map((phrase, index) => (
              <div
                key={phrase.id}
                className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-cyan-100 hover:bg-cyan-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black">
                    {phrase.romanized}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-500">
                    {phrase.bengaliScript} · {phrase.english}
                  </p>
                </div>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white transition group-hover:scale-105 group-hover:bg-cyan-500">
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
      <div className="mb-3 grid size-10 place-items-center rounded-2xl bg-white text-emerald-700">
        <Icon size={19} />
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-300">{label}</p>
    </div>
  );
}
