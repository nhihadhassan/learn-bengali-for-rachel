"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  defaultCurriculumId,
  getLessonIdsForCurriculum,
} from "@/lib/content";
import type { CurriculumId, Mistake, ProgressState } from "@/types/learning";

const STORAGE_KEY = "learn-bengali-rachel-progress";

const DAY_MS = 24 * 60 * 60 * 1000;
// Spaced-repetition interval (in days) per Leitner box. Box 0 = due now.
const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 16, 35];
const MAX_BOX = REVIEW_INTERVAL_DAYS.length - 1;

/**
 * Phrase ids worth reviewing, weakest first. Prefers items that are actually
 * due; if nothing is due it falls back to the weakest/least-recently-seen so a
 * practice session is still available.
 */
export function getReviewPhraseIds(
  progress: ProgressState,
  limit = 12,
  now = Date.now(),
): string[] {
  const entries = Object.entries(progress.phraseMemory ?? {});

  if (entries.length === 0) {
    return [];
  }

  const due = entries.filter(
    ([, memory]) => new Date(memory.dueAt).getTime() <= now,
  );
  const pool = due.length > 0 ? due : entries;

  return pool
    .sort(
      ([, a], [, b]) =>
        a.box - b.box ||
        new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime(),
    )
    .slice(0, limit)
    .map(([phraseId]) => phraseId);
}

export function countDuePhrases(
  progress: ProgressState,
  now = Date.now(),
): number {
  return Object.values(progress.phraseMemory ?? {}).filter(
    (memory) => new Date(memory.dueAt).getTime() <= now,
  ).length;
}

const initialProgress: ProgressState = {
  completedLessons: [],
  encounteredPhraseIds: [],
  xp: 0,
  gems: 0,
  streak: 0,
  streakRestoreAvailable: false,
  lastStreakBeforeMiss: 0,
  currentUnit: 1,
  lastPracticeDate: null,
  lastLessonId: null,
  lastStepIndex: 0,
  lastActiveAt: null,
  mistakes: [],
  skippedListening: [],
  phraseMemory: {},
};

type ProgressStore = {
  activeCurriculumId: CurriculumId;
  byCurriculum: Record<CurriculumId, ProgressState>;
};

const initialStore: ProgressStore = {
  activeCurriculumId: defaultCurriculumId,
  byCurriculum: {
    bengali: cloneInitialProgress(),
    history: cloneInitialProgress(),
    malayalam: cloneInitialProgress(),
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
    phraseMemory: {},
  };
}

