/**
 * The cumulative teaching plan: *what* each lesson introduces and *what it
 * brings back*.
 *
 * The problem this replaces: the Spanish pack gives all six lessons in a unit
 * the same `content_focus`, so the adapter rotated a five-item window over it
 * (`offset = (lesson_index - 1) * 5 % length`). Each lesson was therefore "five
 * of this unit's fifteen items", nothing from an earlier unit ever returned,
 * and finishing a unit meant its vocabulary was never seen again.
 *
 * Here a unit's fifteen items are introduced **across** its six lessons, a few
 * at a time, and every lesson also carries prior material: the items from the
 * lessons just before it, plus a spaced sample from earlier units. So
 * lesson 3 is not "items 11-15", it is "three new things and everything you
 * met on Monday".
 *
 * This module is pure, deterministic and learner-independent on purpose. The
 * curriculum decides *what should be learned*; `@/lib/learner-model` then
 * decides which of the review candidates are worth the learner's time *today*.
 * Keeping the split means the schedule can be asserted offline
 * (`scripts/lesson-plan.test.ts`) and a brand-new learner still gets a
 * sensible, cumulative lesson.
 */

import { makeRng, seededShuffle } from "@/lib/rng";
import { isContentWord, normalizeWord, splitWords } from "@/lib/text-tokens";
import type { LessonKind, LessonPlan } from "@/types/learning";

export type PlanItemKind = "vocabulary" | "phrase";

export type PlanItem = {
  id: string;
  /** The target-language text, used for prerequisite ordering. */
  text: string;
  kind: PlanItemKind;
};

export type PlanUnit = {
  id: string;
  /** 1-based position in the course. */
  number: number;
  items: PlanItem[];
};

/**
 * The six lesson types, in path order. Names come from the pack's
 * `lesson_sequence[].name`; `toLessonKind` maps them.
 */
export const UNIT_LESSON_KINDS: LessonKind[] = [
  "discover",
  "build",
  "grammar",
  "listen",
  "context",
  "review",
];

const KIND_BY_NAME: Record<string, LessonKind> = {
  discover: "discover",
  build: "build",
  "grammar focus": "grammar",
  "listen and speak": "listen",
  "use in context": "context",
  "unit review": "review",
};

export function toLessonKind(name: string, lessonIndex: number): LessonKind {
  return (
    KIND_BY_NAME[name.trim().toLowerCase()] ??
    UNIT_LESSON_KINDS[lessonIndex - 1] ??
    "build"
  );
}

/**
 * How each lesson's share of a unit's new language is weighted, by item type.
 *
 * These are *weights*, not counts: a unit's actual items are divided among the
 * lessons in these proportions, so the schedule works whether a unit holds the
 * pack's usual 10 + 5 or the larger sets the hand-sequenced early units carry.
 * The shape is the pedagogy — most new words arrive early, phrase patterns
 * arrive once their words exist, and "Unit review" introduces nothing at all.
 */
const NEW_WEIGHTS: Record<LessonKind, { vocabulary: number; phrases: number }> = {
  discover: { vocabulary: 3, phrases: 1 },
  build: { vocabulary: 3, phrases: 1 },
  grammar: { vocabulary: 3, phrases: 1 },
  listen: { vocabulary: 2, phrases: 0 },
  context: { vocabulary: 1, phrases: 2 },
  review: { vocabulary: 0, phrases: 0 },
  strengthen: { vocabulary: 0, phrases: 0 },
};

/**
 * The hard ceiling on new items in one lesson. Lesson length is held near five
 * minutes, and the slots that would have gone to a fifth new word are worth
 * more spent on retrieving old ones — that trade is the whole point of the
 * cumulative model.
 */
export const MAX_NEW_ITEMS_PER_LESSON = 4;

/**
 * Split `total` items across `weights` using the largest-remainder method, so
 * the counts always sum to exactly `total` — nothing in a unit is silently
 * left untaught by a rounding error.
 */
function distribute(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0 || weightSum <= 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((weight) => (total * weight) / weightSum);
  const counts = exact.map(Math.floor);
  let remaining = total - counts.reduce((sum, count) => sum + count, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of order) {
    if (remaining <= 0) break;
    counts[index] += 1;
    remaining -= 1;
  }

  return counts;
}

