"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Languages, Pause, Play, RotateCcw } from "lucide-react";
import type { Song } from "@/lib/music";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const TICK_MS = 100;

/**
 * A read-along lyric view in the style of a music app's synced lyrics: each line
 * shows the Spanish (large, bold) with its English translation just below, and
 * the current line is highlighted while the others dim. Text-only — "play"
 * advances the highlight on each line's timing (no audio). Tapping a line jumps
 * to it; the translate button hides/shows English.
 */
export function LyricsPlayer({ song }: { song: Song }) {
  const total = useMemo(
    () => song.lines.reduce((sum, line) => sum + line.seconds, 0),
    [song],
  );
  // Cumulative start time of each line, for mapping elapsed -> active line.
  const starts = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const line of song.lines) {
      out.push(acc);
      acc += line.seconds;
    }
    return out;
  }, [song]);

  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);

  const activeIndex = useMemo(() => {
    let index = 0;
    for (let i = 0; i < starts.length; i += 1) {
      if (elapsed >= starts[i]) index = i;
    }
    return index;
  }, [elapsed, starts]);

  // Advance the read-along while playing; stop at the end.
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setElapsed((current) => {
        const next = current + TICK_MS / 1000;
        if (next >= total) {
          window.clearInterval(id);
          setIsPlaying(false);
          return total;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [isPlaying, total]);

  // Keep the highlighted line in view.
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  const atEnd = elapsed >= total;

  function togglePlay() {
    if (atEnd) {
      setElapsed(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((playing) => !playing);
  }

  function restart() {
    setElapsed(0);
    setIsPlaying(false);
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-6 pb-4">
        {song.lines.map((line, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          return (
            <button
              key={index}
              type="button"
              ref={isActive ? activeRef : undefined}
              onClick={() => {
                setElapsed(starts[index]);
              }}
              className="block w-full text-left transition"
            >
              <p
                className={cn(
                  "text-2xl font-black leading-snug transition-colors sm:text-3xl",
                  isActive
                    ? "text-slate-950 dark:text-white"
                    : isPast
                      ? "text-slate-400 dark:text-slate-500"
                      : "text-slate-500 dark:text-slate-400",
                )}
              >
                {line.es}
              </p>
              {showTranslation && (
                <p
                  className={cn(
                    "mt-1 text-base font-semibold leading-snug transition-colors sm:text-lg",
                    isActive
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {line.en}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Controls pinned to the bottom of the viewport, like a player bar. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-slate-200/70 bg-white/95 px-4 pb-4 pt-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/92 sm:-mx-7 sm:px-7">
        <div className="mb-3 flex items-center gap-3">
          <span className="w-10 text-xs font-black tabular-nums text-slate-500 dark:text-slate-400">
            {formatTime(elapsed)}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-violet-500 transition-[width] duration-100 ease-linear"
              style={{ width: `${total > 0 ? (elapsed / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-black tabular-nums text-slate-500 dark:text-slate-400">
            -{formatTime(total - elapsed)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowTranslation((value) => !value)}
            aria-pressed={showTranslation}
            aria-label={showTranslation ? "Hide English translation" : "Show English translation"}
            className={cn(
              "inline-grid size-11 place-items-center rounded-2xl border shadow-sm transition",
              showTranslation
                ? "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/15 dark:text-violet-200"
                : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
            )}
          >
            <Languages size={20} />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="inline-grid size-16 place-items-center rounded-full bg-violet-600 text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition hover:-translate-y-0.5 hover:bg-violet-500 active:translate-y-0.5"
          >
            {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>

          <button
            type="button"
            onClick={restart}
            aria-label="Restart"
            className="inline-grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
