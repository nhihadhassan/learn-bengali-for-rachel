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
        "animate-soft-rise mx-auto max-w-2xl rounded-[30px] border border-white/80 bg-white/95 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/5 backdrop-blur sm:p-7",
        className,
      )}
    >
      {children}
    </section>
  );
}
