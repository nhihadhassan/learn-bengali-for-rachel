"use client";

export type PronunciationInput = {
  audioFile?: string;
  audioUrl?: string;
  audioText?: string;
  bengaliScript?: string;
  debug?: boolean;
  locale?: string;
  romanized: string;
  script?: string;
};

export type PronunciationResult =
  | {
      provider: "recorded-audio";
      status: "played";
    }
  | {
      fallbackUsed: boolean;
      lang: string;
      message: string;
      provider: "browser-tts";
      status: "played";
      voiceName: string | null;
    }
  | {
      provider: "none";
      reason: string;
      status: "unavailable";
    };

export type PronunciationProvider = {
  name: string;
  speak: (input: PronunciationInput) => Promise<PronunciationResult>;
};

type RankedVoice = {
  lang: string;
  name: string;
  score: number;
  voice: SpeechSynthesisVoice;
};

const bengaliLocalePriority = ["bn-bd", "bn-in", "bn"];
const malayalamLocalePriority = ["ml-in", "ml"];

const preferredVoiceHints = [
  "google বাংলা",
  "google bengali",
  "microsoft bangla",
  "microsoft bengali",
  "bangla",
  "bengali",
];

const softVoiceHints = [
  "female",
  "woman",
  "zira",
  "aria",
  "jenny",
  "neerja",
  "natasha",
  "sonia",
  "samantha",
  "susan",
  "premium",
  "enhanced",
  "natural",
];

const spanishVoiceHints = [
  "google español",
  "google spanish",
  "microsoft sabina",
  "microsoft spanish",
  "español",
  "spanish",
];

const malayalamVoiceHints = [
  "google malayalam",
  "microsoft malayalam",
  "malayalam",
  "മലയാളം",
];

function getSpeechSynthesis() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function hasBengaliScript(text: string) {
  return /[\u0980-\u09FF]/.test(text);
}

function voiceIsBengali(voice: SpeechSynthesisVoice | null) {
  if (!voice) {
    return false;
  }

  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();

  return (
    lang.startsWith("bn") ||
    name.includes("bangla") ||
    name.includes("bengali") ||
    name.includes("বাংলা")
  );
}

function voiceMatchesLocale(voice: SpeechSynthesisVoice | null, locale: string) {
  if (!voice) {
    return false;
  }

  const baseLanguage = locale.toLowerCase().split("-")[0];
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();

  if (baseLanguage === "bn") {
    return voiceIsBengali(voice);
  }

  if (baseLanguage === "ml") {
    return (
      lang.startsWith("ml") ||
      name.includes("malayalam") ||
      name.includes("മലയാളം")
    );
  }

  return lang.startsWith(baseLanguage);
}

function isBengaliLocale(locale: string) {
  return locale.toLowerCase().startsWith("bn");
}

function isMalayalamLocale(locale: string) {
  return locale.toLowerCase().startsWith("ml");
}

function debugPronunciation(input: PronunciationInput, result: PronunciationResult) {
  if (!input.debug) {
    return;
  }

  console.info("[Pronunciation]", {
    audioFile: input.audioFile ?? null,
    audioUrl: input.audioUrl ?? null,
    provider: result.provider,
    result,
    romanized: input.romanized,
    script: input.script ?? input.bengaliScript ?? input.audioText ?? null,
  });

  if (result.provider === "none") {
    console.warn("[Pronunciation] Playback unavailable:", result.reason);
  }
}

async function getVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSpeechSynthesis();

  if (!synth) {
    return [];
  }

  const voices = synth.getVoices();

  if (voices.length > 0) {
    return voices;
  }

  return new Promise((resolve) => {
    let attempts = 0;
    let settled = false;
    let pollTimer: number | null = null;
    let fallbackTimer: number | null = null;

    const cleanup = () => {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }

      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }

      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
    };

    const finish = () => {
      if (settled) {
        return;
      }

      const nextVoices = synth.getVoices();

      if (nextVoices.length > 0 || attempts >= 14) {
        settled = true;
        cleanup();
        resolve(nextVoices);
        return;
      }

      attempts += 1;
      pollTimer = window.setTimeout(finish, 150);
    };

    const handleVoicesChanged = () => {
      const nextVoices = synth.getVoices();

      if (nextVoices.length > 0) {
        settled = true;
        cleanup();
        resolve(nextVoices);
      }
    };

    synth.addEventListener?.("voiceschanged", handleVoicesChanged);
    fallbackTimer = window.setTimeout(finish, 150);
  });
}

