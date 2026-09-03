/**
 * The lesson engine: turns a lesson into the actual sequence of steps a learner
 * works through.
 *
 * This module is deliberately pure — no React, no DOM — so the sequencing rules
 * can be tested directly (`scripts/lesson-steps.test.ts`) instead of only being
 * observable by playing a lesson. `lesson-flow.tsx` renders whatever comes out
 * of here; it no longer decides what the steps are.
 *
 * There are two paths through this file:
 *
 * - **Planned lessons.** A course whose capabilities declare
 *   `lessonStrategy: "cumulative"` carries a `Lesson.plan` (see
 *   `@/lib/curriculum-plan`): a few genuinely new items plus prior material to
 *   retrieve, and which of the six lesson types this is. The profile
 *   (`@/lib/lesson-profiles`) then decides the shape of the session, and the
 *   learner snapshot (`@/lib/learner-model`) decides which older items are
 *   worth today's questions.
 * - **Phrase-book lessons.** Everything else — Bengali, Spanish for Peru,
 *   Malayalam — keeps the original behaviour unchanged: teach this lesson's
 *   phrases, check them, practise them. This is also the documented fallback if
 *   `FEATURES.cumulativeLessons` is turned off.
 *
 * The non-negotiable rule holds on both paths: **never test a phrase in the
 * step right after introducing it** (see `TEACH_TEST_LAG`, enforced by
 * `enforceTeachTestLag` and asserted by `npm test`).
 */

import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { getCapabilities, getTargetLanguage, type CourseId } from "@/lib/courses";
import {
  buildMeaningOptions,
  buildTargetOptions,
  buildWordOptions,
} from "@/lib/distractors";
import { FEATURES } from "@/lib/feature-flags";
import { buildGrammarDrills, type GrammarDrill } from "@/lib/grammar-drills";
import {
  emptyLearnerSnapshot,
  selectReviewItems,
  type LearnerSnapshot,
} from "@/lib/learner-model";
import {
  formatLadder,
  isProductionFormat,
  itemState,
} from "@/lib/learning-state";
import {
  FORMAT_FALLBACKS,
  getLessonProfile,
  type LessonProfile,
  type StepFormat,
} from "@/lib/lesson-profiles";
import { makeRng, seededShuffle, type Rng } from "@/lib/rng";
import { knownFormsFor } from "@/lib/known-forms";
import {
  isContentWord,
  normalizeWord,
  pickBlankIndex,
  shuffle,
  shuffleTokens,
  splitWords,
} from "@/lib/text-tokens";
import type {
  ChoiceQuestion,
  DialogueTurn,
  Exercise,
  GrammarFocus,
  LanguagePattern,
  Lesson,
  LessonPlan,
  NoticeCard,
  Phrase,
  StoryScript,
} from "@/types/learning";

export type LessonStep =
  | { id: string; type: "intro"; lesson: Lesson; title: string; body: string }
  | { id: string; type: "learn"; phrase: Phrase; position: number; total: number }
  | {
      // A grammar point, taught in two sentences and a few examples. Not a
      // question — it is the "here is the pattern" card that the drills right
      // after it then check.
      id: string;
      type: "grammar";
      focus: GrammarFocus;
    }
  | { id: string; type: "speak"; phrase: Phrase; prompt: string }
  | {
      id: string;
      type: "recognize";
      phrase: Phrase;
      options: string[];
      prompt: string;
    }
  | {
      // English meaning shown, pick the correct word/phrase in the target language.
      id: string;
      type: "produce";
      phrase: Phrase;
      options: string[];
      prompt: string;
    }
  | {
      // Arrange a shuffled word bank into the correct phrase order.
      id: string;
      type: "order";
      phrase: Phrase;
      tokens: string[];
      prompt: string;
    }
  | {
      // Translate an English sentence by tapping target-language words from a
      // bank that also contains distractors.
      id: string;
      type: "translate";
      phrase: Phrase;
      tokens: string[];
      prompt: string;
      /**
       * Type the sentence instead of tapping a word bank. The last rung of the
       * ladder, and the point where the bank stops doing half the work.
       */
      typed?: boolean;
    }
  | {
      // Listening: hear a sentence and rebuild it from a word bank. Only for
      // courses whose capabilities declare reliable speech.
      id: string;
      type: "listen";
      phrase: Phrase;
      tokens: string[];
      prompt: string;
    }
  | {
      // Dialogue: a character line, pick the reply. `history` carries the turns
      // already exchanged, so "Use in context" reads as one conversation rather
      // than a series of unrelated one-liners.
      id: string;
      type: "dialogue";
      phrase: Phrase;
      promptRomanized: string;
      promptEnglish: string;
      options: string[];
      answer: string;
      prompt: string;
      scenario?: string;
      speaker?: string;
      turnIndex?: number;
      /** The prompt uses an expression the learner only needs to recognise. */
      promptReceptive?: boolean;
      history?: Array<{ speaker: "them" | "you"; romanized: string; english: string }>;
    }
  | {
      // Complete the sentence: one word is blanked; pick it from a word bank.
      // `hint` is the English meaning, and is empty when the profile has taken
      // that scaffold away.
      id: string;
      type: "complete";
      phrase: Phrase;
      before: string;
      after: string;
      answer: string;
      hint: string;
      options: string[];
      prompt: string;
      /** Set when the blank is the grammar point rather than a content word. */
      grammarNote?: string;
      /**
       * Grammar concepts this question exercises. Answers are tallied against
       * them so the course can tell a pattern is understood without running a
       * second review schedule over it.
       */
      conceptIds?: string[];
    }
  | {
      // Pattern discovery: three examples and nothing else. The rule is not
      // here — it arrives as the *explanation* on the prediction that follows,
      // which is the whole point of noticing before being told.
      id: string;
      type: "notice";
      card: NoticeCard;
    }
  | {
      // A mini-story, heard before it is read. Not a question: the checks come
      // after it, as `choice` steps.
      id: string;
      type: "story";
      story: StoryScript;
    }
  | {
      // Say it out loud. **Never evaluated** — no microphone, no scoring, and
      // the copy says so. A prompt to use the mouth, not a test.
      id: string;
      type: "pronounce";
      phrase: Phrase;
      prompt: string;
    }
  | {
      // A question with fixed options that isn't about one vocabulary item:
      // "what happened in the story?", "which form would Spanish use?". One
      // shape for both rather than a step type per activity.
      id: string;
      type: "choice";
      prompt: string;
      options: string[];
      answer: string;
      /** Shown after answering. For a prediction, this is the rule. */
      explanation?: string;
      conceptIds?: string[];
      /** Spanish worth hearing while the question is on screen. */
      audioTarget?: string;
    }
  | { id: string; type: "exercise"; exercise: Exercise };

export type LessonStepType = LessonStep["type"];

const INCLUDE_SPEAKING_PRACTICE = false;

const MAX_ORDER_STEPS = 1;
const MAX_COMPLETE_STEPS = 2;
const MAX_TRANSLATE_STEPS = 2;
/**
 * A "sentence" phrase (3+ words) is what production steps prefer, so most
 * practice happens on real sentences rather than single words.
 */
const SENTENCE_MIN_WORDS = 3;

/** How many phrases a first-time lesson teaches, and a review session covers. */
const TAUGHT_PHRASES = 5;
const REVIEW_PHRASES = 12;

/**
 * How far a comprehension check lags behind the teach card that introduced the
 * phrase. Two steps of separation is what makes recall real rather than
 * "read *adios*, immediately click *adios*".
 */
export const TEACH_TEST_LAG = 2;

/** Difficulty weight for ordering the practice block, easiest first. */
const EASY_CLOSER_MAX = 2;

/** Below this many decoys, "tap what you hear" stops being transcription. */
const MIN_LISTEN_PADDING = 2;

/** Recycle slots carry this id prefix so they can be found and rewritten. */
const RECYCLE_PREFIX = "recycle";

/**
 * Different words for the same instruction.
 *
 * A listening lesson asks four listening questions, and reading "Tap what you
 * hear." four times is a large part of why lessons felt machine-made — the
 * work varies and the page does not. The variant is chosen by how many times
 * the lesson has already used that format, so it is deterministic and the
 * wording never contradicts the task.
 */
/**
 * Wordings for a dialogue turn.
 *
 * Six turns of "How do you reply?" is the capstone's own conversation reading
 * like a form. Varied by turn, so the exchange sounds like an exchange.
 */
const DIALOGUE_PROMPTS = [
  "How do you reply?",
  "What do you say?",
  "Your turn — what fits?",
  "How do you answer that?",
  "What comes next from you?",
  "And your reply?",
];

const PROMPT_VARIANTS: Partial<Record<StepFormat, string[]>> = {
  listen: [
    "Tap what you hear.",
    "Listen, then build what was said.",
    "What did you hear? Tap it out.",
    "Listen once more and tap it back.",
  ],
  complete: [
    "Pick the missing word to complete the sentence.",
    "One word is missing. Which one?",
    "Fill the gap.",
    "Which word belongs in the gap?",
  ],
  order: [
    "Tap the words in the correct order.",
    "Put these words in order.",
    "Rebuild the sentence.",
  ],
  translate: [
    "Tap the words to build the translation.",
    "Say this in {language}, word by word.",
    "Build the {language} for this.",
  ],
};

/**
 * Prompts name the language they are asking for, and there is more than one
 * course. `{language}` is filled from the course registry rather than the
 * label, so "Spanish for Peru" asks for Spanish and not for Peru.
 */
function withLanguage(text: string, lesson: Lesson): string {
  if (!text.includes("{language}")) {
    return text;
  }

  const language = lesson.curriculumId
    ? getTargetLanguage(lesson.curriculumId as CourseId)
    : "the language";

  return text.replaceAll("{language}", language);
}

/**
 * The instruction for a format, varied by how often the lesson has used it.
 *
 * `usage` counts questions already asked, so the first `complete` reads one way
 * and the third reads another.
 */
