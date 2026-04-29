"use client";

import { useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { playPronunciation, type PronunciationResult } from "@/lib/pronunciation";
import { cn } from "@/lib/utils";

export function SpeakerButton({
  audioUrl,
  debug = true,
  locale,
  romanized,
  script,
}: {
  audioUrl?: string;
  debug?: boolean;
  locale?: string;
  romanized: string;
  script?: string;
}) {
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isUnavailable = result?.status === "unavailable";
  const isBrowserTts = result?.provider === "browser-tts";

  async function handlePlay() {
    setIsLoading(true);
    const nextResult = await playPronunciation({
      audioUrl,
      debug,
      locale,
      romanized,
      script,
    });
    setResult(nextResult);
    setIsLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      aria-label={`Hear ${romanized}`}
      title={
        isUnavailable
          ? "Audio is unavailable in this browser"
          : isBrowserTts
            ? `Using ${result.voiceName ?? result.lang} for ${romanized}`
            : `Hear ${romanized}`
      }
      className={cn(
        "group inline-grid size-11 place-items-center rounded-full text-white shadow-lg transition duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-violet-200 active:translate-y-1 [&>svg]:transition-transform",
        isUnavailable
          ? "bg-slate-400 shadow-slate-400/20"
          : isBrowserTts
            ? "bg-cyan-600 shadow-cyan-600/25 hover:bg-cyan-700 hover:shadow-cyan-600/35 hover:[&>svg]:scale-110"
            : "bg-violet-600 shadow-violet-600/25 hover:bg-violet-500 hover:shadow-violet-600/35 hover:[&>svg]:scale-110",
      )}
    >
      {isLoading ? (
        <Loader2 size={19} className="animate-spin" />
      ) : isUnavailable ? (
        <VolumeX size={20} />
      ) : (
        <Volume2 size={20} />
      )}
    </button>
  );
}
