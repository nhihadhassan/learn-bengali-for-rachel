"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "success";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

export function AppButton({
  children,
  className,
  variant = "primary",
  ...props
}: AppButtonProps) {
  return (
    <button
      className={cn(
        "group inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition duration-200 ease-out focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal-200 active:translate-y-1 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55 [&>svg]:transition-transform [&>svg]:duration-200",
        variant === "primary" &&
          "bg-violet-600 text-white shadow-[0_6px_0_#5b21b6,0_16px_32px_rgba(124,58,237,0.22)] hover:-translate-y-0.5 hover:bg-violet-500 hover:shadow-[0_8px_0_#5b21b6,0_22px_38px_rgba(124,58,237,0.28)] hover:[&>svg]:translate-x-0.5",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-800 shadow-[0_5px_0_#e2e8f0] hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:shadow-[0_7px_0_#ddd6fe,0_14px_28px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_5px_0_rgba(255,255,255,0.08)] dark:hover:border-violet-300/40 dark:hover:bg-violet-400/15 dark:hover:shadow-[0_7px_0_rgba(167,139,250,0.25),0_14px_28px_rgba(0,0,0,0.22)]",
        variant === "ghost" &&
          "bg-transparent text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
        variant === "success" &&
          "bg-emerald-600 text-white shadow-[0_6px_0_#065f46,0_16px_30px_rgba(5,150,105,0.22)] hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_8px_0_#065f46,0_22px_38px_rgba(5,150,105,0.28)] hover:[&>svg]:translate-x-0.5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AnswerButton({
  children,
  isSelected,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isSelected?: boolean;
}) {
  return (
    <button
      className={cn(
        "group min-h-16 rounded-2xl border-2 px-4 py-4 text-left font-black transition duration-200 ease-out focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-teal-200 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-55",
        isSelected
          ? "border-violet-500 bg-violet-50 text-violet-900 shadow-[0_5px_0_#c4b5fd,0_14px_24px_rgba(124,58,237,0.14)] dark:border-violet-300 dark:bg-violet-400/20 dark:text-violet-100 dark:shadow-[0_5px_0_rgba(167,139,250,0.3),0_14px_24px_rgba(0,0,0,0.22)]"
          : "border-slate-200 bg-white text-slate-800 shadow-[0_5px_0_#e2e8f0] hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:shadow-[0_7px_0_#ddd6fe,0_16px_28px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:shadow-[0_5px_0_rgba(255,255,255,0.08),0_16px_28px_rgba(0,0,0,0.22)] dark:hover:border-violet-300/40 dark:hover:bg-violet-400/15",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
