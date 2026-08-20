import { loadExerciseTemplates, resolvePhrases, resolveVocabulary } from "./loader";
import { makeRng, pick, sample, shuffle } from "./rng";
// Shared with the runtime lesson engine so the pipeline's exercises and the
// lessons learners actually play cannot drift apart. See @/lib/text-tokens.
import {
  FUNCTION_WORDS,
  pickBlankIndex,
  splitWords,
} from "../lib/text-tokens";
import type { Rng } from "./rng";
import type {
  ExerciseType,
  GeneratedExercise,
  Lesson,
  PhrasePattern,
  Unit,
  VocabularyItem,
} from "./types";

const SUPPORTED_TYPES: ExerciseType[] = [
  "match_pairs",
  "fill_blank",
  "word_bank_translation",
  "dialogue_response",
];

let templatesCache: ReturnType<typeof loadExerciseTemplates> | null = null;
function templates() {
  templatesCache ??= loadExerciseTemplates();
  return templatesCache;
}

function templateFor(type: ExerciseType): { skills: string[]; prompt: string } {
  return templates().templates[type] ?? { skills: [], prompt: "" };
}

/** Case/punctuation-insensitive form, preserving accents and ñ. */
export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^[¿¡\s]+/, "")
    .replace(/[.?!,;:\s]+$/, "")
    .replace(/\s+/g, " ");
}

function acceptable(...answers: string[]): string[] {
  const set = new Set<string>();
  for (const answer of answers) {
    set.add(answer);
    set.add(normalizeAnswer(answer));
  }
  return [...set].filter((value) => value.length > 0);
}

/**
 * Content-word distractor pool drawn from a unit's vocabulary. Multi-word
 * entries (e.g. "el café", "por favor") are split into their meaningful tokens
 * so articles and function words never become answer options. `exclude` holds
 * normalized forms to leave out (typically the correct answer(s)).
 */
function contentWordPool(unit: Unit, exclude: Set<string>): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const item of unit.vocabulary) {
    for (const rawWord of splitWords(item.spanish)) {
      const core = normalizeAnswer(rawWord);
      if (core.length < 3 || FUNCTION_WORDS.has(core) || exclude.has(core) || seen.has(core)) {
        continue;
      }
      seen.add(core);
      pool.push(core);
    }
  }
  return pool;
}

function externalId(unit: Unit, lesson: Lesson, type: ExerciseType, index: number): string {
  return `${unit.id}-l${lesson.lesson_index}-${type}-${index + 1}`;
}

function lessonVocab(unit: Unit, lesson: Lesson): VocabularyItem[] {
  const focused = resolveVocabulary(unit, lesson.content_focus.vocabulary_ids);
  return focused.length > 0 ? focused : unit.vocabulary;
}

function lessonPhrases(unit: Unit, lesson: Lesson): PhrasePattern[] {
  const focused = resolvePhrases(unit, lesson.content_focus.phrase_ids);
  return focused.length > 0 ? focused : unit.phrase_patterns;
}

function baseSource(unit: Unit, lesson: Lesson) {
  return {
    unit_id: unit.id,
    lesson_index: lesson.lesson_index,
    vocabulary_ids: [] as string[],
    phrase_ids: [] as string[],
  };
}

export interface GenerateOptions {
  index?: number;
  seed?: string;
}

// ---------------------------------------------------------------------------
// match_pairs
// ---------------------------------------------------------------------------
export function generateMatchPairs(
  unit: Unit,
  lesson: Lesson,
  options: GenerateOptions = {},
): GeneratedExercise {
  const index = options.index ?? 0;
  const id = externalId(unit, lesson, "match_pairs", index);
  const rng: Rng = makeRng(options.seed ?? id);
  const template = templateFor("match_pairs");

  const chosen = sample(lessonVocab(unit, lesson), 5, rng);
  const pairs = chosen.map((item) => ({ spanish: item.spanish, english: item.english }));

  return {
    external_id: id,
    type: "match_pairs",
    prompt: template.prompt,
    skills: template.skills,
    pairs,
    acceptable_answers: acceptable(
      ...chosen.map((item) => `${item.spanish} = ${item.english}`),
    ),
    source: {
      ...baseSource(unit, lesson),
      vocabulary_ids: chosen.map((item) => item.id),
    },
  };
}