function rankVoice(voice: SpeechSynthesisVoice, locale = "bn-BD"): RankedVoice {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  const haystack = `${lang} ${name}`;
  const preferredLocale = locale.toLowerCase();
  const baseLanguage = preferredLocale.split("-")[0];
  const isSpanish = baseLanguage === "es";
  const isBengali = baseLanguage === "bn";
  const isMalayalam = baseLanguage === "ml";
  let score = 0;

  if (isBengali) {
    const localeRank = bengaliLocalePriority.indexOf(lang);

    if (localeRank >= 0) {
      score += 260 - localeRank * 10;
    } else if (lang.startsWith("bn-")) {
      score += 230;
    } else if (lang.startsWith("bn")) {
      score += 220;
    }
  } else if (isMalayalam) {
    const localeRank = malayalamLocalePriority.indexOf(lang);

    if (localeRank >= 0) {
      score += 250 - localeRank * 10;
    } else if (lang.startsWith("ml-")) {
      score += 225;
    } else if (lang.startsWith("ml")) {
      score += 215;
    } else if (malayalamVoiceHints.some((hint) => haystack.includes(hint))) {
      score += 150;
    }
  } else if (lang === preferredLocale) {
    score += 120;
  } else if (isSpanish && lang === "es-pe") {
    score += 118;
  } else if (lang.startsWith(`${baseLanguage}-`)) {
    score += 110;
  } else if (lang.startsWith(baseLanguage)) {
    score += 100;
  }

  const hints = isMalayalam
    ? malayalamVoiceHints
    : isSpanish
      ? spanishVoiceHints
      : preferredVoiceHints;
  const hintIndex = preferredVoiceHints.findIndex((hint) =>
    haystack.includes(hint),
  );
  const matchedHintIndex = hints.findIndex((hint) => haystack.includes(hint));

  if (matchedHintIndex >= 0) {
    score += 30 - matchedHintIndex;
  } else if (hintIndex >= 0) {
    score += 20 - hintIndex;
  }

  const softHintIndex = softVoiceHints.findIndex((hint) =>
    haystack.includes(hint),
  );

  if (softHintIndex >= 0) {
    score += 8 - Math.min(softHintIndex, 7);
  }

  if (voice.localService) {
    score += 2;
  }

  return { lang: voice.lang, name: voice.name, score, voice };
}

export async function getAvailablePronunciationVoices() {
  return (await getVoices())
    .map((voice) => rankVoice(voice))
    .sort((left, right) => right.score - left.score);
}

export async function getAvailableVoicesForLocale(locale = "bn-BD") {
  return (await getVoices())
    .map((voice) => rankVoice(voice, locale))
    .sort((left, right) => right.score - left.score);
}

export async function getBestVoice(locale = "bn-BD") {
  const voices = await getAvailableVoicesForLocale(locale);
  return voices.find((item) => item.score >= 100)?.voice ?? null;
}

export async function getBestBengaliVoice() {
  const voices = await getAvailablePronunciationVoices();
  return voices.find((item) => item.score >= 100)?.voice ?? null;
}

async function debugAvailableVoicesForLocale(locale = "bn-BD") {
  const voices = await getAvailableVoicesForLocale(locale);
  const rows = voices.map((item) => ({
    lang: item.voice.lang,
    localService: item.voice.localService,
    name: item.voice.name,
    score: item.score,
  }));

  console.table(rows);
  return rows;
}

let currentAudio: HTMLAudioElement | null = null;

function getRecordedAudioSource(input: PronunciationInput) {
  return input.audioFile?.trim() || input.audioUrl?.trim() || "";
}

function stopCurrentAudio() {
  if (!currentAudio) {
    return;
  }

  currentAudio.pause();
  currentAudio.currentTime = 0;
}

function stopCurrentSpeech() {
  const synth = getSpeechSynthesis();

  if (synth) {
    synth.cancel();
  }
}

// Browsers (Chrome/Safari especially) routinely drop the FIRST speak() after a
// page load: voices aren't loaded yet, the engine is cold, and the synth can
// start in a paused state — so onstart never fires and the call looks like a
// failure. That's the "click once = unavailable, click again = works" bug.
// Warming the engine once (preload voices + resume) makes the first real click
// succeed; we also retry once transparently below.
let speechWarmed = false;

async function warmUpSpeech(): Promise<void> {
  const synth = getSpeechSynthesis();

  if (!synth || speechWarmed) {
    return;
  }

  speechWarmed = true;

  try {
    await getVoices();

    if (synth.paused) {
      synth.resume();
    }
  } catch {
    // Best effort — warming is an optimization, not a requirement.
  }
}

