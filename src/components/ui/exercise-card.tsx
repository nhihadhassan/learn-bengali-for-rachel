import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ExerciseCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mx-auto max-w-2xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-7",
        className,
      )}
    >
      {children}
    </section>
  );
}
