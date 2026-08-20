/**
 * The spaced-repetition policy — one source of truth for how phrase memory
 * ages, when an item is due, and what counts as "known".
 *
 * Previously the Leitner ladder lived inline in the progress store while the
 * lesson content declared its own `reviewSchedule.initialReviewDays`, and the
 * two had drifted apart. This module is now authoritative; the content field is
 * descriptive metadata, and `scripts/review-policy.test.ts` asserts the two
 * still agree.
 */

import type { PhraseMemory } from "@/types/learning";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days until an item comes back, per Leitner box. Box 0 is due immediately;
 * boxes 1-5 mirror the `initialReviewDays` ladder the curricula declare.
 */
export const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;

/** The ladder a correct answer climbs (box 0 is "due now", not a rung). */
export const INITIAL_REVIEW_DAYS = REVIEW_INTERVAL_DAYS.slice(1);

export const MAX_BOX = REVIEW_INTERVAL_DAYS.length - 1;

/** At or above this box an item counts as "strong" — a long interval survived. */
export const MASTERY_BOX = 4;

/** Box a placement test seeds skipped-over phrases into: known, not yet proven. */
export const PLACEMENT_BOX = 2;

/** Where a phrase sits on the 0-1 strength scale. */
export function memoryStrength(memory: PhraseMemory): number {
  return Math.min(1, Math.max(0, memory.box / MAX_BOX));
}

export function isMastered(memory: PhraseMemory): boolean {
  return memory.box >= MASTERY_BOX;
}

/** The box an answer moves a phrase to. Correct promotes, a miss demotes. */
export function nextBox(previousBox: number, isCorrect: boolean): number {
  const current = Number.isFinite(previousBox) ? previousBox : 0;

  return isCorrect
    ? Math.min(current + 1, MAX_BOX)
    : Math.max(current - 1, 0);
}

/**
 * The memory record after answering. A miss makes the phrase due immediately so
 * it comes back in the next practice session.
 */
export function applyResult(
  previous: PhraseMemory | undefined,
  isCorrect: boolean,
  now = Date.now(),
): PhraseMemory {
  const box = nextBox(previous?.box ?? 0, isCorrect);
  const intervalDays = isCorrect ? REVIEW_INTERVAL_DAYS[box] : 0;

  return {
    box,
    dueAt: new Date(now + intervalDays * DAY_MS).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  };
}

/** A memory record for a phrase the learner is assumed to already know. */
export function seedKnownMemory(now = Date.now()): PhraseMemory {
  return {
    box: PLACEMENT_BOX,
    dueAt: new Date(
      now + REVIEW_INTERVAL_DAYS[PLACEMENT_BOX] * DAY_MS,
    ).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  };
}

export function isDue(memory: PhraseMemory, now = Date.now()): boolean {
  return new Date(memory.dueAt).getTime() <= now;
}

/** Weakest first: lowest box, then least recently seen. */
export function compareByWeakness(a: PhraseMemory, b: PhraseMemory): number {
  return (
    a.box - b.box ||
    new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime()
  );
}

export type MemoryEntries = Record<string, PhraseMemory>;

/**
 * Phrase ids worth practicing, weakest first. Prefers items that are actually
 * due; if nothing is due it falls back to the weakest ones so a practice
 * session is always available rather than a dead end.
 */
export function selectReviewPhraseIds(
  memory: MemoryEntries,
  limit = 12,
  now = Date.now(),
): string[] {
  const entries = Object.entries(memory ?? {});

  if (entries.length === 0) {
    return [];
  }

  const due = entries.filter(([, item]) => isDue(item, now));
  const pool = due.length > 0 ? due : entries;

  return pool
    .sort(([, a], [, b]) => compareByWeakness(a, b))
    .slice(0, limit)
    .map(([phraseId]) => phraseId);
}

export function countDue(memory: MemoryEntries, now = Date.now()): number {
  return Object.values(memory ?? {}).filter((item) => isDue(item, now)).length;
}

export type MemoryBreakdown = {
  tracked: number;
  due: number;
  strong: number;
  /** 0-100: average strength across everything the learner has met. */
  averageStrength: number;
};

/** Aggregate view of phrase memory, for the Progress screen. */
export function summarizeMemory(
  memory: MemoryEntries,
  now = Date.now(),
): MemoryBreakdown {
  const items = Object.values(memory ?? {});

  if (items.length === 0) {
    return { tracked: 0, due: 0, strong: 0, averageStrength: 0 };
  }

  const strengthTotal = items.reduce(
    (total, item) => total + memoryStrength(item),
    0,
  );

  return {
    tracked: items.length,
    due: items.filter((item) => isDue(item, now)).length,
    strong: items.filter(isMastered).length,
    averageStrength: Math.round((strengthTotal / items.length) * 100),
  };
}
