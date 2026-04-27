"use client";

export type PronunciationInput = {
  audioUrl?: string;
  debug?: boolean;
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
  score: number;
  voice: SpeechSynthesisVoice;
};

const preferredVoiceHints = [
  "google বাংলা",
  "google bengali",
  "microsoft bangla",
  "microsoft bengali",
  "bangla",
  "bengali",
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

function debugPronunciation(input: PronunciationInput, result: PronunciationResult) {
  if (!input.debug) {
    return;
  }

  console.info("[Pronunciation]", {
    audioUrl: input.audioUrl ?? null,
    provider: result.provider,
    result,
    romanized: input.romanized,
    script: input.script ?? null,
  });
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

function rankVoice(voice: SpeechSynthesisVoice): RankedVoice {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  const haystack = `${lang} ${name}`;
  let score = 0;

  if (lang === "bn-bd") {
    score += 120;
  } else if (lang === "bn-in") {
    score += 110;
  } else if (lang.startsWith("bn")) {
    score += 100;
  }

  const hintIndex = preferredVoiceHints.findIndex((hint) =>
    haystack.includes(hint),
  );

  if (hintIndex >= 0) {
    score += 30 - hintIndex;
  }

  if (voice.localService) {
    score += 2;
  }

  return { lang: voice.lang, score, voice };
}

export async function getAvailablePronunciationVoices() {
  return (await getVoices())
    .map(rankVoice)
    .sort((left, right) => right.score - left.score);
}

export async function getBestBengaliVoice() {
  const voices = await getAvailablePronunciationVoices();
  return voices.find((item) => item.score >= 100)?.voice ?? null;
}

async function debugAvailableVoices() {
  const voices = await getAvailablePronunciationVoices();
  const rows = voices.map((item) => ({
    lang: item.voice.lang,
    localService: item.voice.localService,
    name: item.voice.name,
    score: item.score,
  }));

  console.table(rows);
  return rows;
}

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
      const audio = new Audio(input.audioUrl);
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

    const voice = await getBestBengaliVoice();
    const text = input.script && hasBengaliScript(input.script)
      ? input.script
      : input.romanized;
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = voice?.lang ?? "bn-BD";
    utterance.voice = voice;
    utterance.rate = voice ? 0.68 : 0.62;
    utterance.pitch = 0.96;
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
    listVoices: debugAvailableVoices,
    speak: (script: string, romanized = script) =>
      playPronunciation({ debug: true, romanized, script }),
  };
}

declare global {
  interface Window {
    learnBengaliPronunciation?: {
      listVoices: () => Promise<
        Array<{
          lang: string;
          localService: boolean;
          name: string;
          score: number;
        }>
      >;
      speak: (script: string, romanized?: string) => Promise<PronunciationResult>;
    };
  }
}
