"use client";

export type PronunciationInput = {
  audioUrl?: string;
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
      lang: string;
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

const preferredVoiceHints = [
  "google বাংলা",
  "google bengali",
  "microsoft bangla",
  "microsoft bengali",
  "bangla",
  "bengali",
];

const spanishVoiceHints = [
  "google español",
  "google spanish",
  "microsoft sabina",
  "microsoft spanish",
  "español",
  "spanish",
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

function isBengaliLocale(locale: string) {
  return locale.toLowerCase().startsWith("bn");
}

function debugPronunciation(input: PronunciationInput, result: PronunciationResult) {
  if (!input.debug) {
    return;
  }

  console.info("[Pronunciation]", {
    audioUrl: input.audioUrl ?? null,
    provider: result.provider,
    result,
    romanized: input.romanized,
    script: input.script ?? input.bengaliScript ?? null,
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
    const timeout = window.setTimeout(() => resolve(synth.getVoices()), 700);

    synth.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(synth.getVoices());
    };
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
  } else if (lang === preferredLocale) {
    score += 120;
  } else if (isSpanish && lang === "es-pe") {
    score += 118;
  } else if (lang.startsWith(`${baseLanguage}-`)) {
    score += 110;
  } else if (lang.startsWith(baseLanguage)) {
    score += 100;
  }

  const hints = isSpanish ? spanishVoiceHints : preferredVoiceHints;
  const hintIndex = preferredVoiceHints.findIndex((hint) =>
    haystack.includes(hint),
  );
  const matchedHintIndex = hints.findIndex((hint) => haystack.includes(hint));

  if (matchedHintIndex >= 0) {
    score += 30 - matchedHintIndex;
  } else if (hintIndex >= 0) {
    score += 20 - hintIndex;
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

const recordedAudioProvider: PronunciationProvider = {
  name: "recorded-audio",
  async speak(input) {
    if (!input.audioUrl || typeof Audio === "undefined") {
      return {
        provider: "none",
        reason: "No recorded audio URL was provided.",
        status: "unavailable",
      };
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const audio = new Audio(input.audioUrl);
      currentAudio = audio;
      await audio.play();

      return {
        provider: "recorded-audio",
        status: "played",
      };
    } catch {
      return {
        provider: "none",
        reason: `Could not play recorded audio at ${input.audioUrl}.`,
        status: "unavailable",
      };
    }
  },
};

function resolveTtsText(input: PronunciationInput) {
  const locale = input.locale ?? "bn-BD";
  const script = input.script?.trim() || input.bengaliScript?.trim();

  if (isBengaliLocale(locale)) {
    return script && hasBengaliScript(script) ? script : "";
  }

  return script || input.romanized;
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

    if (!text) {
      return {
        provider: "none",
        reason:
          "No Bengali script was provided, so the app skipped romanized Bengali TTS to avoid English-style pronunciation.",
        status: "unavailable",
      };
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = voice?.lang ?? (isBengaliLocale(locale) ? "bn-BD" : locale);
    utterance.voice = voice;
    utterance.rate = locale.startsWith("es") ? 0.84 : 0.72;
    utterance.pitch = isBengaliLocale(locale) ? 0.92 : 0.98;
    utterance.volume = 1;

    synth.cancel();
    synth.speak(utterance);

    return {
      lang: utterance.lang,
      provider: "browser-tts",
      status: "played",
      voiceName: voice?.name ?? null,
    };
  },
};

export async function playPronunciation(
  input: PronunciationInput,
): Promise<PronunciationResult> {
  if (input.audioUrl) {
    const audioResult = await recordedAudioProvider.speak(input);

    if (audioResult.status === "played") {
      debugPronunciation(input, audioResult);
      return audioResult;
    }
  }

  const ttsResult = await browserTtsProvider.speak(input);
  debugPronunciation(input, ttsResult);
  return ttsResult;
}

if (typeof window !== "undefined") {
  window.learnBengaliPronunciation = {
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
