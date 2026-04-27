"use client";

import { useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { playPronunciation, type PronunciationResult } from "@/lib/pronunciation";
import { cn } from "@/lib/utils";

export function SpeakerButton({
  audioUrl,
  debug = true,
  romanized,
  script,
}: {
  audioUrl?: string;
  debug?: boolean;
  romanized: string;
  script?: string;
}) {
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isUnavailable = result?.status === "unavailable";
  const isBrowserTts = result?.provider === "browser-tts";
  const label = script ? `${romanized} (${script})` : romanized;

  async function handlePlay() {
    setIsLoading(true);
    const nextResult = await playPronunciation({
      audioUrl,
      debug,
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
            ? `Using ${result.voiceName ?? result.lang} for ${label}`
            : `Hear ${label}`
      }
      className={cn(
        "inline-grid size-11 place-items-center rounded-full text-white transition hover:-translate-y-0.5",
        isUnavailable
          ? "bg-slate-400"
          : isBrowserTts
            ? "bg-cyan-600 hover:bg-cyan-700"
            : "bg-emerald-600 hover:bg-emerald-700",
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
