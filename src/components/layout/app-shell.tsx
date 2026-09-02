"use client";

/**
 * The platform shell: identity, course context, and the three places a learner
 * can be — Learn, Practice, Progress.
 *
 * Everything else (course switching, theme, data) lives one level down in the
 * course menu and Settings, so the header stays quiet. During a lesson the
 * shell disappears entirely; the lesson provides its own exit + progress bar.
 */

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  Dumbbell,
  Flame,
  LineChart,
  Settings,
} from "lucide-react";
import { COURSES, getCourse } from "@/lib/courses";
import { getCourseOutline } from "@/lib/course-index";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";
import type { CurriculumId } from "@/types/learning";

const navItems = [
  { href: "/lessons", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: LineChart },
];

/**
 * Routes that run a focused session. The shell hides itself for these so the
 * exercise is the only thing on screen.
 */
function isFocusRoute(pathname: string) {
  return (
    pathname.startsWith("/practice/") ||
    pathname.startsWith("/strengthen") ||
    pathname.startsWith("/unit-review") ||
    pathname.startsWith("/placement") ||
    // The song player has its own bottom control bar.
    pathname.startsWith("/music/")
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeCurriculumId, duePhraseCount, progress } = useProgress();
  const focusMode = isFocusRoute(pathname);

  if (focusMode) {
    return (
      <div className="min-h-screen text-slate-950 transition-colors duration-300 dark:text-slate-100">
        <main className="pb-10">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-950 transition-colors duration-300 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#fbf7ff]/90 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-[#151225]/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2"
            aria-label="Learning for Rachel — all courses"
          >
            <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-lg text-white shadow-[0_6px_16px_rgba(124,58,237,0.25)]">
              ✦
            </span>
            <span className="hidden text-sm font-black leading-tight sm:block">
              Learning
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                for Rachel
              </span>
            </span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                badge={item.href === "/practice" ? duePhraseCount : 0}
                href={item.href}
                icon={item.icon}
                isActive={isNavActive(pathname, item.href)}
                label={item.label}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
            {progress.streak > 0 && (
              <span
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-black text-orange-600 dark:text-orange-300"
                aria-label={`${progress.streak} day streak`}
                title={`${progress.streak} day streak`}
              >
                <Flame size={16} fill="currentColor" aria-hidden="true" />
                {progress.streak}
              </span>
            )}
            <CourseMenu activeCurriculumId={activeCurriculumId} />
            <Link
              href="/settings"
              aria-label="Settings"
              className={cn(
                "inline-grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
                pathname.startsWith("/settings") &&
                  "bg-slate-900/5 text-slate-900 dark:bg-white/10 dark:text-white",
              )}
            >
              <Settings size={19} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:py-8 sm:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur transition-colors duration-300 dark:border-white/10 dark:bg-[#151225]/95 sm:hidden">
        <div className="mx-auto grid max-w-sm grid-cols-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(pathname, item.href);
            const badge = item.href === "/practice" ? duePhraseCount : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold text-slate-500 transition active:scale-95 dark:text-slate-400",
                  isActive && "text-violet-700 dark:text-violet-300",
                )}
              >
                <span className="relative">
                  <Icon size={22} aria-hidden="true" />
                  {badge > 0 && <NavBadge count={badge} />}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** `/practice` must not light up while `/practice/<lessonId>` is running. */
function isNavActive(pathname: string, href: string) {
  if (href === "/practice") {
    return pathname === "/practice";
  }

  return pathname.startsWith(href);
}

function NavLink({
  badge,
  href,
  icon: Icon,
  isActive,
  label,
}: {
  badge: number;
  href: string;
  icon: typeof BookOpen;
  isActive: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-black text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
        isActive &&
          "bg-white text-violet-700 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10",
      )}
    >
      <span className="relative">
        <Icon size={17} aria-hidden="true" />
        {badge > 0 && <NavBadge count={badge} />}
      </span>
      {label}
    </Link>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} due`}
      className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-black leading-4 text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Switching course is a first-class action, not a form control buried among
 * stat pills: the chip shows where you are, the menu shows everywhere else you
 * could be, with progress for each.
 */
function CourseMenu({
  activeCurriculumId,
}: {
  activeCurriculumId: CurriculumId;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setActiveCurriculumId, store } = useProgress();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const course = getCourse(activeCurriculumId);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(courseId: CurriculumId) {
    setActiveCurriculumId(courseId);
    setOpen(false);

    // Course-scoped pages need to re-read the new course from the top.
    if (pathname !== "/lessons") {
      router.push("/lessons");
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-2.5 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-900/5 transition hover:bg-slate-50 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/15"
      >
        <span aria-hidden="true">{course.accent.emoji}</span>
        <span className="max-w-24 truncate">{course.shortLabel}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-soft-rise absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#1c1830]"
        >
          <p className="px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            Your courses
          </p>
          {COURSES.map((item) => {
            const outline = getCourseOutline(item.id);
            const completed =
              store.byCurriculum[item.id]?.completedLessons.length ?? 0;
            const percent =
              outline.lessonCount > 0
                ? Math.round((completed / outline.lessonCount) * 100)
                : 0;
            const isActive = item.id === activeCurriculumId;

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => choose(item.id)}
                className={cn(
                  "flex w-full min-h-12 items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10",
                  isActive && "bg-violet-50 dark:bg-violet-400/15",
                )}
              >
                <span className="text-xl" aria-hidden="true">
                  {item.accent.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-50">
                    {item.label}
                  </span>
                  <span className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                    {percent > 0
                      ? `${percent}% · ${completed}/${outline.lessonCount}`
                      : `${outline.lessonCount} ${item.nouns.lessons}`}
                  </span>
                </span>
                {isActive && (
                  <Check size={17} aria-hidden="true" className="shrink-0 text-violet-600 dark:text-violet-300" />
                )}
              </button>
            );
          })}
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center justify-center rounded-2xl border-t border-slate-100 text-sm font-black text-violet-700 transition hover:bg-violet-50 dark:border-white/10 dark:text-violet-300 dark:hover:bg-white/10"
          >
            Browse all courses
          </Link>
        </div>
      )}
    </div>
  );
}