// Warm the speech engine on the very first user interaction (a gesture the
// browser trusts), so voices are loaded before the first speaker tap.
if (typeof window !== "undefined") {
  const warmOnFirstGesture = () => {
    void warmUpSpeech();
    window.removeEventListener("pointerdown", warmOnFirstGesture);
    window.removeEventListener("keydown", warmOnFirstGesture);
  };

  window.addEventListener("pointerdown", warmOnFirstGesture, { once: true });
  window.addEventListener("keydown", warmOnFirstGesture, { once: true });
}

const recordedAudioProvider: PronunciationProvider = {
  name: "recorded-audio",
  async speak(input) {
    const audioSource = getRecordedAudioSource(input);

    if (!audioSource || typeof Audio === "undefined") {
      return {
        provider: "none",
        reason: "No recorded audio URL was provided.",
        status: "unavailable",
      };
    }

    try {
      stopCurrentSpeech();
      stopCurrentAudio();

      const audio = new Audio(audioSource);
      currentAudio = audio;
      await audio.play();

      return {
        provider: "recorded-audio",
        status: "played",
      };
    } catch {
      return {
        provider: "none",
        reason: `Could not play recorded audio at ${audioSource}.`,
        status: "unavailable",
      };
    }
  },
};

function resolveTtsText(input: PronunciationInput) {
  const locale = input.locale ?? "bn-BD";
  const script =
    input.script?.trim() || input.bengaliScript?.trim() || input.audioText?.trim();

  if (isBengaliLocale(locale)) {
    return script && hasBengaliScript(script) ? script : "";
  }

  return script || input.romanized;
}

function getSpeechSettings(locale: string) {
  if (isBengaliLocale(locale)) {
    return {
      pitch: 1.02,
      rate: 0.7,
      volume: 1,
    };
  }

  if (locale.toLowerCase().startsWith("es")) {
    return {
      pitch: 1,
      rate: 0.84,
      volume: 1,
    };
  }

  if (isMalayalamLocale(locale)) {
    return {
      pitch: 1,
      rate: 0.78,
      volume: 1,
    };
  }

  return {
    pitch: 1,
    rate: 0.9,
    volume: 1,
  };
}

function createVoiceMessage({
  fallbackUsed,
  lang,
  locale,
  voice,
}: {
  fallbackUsed: boolean;
  lang: string;
  locale: string;
  voice: SpeechSynthesisVoice | null;
}) {
  if (voice && !fallbackUsed) {
    return `Using ${voice.name} (${voice.lang}).`;
  }

  if (isBengaliLocale(locale)) {
    return `No dedicated Bengali/Bangla voice was found. Trying the browser's ${lang} speech fallback.`;
  }

  if (isMalayalamLocale(locale)) {
    return `No dedicated Malayalam voice was found. Trying the browser's ${lang} speech fallback.`;
  }

  return `Using the browser's ${lang} speech fallback.`;
}

function speakUtterance(
  synth: SpeechSynthesis,
  utterance: SpeechSynthesisUtterance,
) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    const startWatchdog = window.setTimeout(() => {
      if (!settled && (started || synth.speaking || synth.pending)) {
        settle(resolve);
      }
    }, 350);

    const failureWatchdog = window.setTimeout(() => {
      if (settled) {
        return;
      }

      // If the utterance is audibly playing or still queued, count it as
      // started rather than failing — some engines never fire onstart.
      if (started || synth.speaking || synth.pending) {
        settle(resolve);
        return;
      }

      settle(() =>
        reject(
          new Error(
            "Speech synthesis did not start. This browser may not have a usable voice installed.",
          ),
        ),
      );
    }, 2400);

    const cleanup = () => {
      window.clearTimeout(startWatchdog);
      window.clearTimeout(failureWatchdog);
    };

    utterance.onstart = () => {
      started = true;
      cleanup();
      settle(resolve);
    };

    utterance.onerror = (event) => {
      cleanup();
      settle(() =>
        reject(
          new Error(
            event.error
              ? `Speech synthesis error: ${event.error}.`
              : "Speech synthesis failed.",
          ),
        ),
      );
    };

    stopCurrentAudio();
    synth.cancel();
    synth.speak(utterance);

    if (synth.paused) {
      synth.resume();
    }
  });
}

