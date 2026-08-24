/**
 * How well the learner has a *specific item*, and therefore how hard it is fair
 * to ask about it.
 *
 * This is the answer to the pass's central complaint: the engine already knew
 * which old items to bring back, but not *how* to ask about them. A word met
 * once and a word produced correctly nine times got the same question, so
 * "recognition leads to production" was a description of the profiles' fixed
 * `formatSequence` rather than anything that happened to a learner.
 *
 * Two rules keep this from becoming a second memory model:
 *
 * 1. **Everything here is derived.** `@/lib/review-policy` remains the one
 *    definition of boxes, due-ness and mastery; this module reads it. The only
 *    stored field it depends on is `PhraseMemory.produced`, which cannot be
 *    derived from a Leitner box — a box says how well something is remembered,
 *    not whether the learner has ever had to say it.
 * 2. **It never chooses *what* to review.** `selectReviewItems` in
 *    `@/lib/learner-model` still does that. This module only decides the shape
 *    of the question once an item has been chosen.
 */

import { classifyPhrase, type LearnerSnapshot } from "@/lib/learner-model";
import type { LessonProfile, StepFormat } from "@/lib/lesson-profiles";
import { MASTERY_BOX } from "@/lib/review-policy";

/**
 * The states a concept moves through. Not lesson categories — an item can pass
 * two of these inside one lesson and sit in another for a fortnight.
 *
 * - `unseen`      — never met.
 * - `encountered` — met, but never answered about. Meaning is still borrowed
 *                   from context.
 * - `recognized`  — can pick it out. Cannot yet produce it.
 * - `retrieved`   — has produced it, at least with a word bank.
 * - `applied`     — produced it more than once, and it is holding up.
 * - `durable`     — survived a long interval. Worth revisiting, rarely.
 */
export type ItemState =
  | "unseen"
  | "encountered"
  | "recognized"
  | "retrieved"
  | "applied"
  | "durable";

/** Above this many correct productions, an item counts as applied. */
const APPLIED_PRODUCTIONS = 2;

/**
 * Formats that require the learner to *make* Spanish rather than pick it out.
 *
 * `produce` is multiple choice and still counts: choosing the Spanish for a
 * meaning is a different act from choosing the meaning for a Spanish word, and
 * it is the first rung where the learner has to hold the target-language form.
 */
const PRODUCTION_FORMATS: ReadonlySet<StepFormat> = new Set([
  "produce",
  "complete",
  "order",
  "translate",
]);

export function isProductionFormat(format: StepFormat): boolean {
  return PRODUCTION_FORMATS.has(format);
}

/**
 * Where an item sits, from what the learner has actually done with it.
 *
 * A recent miss pulls an item *back down* a rung rather than merely marking it
 * weak: someone who just got `agua` wrong should be shown it again before being
 * asked to type it.
 */
export function itemState(
  phraseId: string,
  snapshot: LearnerSnapshot,
): ItemState {
  const memory = snapshot.memory[phraseId];

  if (!memory) {
    return "unseen";
  }

  const status = classifyPhrase(phraseId, snapshot);
  const produced = memory.produced ?? 0;

  // A fresh mistake resets the claim that the item can be produced. It is not
  // demoted all the way to `encountered` — the learner has met it, and hiding
  // that would mean re-teaching something they mostly know.
  if (status === "weak") {
    return produced > 0 ? "recognized" : "encountered";
  }

  if (memory.box >= MASTERY_BOX && produced >= APPLIED_PRODUCTIONS) {
    return "durable";
  }

  if (produced >= APPLIED_PRODUCTIONS) {
    return "applied";
  }

  if (produced > 0) {
    return "retrieved";
  }

  // Box 0 with no productions is an item that has been shown and not yet
  // answered about; anything above it has at least been recognised correctly.
  return memory.box > 0 ? "recognized" : "encountered";
}

/**
 * The formats worth asking for an item in this state, best first.
 *
 * Each rung sits one step beyond what the learner has already shown, which is
 * what makes support fall away on its own: nobody has to schedule "unit 7 stops
 * using word banks", because by unit 7 the items in play have been produced.
 * Fallbacks below the top choice keep a lesson buildable when a one-word item
 * cannot support a sentence format.
 */
const LADDER: Record<ItemState, StepFormat[]> = {
  // Never met — the caller teaches it rather than asking.
  unseen: ["recognize"],
  encountered: ["recognize", "listen", "produce"],
  recognized: ["produce", "complete", "listen", "recognize"],
  retrieved: ["complete", "order", "listen", "produce"],
  applied: ["translate", "order", "listen", "complete"],
  // Still asked, but at the top of its range: re-proving an easy item is what a
  // lesson full of "what does hola mean?" is made of.
  durable: ["translate", "listen", "complete", "order"],
};

/** Formats a bias moves to the front, when the state allows them at all. */
const BIAS_PREFERENCE: Record<LessonProfile["ladderBias"], StepFormat[]> = {
  comprehension: ["listen", "recognize", "complete"],
  production: ["translate", "order", "complete", "produce"],
  balanced: [],
};

export function formatLadder(
  state: ItemState,
  profile: LessonProfile,
): StepFormat[] {
  const rungs = LADDER[state];
  const preferred = BIAS_PREFERENCE[profile.ladderBias];

  if (preferred.length === 0) {
    return rungs;
  }

  // A bias reorders what the state already permits; it never adds a rung. A
  // listening lesson may not ask a learner to transcribe a word they met once.
  const front = preferred.filter((format) => rungs.includes(format));

  return [...front, ...rungs.filter((format) => !front.includes(format))];
}

/**
 * Whether an item is ready to be *taught* rather than asked about.
 *
 * Used by the pilot's contextual introductions: a word the learner has already
 * recognised does not need another teach card, even if the unit lists it as
 * new.
 */
export function needsTeaching(
  phraseId: string,
  snapshot: LearnerSnapshot,
): boolean {
  const state = itemState(phraseId, snapshot);
  return state === "unseen" || state === "encountered";
}
