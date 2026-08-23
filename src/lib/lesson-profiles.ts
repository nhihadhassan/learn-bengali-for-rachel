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

import type { LessonKind, ScaffoldLevel } from "@/types/learning";

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
  /** Practise the unit's authored sentence frames. */
  includePatterns: boolean;
  /** Show a pattern-discovery card and its prediction, when the plan has one. */
  includeNotice: boolean;
  /** Tell a mini-story and check that it was understood. */
  includeStory: boolean;
  /**
   * Say-it-aloud steps. Listening and speaking are *modalities*, not lesson
   * slots, so most profiles carry a couple rather than one lesson carrying all
   * of them. Never evaluated — see `buildPronounceStep`.
   */
  pronounceSteps: number;
  /**
   * Which way to lean when an item's state offers a choice of format. The
   * ladder in `@/lib/learning-state` proposes; this decides.
   */
  ladderBias: "comprehension" | "production" | "balanced";
  /** Let word-bank translation become a typed answer. Support taken away. */
  allowTypedAnswers: boolean;
  /** How many frames at most, so a lesson doesn't become a substitution table. */
  maxPatternSteps: number;
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

/**
 * Fields most profiles don't care about. Spelling them out in all eleven rows
 * would bury the fields that actually distinguish one lesson type from another.
 */
const PROFILE_DEFAULTS = {
  includeNotice: false,
  includeStory: false,
  pronounceSteps: 0,
  ladderBias: "balanced",
  allowTypedAnswers: false,
} as const satisfies Partial<LessonProfile>;

type ProfileRow = Omit<LessonProfile, keyof typeof PROFILE_DEFAULTS> &
  Partial<LessonProfile>;

const PROFILE_ROWS: Record<LessonKind, ProfileRow> = {
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
    includePatterns: false,
    maxPatternSteps: 0,
    showMeaningHint: true,
    wordBankPadding: 1,
    reviewQuestionTarget: 3,
    recycleSlots: 1,
    // Hearing a new word and repeating it belongs with meeting it, not in a
    // lesson of its own five screens later.
    pronounceSteps: 1,
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
    includePatterns: true,
    maxPatternSteps: 2,
    showMeaningHint: true,
    wordBankPadding: 2,
    reviewQuestionTarget: 4,
    recycleSlots: 2,
    pronounceSteps: 1,
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
    includePatterns: true,
    maxPatternSteps: 2,
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
    includePatterns: false,
    maxPatternSteps: 0,
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
    includePatterns: true,
    maxPatternSteps: 1,
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
    includePatterns: true,
    maxPatternSteps: 1,
    showMeaningHint: false,
    wordBankPadding: 3,
    reviewQuestionTarget: 12,
    recycleSlots: 2,
  },

  /**
   * Work the pattern out first, be told second.
   *
   * The card shows three examples and asks for a fourth form nobody taught. A
   * learner who gets it has already half-noticed the rule, which is the only
   * moment an explanation is worth reading — so the rule is the *reveal*, not
   * the opening.
   */
  notice: {
    kind: "notice",
    blurb: "Work out how Spanish does this, before anyone explains it.",
    teachNewItems: true,
    warmUpChecks: 1,
    formatSequence: ["recognize", "complete", "produce", "order", "translate"],
    includeGrammar: false,
    includeDialogue: false,
    includePatterns: true,
    includeNotice: true,
    maxPatternSteps: 2,
    showMeaningHint: true,
    wordBankPadding: 2,
    reviewQuestionTarget: 4,
    recycleSlots: 2,
  },

  /**
   * Comprehensible input. A few sentences of mostly-known Spanish, heard before
   * they are read, checked for meaning rather than translated word by word.
   */
  story: {
    kind: "story",
    blurb: "Follow a short story in Spanish. Meaning first.",
    teachNewItems: true,
    warmUpChecks: 1,
    formatSequence: ["listen", "recognize", "complete", "translate", "listen"],
    includeGrammar: false,
    includeDialogue: false,
    includePatterns: false,
    includeStory: true,
    maxPatternSteps: 0,
    showMeaningHint: false,
    wordBankPadding: 2,
    reviewQuestionTarget: 5,
    recycleSlots: 1,
    pronounceSteps: 1,
    ladderBias: "comprehension",
  },

  /**
   * Take your part in a conversation. Heavier on production than "Use in
   * context" is, and the English prop is gone.
   */
  scenario: {
    kind: "scenario",
    blurb: "Take your part in a real conversation.",
    teachNewItems: true,
    warmUpChecks: 2,
    formatSequence: ["complete", "produce", "translate", "produce", "translate"],
    includeGrammar: false,
    includeDialogue: true,
    includePatterns: true,
    maxPatternSteps: 1,
    showMeaningHint: false,
    wordBankPadding: 3,
    reviewQuestionTarget: 5,
    recycleSlots: 2,
    pronounceSteps: 1,
    ladderBias: "production",
  },

  /**
   * The end of the pilot: nothing new, the whole twelve units in play, and the
   * conversation the course has been building toward.
   */
  capstone: {
    kind: "capstone",
    blurb: "Put it all together in one real conversation.",
    teachNewItems: false,
    warmUpChecks: 0,
    formatSequence: [
      "translate", "produce", "complete", "listen", "order",
      "translate", "produce", "complete", "translate", "produce",
    ],
    includeGrammar: false,
    includeDialogue: true,
    includePatterns: true,
    includeStory: true,
    maxPatternSteps: 1,
    showMeaningHint: false,
    wordBankPadding: 4,
    reviewQuestionTarget: 14,
    recycleSlots: 2,
    pronounceSteps: 1,
    ladderBias: "production",
    allowTypedAnswers: true,
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
    includePatterns: false,
    maxPatternSteps: 0,
    showMeaningHint: false,
    wordBankPadding: 3,
    reviewQuestionTarget: 12,
    recycleSlots: 2,
  },
};

