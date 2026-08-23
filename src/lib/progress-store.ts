"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getCourseLessonIds } from "@/lib/course-index";
import {
  COURSE_IDS,
  defaultCourseId,
  isCourseId,
  mapCourses,
  toCourseId,
} from "@/lib/courses";
import { localDayKey, relateDayKey } from "@/lib/date-keys";
import {
  applyResult,
  countDue,
  seedKnownMemory,
  selectReviewPhraseIds,
  summarizeMemory,
} from "@/lib/review-policy";
import type { CurriculumId, Mistake, ProgressState } from "@/types/learning";

/**
 * Legacy storage key — the app was Bengali-only when it was chosen. Renaming it
 * would silently wipe every learner's progress, so it stays.
 */
const STORAGE_KEY = "learn-bengali-rachel-progress";

/**
 * Phrase ids worth reviewing, weakest first.
 *
 * @deprecated prefer `selectReviewPhraseIds` from `@/lib/review-policy`; kept
 * as a thin wrapper so existing callers keep working.
 */
export function getReviewPhraseIds(
  progress: ProgressState,
  limit = 12,
  now = Date.now(),
): string[] {
  return selectReviewPhraseIds(progress.phraseMemory ?? {}, limit, now);
}

export function countDuePhrases(
  progress: ProgressState,
  now = Date.now(),
): number {
  return countDue(progress.phraseMemory ?? {}, now);
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
  conceptMemory: {},
  practiceDays: [],
  answeredTotal: 0,
  answeredCorrect: 0,
};

type ProgressStore = {
  activeCurriculumId: CurriculumId;
  byCurriculum: Record<CurriculumId, ProgressState>;
};

function createInitialStore(): ProgressStore {
  return {
    activeCurriculumId: defaultCourseId,
    byCurriculum: mapCourses(cloneInitialProgress),
  };
}

const listeners = new Set<() => void>();
let progressCache = createInitialStore();
let hasLoadedFromStorage = false;

