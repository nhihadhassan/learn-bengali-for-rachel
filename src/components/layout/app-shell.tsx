"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Flame, Gem, GraduationCap, Library, RotateCcw, Trophy } from "lucide-react";
import { curricula } from "@/lib/content";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const navItems = [
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/vocabulary", label: "Words", historyLabel: "Recap", icon: Library },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/progress", label: "Progress", icon: Flame },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    activeCurriculumId,
    activeMistakes,
    progress,
    setActiveCurriculumId,
  } = useProgress();

  function handleCurriculumChange(value: string) {
    if (value === "history" || value === "spanish-peru" || value === "malayalam") {
      setActiveCurriculumId(value);
    } else {
      setActiveCurriculumId("bengali");
    }

    if (pathname.startsWith("/practice")) {
      router.push("/lessons");
    }
  }

  return (
    <div className="min-h-screen text-slate-950 transition-colors duration-300 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#fbf7ff]/88 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-[#151225]/88 dark:shadow-[0_10px_35px_rgba(0,0,0,0.28)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/lessons" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-[0_10px_24px_rgba(124,58,237,0.28)] transition hover:-rotate-3 hover:scale-105">
              <GraduationCap size={22} />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                Learning Bengali
              </span>
              <span className="block text-lg font-black leading-tight">
                For Rachel
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              const label =
                activeCurriculumId === "history" && item.historyLabel
                  ? item.historyLabel
                  : item.label;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black text-slate-600 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-violet-700 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-violet-200 dark:hover:shadow-[0_8px_22px_rgba(0,0,0,0.2)] [&>svg]:transition-transform",
                    isActive &&
                      "bg-white text-violet-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] dark:bg-white/10 dark:text-violet-200 dark:shadow-[0_8px_22px_rgba(0,0,0,0.22)]",
                  )}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <label className="sr-only" htmlFor="curriculum-switcher">
              Curriculum
            </label>
            <select
              id="curriculum-switcher"
              value={activeCurriculumId}
              onChange={(event) => handleCurriculumChange(event.target.value)}
              className="min-h-10 w-[132px] rounded-full border border-white bg-white px-3 py-2 text-sm font-black text-violet-700 shadow-[0_8px_20px_rgba(15,23,42,0.07)] outline-none ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10 dark:focus:ring-violet-400/20 sm:w-auto"
            >
              {curricula.map((curriculum) => (
                <option key={curriculum.id} value={curriculum.id}>
                  {curriculum.label}
                </option>
              ))}
            </select>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black shadow-[0_8px_20px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 dark:bg-white/10 dark:ring-white/10">
                <Trophy size={15} className="text-amber-500" />
                {progress.xp} XP
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black shadow-[0_8px_20px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-white/10 dark:ring-white/10 dark:hover:bg-cyan-400/15 dark:hover:text-cyan-100">
                <Gem size={15} className="text-cyan-500" />
                {progress.gems} gems
              </span>
              <span className="group inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black shadow-[0_8px_20px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-amber-50 hover:text-orange-700 hover:shadow-[0_12px_28px_rgba(249,115,22,0.2)] dark:bg-white/10 dark:ring-white/10 dark:hover:bg-orange-500/15 dark:hover:text-orange-200 dark:hover:shadow-[0_12px_28px_rgba(249,115,22,0.12)]">
                <Flame
                  size={15}
                  className="text-orange-500 transition group-hover:text-orange-600 group-hover:[animation:flame-dance_1.1s_ease-in-out_infinite]"
                  fill="currentColor"
                />
                {progress.streak} day streak
              </span>
              {activeMistakes.length > 0 && (
                <Link
                  href="/review"
                  className="rounded-full bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                >
                  {activeMistakes.length} to review
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:py-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur transition-colors duration-300 dark:border-white/10 dark:bg-[#151225]/95 dark:shadow-[0_-10px_30px_rgba(0,0,0,0.25)] sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const label =
              activeCurriculumId === "history" && item.historyLabel
                ? item.historyLabel
                : item.label;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-bold text-slate-500 transition active:scale-95 dark:text-slate-300",
                  isActive &&
                    "bg-violet-50 text-violet-700 shadow-inner dark:bg-violet-500/20 dark:text-violet-200",
                )}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