function normalizeProgress(value: unknown): ProgressState {
  const maybeProgress = value as Partial<ProgressState> | null | undefined;

  return {
    ...cloneInitialProgress(),
    ...(maybeProgress ?? {}),
    completedLessons: maybeProgress?.completedLessons ?? [],
    encounteredPhraseIds: maybeProgress?.encounteredPhraseIds ?? [],
    gems: maybeProgress?.gems ?? 0,
    streakRestoreAvailable: maybeProgress?.streakRestoreAvailable ?? false,
    lastStreakBeforeMiss: maybeProgress?.lastStreakBeforeMiss ?? 0,
    lastLessonId: maybeProgress?.lastLessonId ?? null,
    lastStepIndex: maybeProgress?.lastStepIndex ?? 0,
    lastActiveAt: maybeProgress?.lastActiveAt ?? null,
    mistakes: maybeProgress?.mistakes ?? [],
    skippedListening: maybeProgress?.skippedListening ?? [],
    phraseMemory: maybeProgress?.phraseMemory ?? {},
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
  if (value === "history") {
    return "history";
  }

  if (value === "malayalam") {
    return "malayalam";
  }

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
        history: normalizeProgress(byCurriculum.history),
        malayalam: normalizeProgress(byCurriculum.malayalam),
        "spanish-peru": normalizeProgress(byCurriculum["spanish-peru"]),
      },
    };
  }

  return {
    activeCurriculumId: defaultCurriculumId,
    byCurriculum: {
      bengali: normalizeProgress(value),
      history: cloneInitialProgress(),
      malayalam: cloneInitialProgress(),
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
      [curriculumId]: updater(
        current.byCurriculum[curriculumId] ?? cloneInitialProgress(),
      ),
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
  const missedWithStreak =
    Boolean(progress.lastPracticeDate) &&
    progress.lastPracticeDate !== yesterdayKey() &&
    progress.streak > 0;

  return {
    ...progress,
    streak,
    streakRestoreAvailable: missedWithStreak
      ? true
      : progress.streakRestoreAvailable,
    lastStreakBeforeMiss: missedWithStreak
      ? progress.streak
      : progress.lastStreakBeforeMiss,
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
  const progress =
    store.byCurriculum[activeCurriculumId] ?? cloneInitialProgress();

  const activeMistakes = useMemo(() => {
    const currentLessonIds = getLessonIdsForCurriculum(activeCurriculumId);
    const frequency = new Map<string, number>();

    progress.mistakes.forEach((mistake) => {
      if (!mistake.resolved && currentLessonIds.has(mistake.lessonId)) {
        frequency.set(
          mistake.exerciseId,
          (frequency.get(mistake.exerciseId) ?? 0) + 1,
        );
      }
    });

    return progress.mistakes
      .filter(
        (mistake) =>
          !mistake.resolved && currentLessonIds.has(mistake.lessonId),
      )
      .sort((first, second) => {
        const frequencyDelta =
          (frequency.get(second.exerciseId) ?? 0) -
          (frequency.get(first.exerciseId) ?? 0);

        if (frequencyDelta !== 0) {
          return frequencyDelta;
        }

        return (
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
        );
      });
  }, [activeCurriculumId, progress.mistakes]);

  const activeSkippedListening = useMemo(() => {
    const currentLessonIds = getLessonIdsForCurriculum(activeCurriculumId);

    return progress.skippedListening
      .filter((skipped) => currentLessonIds.has(skipped.lessonId))
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
  }, [activeCurriculumId, progress.skippedListening]);

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
      const earnedGems = isNewCompletion ? 25 : 0;

      return {
        ...practiced,
        completedLessons: isNewCompletion
            ? [...practiced.completedLessons, lessonId]
            : practiced.completedLessons,
        xp: practiced.xp + earnedXp,
        gems: practiced.gems + earnedGems,
        currentUnit: Math.max(practiced.currentUnit, unitNumber),
        lastLessonId: lessonId,
        lastStepIndex: 0,
        lastActiveAt: new Date().toISOString(),
      };
    });
  }, [activeCurriculumId]);

  const recordLessonPosition = useCallback(function recordLessonPosition(
    lessonId: string,
    stepIndex: number,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => ({
      ...current,
      lastLessonId: lessonId,
      lastStepIndex: Math.max(0, stepIndex),
      lastActiveAt: new Date().toISOString(),
    }));
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

  const resolveSkippedListening = useCallback(function resolveSkippedListening(
    skippedId: string,
  ) {
    updateCurriculumProgress(activeCurriculumId, (current) =>
      applyPracticeDay({
        ...current,
        skippedListening: current.skippedListening.filter(
          (skipped) => skipped.id !== skippedId,
        ),
      }),
    );
  }, [activeCurriculumId]);

  // Spaced repetition: promote a phrase's Leitner box on a correct answer (and
  // push its next-due date out), or demote it and make it due now on a miss.
  const recordPhraseResult = useCallback(function recordPhraseResult(
    phraseId: string,
    isCorrect: boolean,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
      const now = Date.now();
      const previousBox = current.phraseMemory[phraseId]?.box ?? 0;
      const box = isCorrect
        ? Math.min(previousBox + 1, MAX_BOX)
        : Math.max(previousBox - 1, 0);
      const intervalDays = isCorrect ? REVIEW_INTERVAL_DAYS[box] : 0;

      return {
        ...current,
        phraseMemory: {
          ...current.phraseMemory,
          [phraseId]: {
            box,
            dueAt: new Date(now + intervalDays * DAY_MS).toISOString(),
            lastSeenAt: new Date(now).toISOString(),
          },
        },
      };
    });
  }, [activeCurriculumId]);

  // Finishing a practice/review session earns XP and counts toward the daily
  // streak, but does not mark any lesson complete.
  const completeReview = useCallback(function completeReview(
    xpEarned: number,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) =>
      applyPracticeDay({
        ...current,
        xp: current.xp + Math.max(0, xpEarned),
        lastActiveAt: new Date().toISOString(),
      }),
    );
  }, [activeCurriculumId]);

  const reviewPhraseIds = useMemo(
    () => getReviewPhraseIds(progress),
    [progress],
  );

  const duePhraseCount = useMemo(
    () => countDuePhrases(progress),
    [progress],
  );

  const resetProgress = useCallback(function resetProgress() {
    updateCurriculumProgress(activeCurriculumId, () => cloneInitialProgress());
  }, [activeCurriculumId]);

  const restoreStreak = useCallback(function restoreStreak() {
    let restored = false;

    updateCurriculumProgress(activeCurriculumId, (current) => {
      if (
        !current.streakRestoreAvailable ||
        current.gems < 400 ||
        current.lastStreakBeforeMiss <= 0
      ) {
        return current;
      }

      restored = true;

      return {
        ...current,
        gems: current.gems - 400,
        streak: Math.max(current.streak, current.lastStreakBeforeMiss + 1),
        streakRestoreAvailable: false,
        lastStreakBeforeMiss: 0,
      };
    });

    return restored;
  }, [activeCurriculumId]);

  return {
    activeCurriculumId,
    activeMistakes,
    activeSkippedListening,
    completeLesson,
    completeReview,
    duePhraseCount,
    progress,
    recordEncounteredPhrase,
    recordLessonPosition,
    recordMistake,
    recordPhraseResult,
    recordSkippedListening,
    resetProgress,
    restoreStreak,
    resolveMistake,
    resolveSkippedListening,
    reviewPhraseIds,
    setActiveCurriculumId,
    store,
  };
}
