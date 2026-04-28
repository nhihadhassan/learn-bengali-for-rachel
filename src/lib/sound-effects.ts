"use client";

export const soundEffectsEnabled = true;

type SoundKind = "correct" | "streak-3" | "streak-5" | "streak-10" | "complete";

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
const activeOscillators = new Set<OscillatorNode>();

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (audioContext) {
    return audioContext;
  }

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  audioContext = AudioContextClass ? new AudioContextClass() : null;

  if (audioContext) {
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.72;
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

function stopActiveTones() {
  activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // Oscillator already stopped.
    }
  });
  activeOscillators.clear();
}

function playTone(
  frequency: number,
  start: number,
  duration: number,
  gain = 0.035,
  type: OscillatorType = "sine",
) {
  const context = getAudioContext();

  if (!context || !masterGain || !soundEffectsEnabled) {
    return;
  }

  if (context.state === "suspended") {
    void context.resume();
  }

  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const startsAt = context.currentTime + start;
  const endsAt = startsAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.01, endsAt);
  volume.gain.setValueAtTime(0.0001, startsAt);
  volume.gain.linearRampToValueAtTime(gain, startsAt + 0.018);
  volume.gain.exponentialRampToValueAtTime(0.0001, endsAt);

  oscillator.connect(volume);
  volume.connect(masterGain);
  oscillator.start(startsAt);
  oscillator.stop(endsAt);
  activeOscillators.add(oscillator);
  oscillator.addEventListener("ended", () => activeOscillators.delete(oscillator));
}

export function playFeedbackSound(kind: SoundKind) {
  if (!soundEffectsEnabled) {
    return;
  }

  stopActiveTones();

  if (kind === "correct") {
    playTone(659.25, 0, 0.09, 0.03);
    playTone(880, 0.07, 0.13, 0.034);
  }

  if (kind === "streak-3") {
    playTone(523.25, 0, 0.08, 0.032, "triangle");
    playTone(659.25, 0.07, 0.1, 0.034, "triangle");
    playTone(783.99, 0.15, 0.14, 0.036, "triangle");
  }

  if (kind === "streak-5") {
    playTone(587.33, 0, 0.08, 0.032, "triangle");
    playTone(739.99, 0.07, 0.1, 0.034, "triangle");
    playTone(987.77, 0.16, 0.16, 0.038, "triangle");
    playTone(1174.66, 0.29, 0.16, 0.032, "sine");
  }

  if (kind === "streak-10") {
    playTone(523.25, 0, 0.07, 0.03, "triangle");
    playTone(659.25, 0.06, 0.08, 0.032, "triangle");
    playTone(783.99, 0.13, 0.1, 0.034, "triangle");
    playTone(1046.5, 0.22, 0.16, 0.038, "sine");
    playTone(1318.51, 0.36, 0.2, 0.03, "sine");
  }

  if (kind === "complete") {
    playTone(523.25, 0, 0.09, 0.03, "triangle");
    playTone(659.25, 0.08, 0.1, 0.032, "triangle");
    playTone(783.99, 0.17, 0.13, 0.034, "triangle");
    playTone(1046.5, 0.3, 0.18, 0.036);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
