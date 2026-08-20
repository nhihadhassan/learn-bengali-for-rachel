/**
 * What the engine is allowed to know about the learner.
 *
 * The lesson engine used to receive only "here is the lesson". To bring old
 * material back at the right moment it needs a view of what has been met, what
 * is shaky and what is solid — but that view must not become a *second* memory
 * model. Everything here is derived from `@/lib/review-policy`, which stays the
 * one definition of boxes, intervals, due-ness and mastery. This module adds
 * exactly one thing on top: recency of mistakes, which the review policy
 * deliberately doesn't track.
 *
 * A `LearnerSnapshot` is a plain value taken once at the start of a session.
 * It must not be re-read mid-lesson — answering changes memory, and a session
 * that re-planned itself after every answer would shuffle under the learner.
 */

import {
  MASTERY_BOX,
  isDue,
  memoryStrength,
  type MemoryEntries,
} from "@/lib/review-policy";
import type { Mistake, PhraseMemory, ProgressState } from "@/types/learning";

/**
 * How well the learner knows an item, in the vocabulary the sequencing rules
 * are written in.
 *
 * - `new`    — never met.
 * - `weak`   — met, but recently missed or sitting in a low box.
 * - `due`    — the schedule says it is time.
 * - `recent` — met lately and holding up; not urgent.
 * - `strong` — survived a long interval. Practise sparingly.
 */
export type ItemStatus = "new" | "weak" | "due" | "recent" | "strong";

/** A miss stays "recent" for this long, which is what makes it come back soon. */
const RECENT_MISTAKE_MS = 7 * 24 * 60 * 60 * 1000;

/** Boxes 0-1 are shaky no matter what the due date says. */
const WEAK_BOX = 1;

export type LearnerSnapshot = {
  memory: MemoryEntries;
  /** Phrase ids missed recently, most recent first. */
  recentMistakePhraseIds: string[];
  completedLessonIds: ReadonlySet<string>;
  now: number;
};

const EMPTY_SNAPSHOT: LearnerSnapshot = {
  memory: {},
  recentMistakePhraseIds: [],
  completedLessonIds: new Set(),
  now: 0,
};

/** A snapshot for a learner we know nothing about — every item reads as new. */
export function emptyLearnerSnapshot(now = Date.now()): LearnerSnapshot {
  return { ...EMPTY_SNAPSHOT, completedLessonIds: new Set(), now };
}

/** Build the snapshot from persisted progress. Call once per session. */
export function snapshotLearner(
  progress: Pick<
    ProgressState,
    "phraseMemory" | "mistakes" | "completedLessons"
  >,
  now = Date.now(),
): LearnerSnapshot {
  return {
    memory: progress.phraseMemory ?? {},
    recentMistakePhraseIds: recentMistakePhraseIds(progress.mistakes ?? [], now),
    completedLessonIds: new Set(progress.completedLessons ?? []),
    now,
  };
}

function recentMistakePhraseIds(mistakes: readonly Mistake[], now: number): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const mistake of mistakes) {
    // Mistakes are stored newest-first. Older saves have no phraseId at all;
    // those are simply not attributable to an item.
    if (!mistake.phraseId || mistake.resolved || seen.has(mistake.phraseId)) {
      continue;
    }

    const at = new Date(mistake.createdAt).getTime();

    if (Number.isFinite(at) && now - at > RECENT_MISTAKE_MS) {
      continue;
    }

    seen.add(mistake.phraseId);
    ids.push(mistake.phraseId);
  }

  return ids;
}

export function classifyPhrase(
  phraseId: string,
  snapshot: LearnerSnapshot,
): ItemStatus {
  const memory: PhraseMemory | undefined = snapshot.memory[phraseId];

  if (!memory) {
    return "new";
  }

  if (snapshot.recentMistakePhraseIds.includes(phraseId) || memory.box <= WEAK_BOX) {
    return "weak";
  }

  if (isDue(memory, snapshot.now)) {
    return "due";
  }

  return memory.box >= MASTERY_BOX ? "strong" : "recent";
}

/**
 * Priority for pulling an item into today's lesson. Higher comes first.
 *
 * The order encodes the pedagogy: bring back what was just missed, then what
 * the schedule says is due, then what is merely shaky; keep already-strong
 * items in the mix but rarely, so a lesson doesn't spend itself re-proving
 * things the learner has demonstrated four times.
 */
const STATUS_PRIORITY: Record<ItemStatus, number> = {
  weak: 100,
  due: 80,
  recent: 40,
  new: 30,
  strong: 10,
};

export function scoreForReview(
  phraseId: string,
  snapshot: LearnerSnapshot,
): number {
  const status = classifyPhrase(phraseId, snapshot);
  const memory = snapshot.memory[phraseId];
  let score = STATUS_PRIORITY[status];

  if (status === "weak") {
    const mistakeRank = snapshot.recentMistakePhraseIds.indexOf(phraseId);
    if (mistakeRank >= 0) {
      // The most recent miss outranks an older one.
      score += Math.max(0, 20 - mistakeRank * 2);
    }
  }

  if (memory) {
    // Within a status, weaker memory first.
    score += (1 - memoryStrength(memory)) * 10;
  }

  return score;
}

/**
 * Order review candidates by how much the learner would gain from meeting them
 * again, and cap how much of a session already-strong material may occupy.
 */
export function selectReviewItems(
  candidateIds: readonly string[],
  snapshot: LearnerSnapshot,
  limit: number,
  { maxStrongShare = 0.3 }: { maxStrongShare?: number } = {},
): string[] {
  if (limit <= 0) {
    return [];
  }

  const ranked = [...new Set(candidateIds)]
    .map((id, index) => ({ id, index, score: scoreForReview(id, snapshot) }))
    // Ties fall back to the curriculum's own priority order, which is
    // deterministic — so a learner with no history still gets a sensible lesson.
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const maxStrong = Math.max(1, Math.floor(limit * maxStrongShare));
  const chosen: string[] = [];
  const overflow: string[] = [];
  let strongCount = 0;

  for (const candidate of ranked) {
    if (chosen.length >= limit) {
      break;
    }

    if (classifyPhrase(candidate.id, snapshot) === "strong") {
      if (strongCount >= maxStrong) {
        overflow.push(candidate.id);
        continue;
      }
      strongCount += 1;
    }

    chosen.push(candidate.id);
  }

  // If holding strong items back left the session short, let them back in
  // rather than shipping a thin lesson.
  for (const id of overflow) {
    if (chosen.length >= limit) {
      break;
    }
    chosen.push(id);
  }

  return chosen;
}
