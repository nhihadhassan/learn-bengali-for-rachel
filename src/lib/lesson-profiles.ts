/**
 * What each of the six lesson types actually *is*.
 *
 * The pack has always labelled a unit's lessons "Discover", "Build", "Grammar
 * focus", "Listen and speak", "Use in context" and "Unit review" — but at
 * runtime all six ran the same recipe over a different slice of the same
 * fifteen items, so the labels promised a difference the learner never felt.
 *
 * A profile is **data**, not a branch: a question sequence, how much support to
 * give, and which special blocks (grammar card, dialogue) to include. Reading
 * one row tells you exactly what that lesson type does, and adding a type means
 * adding a row.
 *
 * The sequences are written easiest-first on purpose. A lesson should climb
 * from recognising a phrase to producing it, and `buildLessonSteps` always adds
 * an easy closer so a session ends on a win rather than on the hardest thing
 * in it.
 */

import type { LessonKind } from "@/types/learning";

/** The question formats a profile can ask for. */
export type StepFormat =
  | "recognize"
  | "produce"
  | "complete"
  | "order"
  | "translate"
  | "listen";

/**
 * When a format can't be built for an item — `order` needs three words, `listen`
 * needs a course with reliable speech — the engine walks down this chain rather
 * than dropping the question.
 */
export const FORMAT_FALLBACKS: Record<StepFormat, StepFormat[]> = {
  translate: ["order", "complete", "produce", "recognize"],
  order: ["complete", "translate", "produce", "recognize"],
  complete: ["produce", "order", "recognize"],
  listen: ["recognize", "produce"],
  produce: ["recognize"],
  recognize: ["produce"],
};

export type LessonProfile = {
  kind: LessonKind;
  /** Shown on the lesson intro so the learner knows what kind of work this is. */
  blurb: string;
  /** Teach cards for the items this lesson introduces. */
  teachNewItems: boolean;
  /**
   * How many checks on *older* material to slip between the teach cards. This
   * is what makes a lesson cumulative from its very first question instead of
   * starting with whatever it just taught.
   */
  warmUpChecks: number;
  /** The practice block, in order. */
  formatSequence: StepFormat[];
  /** Include the grammar card and its drills when the plan carries a focus. */
  includeGrammar: boolean;
  /** Include the authored dialogue when the plan carries one. */
  includeDialogue: boolean;
  /** Show the English meaning as a hint on cloze questions. */
  showMeaningHint: boolean;
  /** Extra distractor words in a word bank. More padding = less support. */
  wordBankPadding: number;
  /** How many previously-met items this lesson should actually drill. */
  reviewQuestionTarget: number;
  /**
   * Slots held near the end for items the learner gets wrong. They are filled
   * with review questions up front and rewritten on a miss, so recycling never
   * changes the number of steps and the progress bar never goes backwards.
   */
  recycleSlots: number;
};