/**
 * Per-lesson new-item counts for a unit, respecting both the weighting and the
 * per-lesson ceiling. Anything the ceiling displaces moves to the next lesson
 * with room rather than being dropped.
 */
function newItemPlan(
  lessonKinds: readonly LessonKind[],
  vocabularyCount: number,
  phraseCount: number,
): Array<{ vocabulary: number; phrases: number }> {
  const vocabulary = distribute(
    vocabularyCount,
    lessonKinds.map((kind) => NEW_WEIGHTS[kind].vocabulary),
  );
  const phrases = distribute(
    phraseCount,
    lessonKinds.map((kind) => NEW_WEIGHTS[kind].phrases),
  );

  const plan = lessonKinds.map((_, index) => ({
    vocabulary: vocabulary[index],
    phrases: phrases[index],
  }));

  // Push overflow forward. Phrases move first: a sentence is easier to hold
  // back than the words it is made of.
  for (let index = 0; index < plan.length; index += 1) {
    const entry = plan[index];
    let overflow = entry.vocabulary + entry.phrases - MAX_NEW_ITEMS_PER_LESSON;

    while (overflow > 0) {
      const next = plan[index + 1];

      if (!next) {
        break;
      }

      if (entry.phrases > 0) {
        entry.phrases -= 1;
        next.phrases += 1;
      } else {
        entry.vocabulary -= 1;
        next.vocabulary += 1;
      }

      overflow -= 1;
    }
  }

  return plan;
}

/**
 * How many prior items each lesson may draw on: from earlier in the same unit,
 * and from units the learner finished before this one.
 *
 * These are *candidate pools*, not question counts. A lesson asks about a
 * dozen things at most; offering more candidates than that is what gives the
 * learner model room to pick the weak and due ones.
 */
const REVIEW_LOAD: Record<
  LessonKind,
  { fromUnit: number; fromEarlierUnits: number }
> = {
  discover: { fromUnit: 0, fromEarlierUnits: 3 },
  build: { fromUnit: 4, fromEarlierUnits: 3 },
  grammar: { fromUnit: 7, fromEarlierUnits: 3 },
  listen: { fromUnit: 8, fromEarlierUnits: 3 },
  context: { fromUnit: 10, fromEarlierUnits: 4 },
  review: { fromUnit: 15, fromEarlierUnits: 8 },
  strengthen: { fromUnit: 0, fromEarlierUnits: 12 },
};

/** The weighted share a lesson kind takes of a unit's new material. */
export function newItemWeight(kind: LessonKind): number {
  const weights = NEW_WEIGHTS[kind];
  return weights.vocabulary + weights.phrases;
}

/**
 * How far back to reach for interleaved review. Expanding gaps mean a unit
 * keeps resurfacing long after it is "finished" — unit 1 comes back in units 2,
 * 3, 5, 9 and 17 — rather than being revisited once and forgotten.
 */
const SPACED_UNIT_DISTANCES = [1, 2, 4, 8, 16];

function contentWordSet(text: string): Set<string> {
  const words = new Set<string>();

  for (const word of splitWords(text)) {
    if (isContentWord(word)) {
      words.add(normalizeWord(word));
    }
  }

  return words;
}

/**
 * Undo Spanish's most common stem change so a conjugated form can be matched
 * back to the infinitive the learner was taught: quiero → quero (querer),
 * puedo → podo (poder).
 */
function unstem(word: string): string {
  return word.replace(/ie/, "e").replace(/ue/, "o");
}

/**
 * Loose match so "hablo" counts as knowing "hablar" without shipping a
 * stemmer. Three characters is enough to link tengo/tener and vivo/vivir while
 * still keeping, say, "casa" and "caro" apart.
 */
export function sharesStem(word: string, candidate: string): boolean {
  if (word === candidate) {
    return true;
  }

  const a = unstem(word);
  const b = unstem(candidate);

  if (a.length < 3 || b.length < 3) {
    return a === b;
  }

  return a.slice(0, 3) === b.slice(0, 3);
}

