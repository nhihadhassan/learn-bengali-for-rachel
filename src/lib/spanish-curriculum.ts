// Adapts the research-grounded Spanish curriculum pack
// (content/spanish-curriculum.json) into the app's Unit/Lesson/Phrase shape so
// the lesson engine can generate exercises from it. The pack's own pipeline
// (src/curriculum/*) validates and seeds the data; this module is the thin
// read-side bridge that makes those 131 units playable in the UI.
//
// It is also where the course stops being a phrase book. The pack gives every
// lesson in a unit the *same* content focus, so this adapter used to rotate a
// five-item window over it — six lessons, five items each, and nothing from an
// earlier unit ever coming back. It now asks `@/lib/curriculum-plan` for a
// cumulative schedule instead: which few items each lesson introduces, and
// which previously-met items it should bring back. See `Lesson.plan`.

import rawCourse from "../../content/spanish-curriculum.json";
import type {
  Course,
  Lesson as PackLesson,
  Unit as PackUnit,
} from "@/curriculum/types";
import { getCapabilities } from "@/lib/courses";
import {
  createReviewQueues,
  planUnit,
  toLessonKind,
  toLessonPlan,
  type PlanItem,
  type PlanUnit,
  type PlannedLesson,
} from "@/lib/curriculum-plan";
import { FEATURES } from "@/lib/feature-flags";
import { getGrammarFocus } from "@/lib/grammar-drills";
import type {
  DialogueScript,
  GrammarFocus,
  Lesson,
  Phrase,
  Unit,
} from "@/types/learning";

const course = rawCourse as unknown as Course;

/** Authored dialogue, when a unit has one (see the pack schema's `dialogue`). */
type PackDialogue = {
  scenario: string;
  turns: Array<{
    speaker?: string;
    prompt: { spanish: string; english: string };
    reply: { spanish: string; english: string };
    distractors?: string[];
  }>;
};

type PackUnitWithExtras = PackUnit & { dialogue?: PackDialogue };

const CEFR_DIFFICULTY: Record<string, string> = {
  Intro: "Intro",
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
};

const cumulativeEnabled =
  FEATURES.cumulativeLessons &&
  getCapabilities("spanish").lessonStrategy === "cumulative";

function vocabularyPhrase(item: PackUnit["vocabulary"][number]): Phrase {
  return {
    id: item.id,
    romanized: item.spanish,
    english: item.english,
    pronunciation: "",
    // Part of speech doubles as the semantic grouping distractor selection
    // uses, so a noun is offered against other nouns.
    category: item.part_of_speech || "vocabulary",
  };
}

function patternPhrase(item: PackUnit["phrase_patterns"][number]): Phrase {
  return {
    id: item.id,
    romanized: item.spanish,
    english: item.english,
    pronunciation: "",
    category: "phrase",
  };
}

/** Every phrase in the course, keyed by id — review reaches across units. */
const phraseById = new Map<string, Phrase>();

const orderedUnits: PackUnitWithExtras[] = [...course.units].sort(
  (a, b) => a.section - b.section || a.unit - b.unit,
) as PackUnitWithExtras[];

for (const unit of orderedUnits) {
  for (const item of unit.vocabulary) {
    phraseById.set(item.id, vocabularyPhrase(item));
  }
  for (const item of unit.phrase_patterns) {
    phraseById.set(item.id, patternPhrase(item));
  }
}

/** The pack unit as the planner sees it: ids, text and item type. */
function toPlanUnit(unit: PackUnitWithExtras, unitNumber: number): PlanUnit {
  const items: PlanItem[] = [
    ...unit.vocabulary.map((item) => ({
      id: item.id,
      text: item.spanish,
      kind: "vocabulary" as const,
    })),
    ...unit.phrase_patterns.map((item) => ({
      id: item.id,
      text: item.spanish,
      kind: "phrase" as const,
    })),
  ];

  return { id: unit.id, number: unitNumber, items };
}

/**
 * Which grammar point a unit's "Grammar focus" lesson teaches.
 *
 * A unit declares two or three targets and they repeat across a whole section,
 * so rotating by unit number means consecutive units teach *different* points
 * instead of all ten units of Section 1 explaining articles.
 */
function grammarFocusFor(
  unit: PackUnitWithExtras,
  unitNumber: number,
): GrammarFocus | undefined {
  const targets = unit.grammar_targets ?? [];

  if (targets.length === 0) {
    return undefined;
  }

  const rotated = targets[(unitNumber - 1) % targets.length];

  return getGrammarFocus(rotated) ?? getGrammarFocus(targets[0]);
}

function toDialogueScript(dialogue: PackDialogue | undefined): DialogueScript | undefined {
  if (!dialogue?.turns?.length) {
    return undefined;
  }

  return {
    scenario: dialogue.scenario,
    turns: dialogue.turns.map((turn) => ({
      speaker: turn.speaker,
      prompt: { target: turn.prompt.spanish, english: turn.prompt.english },
      reply: { target: turn.reply.spanish, english: turn.reply.english },
      distractors: turn.distractors,
    })),
  };
}

