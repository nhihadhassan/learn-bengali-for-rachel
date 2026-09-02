"use client";

/**
 * The end-of-session screen, shared by lessons, story chapters and practice.
 *
 * It reports only things that actually happened — accuracy, XP, gems, streak —
 * rather than filler tiles like "Review: Ready", and it puts the single most
 * useful next action first.
 */

import Link from "next/link";
import { ArrowRight, Flame, Gem, PartyPopper, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompletionKind = "lesson" | "story" | "practice";

const HEADLINES: Record<CompletionKind, string> = {
  lesson: "Lesson complete",
  story: "Chapter complete",
  practice: "Practice complete",
};

export function LessonCompleteScreen({
  correctCount,
  gemsEarned,
  kind,
  mistakeCount,
  nextHref,
  nextLabel,
  questionCount,
  secondaryHref,
  secondaryLabel,
  streak,
  xpEarned,
}: {
  correctCount: number;
  gemsEarned: number;
  kind: CompletionKind;
  mistakeCount: number;
  nextHref: string;
  nextLabel: string;
  questionCount: number;
  secondaryHref: string;
  secondaryLabel: string;
  streak: number;
  xpEarned: number;
}) {
  const accuracy =
    questionCount > 0
      ? Math.round((correctCount / questionCount) * 100)
      : null;

  return (
    <section className="animate-soft-rise relative mx-auto mt-6 max-w-2xl overflow-hidden rounded-[30px] bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-[0_24px_70px_rgba(5,150,105,0.25)] sm:p-8">
      <div className="celebration-burst" aria-hidden="true" />
      <div className="relative z-10">
        <span className="warm-glow grid size-14 place-items-center rounded-2xl bg-white text-emerald-700">
          <PartyPopper size={26} />
        </span>
        <h2 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">
          {HEADLINES[kind]}
        </h2>
        <p className="mt-2 text-emerald-50">
          {accuracy !== null
            ? `${correctCount} of ${questionCount} right — ${accuracy}% accuracy.`
            : "Nice work. Your progress is saved."}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 shadow-inner sm:gap-3 sm:p-4">
          <CompletionStat icon={<Trophy size={16} aria-hidden="true" />} label="XP" value={`+${xpEarned}`} />
          <CompletionStat
            icon={<Gem size={16} />}
            label="Gems"
            value={gemsEarned > 0 ? `+${gemsEarned}` : "—"}
          />
          <CompletionStat
            icon={<Flame size={16} aria-hidden="true" />}
            label="Streak"
            value={`${streak}d`}
          />
        </div>

        <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
          <CompletionLink href={nextHref} variant="primary">
            {nextLabel} <ArrowRight size={18} aria-hidden="true" />
          </CompletionLink>
          {mistakeCount > 0 && (
            <CompletionLink href="/review" variant="secondary">
              <RotateCcw size={17} aria-hidden="true" />
              Fix {mistakeCount} {mistakeCount === 1 ? "mistake" : "mistakes"}
            </CompletionLink>
          )}
          <CompletionLink href={secondaryHref} variant="secondary">
            {secondaryLabel}
          </CompletionLink>
        </div>
      </div>
    </section>
  );
}

function CompletionStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-100 sm:justify-start">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function CompletionLink({
  children,
  href,
  variant,
}: {
  children: React.ReactNode;
  href: string;
  variant: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 font-black transition hover:-translate-y-0.5 active:translate-y-0.5",
        variant === "primary"
          ? "bg-white text-emerald-800 shadow-[0_5px_0_rgba(255,255,255,0.4)] hover:bg-emerald-50"
          : "bg-emerald-900/40 text-white shadow-inner hover:bg-emerald-900/60",
      )}
    >
      {children}
    </Link>
  );
}
