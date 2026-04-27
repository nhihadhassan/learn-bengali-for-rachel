import Link from "next/link";
import { ArrowRight, Sparkles, Volume2 } from "lucide-react";
import { units } from "@/lib/content";
import { LessonPath } from "@/components/lesson/lesson-path";

export function LearningHome() {
  const firstLessonId = units[0]?.lessons[0]?.id;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-8">
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-emerald-500/20 to-transparent" />
        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-bold text-emerald-100">
              <Sparkles size={16} />
              Romanized Bengali first, script later
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.02] sm:text-5xl">
              Tiny daily lessons for real Bengali conversations.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Practice phrases like kemon acho, ami bhalo achi, and tomar naam ki with
              guided steps, pronunciation, XP, streaks, and mistake review.
            </p>
          </div>

          {firstLessonId && (
            <Link
              href={`/practice/${firstLessonId}`}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-400"
            >
              Start Lesson 1 <ArrowRight size={19} />
            </Link>
          )}
        </div>

        <div className="grid content-end gap-3 rounded-[28px] border border-white/10 bg-white/8 p-4 shadow-inner">
          {["kemon acho", "ami bhalo achi", "amar naam Rachel"].map((phrase) => (
            <div
              key={phrase}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-sm"
            >
              <p className="text-2xl font-black">{phrase}</p>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-emerald-100">
                <Volume2 size={17} />
              </span>
            </div>
          ))}
        </div>
        </div>
      </section>

      <LessonPath units={units} />
    </div>
  );
}