/**
 * The lesson's working set: what it introduces, then what it brings back.
 * Everything downstream — the word bank, the "phrases you'll meet" card,
 * encountered-phrase tracking — reads `lesson.phrases`, so the plan's ids have
 * to resolve into it.
 */
function resolvePhrases(ids: readonly string[]): Phrase[] {
  const seen = new Set<string>();
  const phrases: Phrase[] = [];

  for (const id of ids) {
    const phrase = phraseById.get(id);

    if (phrase && !seen.has(id)) {
      seen.add(id);
      phrases.push(phrase);
    }
  }

  return phrases;
}

/**
 * The pre-plan behaviour: rotate a five-item window over the unit's focus list.
 * Kept as the fallback for when `FEATURES.cumulativeLessons` is off, which is
 * the documented way to restore the previous experience without a revert.
 */
const TAUGHT_WINDOW = 5;

function rotatedPhrases(unit: PackUnitWithExtras, lesson: PackLesson): Phrase[] {
  const vocab = unit.vocabulary.map(vocabularyPhrase);
  const patterns = unit.phrase_patterns.map(patternPhrase);
  const combined: Phrase[] = [];

  for (let index = 0; index < Math.max(vocab.length, patterns.length); index += 1) {
    if (index < patterns.length) combined.push(patterns[index]);
    if (index < vocab.length) combined.push(vocab[index]);
  }

  if (combined.length === 0) {
    return combined;
  }

  const offset = ((lesson.lesson_index - 1) * TAUGHT_WINDOW) % combined.length;
  return [...combined.slice(offset), ...combined.slice(0, offset)];
}

function adaptLesson(
  unit: PackUnitWithExtras,
  packLesson: PackLesson,
  unitNumber: number,
  planned: PlannedLesson | undefined,
): Lesson {
  const base = {
    id: `${unit.id}-l${packLesson.lesson_index}`,
    unitId: unit.id,
    unitNumber,
    title: packLesson.name,
    difficulty: CEFR_DIFFICULTY[unit.cefr] ?? unit.cefr,
    summary: packLesson.goal,
    exercises: [],
    curriculumId: "spanish" as const,
    locale: "es",
    objectives: [packLesson.goal],
  };

  if (!planned) {
    return { ...base, phrases: rotatedPhrases(unit, packLesson) };
  }

  const kind = toLessonKind(packLesson.name, packLesson.lesson_index);
  const grammar = kind === "grammar" ? grammarFocusFor(unit, unitNumber) : undefined;
  const dialogue = kind === "context" ? toDialogueScript(unit.dialogue) : undefined;
  const plan = toLessonPlan(planned, { grammar, dialogue });

  return {
    ...base,
    phrases: resolvePhrases([...plan.newPhraseIds, ...plan.reviewPhraseIds]),
    plan,
    // Rendered by the lesson intro's "What you'll learn" panel.
    grammar: grammar
      ? [{ point: grammar.title, notes: grammar.explanation }]
      : undefined,
  };
}

/** Section metadata from the pack, keyed by section number. */
const sectionByNumber = new Map(
  (course.sections ?? []).map((section) => [
    section.section,
    {
      number: section.section,
      title: section.title_es,
      description: section.description,
    },
  ]),
);

function adaptUnit(
  unit: PackUnitWithExtras,
  unitNumber: number,
  plannedLessons: PlannedLesson[] | undefined,
): Unit {
  return {
    id: unit.id,
    number: unitNumber,
    title: unit.title,
    description: unit.communicative_goal,
    // Sections are the course's four big chapters; the path browser uses them
    // to keep 131 units navigable.
    section: sectionByNumber.get(unit.section),
    lessons: unit.lesson_sequence.map((lesson, index) =>
      adaptLesson(unit, lesson, unitNumber, plannedLessons?.[index]),
    ),
    metadata: {
      difficultyBand: CEFR_DIFFICULTY[unit.cefr] ?? unit.cefr,
      estimatedTotalMinutes: unit.lesson_sequence.length * 5,
      tags: unit.grammar_targets ?? [],
    },
  };
}

function buildUnits(): Unit[] {
  const planUnits = orderedUnits.map((unit, index) => toPlanUnit(unit, index + 1));
  // Shared across the course so the cursor into an old unit's material is
  // continuous: every later unit that reaches back to unit 2 picks up where the
  // last one left off instead of re-drawing the same few items.
  const reviewQueues = createReviewQueues();

  return orderedUnits.map((unit, index) => {
    const planned = cumulativeEnabled
      ? planUnit(
          planUnits[index],
          planUnits.slice(0, index),
          unit.lesson_sequence.map((lesson) =>
            toLessonKind(lesson.name, lesson.lesson_index),
          ),
          reviewQueues,
        )
      : undefined;

    return adaptUnit(unit, index + 1, planned);
  });
}

/** The full research-grounded Spanish course as app units (sorted by section, unit). */
export const spanishCurriculumUnits: Unit[] = buildUnits();

export const spanishCourseMeta = {
  title: course.title,
  version: course.version,
  legalNote: course.legal_note,
};
