"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CloudDownload,
  DoorOpen,
  Flame,
  Gem,
  GraduationCap,
  Languages,
  Library,
  Menu,
  RotateCcw,
  Route,
  Trophy,
  X,
} from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  // Lesson + review sessions run in focus mode (bottom tab bar hidden).
  const isInLesson =
    pathname.startsWith("/practice") ||
    pathname.startsWith("/strengthen") ||
    pathname.startsWith("/unit-review") ||
    pathname.startsWith("/placement");

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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:py-3">
          <Link href="/lessons" className="flex items-center gap-2.5 sm:gap-3">
            <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-[0_10px_24px_rgba(124,58,237,0.28)] transition hover:-rotate-3 hover:scale-105 sm:size-10">
              <GraduationCap size={20} />
            </span>
            <span>
              <span className="hidden text-xs font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300 sm:block">
                Learning Bengali
              </span>
              <span className="block text-base font-black leading-tight sm:text-lg">
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

          {/* Desktop actions: theme, language, and live stats. */}
          <div className="hidden items-center gap-2 sm:flex">
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
            <div className="flex items-center gap-2">
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

          {/* Mobile action: a single minimal menu button. */}
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="inline-grid size-10 place-items-center rounded-full border border-white bg-white text-violet-700 shadow-[0_8px_20px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 active:translate-y-0.5 dark:border-white/10 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10 sm:hidden"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <MobileMenu
        activeCurriculumId={activeCurriculumId}
        activeMistakesCount={activeMistakes.length}
        isInLesson={isInLesson}
        onClose={() => setMenuOpen(false)}
        onCurriculumChange={handleCurriculumChange}
        open={menuOpen}
        progress={progress}
      />

      <main
        className={cn(
          "mx-auto max-w-6xl px-4 py-6 sm:py-8",
          // In-lesson focus mode hides the bottom tab bar, so we don't need
          // to reserve space for it.
          isInLesson ? "pb-6" : "pb-28",
        )}
      >
        {children}
      </main>

      {/* Bottom tab bar is hidden during a lesson (focus mode). */}
      {!isInLesson && (
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
      )}
    </div>
  );
}

function MobileMenu({
  activeCurriculumId,
  activeMistakesCount,
  isInLesson,
  onClose,
  onCurriculumChange,
  open,
  progress,
}: {
  activeCurriculumId: string;
  activeMistakesCount: number;
  isInLesson: boolean;
  onClose: () => void;
  onCurriculumChange: (value: string) => void;
  open: boolean;
  progress: { xp: number; gems: number; streak: number };
}) {
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-slate-950/40 backdrop-blur-sm"
      />
      <div className="animate-soft-rise absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto rounded-b-[28px] border-b border-white/70 bg-[#fbf7ff] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-[#151225]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Settings
          </p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="inline-grid size-9 place-items-center rounded-full border border-white bg-white text-slate-600 shadow-sm ring-1 ring-slate-900/5 transition active:scale-95 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatPill icon={<Trophy size={15} className="text-amber-500" />} value={`${progress.xp} XP`} />
          <StatPill icon={<Gem size={15} className="text-cyan-500" />} value={`${progress.gems} gems`} />
          <StatPill
            icon={<Flame size={15} className="text-orange-500" fill="currentColor" />}
            value={`${progress.streak} day`}
          />
        </div>

        <div className="mt-3 grid gap-2">
          {isInLesson && (
            <MenuLink href="/lessons" icon={<DoorOpen size={18} />} label="Exit lesson" onClick={onClose} />
          )}
          <MenuLink href="/lessons" icon={<Route size={18} />} label="Lesson path" onClick={onClose} />
          {activeMistakesCount > 0 && (
            <MenuLink
              href="/review"
              icon={<RotateCcw size={18} />}
              label={`Review (${activeMistakesCount})`}
              onClick={onClose}
            />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/10">
          <span className="inline-flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-100">
            <Languages size={18} className="text-violet-600 dark:text-violet-300" />
            Language
          </span>
          <label className="sr-only" htmlFor="curriculum-switcher-mobile">
            Curriculum
          </label>
          <select
            id="curriculum-switcher-mobile"
            value={activeCurriculumId}
            onChange={(event) => {
              onCurriculumChange(event.target.value);
              onClose();
            }}
            className="min-h-10 rounded-full border border-white bg-white px-3 py-2 text-sm font-black text-violet-700 shadow-sm outline-none ring-1 ring-slate-900/5 transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10 dark:focus:ring-violet-400/20"
          >
            {curricula.map((curriculum) => (
              <option key={curriculum.id} value={curriculum.id}>
                {curriculum.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/10">
          <span className="text-sm font-black text-slate-700 dark:text-slate-100">
            Light / dark mode
          </span>
          <ThemeToggle />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/80 px-4 py-3 dark:border-cyan-300/20 dark:bg-cyan-400/10">
          <CloudDownload
            size={18}
            className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300"
          />
          <p className="text-xs font-bold leading-5 text-slate-600 dark:text-slate-300">
            Works offline. Add to your Home Screen (Share → Add to Home Screen)
            to open lessons without internet.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-2 py-2 text-xs font-black shadow-sm ring-1 ring-slate-900/5 dark:bg-white/10 dark:ring-white/10">
      {icon}
      {value}
    </span>
  );
}

function MenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition active:scale-[0.99] dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
        {icon}
      </span>
      {label}
    </Link>
  );
}
