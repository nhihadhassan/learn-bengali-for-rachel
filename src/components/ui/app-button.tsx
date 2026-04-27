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
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" &&
          "bg-slate-950 text-white shadow-[0_5px_0_#047857] hover:bg-slate-800",
        variant === "secondary" &&
          "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-emerald-200 hover:bg-emerald-50",
        variant === "ghost" &&
          "bg-transparent text-slate-600 hover:bg-white hover:text-slate-950",
        variant === "success" &&
          "bg-emerald-600 text-white shadow-[0_5px_0_#065f46] hover:bg-emerald-700",
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
        "min-h-16 rounded-2xl border-2 px-4 py-4 text-left font-black transition active:translate-y-px",
        isSelected
          ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-[0_4px_0_#a7f3d0]"
          : "border-slate-200 bg-white text-slate-800 shadow-[0_4px_0_#e2e8f0] hover:border-emerald-200 hover:bg-emerald-50",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
