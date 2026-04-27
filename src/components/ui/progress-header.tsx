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
  const percent = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        <span>
          Step {current} of {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div
        aria-label={`Lesson progress ${percent}%`}
        className="h-3 overflow-hidden rounded-full bg-slate-100 shadow-inner"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