function promptFor(
  format: StepFormat,
  fallback: string,
  context: BuildContext,
): string {
  const variants = PROMPT_VARIANTS[format];

  if (!variants?.length) {
    return withLanguage(fallback, context.lesson);
  }

  const used = context.formatUse.get(format) ?? 0;
  context.formatUse.set(format, used + 1);

  return withLanguage(variants[used % variants.length], context.lesson);
}

export type BuildLessonStepsOptions = {
  reviewMode?: boolean;
  /**
   * What we know about the learner, snapshotted **once** at the start of the
   * session. Passing live progress would re-plan the lesson after every answer.
   */
  learner?: LearnerSnapshot;
};

/**
 * A lesson uses the cumulative engine when its course asks for it and the
 * curriculum layer actually produced a plan. Both halves matter: the flag is
 * the rollback switch, and the plan's absence is what keeps the phrase-book
 * courses on their original path.
 */
export function hasCumulativePlan(lesson: Lesson): boolean {
  if (!FEATURES.cumulativeLessons || !lesson.plan) {
    return false;
  }

  if (!lesson.curriculumId) {
    return true;
  }

  return (
    getCapabilities(lesson.curriculumId as CourseId).lessonStrategy === "cumulative"
  );
}

export function buildLessonSteps(
  lesson: Lesson,
  options: BuildLessonStepsOptions = {},
): LessonStep[] {
  if (hasCumulativePlan(lesson) && lesson.plan) {
    return buildPlannedLessonSteps(lesson, lesson.plan, options);
  }

  return buildPhraseBookLessonSteps(lesson, options);
}

// ---------------------------------------------------------------------------
// The cumulative path
// ---------------------------------------------------------------------------

/**
 * Build a planned lesson.
 *
 * The shape is always the same, and each part earns its place:
 *
 *   intro → teach new items, checking *older* ones in between
 *         → grammar card + pattern drills (Grammar focus only)
 *         → the profile's practice sequence over new + selected review items
 *         → the dialogue (Use in context only)
 *         → recycle slots for anything missed today
 *         → an easy closer
 *
 * Checking old material *between* the teach cards is the small structural
 * change that makes a lesson feel cumulative from question one, and it happens
 * to satisfy the teach/test lag for free: what you are asked about early is
 * never what you were just shown.
 */
function buildPlannedLessonSteps(
  lesson: Lesson,
  plan: LessonPlan,
  { learner, reviewMode = false }: BuildLessonStepsOptions,
): LessonStep[] {
  // A practice session over a planned lesson teaches nothing: everything in the
  // working set is treated as material to retrieve.
  const kind = reviewMode ? "strengthen" : plan.kind;
  const profile = getLessonProfile(kind, plan.band, plan.scaffold);
  const rng = makeRng(`${lesson.id}-${kind}`);
  const byId = new Map(lesson.phrases.map((phrase) => [phrase.id, phrase]));
  const resolve = (ids: readonly string[]): Phrase[] =>
    ids.map((id) => byId.get(id)).filter((phrase): phrase is Phrase => Boolean(phrase));

  const snapshot = learner ?? emptyLearnerSnapshot();
  const newItems = profile.teachNewItems ? resolve(plan.newPhraseIds) : [];
  const reviewItems = resolve(
    selectReviewItems(
      profile.teachNewItems
        ? plan.reviewPhraseIds
        : [...plan.newPhraseIds, ...plan.reviewPhraseIds],
      snapshot,
      profile.reviewQuestionTarget,
    ),
  );

  // Distractors are drawn from everything in the working set: this unit's
  // items plus the interleaved older ones. Same topic, same register, so wrong
  // options are plausible rather than obviously foreign.
  const optionPool = lesson.phrases;
  const wordPool = buildWordPool(lesson.phrases);
  const capabilities = lesson.curriculumId
    ? getCapabilities(lesson.curriculumId as CourseId)
    : undefined;

  const context: BuildContext = {
    lesson,
    resolveKnown: knownFormsFor(lesson.curriculumId),
    profile,
    snapshot,
    optionPool,
    wordPool,
    capabilities,
    rng,
    counter: { value: 0 },
    formatUse: new Map(),
  };

  // Which item has been asked about, and in which format. Shared by the warm-up
  // checks, the practice block, the recycle slots and the closer, so no part of
  // a lesson unknowingly repeats another part's question.
  const usage = new Map<string, number>();
  const steps: LessonStep[] = reviewMode
    ? []
    : [
        {
          id: `${lesson.id}-intro`,
          type: "intro",
          lesson,
          title: lesson.title,
          body: lesson.summary,
        },
      ];

  // --- teach, with warm-up checks on older material in between ---------------
  const warmUpQueue = [...reviewItems];
  let warmUpsUsed = 0;

  if (profile.teachNewItems) {
    newItems.forEach((phrase, index) => {
      steps.push({
        id: `${lesson.id}-learn-${phrase.id}`,
        type: "learn",
        phrase,
        position: index + 1,
        total: newItems.length,
      });

      if (warmUpsUsed < profile.warmUpChecks && warmUpQueue.length > 0) {
        const older = warmUpQueue.shift();

        if (older) {
          warmUpsUsed += 1;
          const format: StepFormat = warmUpsUsed % 2 === 1 ? "recognize" : "produce";
          const check =
            buildFormatStep(format, older, context) ??
            buildRecognizeStep(older, context);

          markUsed(usage, older, stepFormatOf(check) ?? format);
          steps.push(check);
        }
      }
    });
  }

  const practiceSteps: LessonStep[] = [];

  // --- say it aloud ---------------------------------------------------------
  // Right after the teach cards, while the sound is still in the ear. Ungraded.
  practiceSteps.push(
    ...buildPronounceSteps(newItems.length > 0 ? newItems : reviewItems, context),
  );

  // --- notice ---------------------------------------------------------------
  // Before the grammar card, always: the examples have to be read and the
  // prediction made while the learner still has nothing to recite.
  if (profile.includeNotice && plan.notices?.length) {
    practiceSteps.push(...buildNoticeSteps(plan.notices, context));
  }

  // --- grammar --------------------------------------------------------------
  if (profile.includeGrammar && plan.grammar) {
    practiceSteps.push({
      id: `${lesson.id}-grammar-${plan.grammar.id}`,
      type: "grammar",
      focus: plan.grammar,
    });

    // Skip the derived pattern drill when the unit authored its own frames:
    // an authored pattern says what the unit wants built, where the derived one
    // just takes whatever follows a marker.
    const drills = buildGrammarDrills(plan.grammar, lesson.phrases, lesson.id, 3, {
      includePatterns: !(profile.includePatterns && plan.patterns?.length),
    });

    for (const drill of drills) {
      const step = buildGrammarDrillStep(drill, plan.grammar, context);

      if (step) {
        // Grammar drills count as questions asked, so the practice block that
        // follows doesn't re-ask one of them in the same format.
        markUsed(usage, drill.phrase, stepFormatOf(step) ?? "complete");
        practiceSteps.push(step);
      }
    }
  }

  // --- patterns -------------------------------------------------------------
  // Authored frames: the frame stays put and the slot varies, so the learner
  // practises a structure they can reuse rather than one memorised sentence.
  // They sit after the grammar card because that card is what names the frame.
  if (profile.includePatterns && plan.patterns?.length) {
    const knownWords = new Set<string>();

    for (const phrase of lesson.phrases) {
      for (const word of splitWords(phrase.romanized)) {
        knownWords.add(normalizeWord(word));
      }
    }

    for (const pattern of plan.patterns.slice(0, profile.maxPatternSteps)) {
      const step = buildPatternStep(pattern, context, knownWords);

      if (step) {
        practiceSteps.push(step);
      }
    }
  }

  // --- story ----------------------------------------------------------------
  // Input before work: the story is the language this lesson then practises,
  // so it comes ahead of the practice block rather than after it.
  if (profile.includeStory && plan.stories?.length) {
    practiceSteps.push(...buildStorySteps(plan.stories, context));
  }

  // --- the profile's practice sequence --------------------------------------
  // New items lead so every one of them is definitely checked; the review items
  // the learner model chose follow. Items are matched to formats by shape —
  // asking a learner to "arrange the words" in *el café* is not a sentence
  // exercise, and letting single words fall through to cloze produced lessons
  // that were five "complete the sentence" questions in a row.
  // The queue leads with what this lesson is *for*, then falls back to the rest
  // of the working set. Sentence formats need sentences, and a lesson whose
  // chosen items are all single words would otherwise ask the one sentence it
  // has three times over.
  const chosen = new Set([...newItems, ...reviewItems].map((phrase) => phrase.id));
  const practiceQueue = [
    ...newItems,
    ...reviewItems,
    ...warmUpQueue,
    ...lesson.phrases.filter((phrase) => !chosen.has(phrase.id)),
  ];
  const covered = new Set<string>();

  if (practiceQueue.length > 0) {
    for (const format of profile.formatSequence) {
      const filled = fillPracticeSlot(format, practiceQueue, usage, context);

      if (!filled) {
        continue;
      }

      markUsed(usage, filled.phrase, filled.format);
      covered.add(filled.phrase.id);
      practiceSteps.push(filled.step);
    }
  }

  // Nothing may be taught and then never checked. Recorded in `usage` like any
  // other question, so the recycle slots and closer don't ask it again.
  //
  // The format follows the same rules as the rest of the lesson rather than
  // defaulting to recognition — a sweep-up question is still a question, and a
  // lesson whose leftovers are all "what does this mean?" reads as a glossary.
  for (const phrase of newItems) {
    if (covered.has(phrase.id)) {
      continue;
    }

    const filled = fillPracticeSlot("produce", [phrase], usage, context);
    const step = filled?.step ?? buildRecognizeStep(phrase, context);

    markUsed(usage, phrase, filled?.format ?? "recognize");
    practiceSteps.push(step);
    covered.add(phrase.id);
  }

  // --- dialogue -------------------------------------------------------------
  if (profile.includeDialogue) {
    practiceSteps.push(...buildDialogueSteps(lesson, plan, context));
  }

  // --- recycle slots --------------------------------------------------------
  // Filled with ordinary review questions now, rewritten on a miss later. The
  // step count never changes, so the progress bar only ever moves forward.
  const recyclePool = [...reviewItems, ...newItems];
  for (let slot = 0; slot < profile.recycleSlots; slot += 1) {
    // Decide the format first, then pick the item least asked about *in that
    // format* — otherwise a slot can quietly repeat a question the practice
    // block already used.
    const slotFormat: StepFormat = slot % 2 === 0 ? "recognize" : "produce";
    const filled = fillPracticeSlot(slotFormat, recyclePool, usage, context);

    if (!filled) {
      break;
    }

    markUsed(usage, filled.phrase, filled.format);
    practiceSteps.push({
      ...filled.step,
      id: `${lesson.id}-${RECYCLE_PREFIX}-${slot}`,
    });
  }

  // --- closer ---------------------------------------------------------------
  const lastStep = practiceSteps[practiceSteps.length - 1];

  if (!lastStep || stepDifficulty(lastStep) > EASY_CLOSER_MAX) {
    // Recognition is the gentlest way to finish, unless the lesson has already
    // leaned on it — in which case "pick the Spanish" is just as easy a win and
    // does not tip the session into being mostly glossary.
    const asked = practiceSteps.filter((step) => !isTeachingStep(step));
    const recognitions = asked.filter((step) => step.type === "recognize").length;
    const closerFormat: StepFormat =
      asked.length > 0 && recognitions * 2 >= asked.length ? "produce" : "recognize";
    const closer = fillPracticeSlot(
      closerFormat,
      [...newItems, ...reviewItems],
      usage,
      context,
    );

    if (closer) {
      practiceSteps.push({
        ...closer.step,
        id: `${lesson.id}-closer-${closer.phrase.id}`,
      });
    }
  }

  steps.push(...practiceSteps);

  return spaceRepeatedItems(enforceTeachTestLag(steps));
}

