"use client";

export const soundEffectsEnabled = true;

type SoundKind = "correct" | "streak" | "complete";

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playTone(frequency: number, start: number, duration: number, gain = 0.04) {
  const context = getAudioContext();

  if (!context || !soundEffectsEnabled) {
    return;
  }

  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  volume.gain.setValueAtTime(0, context.currentTime + start);
  volume.gain.linearRampToValueAtTime(gain, context.currentTime + start + 0.015);
  volume.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + start + duration,
  );

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration);
}

export function playFeedbackSound(kind: SoundKind) {
  if (!soundEffectsEnabled) {
    return;
  }

  if (kind === "correct") {
    playTone(523.25, 0, 0.12);
    playTone(659.25, 0.08, 0.14);
  }

  if (kind === "streak") {
    playTone(523.25, 0, 0.1);
    playTone(659.25, 0.08, 0.12);
    playTone(783.99, 0.16, 0.16);
  }

  if (kind === "complete") {
    playTone(523.25, 0, 0.1);
    playTone(659.25, 0.09, 0.1);
    playTone(783.99, 0.18, 0.14);
    playTone(1046.5, 0.3, 0.18);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