const browserTtsProvider: PronunciationProvider = {
  name: "browser-tts",
  async speak(input) {
    const synth = getSpeechSynthesis();

    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      return {
        provider: "none",
        reason: "SpeechSynthesis is unavailable in this browser.",
        status: "unavailable",
      };
    }

    const locale = input.locale ?? "bn-BD";
    const voice = await getBestVoice(locale);
    const text = resolveTtsText(input);
    const isBengali = isBengaliLocale(locale);
    const hasLocaleVoice = voiceMatchesLocale(voice, locale);

    if (!text) {
      return {
        provider: "none",
        reason:
          "No Bengali script was provided, so the app skipped romanized Bengali TTS to avoid English-style pronunciation.",
        status: "unavailable",
      };
    }

    const fallbackLang = isBengali ? "bn-BD" : locale;
    const settings = getSpeechSettings(locale);
    const fallbackUsed = !hasLocaleVoice;
    const utteranceLang = voice?.lang ?? fallbackLang;

    const buildUtterance = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = utteranceLang;
      utterance.voice = voice;
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;
      return utterance;
    };

    // Warm the engine, then try to speak. The first attempt after page load can
    // silently fail to start; if it does, reset and retry once so the user's
    // single click is enough (instead of "unavailable, then works on click 2").
    await warmUpSpeech();

    let spoke = false;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2 && !spoke; attempt += 1) {
      try {
        await speakUtterance(synth, buildUtterance());
        spoke = true;
      } catch (error) {
        lastError = error;
        synth.cancel();

        if (synth.paused) {
          synth.resume();
        }

        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }

    if (!spoke) {
      return {
        provider: "none",
        reason:
          lastError instanceof Error
            ? lastError.message
            : "Speech synthesis failed in this browser.",
        status: "unavailable",
      };
    }

    return {
      fallbackUsed,
      lang: utteranceLang,
      message: createVoiceMessage({
        fallbackUsed,
        lang: utteranceLang,
        locale,
        voice,
      }),
      provider: "browser-tts",
      status: "played",
      voiceName: voice?.name ?? null,
    };
  },
};

export async function playPronunciation(
  input: PronunciationInput,
): Promise<PronunciationResult> {
  if (getRecordedAudioSource(input)) {
    const audioResult = await recordedAudioProvider.speak(input);

    if (audioResult.status === "played") {
      debugPronunciation(input, audioResult);
      return audioResult;
    }

    debugPronunciation(input, audioResult);
  }

  const ttsResult = await browserTtsProvider.speak(input);
  debugPronunciation(input, ttsResult);
  return ttsResult;
}

export function stopPronunciation() {
  stopCurrentAudio();
  stopCurrentSpeech();
}

export async function getPronunciationDiagnostics(locale = "bn-BD") {
  const synth = getSpeechSynthesis();
  const voices = await getAvailableVoicesForLocale(locale);
  const bestVoice = await getBestVoice(locale);

  return {
    bestVoice: bestVoice
      ? {
          lang: bestVoice.lang,
          localService: bestVoice.localService,
          name: bestVoice.name,
        }
      : null,
    browserHasSpeechSynthesis: Boolean(synth),
    locale,
    voiceCount: voices.length,
    voices: voices.slice(0, 12).map((item) => ({
      lang: item.lang,
      localService: item.voice.localService,
      name: item.name,
      score: item.score,
    })),
  };
}

if (typeof window !== "undefined") {
  window.learnBengaliPronunciation = {
    diagnose: async (locale = "bn-BD") => {
      const diagnostics = await getPronunciationDiagnostics(locale);
      console.info("[Pronunciation] Diagnostics", diagnostics);
      return diagnostics;
    },
    getBestVoice: async (locale = "bn-BD") => {
      const voice = await getBestVoice(locale);
      const summary = voice
        ? { lang: voice.lang, localService: voice.localService, name: voice.name }
        : null;

      console.info("[Pronunciation] Best voice", summary);
      return summary;
    },
    listVoices: debugAvailableVoicesForLocale,
    speak: (script: string, romanized = script) =>
      playPronunciation({ debug: true, locale: "bn-BD", romanized, script }),
    speakPhrase: (input: PronunciationInput) =>
      playPronunciation({ ...input, debug: input.debug ?? true }),
  };
}

declare global {
  interface Window {
    learnBengaliPronunciation?: {
      diagnose: (locale?: string) => Promise<{
        bestVoice: {
          lang: string;
          localService: boolean;
          name: string;
        } | null;
        browserHasSpeechSynthesis: boolean;
        locale: string;
        voiceCount: number;
        voices: Array<{
          lang: string;
          localService: boolean;
          name: string;
          score: number;
        }>;
      }>;
      getBestVoice: (locale?: string) => Promise<{
        lang: string;
        localService: boolean;
        name: string;
      } | null>;
      listVoices: (locale?: string) => Promise<
        Array<{
          lang: string;
          localService: boolean;
          name: string;
          score: number;
        }>
      >;
      speak: (script: string, romanized?: string) => Promise<PronunciationResult>;
      speakPhrase: (input: PronunciationInput) => Promise<PronunciationResult>;
    };
  }
}
