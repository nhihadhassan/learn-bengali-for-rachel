"use client";

/**
 * The only chrome a running lesson shows: a way out, and how far along you are.
 *
 * The app shell hides its header and tab bar for lesson routes, so this bar is
 * what replaces them — exit, progress, and nothing else competing with the
 * exercise.
 */

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function LessonChrome({
  className,
  current,
  exitHref = "/lessons",
  exitLabel = "Exit lesson",
  total,
}: {
  className?: string;
  /** Work steps completed so far. Zero until real work is done. */
  current: number;
  exitHref?: string;
  exitLabel?: string;
  total: number;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 border-b border-slate-200/70 bg-[#fbf7ff]/92 backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-[#151225]/92",
        className,
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
      <Link
        href={exitHref}
        aria-label={exitLabel}
        className="inline-grid size-11 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <X size={22} />
      </Link>

      <div
        aria-label={`Lesson progress ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-200/80 shadow-inner dark:bg-white/10"
        role="progressbar"
      >
        <div
          className="progress-shine h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

        <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums text-slate-500 dark:text-slate-400">
          {percent}%
        </span>
      </div>
    </div>
  );
}