function isKnownWord(word: string, known: ReadonlySet<string>): boolean {
  if (known.has(word)) {
    return true;
  }

  for (const candidate of known) {
    if (sharesStem(word, candidate)) {
      return true;
    }
  }

  return false;
}

/**
 * How much of a phrase the learner can already read, 0-1. Used to introduce
 * phrase patterns *after* the words they are built from, so a sentence is a new
 * arrangement of known pieces rather than five new words at once.
 */
export function coverage(text: string, knownWords: ReadonlySet<string>): number {
  const words = [...contentWordSet(text)];

  if (words.length === 0) {
    return 1;
  }

  const known = words.filter((word) => isKnownWord(word, knownWords)).length;
  return known / words.length;
}

function addWords(target: Set<string>, text: string) {
  for (const word of contentWordSet(text)) {
    target.add(word);
  }
}

export type PlannedLesson = {
  kind: LessonKind;
  newPhraseIds: string[];
  reviewPhraseIds: string[];
  interleavedPhraseIds: string[];
};

/**
 * Plan one unit's lessons.
 *
 * `priorUnits` are the units before this one in path order, oldest first; they
 * supply both the interleaved review and the vocabulary that makes a phrase
 * pattern "mostly known" already.
 */
export function planUnit(
  unit: PlanUnit,
  priorUnits: readonly PlanUnit[],
  lessonKinds: readonly LessonKind[] = UNIT_LESSON_KINDS,
  sharedQueues: ReviewQueues = createReviewQueues(),
): PlannedLesson[] {
  const vocabulary = unit.items.filter((item) => item.kind === "vocabulary");
  const phrases = unit.items.filter((item) => item.kind === "phrase");

  // Words the learner brings into this unit.
  const knownWords = new Set<string>();
  for (const prior of priorUnits) {
    for (const item of prior.items) {
      addWords(knownWords, item.text);
    }
  }

  const remainingVocabulary = [...vocabulary];
  const remainingPhrases = [...phrases];
  const loads = newItemPlan(lessonKinds, vocabulary.length, phrases.length);
  /** Items introduced in this unit so far, most recent last. */
  const introduced: string[] = [];
  const plans: PlannedLesson[] = [];
  const interleaver = createInterleaver(unit, priorUnits, sharedQueues);

  lessonKinds.forEach((kind, index) => {
    const load = loads[index] ?? { vocabulary: 0, phrases: 0 };
    const newIds: string[] = [];

    // Vocabulary goes in curriculum order — that order is the pedagogy, and for
    // the early units it has been hand-sequenced.
    for (let taken = 0; taken < load.vocabulary; taken += 1) {
      const item = remainingVocabulary.shift();
      if (!item) break;
      addWords(knownWords, item.text);
      newIds.push(item.id);
    }

    // Phrase patterns go in *readiness* order: whichever remaining pattern the
    // learner can already read the most of. That keeps a lesson from opening
    // with a sentence made of four words it has not taught.
    for (let taken = 0; taken < load.phrases; taken += 1) {
      if (remainingPhrases.length === 0) break;

      let bestIndex = 0;
      let bestCoverage = -1;

      remainingPhrases.forEach((candidate, candidateIndex) => {
        const score = coverage(candidate.text, knownWords);
        if (score > bestCoverage) {
          bestCoverage = score;
          bestIndex = candidateIndex;
        }
      });

      const [item] = remainingPhrases.splice(bestIndex, 1);
      addWords(knownWords, item.text);
      newIds.push(item.id);
    }

    const reviewLoad = REVIEW_LOAD[kind];
    // Most recently introduced first: the previous lesson's material is what
    // needs consolidating, and older items in the unit have already had turns.
    const fromUnit = [...introduced].reverse().slice(0, reviewLoad.fromUnit);
    const interleaved = interleaver.take(reviewLoad.fromEarlierUnits, {
      nearestOnly: kind === "discover",
    });

    plans.push({
      kind,
      newPhraseIds: newIds,
      reviewPhraseIds: [...fromUnit, ...interleaved],
      interleavedPhraseIds: interleaved,
    });

    introduced.push(...newIds);
  });

  // Anything the loads left over (a unit with more items than the schedule
  // covers) is folded into the review lesson so nothing is silently dropped.
  const leftovers = [...remainingVocabulary, ...remainingPhrases].map((item) => item.id);
  if (leftovers.length > 0) {
    const last = plans[plans.length - 1];
    if (last) {
      last.newPhraseIds = [...last.newPhraseIds, ...leftovers];
    }
  }

  return plans;
}