const PROFILES: Record<LessonKind, LessonProfile> = {
  /**
   * A small amount of new language, met mostly by ear and by eye. Support is
   * high and production is light — the job here is form, sound and meaning.
   */
  discover: {
    kind: "discover",
    blurb: "Meet a few new words and connect sound to meaning.",
    teachNewItems: true,
    warmUpChecks: 2,
    formatSequence: [
      "recognize",
      "listen",
      "recognize",
      "produce",
      "listen",
      "produce",
      "recognize",
    ],
    includeGrammar: false,
    includeDialogue: false,
    showMeaningHint: true,
    wordBankPadding: 1,
    reviewQuestionTarget: 3,
    recycleSlots: 1,
  },

  /**
   * Almost everything here came from Discover. The work is combining known
   * pieces into sentences, so the formats are constructive: arrange, complete,
   * build from a word bank.
   */
  build: {
    kind: "build",
    blurb: "Put words you know together into sentences.",
    teachNewItems: true,
    warmUpChecks: 2,
    formatSequence: [
      "produce",
      "complete",
      "order",
      "translate",
      "order",
      "produce",
      "translate",
    ],
    includeGrammar: false,
    includeDialogue: false,
    showMeaningHint: true,
    wordBankPadding: 2,
    reviewQuestionTarget: 4,
    recycleSlots: 2,
  },

  /**
   * The unit's pattern, explained in two sentences and then drilled with the
   * vocabulary held constant — so the question is about the grammar, not about
   * whether you remember a noun.
   */
  grammar: {
    kind: "grammar",
    blurb: "Notice the pattern behind the sentences you already know.",
    teachNewItems: true,
    warmUpChecks: 1,
    formatSequence: ["recognize", "produce", "order", "translate", "produce"],
    includeGrammar: true,
    includeDialogue: false,
    showMeaningHint: true,
    wordBankPadding: 2,
    reviewQuestionTarget: 4,
    recycleSlots: 2,
  },

  /**
   * Heavy audio, barely any new vocabulary, and the English prop taken away on
   * cloze questions — the point is understanding Spanish as sound.
   */
  listen: {
    kind: "listen",
    blurb: "Understand the unit's language by ear.",
    teachNewItems: true,
    warmUpChecks: 2,
    formatSequence: [
      "listen",
      "recognize",
      "listen",
      "produce",
      "listen",
      "complete",
      "listen",
    ],
    includeGrammar: false,
    includeDialogue: false,
    showMeaningHint: false,
    wordBankPadding: 2,
    reviewQuestionTarget: 5,
    recycleSlots: 1,
  },

  /**
   * One scenario, several connected turns, then production work on the language
   * that scenario used. The learner has to interpret and respond, not answer
   * unrelated questions.
   */
  context: {
    kind: "context",
    blurb: "Use the unit's language in a short real exchange.",
    teachNewItems: true,
    warmUpChecks: 2,
    formatSequence: [
      "recognize",
      "complete",
      "translate",
      "produce",
      "translate",
      "produce",
    ],
    includeGrammar: false,
    includeDialogue: true,
    showMeaningHint: true,
    wordBankPadding: 2,
    reviewQuestionTarget: 5,
    recycleSlots: 2,
  },

  /**
   * Nothing new, minimal scaffolding, the whole unit plus older material. This
   * is the lesson that answers "can you actually use this yet?".
   */
  review: {
    kind: "review",
    blurb: "Mix everything from this unit, with less help.",
    teachNewItems: false,
    warmUpChecks: 0,
    formatSequence: [
      "produce",
      "complete",
      "translate",
      "listen",
      "order",
      "translate",
      "produce",
      "listen",
      "complete",
      "produce",
    ],
    includeGrammar: false,
    includeDialogue: false,
    showMeaningHint: false,
    wordBankPadding: 3,
    reviewQuestionTarget: 12,
    recycleSlots: 2,
  },

  /** The Practice hub's spaced-repetition session: retrieval, no teaching. */
  strengthen: {
    kind: "strengthen",
    blurb: "Strengthen the phrases your memory says are fading.",
    teachNewItems: false,
    warmUpChecks: 0,
    formatSequence: [
      "recognize",
      "produce",
      "complete",
      "translate",
      "listen",
      "produce",
      "order",
      "translate",
      "produce",
      "recognize",
    ],
    includeGrammar: false,
    includeDialogue: false,
    showMeaningHint: false,
    wordBankPadding: 3,
    reviewQuestionTarget: 12,
    recycleSlots: 2,
  },
};

/**
 * CEFR bands, in course order. The six-lesson rhythm is right for a beginner,
 * but a 786-lesson course should not still be running the Intro shape at B1.
 */
export type CefrBand = "Intro" | "A1" | "A2" | "B1";

/**
 * Per-band profile overrides — the extension point for evolving later sections.
 *
 * Empty on purpose: the shape of A2/B1 lessons (longer listening, reading
 * passages, mixed-skill sessions, less scaffolding) is a content decision that
 * has not been made yet, and inventing it before the early course is right
 * would be guessing. When it is made, it goes here as data rather than as a
 * second engine — a band supplies only the fields it wants to change.
 *
 * See docs/HANDOFF.md §5a.
 */
const BAND_OVERRIDES: Partial<Record<CefrBand, Partial<Record<LessonKind, Partial<LessonProfile>>>>> =
  {};

export function getLessonProfile(
  kind: LessonKind,
  band?: CefrBand,
): LessonProfile {
  const base = PROFILES[kind] ?? PROFILES.build;
  const override = band ? BAND_OVERRIDES[band]?.[kind] : undefined;

  return override ? { ...base, ...override } : base;
}

export function allLessonProfiles(): LessonProfile[] {
  return Object.values(PROFILES);
}