// ---------------------------------------------------------------------------
// fill_blank
// ---------------------------------------------------------------------------
export function generateFillBlank(
  unit: Unit,
  lesson: Lesson,
  options: GenerateOptions = {},
): GeneratedExercise {
  const index = options.index ?? 0;
  const id = externalId(unit, lesson, "fill_blank", index);
  const rng: Rng = makeRng(options.seed ?? id);
  const template = templateFor("fill_blank");

  const phrase = pick(lessonPhrases(unit, lesson), rng);
  const words = splitWords(phrase.spanish);

  // Prefer a real content word; the shared helper is the same one the runtime
  // lesson engine uses to build cloze exercises.
  const blankIndex = pickBlankIndex(words);

  const answerToken = words[blankIndex];
  const answerCore = normalizeAnswer(answerToken);

  // Distractors: other content words from the unit vocabulary.
  const distractorPool = contentWordPool(unit, new Set([answerCore]));
  const distractors = sample(distractorPool, 3, rng);
  const options4 = shuffle([answerCore, ...distractors], rng);

  return {
    external_id: id,
    type: "fill_blank",
    prompt: template.prompt,
    skills: template.skills,
    sentence: phrase.spanish,
    before: words.slice(0, blankIndex).join(" "),
    after: words.slice(blankIndex + 1).join(" "),
    options: options4,
    acceptable_answers: acceptable(answerToken, answerCore),
    source: {
      ...baseSource(unit, lesson),
      phrase_ids: [phrase.id],
    },
  };
}

// ---------------------------------------------------------------------------
// word_bank_translation
// ---------------------------------------------------------------------------
export function generateWordBankTranslation(
  unit: Unit,
  lesson: Lesson,
  options: GenerateOptions = {},
): GeneratedExercise {
  const index = options.index ?? 0;
  const id = externalId(unit, lesson, "word_bank_translation", index);
  const rng: Rng = makeRng(options.seed ?? id);
  const template = templateFor("word_bank_translation");

  const phrase = pick(lessonPhrases(unit, lesson), rng);
  const correctTokens = splitWords(phrase.spanish);
  const correctSet = new Set(correctTokens.map(normalizeAnswer));

  const distractorPool = contentWordPool(unit, correctSet);
  const distractors = sample(distractorPool, Math.min(3, distractorPool.length), rng);

  return {
    external_id: id,
    type: "word_bank_translation",
    prompt: template.prompt,
    skills: template.skills,
    english_prompt: phrase.english,
    tokens: shuffle([...correctTokens, ...distractors], rng),
    acceptable_answers: acceptable(phrase.spanish),
    source: {
      ...baseSource(unit, lesson),
      phrase_ids: [phrase.id],
    },
  };
}

// ---------------------------------------------------------------------------
// dialogue_response
// ---------------------------------------------------------------------------
export function generateDialogueResponse(
  unit: Unit,
  lesson: Lesson,
  options: GenerateOptions = {},
): GeneratedExercise {
  const index = options.index ?? 0;
  const id = externalId(unit, lesson, "dialogue_response", index);
  const rng: Rng = makeRng(options.seed ?? id);
  const template = templateFor("dialogue_response");

  const phrases = lessonPhrases(unit, lesson);
  const ordered = shuffle(phrases, rng);
  const promptPhrase = ordered[0];
  const replyPhrase = ordered[1] ?? ordered[0];

  const distractorPool = phrases.filter(
    (item) => item.id !== replyPhrase.id && item.id !== promptPhrase.id,
  );
  const distractors = sample(distractorPool, 2, rng).map((item) => item.spanish);
  const optionsList = shuffle([replyPhrase.spanish, ...distractors], rng);

  return {
    external_id: id,
    type: "dialogue_response",
    prompt: template.prompt,
    skills: template.skills,
    dialogue_prompt: { spanish: promptPhrase.spanish, english: promptPhrase.english },
    options: optionsList,
    acceptable_answers: acceptable(replyPhrase.spanish),
    source: {
      ...baseSource(unit, lesson),
      phrase_ids: [promptPhrase.id, replyPhrase.id],
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------
export function isSupportedType(type: ExerciseType): boolean {
  return SUPPORTED_TYPES.includes(type);
}

export function generateExercise(
  type: ExerciseType,
  unit: Unit,
  lesson: Lesson,
  options: GenerateOptions = {},
): GeneratedExercise {
  switch (type) {
    case "match_pairs":
      return generateMatchPairs(unit, lesson, options);
    case "fill_blank":
      return generateFillBlank(unit, lesson, options);
    case "word_bank_translation":
      return generateWordBankTranslation(unit, lesson, options);
    case "dialogue_response":
      return generateDialogueResponse(unit, lesson, options);
    default:
      throw new Error(`No generator implemented for exercise type "${type}"`);
  }
}

/** Generate one exercise per supported type in the lesson's mix, deterministically. */
export function generateLessonExercises(unit: Unit, lesson: Lesson): GeneratedExercise[] {
  const exercises: GeneratedExercise[] = [];
  lesson.exercise_mix.forEach((type, index) => {
    if (isSupportedType(type)) {
      exercises.push(generateExercise(type, unit, lesson, { index }));
    }
  });
  return exercises;
}