/**
 * Draws older material for one unit's lessons, along the spaced ladder.
 *
 * The queues are built **once per unit**, not per lesson, and each lesson
 * advances a cursor. That is the difference between "unit 2 shows three random
 * unit-1 items six times" and "unit 2 works through all of unit 1" — with an
 * independent shuffle per lesson, a third of the previous unit was never
 * revisited at all.
 */
type ReviewQueue = { items: PlanItem[]; cursor: number };

/**
 * Per-unit review queues, shared across the whole course.
 *
 * The cursor into unit 2's material has to be shared by units 3, 4, 6 and 10 —
 * every unit that reaches back to it. With a fresh shuffle per consumer they
 * kept re-drawing the same handful and a third of each unit was never seen
 * again after its own six lessons.
 */
export type ReviewQueues = Map<string, ReviewQueue>;

export function createReviewQueues(): ReviewQueues {
  return new Map();
}

function queueFor(queues: ReviewQueues, unit: PlanUnit): ReviewQueue {
  const existing = queues.get(unit.id);

  if (existing) {
    return existing;
  }

  const created: ReviewQueue = {
    items: seededShuffle(unit.items, makeRng(`${unit.id}-review-queue`)),
    cursor: 0,
  };
  queues.set(unit.id, created);
  return created;
}

function createInterleaver(
  unit: PlanUnit,
  priorUnits: readonly PlanUnit[],
  shared: ReviewQueues,
) {
  const byNumber = new Map(priorUnits.map((prior) => [prior.number, prior]));
  const queues = SPACED_UNIT_DISTANCES.map((distance) =>
    byNumber.get(unit.number - distance),
  )
    .filter((prior): prior is PlanUnit => Boolean(prior))
    // Nearest unit first: the material most at risk of fading is what was
    // learned most recently but is no longer being taught.
    .map((prior) => queueFor(shared, prior));

  const taken = new Set<string>();

  return {
    /**
     * `nearestOnly` draws everything from the unit just finished. A unit's
     * opening lesson uses it so the learner starts by reconnecting with
     * yesterday's material rather than with something from eight units ago.
     */
    take(count: number, { nearestOnly = false } = {}): string[] {
      if (count <= 0 || queues.length === 0) {
        return [];
      }

      const rungs = nearestOnly ? queues.slice(0, 1) : queues;
      const picked: string[] = [];

      // One item per rung per round, so a lesson that wants three old items
      // reaches three *different* units rather than draining the nearest one.
      while (picked.length < count) {
        let tookAny = false;

        for (const queue of rungs) {
          if (picked.length >= count) {
            break;
          }

          // Wrap once the queue is exhausted: a unit that has been fully
          // revisited should still be able to come back, just not before
          // everything else has had a turn.
          for (let step = 0; step < queue.items.length; step += 1) {
            const item = queue.items[queue.cursor % queue.items.length];
            queue.cursor += 1;

            if (taken.has(item.id)) {
              continue;
            }

            taken.add(item.id);
            picked.push(item.id);
            tookAny = true;
            break;
          }
        }

        if (!tookAny) {
          break;
        }
      }

      return picked;
    },
  };
}

/** Build a `LessonPlan` from a planned lesson plus any authored extras. */
export function toLessonPlan(
  planned: PlannedLesson,
  extras: Pick<LessonPlan, "grammar" | "dialogue"> = {},
): LessonPlan {
  return {
    kind: planned.kind,
    newPhraseIds: planned.newPhraseIds,
    reviewPhraseIds: planned.reviewPhraseIds,
    interleavedPhraseIds: planned.interleavedPhraseIds,
    ...extras,
  };
}
