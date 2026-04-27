"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Flame, GraduationCap, Library, RotateCcw } from "lucide-react";
import { useProgress } from "@/lib/progress-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/lessons", label: "Lessons", icon: BookOpen },
  { href: "/vocabulary", label: "Words", icon: Library },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/progress", label: "Progress", icon: Flame },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeMistakes, progress } = useProgress();

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f8f5ef]/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/lessons" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <GraduationCap size={22} />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Learn Bengali
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-slate-600 transition hover:bg-white hover:text-emerald-700",
                    isActive && "bg-white text-emerald-700 shadow-sm",
                  )}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-white px-3 py-2 text-sm font-black shadow-sm">
              {progress.xp} XP
            </span>
            <span className="rounded-full bg-white px-3 py-2 text-sm font-black shadow-sm">
              {progress.streak} day streak
            </span>
            {activeMistakes.length > 0 && (
              <Link
                href="/review"
                className="rounded-full bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-200"
              >
                {activeMistakes.length} to review
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:py-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-slate-500",
                  isActive && "bg-emerald-50 text-emerald-700",
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