function cloneInitialProgress(): ProgressState {
  return {
    ...initialProgress,
    completedLessons: [],
    encounteredPhraseIds: [],
    mistakes: [],
    skippedListening: [],
    phraseMemory: {},
    conceptMemory: {},
    practiceDays: [],
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
    conceptMemory: maybeProgress?.conceptMemory ?? {},
    practiceDays: maybeProgress?.practiceDays ?? [],
    answeredTotal: maybeProgress?.answeredTotal ?? 0,
    answeredCorrect: maybeProgress?.answeredCorrect ?? 0,
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

/**
 * Restore a saved store.
 *
 * Two shapes are supported forever: the current per-course store, and the
 * original Bengali-only `ProgressState` that predates course switching (which
 * becomes the Bengali bucket). Buckets for course ids we don't recognise are
 * carried through untouched rather than dropped, so a course that is
 * temporarily unregistered doesn't cost a learner their history.
 */
export function normalizeStore(value: unknown): ProgressStore {
  if (isProgressStore(value)) {
    const byCurriculum = (value.byCurriculum ?? {}) as Record<string, unknown>;
    const known = mapCourses((courseId) =>
      normalizeProgress(byCurriculum[courseId]),
    );
    const unknownBuckets = Object.fromEntries(
      Object.entries(byCurriculum).filter(([key]) => !isCourseId(key)),
    );

    return {
      activeCurriculumId: toCourseId(value.activeCurriculumId),
      byCurriculum: { ...unknownBuckets, ...known } as Record<
        CurriculumId,
        ProgressState
      >,
    };
  }

  const store = createInitialStore();

  if (value && typeof value === "object") {
    store.byCurriculum[defaultCourseId] = normalizeProgress(value);
  }

  return store;
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
    progressCache = createInitialStore();
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

/**
 * Mark today as practiced and roll the streak forward.
 *
 * Day keys are the learner's **local** calendar day (see `@/lib/date-keys`).
 * A stored key in the future is treated as "already practiced today": that only
 * happens for progress saved under the old UTC-based keys, and resetting those
 * learners' streaks to 1 would be a worse outcome than an extra grace day.
 */
export function applyPracticeDay(
  progress: ProgressState,
  today = localDayKey(),
): ProgressState {
  const relation = relateDayKey(progress.lastPracticeDate, today);

  if (relation === "today" || relation === "future") {
    return progress;
  }

  const continuesStreak = relation === "yesterday";
  const missedWithStreak = relation === "older" && progress.streak > 0;

  return {
    ...progress,
    streak: continuesStreak ? progress.streak + 1 : 1,
    streakRestoreAvailable: missedWithStreak
      ? true
      : progress.streakRestoreAvailable,
    lastStreakBeforeMiss: missedWithStreak
      ? progress.streak
      : progress.lastStreakBeforeMiss,
    lastPracticeDate: today,
    practiceDays: appendPracticeDay(progress.practiceDays, today),
  };
}

/** Keep a rolling window of practice days; enough for any activity view. */
const PRACTICE_DAY_HISTORY = 120;

function appendPracticeDay(days: string[] | undefined, today: string): string[] {
  const existing = days ?? [];

  if (existing.includes(today)) {
    return existing;
  }

  return [...existing, today].slice(-PRACTICE_DAY_HISTORY);
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

const serverStore = createInitialStore();

function getServerSnapshot() {
  return serverStore;
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
    const currentLessonIds = getCourseLessonIds(activeCurriculumId);
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
    const currentLessonIds = getCourseLessonIds(activeCurriculumId);

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
      activeCurriculumId: toCourseId(curriculumId),
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

  /**
   * Count a graded answer. Separate from phrase memory because not every graded
   * step maps to a phrase, and Progress needs a true denominator for accuracy.
   */
  const recordAnswer = useCallback(function recordAnswer(
    isCorrect: boolean,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => ({
      ...current,
      answeredTotal: current.answeredTotal + 1,
      answeredCorrect: current.answeredCorrect + (isCorrect ? 1 : 0),
    }));
  }, [activeCurriculumId]);

  // Spaced repetition: the schedule itself lives in @/lib/review-policy so the
  // Leitner ladder has exactly one definition.
  /**
   * `produced` marks answers the learner had to *make* the Spanish for, rather
   * than pick the meaning of. The Leitner box already says how well an item is
   * remembered; this is the one thing it cannot say, and it is what
   * `@/lib/learning-state` uses to stop asking "what does hola mean?" forever.
   */
  const recordPhraseResult = useCallback(function recordPhraseResult(
    phraseId: string,
    isCorrect: boolean,
    curriculumId = activeCurriculumId,
    { produced = false }: { produced?: boolean } = {},
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
      const previous = current.phraseMemory[phraseId];
      const next = applyResult(previous, isCorrect);
      const productions = previous?.produced ?? 0;

      return {
        ...current,
        phraseMemory: {
          ...current.phraseMemory,
          [phraseId]:
            produced && isCorrect
              ? { ...next, produced: productions + 1 }
              : productions > 0
                ? { ...next, produced: productions }
                : next,
        },
      };
    });
  }, [activeCurriculumId]);

  /**
   * Count an answer against the grammar concepts the question exercised.
   *
   * Separate from `recordPhraseResult` because a concept is not a phrase: the
   * same "adjective agreement" skill shows up across dozens of sentences, and
   * what matters is the running accuracy, not a review interval.
   */
  const recordConceptResult = useCallback(function recordConceptResult(
    conceptIds: readonly string[],
    isCorrect: boolean,
    curriculumId = activeCurriculumId,
  ) {
    if (conceptIds.length === 0) {
      return;
    }

    updateCurriculumProgress(curriculumId, (current) => {
      const conceptMemory = { ...current.conceptMemory };
      const now = new Date().toISOString();

      for (const conceptId of conceptIds) {
        const previous = conceptMemory[conceptId];

        conceptMemory[conceptId] = {
          correct: (previous?.correct ?? 0) + (isCorrect ? 1 : 0),
          total: (previous?.total ?? 0) + 1,
          lastSeenAt: now,
        };
      }

      return { ...current, conceptMemory };
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

  // Placement: open the path at an estimated unit by marking every lesson in
  // earlier units complete and seeding their phrases into spaced-repetition
  // memory. Additive and reversible — nothing is hidden or deleted.
  const applyPlacement = useCallback(function applyPlacement(
    estimatedUnitNumber: number,
    phrasesByUnitNumber: Map<number, { lessonIds: string[]; phraseIds: string[] }>,
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, (current) => {
      const completed = new Set(current.completedLessons);
      const phraseMemory = { ...current.phraseMemory };

      phrasesByUnitNumber.forEach((unit, unitNumber) => {
        if (unitNumber >= estimatedUnitNumber) {
          return;
        }

        unit.lessonIds.forEach((lessonId) => completed.add(lessonId));
        unit.phraseIds.forEach((phraseId) => {
          phraseMemory[phraseId] ??= seedKnownMemory();
        });
      });

      return applyPracticeDay({
        ...current,
        completedLessons: [...completed],
        phraseMemory,
        currentUnit: Math.max(current.currentUnit, estimatedUnitNumber),
        xp: current.xp + 20,
        lastActiveAt: new Date().toISOString(),
      });
    });
  }, [activeCurriculumId]);

  const reviewPhraseIds = useMemo(
    () => selectReviewPhraseIds(progress.phraseMemory),
    [progress.phraseMemory],
  );

  const duePhraseCount = useMemo(
    () => countDue(progress.phraseMemory),
    [progress.phraseMemory],
  );

  const memorySummary = useMemo(
    () => summarizeMemory(progress.phraseMemory),
    [progress.phraseMemory],
  );

  /** Wipe this course's progress. Destructive — always confirm first. */
  const resetProgress = useCallback(function resetProgress(
    curriculumId = activeCurriculumId,
  ) {
    updateCurriculumProgress(curriculumId, () => cloneInitialProgress());
  }, [activeCurriculumId]);

  /** Wipe every course. Destructive — always confirm first. */
  const resetAllProgress = useCallback(function resetAllProgress() {
    updateStore((current) => ({
      ...current,
      byCurriculum: mapCourses(cloneInitialProgress),
    }));
  }, []);

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
    applyPlacement,
    completeLesson,
    completeReview,
    duePhraseCount,
    memorySummary,
    progress,
    recordAnswer,
    recordConceptResult,
    recordEncounteredPhrase,
    recordLessonPosition,
    recordMistake,
    recordPhraseResult,
    recordSkippedListening,
    resetAllProgress,
    resetProgress,
    restoreStreak,
    resolveMistake,
    resolveSkippedListening,
    reviewPhraseIds,
    setActiveCurriculumId,
    store,
  };
}

/** Every registered course id, for callers iterating all progress buckets. */
export { COURSE_IDS };
