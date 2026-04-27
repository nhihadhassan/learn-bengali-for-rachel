"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Mistake, ProgressState } from "@/types/learning";

const STORAGE_KEY = "learn-bengali-rachel-progress";

const initialProgress: ProgressState = {
  completedLessons: [],
  encounteredPhraseIds: [],
  xp: 0,
  streak: 0,
  currentUnit: 1,
  lastPracticeDate: null,
  mistakes: [],
};

const listeners = new Set<() => void>();
let progressCache = initialProgress;
let hasLoadedFromStorage = false;

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return todayKey(date);
}

function ensureLoaded() {
  if (hasLoadedFromStorage || typeof window === "undefined") {
    return progressCache;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  hasLoadedFromStorage = true;

  if (!stored) {
    return progressCache;
  }

  try {
    progressCache = { ...initialProgress, ...JSON.parse(stored) };
  } catch {
    progressCache = initialProgress;
  }

  return progressCache;
}

function saveProgress(nextProgress: ProgressState) {
  progressCache = nextProgress;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressCache));
  }

  listeners.forEach((listener) => listener());
}

function updateProgress(updater: (current: ProgressState) => ProgressState) {
  saveProgress(updater(ensureLoaded()));
}

function applyPracticeDay(progress: ProgressState): ProgressState {
  const today = todayKey();

  if (progress.lastPracticeDate === today) {
    return progress;
  }

  const streak =
    progress.lastPracticeDate === yesterdayKey() ? progress.streak + 1 : 1;

  return {
    ...progress,
    streak,
    lastPracticeDate: today,
  };
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getClientSnapshot() {
  return ensureLoaded();
}

function getServerSnapshot() {
  return initialProgress;
}

export function useProgress() {
  const progress = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const activeMistakes = useMemo(
    () => progress.mistakes.filter((mistake) => !mistake.resolved),
    [progress.mistakes],
  );

  const completeLesson = useCallback(function completeLesson(
    lessonId: string,
    unitNumber: number,
    correctCount: number,
  ) {
    updateProgress((current) => {
      const practiced = applyPracticeDay(current);
      const isNewCompletion = !practiced.completedLessons.includes(lessonId);
      const earnedXp = 10 + correctCount * 5;

      return {
        ...practiced,
        completedLessons: isNewCompletion
          ? [...practiced.completedLessons, lessonId]
          : practiced.completedLessons,
        xp: practiced.xp + earnedXp,
        currentUnit: Math.max(practiced.currentUnit, unitNumber),
      };
    });
  }, []);

  const recordEncounteredPhrase = useCallback(function recordEncounteredPhrase(
    phraseId: string,
  ) {
    updateProgress((current) => {
      if (current.encounteredPhraseIds.includes(phraseId)) {
        return current;
      }

      return {
        ...current,
        encounteredPhraseIds: [...current.encounteredPhraseIds, phraseId],
      };
    });
  }, []);

  const recordMistake = useCallback(function recordMistake(
    mistake: Omit<Mistake, "id" | "createdAt" | "resolved">,
  ) {
    updateProgress((current) => {
      const duplicate = current.mistakes.some(
        (item) =>
          !item.resolved &&
          item.exerciseId === mistake.exerciseId &&
          item.wrongAnswer === mistake.wrongAnswer,
      );

      if (duplicate) {
        return applyPracticeDay(current);
      }

      return applyPracticeDay({
        ...current,
        mistakes: [
          {
            ...mistake,
            id: `${mistake.exerciseId}-${Date.now()}`,
            createdAt: new Date().toISOString(),
            resolved: false,
          },
          ...current.mistakes,
        ],
      });
    });
  }, []);

  const resolveMistake = useCallback(function resolveMistake(mistakeId: string) {
    updateProgress((current) =>
      applyPracticeDay({
        ...current,
        xp: current.xp + 5,
        mistakes: current.mistakes.map((mistake) =>
          mistake.id === mistakeId ? { ...mistake, resolved: true } : mistake,
        ),
      }),
    );
  }, []);

  const resetProgress = useCallback(function resetProgress() {
    saveProgress(initialProgress);
  }, []);

  return {
    activeMistakes,
    completeLesson,
    progress,
    recordEncounteredPhrase,
    recordMistake,
    resetProgress,
    resolveMistake,
  };
}
