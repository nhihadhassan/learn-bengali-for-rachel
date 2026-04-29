import { cn } from "@/lib/utils";

export function ProgressHeader({
  className,
  current,
  total,
}: {
  className?: string;
  current: number;
  total: number;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        <span>Progress</span>
        <span>{percent}%</span>
      </div>
      <div
        aria-label={`Lesson progress ${percent}%`}
        className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-1 ring-slate-900/5 dark:bg-white/10 dark:ring-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="progress-shine h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