const PROFILES: Record<LessonKind, LessonProfile> = Object.fromEntries(
  Object.entries(PROFILE_ROWS).map(([kind, row]) => [
    kind,
    { ...PROFILE_DEFAULTS, ...row },
  ]),
) as Record<LessonKind, LessonProfile>;

/**
 * CEFR bands, in course order. The six-lesson rhythm is right for a beginner,
 * but a 786-lesson course should not still be running the Intro shape at B1.
 */
export type CefrBand = "Intro" | "A1" | "A2" | "B1";

/**
 * How a lesson type changes as the course gets harder.
 *
 * The six-lesson rhythm is right for a beginner, but running the Intro shape
 * unchanged through 786 lessons would mean a learner at A2 still getting the
 * scaffolding they needed on day one. A band supplies only the fields it wants
 * to change; everything else is inherited.
 *
 * The direction of travel is the same for every type: take away support, ask
 * for more production, and lean harder on the ear.
 */
const BAND_OVERRIDES: Partial<
  Record<CefrBand, Partial<Record<LessonKind, Partial<LessonProfile>>>>
> = {
  // A1: the English hint starts coming off cloze questions, and word banks
  // carry more decoys.
  A1: {
    build: { showMeaningHint: false, wordBankPadding: 3 },
    context: { wordBankPadding: 3 },
    review: { wordBankPadding: 4, reviewQuestionTarget: 14 },
  },

  // A2: fewer warm-up props, sentence-building over recognition, and listening
  // that is no longer a two-word bank.
  A2: {
    discover: {
      warmUpChecks: 1,
      formatSequence: ["recognize", "listen", "produce", "listen", "produce", "complete", "recognize"],
    },
    build: {
      showMeaningHint: false,
      wordBankPadding: 4,
      formatSequence: ["complete", "order", "translate", "translate", "order", "produce", "translate"],
    },
    grammar: { showMeaningHint: false, wordBankPadding: 3 },
    listen: {
      wordBankPadding: 4,
      formatSequence: ["listen", "listen", "produce", "listen", "complete", "listen", "listen"],
    },
    context: {
      showMeaningHint: false,
      wordBankPadding: 3,
      formatSequence: ["complete", "translate", "produce", "translate", "produce", "produce"],
    },
    review: {
      wordBankPadding: 4,
      reviewQuestionTarget: 16,
      formatSequence: [
        "translate", "produce", "listen", "translate", "order",
        "produce", "complete", "listen", "translate", "produce",
      ],
    },
  },
};

/**
 * How much support each scaffold level leaves in place.
 *
 * The band table above says how a *course* gets harder; this says how a
 * *sequence of units* does, which is a different axis: the pilot's twelve units
 * are all beginner units, and they still have to take the props away one at a
 * time. Level 5 hands the learner everything; level 1 hands them almost
 * nothing. Applied after the band, so a unit's own intent wins.
 */
const SCAFFOLD_OVERRIDES: Record<ScaffoldLevel, Partial<LessonProfile>> = {
  5: { showMeaningHint: true, wordBankPadding: 0, allowTypedAnswers: false },
  4: { showMeaningHint: true, wordBankPadding: 1, allowTypedAnswers: false },
  3: { wordBankPadding: 2, allowTypedAnswers: false },
  2: { showMeaningHint: false, wordBankPadding: 3 },
  1: { showMeaningHint: false, wordBankPadding: 4, allowTypedAnswers: true },
};

export function getLessonProfile(
  kind: LessonKind,
  band?: CefrBand,
  scaffold?: ScaffoldLevel,
): LessonProfile {
  const base = PROFILES[kind] ?? PROFILES.build;
  const banded = band ? { ...base, ...BAND_OVERRIDES[band]?.[kind] } : base;

  // A review or capstone keeps its own padding: those lessons are the check,
  // and softening them at a high scaffold level would defeat the point.
  if (!scaffold || kind === "review" || kind === "capstone") {
    return banded;
  }

  return { ...banded, ...SCAFFOLD_OVERRIDES[scaffold] };
}

export function allLessonProfiles(): LessonProfile[] {
  return Object.values(PROFILES);
}