type BuildContext = {
  lesson: Lesson;
  /** How the course decides a word is already known; see `KnownWordResolver`. */
  resolveKnown?: (word: string, known: ReadonlySet<string>) => boolean;
  profile: LessonProfile;
  /**
   * What the learner has done with each item, for the difficulty ladder in
   * `@/lib/learning-state`. Absent — or empty, for a first-time learner — means
   * the profile's own `formatSequence` decides, unchanged.
   */
  snapshot?: LearnerSnapshot;
  optionPool: readonly Phrase[];
  wordPool: string[];
  capabilities: ReturnType<typeof getCapabilities> | undefined;
  rng: Rng;
  /** Makes every generated step id unique even when a phrase repeats. */
  counter: { value: number };
  /** How many times each format has been asked, for instruction wording. */
  formatUse: Map<StepFormat, number>;
};

function nextStepId(context: BuildContext, format: string, phrase: Phrase): string {
  context.counter.value += 1;
  return `${context.lesson.id}-${format}-${context.counter.value}-${phrase.id}`;
}

/**
 * Parts of speech that carry no meaning on their own.
 *
 * `Phrase.category` holds the curriculum's `part_of_speech`, which is a better
 * judge of this than word shape: *pero* is five letters and passes every
 * heuristic, and is still nothing to listen to by itself.
 */
const FUNCTION_CATEGORIES = new Set([
  "conjunction",
  "preposition",
  "article",
  "pronoun",
  "determiner",
]);

function isFunctionCategory(phrase: Phrase): boolean {
  return FUNCTION_CATEGORIES.has(phrase.category.toLowerCase());
}

/**
 * A vocabulary entry written as a gendered pair ("el profesor/la profesora") is
 * two words, not a sentence. Building a word bank from it produces tokens like
 * "profesor/la", so sentence formats skip these.
 */
function isSlashVariant(phrase: Phrase): boolean {
  return phrase.romanized.includes("/");
}

/**
 * How many words a format needs to be worth asking. Below the minimum the
 * question either can't be built at all (`order` on one word) or is a worse
 * version of a simpler format.
 */
/**
 * Blank a word without dragging its punctuation into the answer: the learner
 * should pick "té", not "té." — and the sentence should still read
 * "Para mí, un ___."
 */
