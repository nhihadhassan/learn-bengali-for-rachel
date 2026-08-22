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
import { getCapabilities, type CourseId } from "@/lib/courses";
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
  FORMAT_FALLBACKS,
  getLessonProfile,
  type LessonProfile,
  type StepFormat,
} from "@/lib/lesson-profiles";
import { makeRng, seededShuffle, type Rng } from "@/lib/rng";
import {
  isContentWord,
  normalizeWord,
  pickBlankIndex,
  shuffle,
  shuffleTokens,
  splitWords,
} from "@/lib/text-tokens";
import type {
  DialogueTurn,
  Exercise,
  GrammarFocus,
  Lesson,
  LessonPlan,
  Phrase,
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

/** Recycle slots carry this id prefix so they can be found and rewritten. */
const RECYCLE_PREFIX = "recycle";

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
  const profile = getLessonProfile(kind);
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
    profile,
    optionPool,
    wordPool,
    capabilities,
    rng,
    counter: { value: 0 },
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

  // --- grammar --------------------------------------------------------------
  const practiceSteps: LessonStep[] = [];

  if (profile.includeGrammar && plan.grammar) {
    practiceSteps.push({
      id: `${lesson.id}-grammar-${plan.grammar.id}`,
      type: "grammar",
      focus: plan.grammar,
    });

    for (const drill of buildGrammarDrills(
      plan.grammar,
      lesson.phrases,
      lesson.id,
    )) {
      const step = buildGrammarDrillStep(drill, plan.grammar, context);

      if (step) {
        // Grammar drills count as questions asked, so the practice block that
        // follows doesn't re-ask one of them in the same format.
        markUsed(usage, drill.phrase, stepFormatOf(step) ?? "complete");
        practiceSteps.push(step);
      }
    }
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
  for (const phrase of newItems) {
    if (!covered.has(phrase.id)) {
      practiceSteps.push(buildRecognizeStep(phrase, context));
      markUsed(usage, phrase, "recognize");
      covered.add(phrase.id);
    }
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
    const closer = fillPracticeSlot(
      "recognize",
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

  return enforceTeachTestLag(steps);
}

type BuildContext = {
  lesson: Lesson;
  profile: LessonProfile;
  optionPool: readonly Phrase[];
  wordPool: string[];
  capabilities: ReturnType<typeof getCapabilities> | undefined;
  rng: Rng;
  /** Makes every generated step id unique even when a phrase repeats. */
  counter: { value: number };
};

function nextStepId(context: BuildContext, format: string, phrase: Phrase): string {
  context.counter.value += 1;
  return `${context.lesson.id}-${format}-${context.counter.value}-${phrase.id}`;
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
  listen: 2,
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
  const formats: StepFormat[] = [format, ...FORMAT_FALLBACKS[format]];

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
        prompt: "Pick the missing word to complete the sentence.",
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
        prompt: "Tap the words in the correct order.",
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

      return {
        id,
        type: "translate",
        phrase,
        tokens: shuffle([...words, ...distractors]),
        prompt: "Tap the words to build the translation.",
      };
    }

    case "listen": {
      const listeningEnabled =
        FEATURES.listening || Boolean(context.capabilities?.listening);

      if (!listeningEnabled || words.length < 2 || isSlashVariant(phrase)) {
        return null;
      }

      // Pad the bank so "tap what you hear" is a real transcription rather
      // than putting two given words in order.
      const heard = new Set(words.map(normalizeWord));
      const extras = seededShuffle(
        context.wordPool.filter((word) => !heard.has(normalizeWord(word))),
        context.rng,
      ).slice(0, context.profile.wordBankPadding);

      return {
        id: nextStepId(context, "listen", phrase),
        type: "listen",
        phrase,
        tokens: shuffle([...words, ...extras]),
        prompt: "Tap what you hear.",
      };
    }

    default:
      return null;
  }
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
    ? script.turns.slice(0, 3)
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
      prompt: "How do you reply?",
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
    profile: getLessonProfile(lesson.plan?.kind ?? "build"),
    optionPool: lesson.phrases,
    wordPool: buildWordPool(lesson.phrases),
    capabilities: lesson.curriculumId
      ? getCapabilities(lesson.curriculumId as CourseId)
      : undefined,
    rng: makeRng(`${lesson.id}-adaptive`),
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
      return 0;
    case "recognize":
      return 1;
    case "produce":
    case "complete":
    case "dialogue":
      return 2;
    case "order":
      return 3;
    case "translate":
    case "listen":
      return 4;
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
  return step.type === "intro" || step.type === "learn" || step.type === "grammar";
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
  const words = new Set<string>();

  phrases.forEach((phrase) => {
    splitWords(phrase.romanized).forEach((word) => {
      const bare = word.replace(/^[¿¡"']+/, "").replace(/[.,;:!?"']+$/, "");

      if (bare) {
        words.add(bare);
      }
    });
  });

  return [...words];
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
    step.type === "speak"
  ) {
    return step.prompt;
  }

  if (step.type === "exercise") {
    return step.exercise.prompt;
  }

  return "Lesson step";
}

/** Grammar concepts a step exercises, if any. */
export function getStepConceptIds(step: LessonStep): string[] {
  return step.type === "complete" ? (step.conceptIds ?? []) : [];
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
