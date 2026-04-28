"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  defaultCurriculumId,
  getLessonIdsForCurriculum,
} from "@/lib/content";
import type { CurriculumId, Mistake, ProgressState } from "@/types/learning";

const STORAGE_KEY = "learn-bengali-rachel-progress";

const initialProgress: ProgressState = {
  completedLessons: [],
  encounteredPhraseIds: [],
  xp: 0,
  streak: 0,
  currentUnit: 1,
  lastPracticeDate: null,
  mistakes: [],
  skippedListening: [],
};

type ProgressStore = {
  activeCurriculumId: CurriculumId;
  byCurriculum: Record<CurriculumId, ProgressState>;
};

const initialStore: ProgressStore = {
  activeCurriculumId: defaultCurriculumId,
  byCurriculum: {
    bengali: cloneInitialProgress(),
    "spanish-peru": cloneInitialProgress(),
  },
};

const listeners = new Set<() => void>();
let progressCache = initialStore;
let hasLoadedFromStorage = false;

function cloneInitialProgress(): ProgressState {
  return {
    ...initialProgress,
    completedLessons: [],
    encounteredPhraseIds: [],
    mistakes: [],
    skippedListening: [],
  };
}

function normalizeProgress(value: unknown): ProgressState {
  const maybeProgress = value as Partial<ProgressState> | null | undefined;

  return {
    ...cloneInitialProgress(),
    ...(maybeProgress ?? {}),
    completedLessons: maybeProgress?.completedLessons ?? [],
    encounteredPhraseIds: maybeProgress?.encounteredPhraseIds ?? [],
    mistakes: maybeProgress?.mistakes ?? [],
    skippedListening: maybeProgress?.skippedListening ?? [],
  };
}

function isProgressStore(value: unknown): value is Partial<ProgressStore> {
  return Boolean(
    value &&
      typeof value === "object" &&
      "byCurriculum" in value &&
      "activeCurriculumId" in value,
  );
}

function normalizeCurriculumId(value: unknown): CurriculumId {
  return value === "spanish-peru" ? "spanish-peru" : defaultCurriculumId;
}

function normalizeStore(value: unknown): ProgressStore {
  if (isProgressStore(value)) {
    const byCurriculum = (value.byCurriculum ?? {}) as Partial<
      Record<CurriculumId, unknown>
    >;

    return {
      activeCurriculumId: normalizeCurriculumId(value.activeCurriculumId),
      byCurriculum: {
        bengali: normalizeProgress(byCurriculum.bengali),
        "spanish-peru": normalizeProgress(byCurriculum["spanish-peru"]),
      },
    };
  }

  return {
    activeCurriculumId: defaultCurriculumId,
    byCurriculum: {
      bengali: normalizeProgress(value),
      "spanish-peru": cloneInitialProgress(),
    },
  };
}

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
    progressCache = normalizeStore(JSON.parse(stored));
  } catch {
    progressCache = initialStore;
  }

  return progressCache;
}

function saveStore(nextStore: ProgressStore) {
  progressCache = nextStore;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressCache));
  }

  listeners.forEach((listener) => listener());
}

function updateStore(updater: (current: ProgressStore) => ProgressStore) {
  saveStore(updater(ensureLoaded()));
}

function updateCurriculumProgress(
  curriculumId: CurriculumId,
  updater: (current: ProgressState) => ProgressState,
) {
  updateStore((current) => ({
    ...current,
    byCurriculum: {
      ...current.byCurriculum,
      [curriculumId]: updater(current.byCurriculum[curriculumId]),
    },
  }));
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
  return initialStore;
}

export function useProgress() {
  const store = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const activeCurriculumId = store.activeCurriculumId;
  const progress = store.byCurriculum[activeCurriculumId];

  const activeMistakes = useMemo(() => {
    const currentLessonIds = getLessonIdsForCurriculum(activeCurriculumId);

    return progress.mistakes.filter(
      (mistake) =>
        !mistake.resolved && currentLessonIds.has(mistake.lessonId),
    );
  }, [activeCurriculumId, progress.mistakes]);

  const setActiveCurriculumId = useCallback(function setActiveCurriculumId(
    curriculumId: CurriculumId,
  ) {
    updateStore((current) => ({
      ...current,
      activeCurriculumId: curriculumId,
    }));
  }, []);

  const completeLesson = useCallback(function completeLesson(
    lessonId: string,
    unitNumber: number,
    correctCount: number,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
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
  }, [activeCurriculumId]);

  const recordEncounteredPhrase = useCallback(function recordEncounteredPhrase(
    phraseId: string,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
      if (current.encounteredPhraseIds.includes(phraseId)) {
        return current;
      }

      return {
        ...current,
        encounteredPhraseIds: [...current.encounteredPhraseIds, phraseId],
      };
    });
  }, [activeCurriculumId]);

  const recordMistake = useCallback(function recordMistake(
    mistake: Omit<Mistake, "id" | "createdAt" | "resolved">,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
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
  }, [activeCurriculumId]);

  const recordSkippedListening = useCallback(function recordSkippedListening(
    skipped: Omit<ProgressState["skippedListening"][number], "id" | "createdAt">,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
      const duplicate = current.skippedListening.some(
        (item) =>
          item.exerciseId === skipped.exerciseId &&
          item.lessonId === skipped.lessonId,
      );

      if (duplicate) {
        return applyPracticeDay(current);
      }

      return applyPracticeDay({
        ...current,
        skippedListening: [
          {
            ...skipped,
            id: `${skipped.exerciseId}-skipped-${Date.now()}`,
            createdAt: new Date().toISOString(),
          },
          ...current.skippedListening,
        ],
      });
    });
  }, [activeCurriculumId]);

  const resolveMistake = useCallback(function resolveMistake(mistakeId: string) {
    updateCurriculumProgress(activeCurriculumId, (current) =>
      applyPracticeDay({
        ...current,
        xp: current.xp + 5,
        mistakes: current.mistakes.map((mistake) =>
          mistake.id === mistakeId ? { ...mistake, resolved: true } : mistake,
        ),
      }),
    );
  }, [activeCurriculumId]);

  const resetProgress = useCallback(function resetProgress() {
    updateCurriculumProgress(activeCurriculumId, () => cloneInitialProgress());
  }, [activeCurriculumId]);

  return {
    activeCurriculumId,
    activeMistakes,
    completeLesson,
    progress,
    recordEncounteredPhrase,
    recordMistake,
    recordSkippedListening,
    resetProgress,
    resolveMistake,
    setActiveCurriculumId,
    store,
  };
}
