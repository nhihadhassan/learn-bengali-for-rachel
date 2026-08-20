/**
 * The lesson engine: turns a lesson's phrases into the actual sequence of steps
 * a learner works through.
 *
 * This module is deliberately pure — no React, no DOM — so the sequencing rules
 * can be tested directly (`scripts/lesson-steps.test.ts`) instead of only being
 * observable by playing a lesson. `lesson-flow.tsx` renders whatever comes out
 * of here; it no longer decides what the steps are.
 *
 * The non-negotiable rule lives here: **never test a phrase in the step right
 * after introducing it** (see `TEACH_TEST_LAG`).
 */

import { capitalizeDisplayText, formatRomanizedDisplay } from "@/lib/display-text";
import { getCapabilities, type CourseId } from "@/lib/courses";
import { FEATURES } from "@/lib/feature-flags";
import {
  pickBlankIndex,
  shuffle,
  shuffleTokens,
  splitWords,
} from "@/lib/text-tokens";
import type { Exercise, Lesson, Phrase } from "@/types/learning";

export type LessonStep =
  | { id: string; type: "intro"; lesson: Lesson; title: string; body: string }
  | { id: string; type: "learn"; phrase: Phrase; position: number; total: number }
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
      // Dialogue: a character line, pick the reply.
      id: string;
      type: "dialogue";
      phrase: Phrase;
      promptRomanized: string;
      promptEnglish: string;
      options: string[];
      answer: string;
      prompt: string;
    }
  | {
      // Complete the sentence: one word is blanked; pick it from a word bank.
      id: string;
      type: "complete";
      phrase: Phrase;
      before: string;
      after: string;
      answer: string;
      hint: string;
      options: string[];
      prompt: string;
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

export type BuildLessonStepsOptions = {
  reviewMode?: boolean;
};

export function buildLessonSteps(
  lesson: Lesson,
  { reviewMode = false }: BuildLessonStepsOptions = {},
): LessonStep[] {
  // Review sessions skip the intro + teaching and go straight to checks, and can
  // cover more phrases than a first-time lesson.
  const introducedPhrases = lesson.phrases.slice(
    0,
    reviewMode ? REVIEW_PHRASES : TAUGHT_PHRASES,
  );
  const phraseMeanings = introducedPhrases.map((phrase) => phrase.english);
  const targetPhrasePool = introducedPhrases.map((phrase) => phrase.romanized);
  const wordPool = buildWordPool(introducedPhrases);
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
          options: buildMeaningOptions(phrase.english, phraseMeanings),
        }
      : {
          id: `${lesson.id}-produce-${phrase.id}`,
          type: "produce",
          phrase,
          prompt: `Which one means "${capitalizeDisplayText(phrase.english)}"?`,
          options: buildTargetOptions(phrase.romanized, targetPhrasePool),
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
    const distractorPool = [...lessonSentences, ...lessonMultiWord]
      .filter((phrase) => phrase.id !== promptPhrase.id && phrase.id !== replyPhrase.id)
      .map((phrase) => phrase.romanized);
    const options = buildTargetOptions(replyPhrase.romanized, [
      replyPhrase.romanized,
      ...distractorPool,
    ]);
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
      options: buildMeaningOptions(closerPhrase.english, phraseMeanings),
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

function buildWordPool(phrases: Phrase[]): string[] {
  const words = new Set<string>();

  phrases.forEach((phrase) => {
    splitWords(phrase.romanized).forEach((word) => words.add(word));
  });

  return [...words];
}

function buildTargetOptions(answer: string, pool: string[]): string[] {
  const candidates = pool.filter((option) => option !== answer);
  const unique = Array.from(new Set([answer, ...candidates])).slice(0, 4);

  return shuffle(unique);
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
  const distractors = wordPool.filter((word) => word !== answer);
  const options = shuffle(
    Array.from(new Set([answer, ...distractors])).slice(0, 4),
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

function buildMeaningOptions(answer: string, allMeanings: string[]) {
  const fillers = ["please", "thank you", "where", "rice", "water", "father"];
  const candidates = [...allMeanings, ...fillers].filter(
    (option) => option !== answer,
  );
  const uniqueOptions = Array.from(new Set([answer, ...candidates])).slice(0, 4);

  return uniqueOptions.sort();
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
    (step) =>
      step.type !== "intro" && step.type !== "learn" && step.type !== "speak",
  ).length;
}