function splitBlank(words: string[], blankIndex: number) {
  const raw = words[blankIndex];
  const leading = raw.match(/^[¿¡"']+/)?.[0] ?? "";
  const withoutLeading = raw.slice(leading.length);
  const trailing = withoutLeading.match(/[.,;:!?"']+$/)?.[0] ?? "";
  const answer = trailing
    ? withoutLeading.slice(0, withoutLeading.length - trailing.length)
    : withoutLeading;
  const rest = words.slice(blankIndex + 1).join(" ");
  const before = words.slice(0, blankIndex).join(" ");

  return {
    answer,
    // The opening "¿" belongs to the sentence, not to the word being chosen.
    before: leading ? `${before} ${leading}`.trim() : before,
    after: rest ? `${trailing} ${rest}`.trim() : trailing,
  };
}

/**
 * Cloze distractors should be words that could plausibly fill the gap. Function
 * words can't: nobody is choosing between "agua" and "el".
 */
function contentWordPool(wordPool: readonly string[], answer: string): string[] {
  const answerKey = normalizeWord(answer);
  const pool = wordPool.filter(
    (word) => isContentWord(word) && normalizeWord(word) !== answerKey,
  );

  return pool.length >= 2
    ? pool
    : wordPool.filter((word) => normalizeWord(word) !== answerKey);
}

const FORMAT_MIN_WORDS: Record<StepFormat, number> = {
  recognize: 1,
  produce: 1,
  // Cloze wants a real sentence: blanking the only content word of "el café"
  // leaves "el ___", which is a vocabulary question wearing a cloze costume.
  complete: 3,
  // One word is a perfectly good listening question — hear it, pick it out of
  // four. Requiring two turned every single-word listening slot into "what does
  // this mean?", which is how a listening lesson ended up mostly reading.
  listen: 1,
  order: 3,
  translate: 3,
};

/**
 * Items ranked by how well they suit a format: ones that actually fit it first,
 * then the ones asked about least, then the curriculum's own order. This is what
 * spreads a lesson across its working set instead of drilling the first phrase
 * six times.
 */
function rankCandidates(
  format: StepFormat,
  queue: readonly Phrase[],
  usage: ReadonlyMap<string, number>,
): Phrase[] {
  const minWords = FORMAT_MIN_WORDS[format];

  return queue
    .map((phrase, index) => {
      const fits = splitWords(phrase.romanized).length >= minWords;
      const timesUsed = usage.get(phrase.id) ?? 0;

      return { phrase, score: (fits ? 1000 : 0) - timesUsed * 10 - index * 0.01 };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.phrase);
}

function pickPhraseForFormat(
  format: StepFormat,
  queue: readonly Phrase[],
  usage: ReadonlyMap<string, number>,
): Phrase | undefined {
  return rankCandidates(format, queue, usage)[0];
}

/** Does this snapshot know anything at all? */
function hasHistory(snapshot: LearnerSnapshot | undefined): snapshot is LearnerSnapshot {
  return Boolean(snapshot && Object.keys(snapshot.memory).length > 0);
}

/**
 * The formats worth trying for one item, in order.
 *
 * The profile's request leads whenever the item's state allows it — that is
 * what keeps a listening lesson a listening lesson. When it doesn't, the
 * ladder's own top rung is used instead: asking someone to transcribe a word
 * they met once is not a listening exercise, it's a guess.
 */
function slotFormats(
  phrase: Phrase,
  requested: StepFormat,
  context: BuildContext,
  usage?: ReadonlyMap<string, number>,
): StepFormat[] {
  const fallbacks = usage
    ? fallbacksLeastUsedFirst(requested, usage)
    : [requested, ...FORMAT_FALLBACKS[requested]];

  if (!hasHistory(context.snapshot)) {
    return fallbacks;
  }

  const state = itemState(phrase.id, context.snapshot);

  // An item the learner has never met is not "at the bottom of the ladder" —
  // it is off it. It was taught in this lesson, minutes ago, and what to ask
  // about it is the profile's business. Running it through the ladder made
  // every brand-new word a recognition question and turned a Discover lesson
  // into eight glosses in a row.
  if (state === "unseen") {
    return fallbacks;
  }

  const rungs = formatLadder(state, context.profile);
  const ordered = rungs.includes(requested) ? [requested, ...rungs] : rungs;

  return [...new Set([...ordered, ...fallbacks])];
}

/**
 * Item-first slot filling, used only once the learner has a history.
 *
 * The cold path asks "who can answer this format?"; this asks "what is this
 * learner ready to be asked about this item?", which is the difference between
 * a lesson that repeats itself and one that climbs.
 *
 * The two passes matter. Asking each candidate's ladder straight away sounds
 * right and is wrong: the first candidate for a `translate` slot might be an
 * item met once, whose ladder tops out at `recognize`, and the slot silently
 * becomes a vocabulary question. Do that across a lesson and a returning
 * learner gets ten "what does this mean?" in a row — the exact complaint this
 * work exists to answer. So: first look for an item that is *ready* for the
 * format the profile asked for, and only drop a rung when none is.
 */
function fillFromLadder(
  requested: StepFormat,
  queue: readonly Phrase[],
  usage: ReadonlyMap<string, number>,
  context: BuildContext,
): { phrase: Phrase; format: StepFormat; step: LessonStep } | null {
  if (!hasHistory(context.snapshot)) {
    return null;
  }

  const ranked = rankCandidates(requested, queue, usage);
  const unused = (phrase: Phrase, format: StepFormat) =>
    (usage.get(`${phrase.id}::${format}`) ?? 0) === 0;

  // Pass 1: someone ready for the question the profile wanted to ask.
  for (const phrase of ranked) {
    if (!slotFormats(phrase, requested, context, usage).includes(requested)) {
      continue;
    }

    if (!unused(phrase, requested)) {
      continue;
    }

    const step = tryBuildFormat(requested, phrase, context);

    if (step) {
      return { phrase, format: requested, step };
    }
  }

  // Pass 2: nobody is. Take the best each candidate is ready for.
  for (const phrase of ranked) {
    for (const format of slotFormats(phrase, requested, context, usage)) {
      if (!unused(phrase, format)) {
        continue;
      }

      const step = tryBuildFormat(format, phrase, context);

      if (step) {
        return { phrase, format, step };
      }
    }
  }

  return null;
}

/**
 * How often this lesson has already asked in each format.
 *
 * `usage` is keyed `phraseId::format`, so the per-format totals are one fold
 * away — and they are what stops a fallback chain quietly turning a lesson into
 * one question repeated.
 */
function formatCounts(usage: ReadonlyMap<string, number>): Map<StepFormat, number> {
  const counts = new Map<StepFormat, number>();

  for (const [key, times] of usage) {
    const format = key.split("::")[1] as StepFormat;
    counts.set(format, (counts.get(format) ?? 0) + times);
  }

  return counts;
}

/**
 * The fallback chain, reordered so the lesson's least-used format comes first.
 *
 * The requested format keeps its place at the head — that is the profile's
 * intent and it should be tried first. The *fallbacks* are a different matter.
 * `listen` falls back to `recognize`, which is right when one item cannot be
 * heard; it is wrong when the whole course has no audio, because then every
 * listening slot in the lesson becomes another "what does this mean?". A
 * Bengali Discover lesson was coming out four-sevenths recognition for exactly
 * that reason.
 *
 * Ties keep the authored chain order, so this only reorders where the lesson
 * has real evidence of over-using something.
 */
function fallbacksLeastUsedFirst(
  format: StepFormat,
  usage: ReadonlyMap<string, number>,
): StepFormat[] {
  const counts = formatCounts(usage);
  const chain = FORMAT_FALLBACKS[format];

  return [
    format,
    ...chain
      .map((candidate, index) => ({ candidate, index }))
      .sort(
        (a, b) =>
          (counts.get(a.candidate) ?? 0) - (counts.get(b.candidate) ?? 0) || a.index - b.index,
      )
      .map((entry) => entry.candidate),
  ];
}

/**
 * Fill one slot in the profile's practice sequence, never repeating a question
 * the lesson has already asked.
 *
 * Some lessons hold only one long sentence, and asking the learner to arrange
 * it three times is worse than varying the format. So: try the requested format
 * on the best unused item; failing that, walk the fallback chain for any
 * item/format pair this lesson hasn't used yet.
 */
function fillPracticeSlot(
  format: StepFormat,
  queue: readonly Phrase[],
  usage: ReadonlyMap<string, number>,
  context: BuildContext,
): { phrase: Phrase; format: StepFormat; step: LessonStep } | null {
  // A learner with a history gets asked at the level each item has earned; a
  // first-time learner gets the profile's sequence exactly as before, so a
  // cold-start lesson stays deterministic and every existing assertion about
  // it still describes real behaviour.
  const laddered = fillFromLadder(format, queue, usage, context);

  if (laddered) {
    return laddered;
  }

  const formats = fallbacksLeastUsedFirst(format, usage);

  for (const candidateFormat of formats) {
    for (const phrase of rankCandidates(candidateFormat, queue, usage)) {
      if ((usage.get(`${phrase.id}::${candidateFormat}`) ?? 0) > 0) {
        continue;
      }

      const step = tryBuildFormat(candidateFormat, phrase, context);

      if (step) {
        return { phrase, format: candidateFormat, step };
      }
    }
  }

  // Everything this lesson can ask, it has already asked. Dropping the slot is
  // better than asking an identical question twice — the slot is a recycle
  // reserve or an easy closer, and a lesson one question shorter beats a lesson
  // that repeats itself.
  return null;
}

/** Record that `phrase` was just asked about in `format`. */
function markUsed(usage: Map<string, number>, phrase: Phrase, format: StepFormat) {
  usage.set(phrase.id, (usage.get(phrase.id) ?? 0) + 1);
  const key = `${phrase.id}::${format}`;
  usage.set(key, (usage.get(key) ?? 0) + 1);
}

function buildRecognizeStep(
  phrase: Phrase,
  context: BuildContext,
): Extract<LessonStep, { type: "recognize" }> {
  const id = nextStepId(context, "recognize", phrase);

  return {
    id,
    type: "recognize",
    phrase,
    prompt: `What does "${formatRomanizedDisplay(phrase.romanized)}" mean?`,
    options: buildMeaningOptions(phrase, context.optionPool, id),
  };
}

/**
 * Build one question in the requested format, walking the fallback chain when
 * the phrase can't support it (a one-word phrase can't be arranged; a course
 * without reliable speech can't be listened to).
 */
function buildFormatStep(
  format: StepFormat,
  phrase: Phrase,
  context: BuildContext,
  attempted: Set<StepFormat> = new Set(),
): LessonStep | null {
  if (attempted.has(format)) {
    return null;
  }

  attempted.add(format);

  const step = tryBuildFormat(format, phrase, context);

  if (step) {
    return step;
  }

  for (const fallback of FORMAT_FALLBACKS[format]) {
    const built = buildFormatStep(fallback, phrase, context, attempted);

    if (built) {
      return built;
    }
  }

  return null;
}

/** The format a built step actually ended up using. */
function stepFormatOf(step: LessonStep): StepFormat | null {
  switch (step.type) {
    case "recognize":
    case "produce":
    case "complete":
    case "order":
    case "translate":
    case "listen":
      return step.type;
    default:
      return null;
  }
}

function tryBuildFormat(
  format: StepFormat,
  phrase: Phrase,
  context: BuildContext,
): LessonStep | null {
  const words = splitWords(phrase.romanized);

  switch (format) {
    case "recognize":
      return buildRecognizeStep(phrase, context);

    case "produce": {
      const id = nextStepId(context, "produce", phrase);
      const options = buildTargetOptions(phrase, context.optionPool, id);

      return options.length < 2
        ? null
        : {
            id,
            type: "produce",
            phrase,
            prompt: `Which one means "${capitalizeDisplayText(phrase.english)}"?`,
            options,
          };
    }

    case "complete": {
      if (words.length < FORMAT_MIN_WORDS.complete) {
        return null;
      }

      const id = nextStepId(context, "complete", phrase);
      const blankIndex = pickBlankIndex(words);
      const blank = splitBlank(words, blankIndex);

      return {
        id,
        type: "complete",
        phrase,
        before: blank.before,
        after: blank.after,
        answer: blank.answer,
        // The profile decides whether the English meaning stays on screen.
        hint: context.profile.showMeaningHint ? phrase.english : "",
        options: buildWordOptions(
          blank.answer,
          contentWordPool(context.wordPool, blank.answer),
          id,
        ),
        prompt: promptFor("complete", "Pick the missing word to complete the sentence.", context),
      };
    }

    case "order": {
      if (words.length < 3 || isSlashVariant(phrase)) {
        return null;
      }

      return {
        id: nextStepId(context, "order", phrase),
        type: "order",
        phrase,
        tokens: shuffleTokens(words),
        prompt: promptFor("order", "Tap the words in the correct order.", context),
      };
    }

    case "translate": {
      if (words.length < 3 || isSlashVariant(phrase)) {
        return null;
      }

      const id = nextStepId(context, "translate", phrase);
      // Compare normalized, or "café" sneaks in as a distractor beside the
      // sentence's own "café," and the bank reads as a typo.
      const used = new Set(words.map(normalizeWord));
      const distractors = seededShuffle(
        context.wordPool.filter((word) => !used.has(normalizeWord(word))),
        context.rng,
      ).slice(0, context.profile.wordBankPadding);

      // At the lowest scaffold level the bank comes away entirely and the
      // learner writes the sentence. The tokens are still built so a struggling
      // learner can be handed the bank back mid-lesson (`adaptUpcomingSteps`).
      const typed = context.profile.allowTypedAnswers;

      return {
        id,
        type: "translate",
        phrase,
        tokens: shuffle([...words, ...distractors]),
        prompt: typed
          ? withLanguage("Write this in {language}.", context.lesson)
          : promptFor("translate", "Tap the words to build the translation.", context),
        typed,
      };
    }

    case "listen": {
      const listeningEnabled =
        FEATURES.listening || Boolean(context.capabilities?.listening);

      // A single word can be a listening question, but only a real one. "Tap
      // what you hear" on *a*, *pero* or *y* tests hearing, not Spanish — so a
      // lone word has to be one that carries meaning, judged by the part of
      // speech the curriculum gave it as well as by its shape.
      const singleFunctionWord =
        words.length === 1 && (!isContentWord(words[0]) || isFunctionCategory(phrase));

      if (
        !listeningEnabled ||
        words.length < 1 ||
        singleFunctionWord ||
        isSlashVariant(phrase)
      ) {
        return null;
      }

      // Pad the bank so "tap what you hear" is a real transcription rather
      // than putting two given words in order. The floor matters more than the
      // profile here: at the highest scaffold level the padding is 0, and a
      // two-word sentence would otherwise arrive as two tiles and no choice.
      const heard = new Set(words.map(normalizeWord));
      const extras = seededShuffle(
        context.wordPool.filter((word) => !heard.has(normalizeWord(word))),
        context.rng,
      ).slice(0, Math.max(context.profile.wordBankPadding, MIN_LISTEN_PADDING));

      return {
        id: nextStepId(context, "listen", phrase),
        type: "listen",
        phrase,
        tokens: shuffle([...words, ...extras]),
        prompt: promptFor("listen", "Tap what you hear.", context),
      };
    }

    default:
      return null;
  }
}

/**
 * A question built from an authored sentence frame.
 *
 * The frame is fixed and the slot varies, so the learner practises *the
 * structure* rather than one memorised sentence: `Quiero ___` against un café /
 * el té / el agua. Fills the learner has not met are filtered out, so an early
 * unit only ever offers words it has taught.
 */
function buildPatternStep(
  pattern: LanguagePattern,
  context: BuildContext,
  known: ReadonlySet<string>,
): LessonStep | null {
  // Judge a fill by its content words, through the same "does the learner have
  // this?" test the curriculum layer uses — so `Canadá` counts as readable
  // without the course having to teach every place name, and "un café" is not
  // rejected for an article.
  const usable = pattern.fills.filter((fill) => {
    const words = splitWords(fill.target).filter(isContentWord);
    const check = words.length > 0 ? words : splitWords(fill.target);

    return check.every(
      (word) =>
        known.has(normalizeWord(word)) ||
        (context.resolveKnown?.(normalizeWord(word), known) ?? false),
    );
  });

  // One answer and two alternatives is the smallest thing that still asks a
  // question; below that the frame has nothing to vary.
  if (usable.length < 3) {
    return null;
  }

  const rng = makeRng(`${context.lesson.id}-${pattern.id}`);
  const [answer, ...rest] = seededShuffle(usable, rng);
  const [before, after = ""] = pattern.template.split("{}");
  const phrase: Phrase = {
    id: pattern.id,
    romanized: pattern.template.replace("{}", answer.target),
    english: pattern.english.replace("{}", answer.english),
    pronunciation: "",
    category: "phrase",
  };

  context.counter.value += 1;

  return {
    id: `${context.lesson.id}-pattern-${context.counter.value}-${pattern.id}`,
    type: "complete",
    phrase,
    before: before.trim(),
    after: after.trim(),
    answer: answer.target,
    hint: pattern.english.replace("{}", answer.english),
    options: seededShuffle(
      [answer.target, ...rest.slice(0, 3).map((fill) => fill.target)],
      rng,
    ),
    prompt: `Use the pattern: ${before.trim()} …`,
    conceptIds: pattern.concepts,
  };
}

/** A grammar drill, rendered with the question types the learner already knows. */
function buildGrammarDrillStep(
  drill: GrammarDrill,
  focus: GrammarFocus,
  context: BuildContext,
): LessonStep | null {
  if (drill.kind === "order") {
    return tryBuildFormat("order", drill.phrase, context);
  }

  if (drill.kind === "pattern") {
    return {
      id: nextStepId(context, "pattern", drill.phrase),
      type: "complete",
      conceptIds: [focus.id],
      phrase: drill.phrase,
      before: drill.before,
      after: drill.after,
      answer: drill.answer,
      hint: drill.hint,
      options: drill.options,
      prompt: `Use the pattern: ${drill.patternLabel}`,
      grammarNote: focus.explanation,
    };
  }

  const id = nextStepId(context, "grammar-drill", drill.phrase);

  return {
    id,
    type: "complete",
    phrase: drill.phrase,
    before: drill.before,
    after: drill.after,
    answer: drill.answer,
    hint: drill.hint,
    options: drill.options,
    prompt: `${focus.title}: pick the right form.`,
    grammarNote: focus.explanation,
    conceptIds: [focus.id],
  };
}

/**
 * A prediction or comprehension question.
 *
 * Authored, options and all: "which form would Spanish use here?" and "why did
 * she say that?" are judgements, not something to generate from a phrase list.
 */
function buildChoiceStep(
  question: ChoiceQuestion,
  context: BuildContext,
  key: string,
  audioTarget?: string,
): LessonStep | null {
  const options = [...new Set(question.options)];

  // Two real alternatives is the floor; below it the learner is pressing
  // "continue" with extra steps.
  if (options.length < 2 || !options.includes(question.answer)) {
    return null;
  }

  context.counter.value += 1;

  return {
    id: `${context.lesson.id}-choice-${context.counter.value}-${key}`,
    type: "choice",
    prompt: question.prompt,
    options: seededShuffle(options, context.rng),
    answer: question.answer,
    explanation: question.explanation,
    conceptIds: question.concepts,
    audioTarget,
  };
}

/**
 * Pattern discovery: examples, then a form nobody taught.
 *
 * The card carries no rule. The rule is the prediction's `explanation`, shown
 * only once the learner has committed to an answer — because an explanation
 * read *after* a guess is the one that sticks, and because getting it right is
 * itself the evidence that the pattern was ready to be named.
 */
function buildNoticeSteps(
  notices: readonly NoticeCard[],
  context: BuildContext,
): LessonStep[] {
  const steps: LessonStep[] = [];

  for (const card of notices) {
    const question = buildChoiceStep(card.question, context, card.id);

    // No question means no discovery — a card of examples on its own is a
    // wall of text the learner scrolls past.
    if (!question) {
      continue;
    }

    steps.push({ id: `${context.lesson.id}-notice-${card.id}`, type: "notice", card });
    steps.push(question);
  }

  return steps;
}

/** A story, then what it meant. The transcript stays hidden until asked for. */
function buildStorySteps(
  stories: readonly StoryScript[],
  context: BuildContext,
): LessonStep[] {
  const steps: LessonStep[] = [];

  for (const story of stories) {
    const questions = story.questions
      .map((question, index) =>
        buildChoiceStep(question, context, `${story.id}-q${index}`),
      )
      .filter((step): step is LessonStep => Boolean(step));

    if (questions.length === 0) {
      continue;
    }

    steps.push({ id: `${context.lesson.id}-story-${story.id}`, type: "story", story });
    steps.push(...questions);
  }

  return steps;
}

/**
 * Say it out loud.
 *
 * Deliberately ungraded and unrecorded. The app has no speech recognition, and
 * a step that *looked* like it was listening would be a lie the learner would
 * believe. Saying a sentence aloud is worth doing anyway, so it is offered as
 * exactly that and nothing more.
 */
function buildPronounceSteps(
  candidates: readonly Phrase[],
  context: BuildContext,
): LessonStep[] {
  const count = context.profile.pronounceSteps;

  if (count <= 0) {
    return [];
  }

  // Sentences first: repeating a single word teaches less than repeating a
  // phrase with a shape to it.
  const ranked = [...candidates]
    .filter((phrase) => !isSlashVariant(phrase))
    .sort(
      (a, b) =>
        splitWords(b.romanized).length - splitWords(a.romanized).length,
    );

  return ranked.slice(0, count).map((phrase) => ({
    id: `${context.lesson.id}-pronounce-${phrase.id}`,
    type: "pronounce" as const,
    phrase,
    prompt: "Listen, then say it out loud.",
  }));
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

/**
 * "Use in context" as a real exchange.
 *
 * Authored turns are preferred: which reply *answers* a question is a semantic
 * judgement, and the old behaviour — pair `phrases[0]` with `phrases[1]` —
 * happily offered "See you tomorrow" as the reply to "How much does it cost?".
 * Where a unit has no authored dialogue, `inferDialogueTurn` only pairs a
 * question with a non-question that shares vocabulary, and returns nothing at
 * all rather than an incoherent exchange.
 */
function buildDialogueSteps(
  lesson: Lesson,
  plan: LessonPlan,
  context: BuildContext,
): LessonStep[] {
  const script = plan.dialogue;
  const turns: DialogueTurn[] = script?.turns?.length
    ? script.turns.slice(0, context.profile.maxDialogueTurns)
    : ([inferDialogueTurn(lesson)].filter(Boolean) as DialogueTurn[]);

  if (turns.length === 0) {
    return [];
  }

  const steps: LessonStep[] = [];
  const history: Array<{ speaker: "them" | "you"; romanized: string; english: string }> = [];

  turns.forEach((turn, index) => {
    const options = buildDialogueOptions(turn, lesson, context);

    // Without real alternatives it isn't a question, it's a "tap continue".
    if (options.length < 3) {
      return;
    }

    const phrase =
      lesson.phrases.find((item) => item.romanized === turn.reply.target) ??
      ({
        id: `${lesson.id}-dialogue-${index}`,
        romanized: turn.reply.target,
        english: turn.reply.english,
        pronunciation: "",
        category: "phrase",
      } satisfies Phrase);

    steps.push({
      id: `${lesson.id}-dialogue-${index}`,
      type: "dialogue",
      phrase,
      promptRomanized: turn.prompt.target,
      promptEnglish: turn.prompt.english,
      options,
      answer: turn.reply.target,
      prompt: DIALOGUE_PROMPTS[index % DIALOGUE_PROMPTS.length],
      scenario: script?.scenario,
      speaker: turn.speaker,
      turnIndex: index,
      promptReceptive: turn.prompt.receptive,
      history: [...history],
    });

    history.push(
      { speaker: "them", romanized: turn.prompt.target, english: turn.prompt.english },
      { speaker: "you", romanized: turn.reply.target, english: turn.reply.english },
    );
  });

  return steps;
}

function buildDialogueOptions(
  turn: DialogueTurn,
  lesson: Lesson,
  context: BuildContext,
): string[] {
  const authored = (turn.distractors ?? []).filter(
    (option) => option !== turn.reply.target,
  );

  if (authored.length >= 2) {
    return seededShuffle([turn.reply.target, ...authored.slice(0, 3)], context.rng);
  }

  // Fall back to the most confusable phrases in the working set, then top up
  // with any authored distractors we do have.
  const answerPhrase =
    lesson.phrases.find((item) => item.romanized === turn.reply.target) ??
    ({
      id: "dialogue-answer",
      romanized: turn.reply.target,
      english: turn.reply.english,
      pronunciation: "",
      category: "phrase",
    } satisfies Phrase);
  const pool = lesson.phrases.filter(
    (item) =>
      item.romanized !== turn.reply.target &&
      item.romanized !== turn.prompt.target &&
      // A reply to a question should not itself be a question.
      item.romanized.includes("?") === turn.reply.target.includes("?"),
  );
  const generated = buildTargetOptions(
    answerPhrase,
    pool,
    `${lesson.id}-dialogue-${turn.reply.target}`,
  );

  return Array.from(new Set([...generated, ...authored])).slice(0, 4);
}

/**
 * The unauthored fallback.
 *
 * Two rules, and they are the whole difference from the old behaviour (which
 * paired `phrases[0]` with `phrases[1]` and cheerfully offered "See you
 * tomorrow" as the answer to "How much does it cost?"):
 *
 * 1. The prompt must be a **question** and the reply must **not** be one.
 * 2. Prefer a reply that shares a content word with the question; failing that,
 *    accept a statement from the same unit, whose phrases all serve one
 *    communicative goal ("order at a café"), so the pair is at least on topic.
 *
 * No question, or no statement, means no dialogue — an incoherent exchange is
 * worse than none.
 */
function inferDialogueTurn(lesson: Lesson): DialogueTurn | null {
  const questions = lesson.phrases.filter((phrase) => phrase.romanized.includes("?"));
  const statements = lesson.phrases.filter(
    (phrase) =>
      !phrase.romanized.includes("?") &&
      splitWords(phrase.romanized).length >= SENTENCE_MIN_WORDS,
  );

  if (questions.length === 0 || statements.length === 0) {
    return null;
  }

  const asTurn = (question: Phrase, statement: Phrase): DialogueTurn => ({
    prompt: { target: question.romanized, english: question.english },
    reply: { target: statement.romanized, english: statement.english },
  });

  for (const question of questions) {
    const questionWords = new Set(
      splitWords(question.romanized.toLowerCase())
        .map(normalizeWord)
        .filter((word) => word.length > 3),
    );

    for (const statement of statements) {
      const shares = splitWords(statement.romanized.toLowerCase()).some((word) =>
        questionWords.has(normalizeWord(word)),
      );

      if (shares) {
        return asTurn(question, statement);
      }
    }
  }

  return asTurn(questions[0], statements[0]);
}

// ---------------------------------------------------------------------------
// Teach/test lag, mistake recycling, and in-lesson adaptation
// ---------------------------------------------------------------------------

/** How many steps must pass before a missed item is asked again. */
export const MIN_RECYCLE_GAP = 3;

/**
 * Push any question that lands too soon after its own teach card further down
 * the lesson.
 *
 * The profiles are arranged so this rarely fires, but a grammar drill or a
 * dialogue reply can happen to land on the item that was just introduced. This
 * is the safety net for the one rule the app is not allowed to break, and it
 * moves the step rather than dropping it, so nothing taught goes unchecked.
 */
export function enforceTeachTestLag(steps: LessonStep[]): LessonStep[] {
  const out = [...steps];

  // Each pass can only move steps later, so this terminates; the bound is
  // belt-and-braces against pathological content.
  for (let pass = 0; pass < 8; pass += 1) {
    const violation = findLagViolation(out);

    if (violation < 0) {
      return out;
    }

    const [step] = out.splice(violation, 1);
    const target = Math.min(out.length, violation + TEACH_TEST_LAG + 1);
    out.splice(target, 0, step);
  }

  return out;
}

function findLagViolation(steps: LessonStep[]): number {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];

    if (step.type !== "learn") {
      continue;
    }

    for (
      let ahead = 1;
      ahead <= TEACH_TEST_LAG && index + ahead < steps.length;
      ahead += 1
    ) {
      const later = steps[index + ahead];

      if (later.type === "learn" || later.type === "intro") {
        continue;
      }

      if (getStepPhraseId(later) === step.phrase.id) {
        return index + ahead;
      }
    }
  }

  return -1;
}

/**
 * How many steps must separate two questions about the same item.
 *
 * The teach/test lag stops "read *adiós*, click *adiós*". This stops the other
 * half of the same problem: being asked about `adiós` twice in a row, which
 * tests whether the last screen is still on the retina rather than whether the
 * word is known. Retrieval has to be interrupted to be retrieval.
 */
export const MIN_RETRIEVAL_GAP = 2;

/**
 * Push apart consecutive questions about the same item.
 *
 * Runs after `enforceTeachTestLag` and moves steps *later* only, so the two
 * passes cannot fight each other. A step with nowhere later to go is left where
 * it is: a slightly close repeat beats dropping a question.
 */
export function spaceRepeatedItems(steps: LessonStep[]): LessonStep[] {
  const out = [...steps];

  for (let pass = 0; pass < 8; pass += 1) {
    const violation = findRepeatViolation(out);

    if (violation < 0) {
      return out;
    }

    const [step] = out.splice(violation, 1);
    const target = Math.min(out.length, violation + MIN_RETRIEVAL_GAP);

    // Nothing to move it past — leave it alone rather than loop forever.
    if (target <= violation) {
      out.splice(violation, 0, step);
      return out;
    }

    out.splice(target, 0, step);
  }

  return out;
}

function findRepeatViolation(steps: LessonStep[]): number {
  for (let index = 1; index < steps.length; index += 1) {
    const phraseId = getStepPhraseId(steps[index]);

    if (!phraseId || isTeachingStep(steps[index])) {
      continue;
    }

    for (
      let back = 1;
      back < MIN_RETRIEVAL_GAP && index - back >= 0;
      back += 1
    ) {
      const earlier = steps[index - back];

      // A teach card is handled by `enforceTeachTestLag`; this pass is only
      // about two *questions* landing on top of each other.
      if (isTeachingStep(earlier)) {
        continue;
      }

      if (getStepPhraseId(earlier) === phraseId) {
        return index;
      }
    }
  }

  return -1;
}

/** A question step that reuses a recycle slot keeps this marker in its id. */
export function isRecycleSlot(step: LessonStep): boolean {
  return step.id.includes(`-${RECYCLE_PREFIX}-`);
}

/** Ask the same thing a different way — never the format that was just missed. */
const RECYCLE_FORMAT: Record<string, StepFormat> = {
  recognize: "produce",
  produce: "recognize",
  complete: "produce",
  order: "complete",
  translate: "order",
  listen: "recognize",
  dialogue: "produce",
};

/**
 * Bring a missed item back later in the lesson.
 *
 * Showing the correction and immediately re-asking the same question tests
 * short-term memory and nothing else. Instead the next unused recycle slot —
 * already several questions away — is rewritten to ask about the missed item
 * **in a different format**. Because the slot already existed, the lesson does
 * not get longer and the progress bar does not jump backwards.
 *
 * Returns the original array when there is nothing to do, so callers can use
 * referential equality to skip a re-render.
 */
export function applyMistakeRecycling(
  steps: LessonStep[],
  currentIndex: number,
  missedStep: LessonStep,
  lesson: Lesson,
): LessonStep[] {
  const phraseId = getStepPhraseId(missedStep);

  if (!phraseId) {
    return steps;
  }

  const phrase = lesson.phrases.find((item) => item.id === phraseId);

  if (!phrase) {
    return steps;
  }

  const slotIndex = steps.findIndex(
    (step, index) => index >= currentIndex + MIN_RECYCLE_GAP && isRecycleSlot(step),
  );

  if (slotIndex < 0) {
    return steps;
  }

  const context = buildContextFor(lesson);
  const preferred = RECYCLE_FORMAT[missedStep.type] ?? "recognize";
  // Ask it a way the lesson hasn't already asked it — the point of recycling is
  // a second route to the same item, not the same question again.
  const asked = new Set(
    steps
      .filter((step, index) => index !== slotIndex && getStepPhraseId(step) === phraseId)
      .map((step) => step.type),
  );
  let replacement: LessonStep | null = null;

  for (const format of [preferred, ...FORMAT_FALLBACKS[preferred]]) {
    const candidate = buildFormatStep(format, phrase, context);

    if (candidate && !asked.has(candidate.type)) {
      replacement = candidate;
      break;
    }
  }

  replacement ??= buildFormatStep(preferred, phrase, context) ??
    buildRecognizeStep(phrase, context);

  const out = [...steps];
  out[slotIndex] = {
    ...replacement,
    // Consume the slot: `isRecycleSlot` no longer matches, so a second mistake
    // takes the next slot instead of overwriting this one.
    id: `${lesson.id}-recycled-${slotIndex}-${phrase.id}`,
  };

  return out;
}

/** How many of the last few answers were wrong, for support decisions. */
export type StruggleSignal = {
  recentResults: boolean[];
};

const STRUGGLE_WINDOW = 4;
const STRUGGLE_MISSES = 2;

export function isStruggling({ recentResults }: StruggleSignal): boolean {
  const window = recentResults.slice(-STRUGGLE_WINDOW);
  return window.filter((correct) => !correct).length >= STRUGGLE_MISSES;
}

/** Easier version of a hard format, for a learner who is having a rough run. */
const SUPPORT_DOWNGRADE: Partial<Record<LessonStepType, StepFormat>> = {
  translate: "order",
  order: "complete",
  listen: "recognize",
};

/**
 * Give a struggling learner the scaffolding back.
 *
 * If the last few answers have gone badly, the next hard question becomes a
 * more supported one on the same phrase — a word bank instead of a free
 * translation. The learner still meets the material; they just aren't asked to
 * climb while they're slipping. Returns the original array when nothing
 * changes.
 */
export function adaptUpcomingSteps(
  steps: LessonStep[],
  nextIndex: number,
  signal: StruggleSignal,
  lesson: Lesson,
): LessonStep[] {
  if (!isStruggling(signal)) {
    return steps;
  }

  const limit = Math.min(steps.length, nextIndex + 3);

  for (let index = nextIndex; index < limit; index += 1) {
    const step = steps[index];
    const downgrade = SUPPORT_DOWNGRADE[step.type];

    if (!downgrade || step.type === "exercise" || step.type === "intro") {
      continue;
    }

    const phraseId = getStepPhraseId(step);
    const phrase = phraseId
      ? lesson.phrases.find((item) => item.id === phraseId)
      : undefined;

    if (!phrase) {
      continue;
    }

    const replacement = buildFormatStep(downgrade, phrase, buildContextFor(lesson));

    if (!replacement) {
      continue;
    }

    // Softening a question must not turn it into one the learner has already
    // been asked. Answering three questions wrong should not produce three
    // identical cloze exercises on the same sentence.
    const alreadyAsked = steps.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other.type === replacement.type &&
        getStepPhraseId(other) === phrase.id,
    );

    if (alreadyAsked) {
      continue;
    }

    const out = [...steps];
    // Keep the original id so answers stay attributable to the same slot.
    out[index] = { ...replacement, id: step.id } as LessonStep;
    return out;
  }

  return steps;
}

function buildContextFor(lesson: Lesson): BuildContext {
  return {
    lesson,
    resolveKnown: knownFormsFor(lesson.curriculumId),
    profile: getLessonProfile(
      lesson.plan?.kind ?? "build",
      lesson.plan?.band,
      lesson.plan?.scaffold,
    ),
    optionPool: lesson.phrases,
    wordPool: buildWordPool(lesson.phrases),
    capabilities: lesson.curriculumId
      ? getCapabilities(lesson.curriculumId as CourseId)
      : undefined,
    rng: makeRng(`${lesson.id}-adaptive`),
    formatUse: new Map(),
    // Offset so an adapted step id can never collide with a planned one.
    counter: { value: 1000 },
  };
}

// ---------------------------------------------------------------------------
// The phrase-book path (unchanged)
// ---------------------------------------------------------------------------

/**
 * The original phrase-book engine, unchanged in behaviour.
 *
 * Bengali, Spanish for Peru and Malayalam are short, hand-authored courses
 * where a lesson *is* its phrase set and there is no long backlog to
 * interleave; this is the right shape for them. It is also what a cumulative
 * course falls back to if `FEATURES.cumulativeLessons` is switched off, which
 * is why it stays a first-class path rather than dead code.
 */
function buildPhraseBookLessonSteps(
  lesson: Lesson,
  { reviewMode = false }: BuildLessonStepsOptions = {},
): LessonStep[] {
  // Review sessions skip the intro + teaching and go straight to checks, and can
  // cover more phrases than a first-time lesson.
  const introducedPhrases = lesson.phrases.slice(
    0,
    reviewMode ? REVIEW_PHRASES : TAUGHT_PHRASES,
  );
  // Distractors come from the lesson's own phrases, ranked by how confusable
  // they are with the answer (see @/lib/distractors) rather than padded with a
  // fixed list of unrelated English words.
  const optionPool = lesson.phrases.length > 0 ? lesson.phrases : introducedPhrases;
  const wordPool = buildWordPool(introducedPhrases);
  // Which item has been asked about, and in which format. Shared by the warm-up
  // checks, the practice block, the recycle slots and the closer, so no part of
  // a lesson unknowingly repeats another part's question.
  const usage = new Map<string, number>();
  const steps: LessonStep[] = reviewMode
    ? []
    : [
        {
          id: `${lesson.id}-intro`,
          type: "intro",
          lesson,
          title: lesson.title,
          body: lesson.summary,
        },
      ];

  // A comprehension check for one phrase. Alternate direction by the phrase's
  // position so learners both recognize (target -> English) and produce
  // (English -> target).
  const comprehensionStep = (phrase: Phrase, index: number): LessonStep =>
    index % 2 === 0
      ? {
          id: `${lesson.id}-recognize-${phrase.id}`,
          type: "recognize",
          phrase,
          prompt: `What does "${formatRomanizedDisplay(phrase.romanized)}" mean?`,
          options: buildMeaningOptions(
            phrase,
            optionPool,
            `${lesson.id}-recognize-${phrase.id}`,
          ),
        }
      : {
          id: `${lesson.id}-produce-${phrase.id}`,
          type: "produce",
          phrase,
          prompt: `Which one means "${capitalizeDisplayText(phrase.english)}"?`,
          options: buildTargetOptions(
            phrase,
            optionPool,
            `${lesson.id}-produce-${phrase.id}`,
          ),
        };

  // Dynamic flow: teach a phrase, but DON'T test it in the very next step.
  introducedPhrases.forEach((phrase, index) => {
    if (!reviewMode) {
      steps.push({
        id: `${lesson.id}-learn-${phrase.id}`,
        type: "learn",
        phrase,
        position: index + 1,
        total: introducedPhrases.length,
      });
    }

    const testIndex = index - TEACH_TEST_LAG;
    if (testIndex >= 0) {
      steps.push(comprehensionStep(introducedPhrases[testIndex], testIndex));
    }

    if (INCLUDE_SPEAKING_PRACTICE && (index === 1 || index === 3)) {
      steps.push({
        id: `${lesson.id}-speak-${phrase.id}`,
        type: "speak",
        phrase,
        prompt: "Practice saying this phrase.",
      });
    }
  });

  // Flush the comprehension checks for the last few taught phrases.
  for (
    let index = Math.max(0, introducedPhrases.length - TEACH_TEST_LAG);
    index < introducedPhrases.length;
    index += 1
  ) {
    steps.push(comprehensionStep(introducedPhrases[index], index));
  }

  const multiWordPhrases = introducedPhrases.filter(
    (phrase) => splitWords(phrase.romanized).length >= 2,
  );
  // Prefer real sentences for production; fall back to any multi-word phrase.
  const sentencePhrases = introducedPhrases.filter(
    (phrase) => splitWords(phrase.romanized).length >= SENTENCE_MIN_WORDS,
  );
  const productionPhrases =
    sentencePhrases.length > 0 ? sentencePhrases : multiWordPhrases;

  // The practice block (everything after teaching) is ordered by difficulty so
  // each lesson climbs recognition -> word bank -> typing, then ends on an easy
  // win. See stepDifficulty().
  const practiceSteps: LessonStep[] = [];

  // Word-bank translation: build a target sentence from an English prompt.
  productionPhrases.slice(0, MAX_TRANSLATE_STEPS).forEach((phrase) => {
    const translateStep = buildTranslateStep(lesson.id, phrase, wordPool);

    if (translateStep) {
      practiceSteps.push(translateStep);
    }
  });

  // Sentence completion: blank a content word and pick it from a word bank.
  // Draw from the end of the list so it tends to use different sentences than
  // translation.
  [...productionPhrases]
    .reverse()
    .slice(0, MAX_COMPLETE_STEPS)
    .forEach((phrase) => {
      const completeStep = buildCompleteStep(lesson.id, phrase, wordPool);

      if (completeStep) {
        practiceSteps.push(completeStep);
      }
    });

  // Word-bank ordering: arrange a shuffled phrase into the correct order.
  multiWordPhrases.slice(0, MAX_ORDER_STEPS).forEach((phrase) => {
    practiceSteps.push({
      id: `${lesson.id}-order-${phrase.id}`,
      type: "order",
      phrase,
      tokens: shuffleTokens(splitWords(phrase.romanized)),
      prompt: "Tap the words in the correct order.",
    });
  });

  lesson.exercises.forEach((exercise) => {
    practiceSteps.push({
      id: `${lesson.id}-review-${exercise.id}`,
      type: "exercise",
      exercise,
    });
  });

  // Audio-dependent step types come from the course's declared capabilities
  // (see @/lib/courses) rather than an id check, so a new course opts in by
  // describing itself rather than by editing the engine.
  const capabilities = lesson.curriculumId
    ? getCapabilities(lesson.curriculumId as CourseId)
    : undefined;

  // Listening: hear a sentence and rebuild it by ear. Uses the same play button
  // + word bank the learner already knows.
  const listeningEnabled = FEATURES.listening || Boolean(capabilities?.listening);
  if (listeningEnabled && !reviewMode && multiWordPhrases[0]) {
    const phrase = multiWordPhrases[0];
    practiceSteps.push({
      id: `${lesson.id}-listen-${phrase.id}`,
      type: "listen",
      phrase,
      tokens: shuffleTokens(splitWords(phrase.romanized)),
      prompt: "Tap what you hear.",
    });
  }

  // Dialogue: a character line, pick the reply. Prompt + reply are full
  // sentences (falling back to any multi-word phrase), and the wrong replies are
  // drawn from ALL the lesson's phrases — sentences first, then other multi-word
  // phrases — so there are always a few plausible choices, never just one.
  const dialogueEnabled = FEATURES.dialogue || Boolean(capabilities?.dialogue);
  const lessonSentences = lesson.phrases.filter(
    (phrase) => splitWords(phrase.romanized).length >= SENTENCE_MIN_WORDS,
  );
  const lessonMultiWord = lesson.phrases.filter(
    (phrase) => splitWords(phrase.romanized).length >= 2,
  );
  const dialogueBase = lessonSentences.length >= 2 ? lessonSentences : lessonMultiWord;
  if (dialogueEnabled && !reviewMode && dialogueBase.length >= 2) {
    const promptPhrase = dialogueBase[0];
    const replyPhrase = dialogueBase[1];
    const distractorPool = [...lessonSentences, ...lessonMultiWord].filter(
      (phrase) => phrase.id !== promptPhrase.id && phrase.id !== replyPhrase.id,
    );
    const options = buildTargetOptions(
      replyPhrase,
      distractorPool,
      `${lesson.id}-dialogue-${replyPhrase.id}`,
    );
    // Only show the dialogue if it has real alternatives to choose between.
    if (options.length >= 3) {
      practiceSteps.push({
        id: `${lesson.id}-dialogue-${replyPhrase.id}`,
        type: "dialogue",
        phrase: replyPhrase,
        promptRomanized: promptPhrase.romanized,
        promptEnglish: promptPhrase.english,
        options,
        answer: replyPhrase.romanized,
        prompt: "How do you reply?",
      });
    }
  }

  // Stable-sort the practice block from easiest to hardest.
  practiceSteps.sort((a, b) => stepDifficulty(a) - stepDifficulty(b));

  // End on a win: if the last practice step is a hard (typed/arrange) one, add a
  // quick recognition check on an already-taught phrase as the closer.
  const lastStep = practiceSteps[practiceSteps.length - 1];

  if (lastStep && stepDifficulty(lastStep) > EASY_CLOSER_MAX && introducedPhrases[0]) {
    const closerPhrase = introducedPhrases[0];
    practiceSteps.push({
      id: `${lesson.id}-closer-${closerPhrase.id}`,
      type: "recognize",
      phrase: closerPhrase,
      prompt: `What does "${formatRomanizedDisplay(closerPhrase.romanized)}" mean?`,
      options: buildMeaningOptions(
        closerPhrase,
        optionPool,
        `${lesson.id}-closer-${closerPhrase.id}`,
      ),
    });
  }

  steps.push(...practiceSteps);

  return steps;
}

/**
 * Difficulty weight for ordering the practice block: recognition (easiest) ->
 * constrained production (word bank) -> free production (typing).
 */
export function stepDifficulty(step: LessonStep): number {
  switch (step.type) {
    // Instruction, not a question — it never competes for the "easy closer".
    case "intro":
    case "learn":
    case "grammar":
    case "notice":
    case "story":
    case "pronounce":
      return 0;
    case "recognize":
      return 1;
    case "choice":
    case "produce":
    case "complete":
    case "dialogue":
      return 2;
    case "order":
      return 3;
    case "listen":
      return 4;
    // Typing a sentence with no word bank is the hardest thing the app asks.
    case "translate":
      return step.typed ? 5 : 4;
    case "exercise":
      switch (step.exercise.type) {
        case "multiple-choice":
          return 1;
        case "matching":
          return 2;
        case "fill-blank":
          return 3;
        case "translation":
        case "listen-type":
          return 4;
        default:
          return 3;
      }
    default:
      return 5;
  }
}

/**
 * Steps that represent real work. The intro is a title card, so it is excluded
 * from progress: a lesson should read 0% until the learner has actually done
 * something.
 */
export function isWorkStep(step: LessonStep): boolean {
  return step.type !== "intro";
}

/** Steps that teach rather than test. Excluded from the accuracy figure. */
export function isTeachingStep(step: LessonStep): boolean {
  return (
    step.type === "intro" ||
    step.type === "learn" ||
    step.type === "grammar" ||
    step.type === "notice" ||
    step.type === "story" ||
    // Saying a sentence aloud is practice, but nothing about it is graded, so
    // counting it toward accuracy would inflate every score.
    step.type === "pronounce"
  );
}

export function countWorkSteps(steps: LessonStep[]): number {
  return steps.filter(isWorkStep).length;
}

/** How many work steps are finished once the learner is on `stepIndex`. */
export function countCompletedWorkSteps(
  steps: LessonStep[],
  stepIndex: number,
): number {
  return steps.slice(0, stepIndex).filter(isWorkStep).length;
}

/**
 * Words a lesson can draw distractors from.
 *
 * Punctuation is stripped: a word bank offering "grande." and "eres?" as
 * alternatives to a plain word tells the learner which tokens are decoys
 * before they have read them.
 */
function buildWordPool(phrases: Phrase[]): string[] {
  // Keyed by the normalized word so "Sí" and "sí" cannot both become tiles.
  // The pool is only ever a source of *distractors* — the words of the sentence
  // being built come from the phrase itself — so collapsing case here loses
  // nothing and stops a bank offering the same word twice.
  const words = new Map<string, string>();

  phrases.forEach((phrase) => {
    splitWords(phrase.romanized).forEach((word) => {
      const bare = word.replace(/^[¿¡"']+/, "").replace(/[.,;:!?"']+$/, "");

      // A gendered pair ("vacío/vacía") is a dictionary entry, not a word you
      // can tap into a sentence. Keeping it out of the pool stops word banks
      // offering "Vacío/Vacía" as a tile.
      if (!bare || bare.includes("/")) {
        return;
      }

      const key = normalizeWord(bare);

      // Prefer the lowercase form: a distractor should not look like the start
      // of a sentence.
      const existing = words.get(key);

      if (!existing || (existing !== existing.toLowerCase() && bare === bare.toLowerCase())) {
        words.set(key, bare);
      }
    });
  });

  return [...words.values()];
}

/** Word-bank translation: correct target words plus a few distractors, shuffled. */
function buildTranslateStep(
  lessonId: string,
  phrase: Phrase,
  wordPool: string[],
): Extract<LessonStep, { type: "translate" }> | null {
  const words = splitWords(phrase.romanized);

  if (words.length < 3) {
    return null;
  }

  const distractorCount = Math.min(3, Math.max(2, Math.floor(words.length / 2)));
  const distractors = shuffle(
    wordPool.filter((word) => !words.includes(word)),
  ).slice(0, distractorCount);

  return {
    id: `${lessonId}-translate-${phrase.id}`,
    type: "translate",
    phrase,
    tokens: shuffle([...words, ...distractors]),
    prompt: "Tap the words to build the translation.",
  };
}

function buildCompleteStep(
  lessonId: string,
  phrase: Phrase,
  wordPool: string[],
): Extract<LessonStep, { type: "complete" }> | null {
  const words = splitWords(phrase.romanized);

  if (words.length < 2) {
    return null;
  }

  const blankIndex = pickBlankIndex(words);
  const answer = words[blankIndex];
  const options = buildWordOptions(
    answer,
    wordPool.filter((word) => word !== answer),
    `${lessonId}-complete-${phrase.id}`,
  );

  return {
    id: `${lessonId}-complete-${phrase.id}`,
    type: "complete",
    phrase,
    before: words.slice(0, blankIndex).join(" "),
    after: words.slice(blankIndex + 1).join(" "),
    answer,
    hint: phrase.english,
    options,
    prompt: "Pick the missing word to complete the sentence.",
  };
}

export function formatMultipleChoiceOption(exercise: Exercise, option: string) {
  if (
    exercise.sourceType === "listenSelect" ||
    exercise.sourceType === "quickReply"
  ) {
    return formatRomanizedDisplay(option);
  }

  return capitalizeDisplayText(option);
}

export function getStepPrompt(step: LessonStep) {
  if (
    step.type === "recognize" ||
    step.type === "produce" ||
    step.type === "order" ||
    step.type === "translate" ||
    step.type === "listen" ||
    step.type === "dialogue" ||
    step.type === "complete" ||
    step.type === "choice" ||
    step.type === "pronounce" ||
    step.type === "speak"
  ) {
    return step.prompt;
  }

  if (step.type === "notice") {
    return step.card.title;
  }

  if (step.type === "story") {
    return step.story.title;
  }

  if (step.type === "exercise") {
    return step.exercise.prompt;
  }

  return "Lesson step";
}

/** Grammar concepts a step exercises, if any. */
export function getStepConceptIds(step: LessonStep): string[] {
  if (step.type === "complete" || step.type === "choice") {
    return step.conceptIds ?? [];
  }

  return [];
}

/** The phrase a step exercises, if any — used to update spaced-repetition memory. */
export function getStepPhraseId(step: LessonStep): string | undefined {
  if (
    step.type === "recognize" ||
    step.type === "produce" ||
    step.type === "order" ||
    step.type === "translate" ||
    step.type === "listen" ||
    step.type === "dialogue" ||
    step.type === "complete"
  ) {
    return step.phrase.id;
  }

  if (step.type === "exercise") {
    return step.exercise.phraseId;
  }

  return undefined;
}

/**
 * Explain My Answer: a short, offline "why", from the phrase pairing plus a few
 * deterministic Spanish grammar heuristics and the lesson's own grammar notes.
 * Safe for any language — the regex hints simply don't fire on non-Spanish text.
 */
export function getStepExplanation(
  step: LessonStep,
  lesson: Lesson,
): string | undefined {
  const phraseId = getStepPhraseId(step);
  const phrase = phraseId
    ? lesson.phrases.find((item) => item.id === phraseId)
    : undefined;

  if (!phrase) {
    const grammar = lesson.grammar?.[0];
    return grammar ? `${grammar.point}: ${grammar.notes}` : undefined;
  }

  const parts: string[] = [
    `“${formatRomanizedDisplay(phrase.romanized)}” means “${capitalizeDisplayText(phrase.english)}”.`,
  ];
  const text = ` ${phrase.romanized.toLowerCase()} `;

  if (/\b(el|un|unos)\b/.test(text)) {
    parts.push("“el / un” go with masculine nouns.");
  } else if (/\b(la|una|unas)\b/.test(text)) {
    parts.push("“la / una” go with feminine nouns.");
  }

  if (/\b(está|estoy|están|estás|estamos)\b/.test(text)) {
    parts.push("“estar” is for location or a temporary state.");
  } else if (/\b(es|soy|son|eres|somos)\b/.test(text)) {
    parts.push("“ser” is for identity or lasting traits.");
  }

  return parts.join(" ");
}

export function getExerciseMode(exercise: Exercise) {
  if (exercise.sourceType?.startsWith("history-")) {
    return "Story check";
  }

  if (exercise.type === "multiple-choice") {
    return "Choose";
  }

  if (exercise.type === "translation") {
    return "Type";
  }

  if (exercise.type === "listen-type") {
    return "Listen";
  }

  if (exercise.type === "fill-blank") {
    return "Practice";
  }

  if (exercise.type === "speaking") {
    return "Speak";
  }

  return "Match";
}

export function getStreakMilestone(streak: number): 3 | 5 | 10 | null {
  if (streak === 3 || streak === 5 || streak === 10) {
    return streak;
  }

  return null;
}

/** Steps that depend on audio, and can therefore be skipped without penalty. */
export function isListeningStep(step: LessonStep) {
  return (
    step.type === "recognize" ||
    (step.type === "exercise" &&
      (Boolean(step.exercise.audioPromptId) ||
        step.exercise.sourceType === "listenSelect" ||
        step.exercise.type === "listen-type"))
  );
}

export function getCorrectAnswerLabel(exercise: Exercise) {
  if (exercise.type === "matching") {
    return (exercise.pairs ?? [])
      .map((pair) => `${pair.left} -> ${pair.right}`)
      .join(", ");
  }

  return exercise.answer;
}

/** Steps that are actually graded — used for the end-of-lesson accuracy figure. */
export function countQuestionSteps(steps: LessonStep[]): number {
  return steps.filter(
    (step) => !isTeachingStep(step) && step.type !== "speak",
  ).length;
}

/**
 * The format a graded step used, for the production tally in `PhraseMemory`.
 *
 * Returns nothing for steps that are not a climb up the ladder — a dialogue
 * reply is chosen from four options, and a story question is about meaning
 * rather than about producing an item.
 */
export function getStepProductionFormat(step: LessonStep): StepFormat | null {
  const format = stepFormatOf(step);
  return format && isProductionFormat(format) ? format : null;
}
