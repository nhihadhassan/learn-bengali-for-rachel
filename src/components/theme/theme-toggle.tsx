"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const STORAGE_KEY = "learning-bengali-theme";

function getAppliedTheme(): Theme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event("learning-bengali-theme-change"));
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("learning-bengali-theme-change", listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener("learning-bengali-theme-change", listener);
    window.removeEventListener("storage", listener);
  };
}

function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribe,
    getAppliedTheme,
    getServerSnapshot,
  );

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className={cn(
        "group relative inline-grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white bg-white text-violet-700 shadow-[0_8px_20px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/5 transition duration-200 hover:-translate-y-0.5 hover:bg-violet-50 hover:shadow-[0_12px_28px_rgba(124,58,237,0.16)] active:translate-y-1 dark:border-white/10 dark:bg-white/10 dark:text-amber-200 dark:ring-white/10 dark:hover:bg-white/15 dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <Sun
        size={18}
        className={cn(
          "absolute transition duration-300 group-hover:rotate-12",
          isDark ? "scale-0 opacity-0 rotate-90" : "scale-100 opacity-100 rotate-0",
        )}
      />
      <Moon
        size={18}
        className={cn(
          "absolute transition duration-300 group-hover:-rotate-12",
          isDark ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 -rotate-90",
        )}
        fill="currentColor"
      />
    </button>
  );
}
