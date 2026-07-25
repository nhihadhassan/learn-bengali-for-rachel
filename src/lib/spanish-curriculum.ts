// Adapts the research-grounded Spanish curriculum pack
// (content/spanish-curriculum.json) into the app's Unit/Lesson/Phrase shape so
// the existing lesson engine can generate exercises from it. The pack's own
// pipeline (src/curriculum/*) validates and seeds the data; this module is the
// thin read-side bridge that makes those 131 units playable in the UI.

import rawCourse from "../../content/spanish-curriculum.json";
import type { Course, Lesson as PackLesson, Unit as PackUnit } from "@/curriculum/types";
import type { Lesson, Phrase, Unit } from "@/types/learning";

const course = rawCourse as unknown as Course;

const CEFR_DIFFICULTY: Record<string, string> = {
  Intro: "Intro",
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
};

/** Interleave two lists so sentences and single words alternate in the first
 * few phrases — the engine teaches `phrases.slice(0, 5)`, and we want it to see
 * both vocabulary and full sentences there. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

function resolveById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  if (ids.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const resolved = ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  return resolved.length > 0 ? resolved : items;
}

function lessonPhrases(unit: PackUnit, lesson: PackLesson): Phrase[] {
  const vocab = resolveById(unit.vocabulary, lesson.content_focus.vocabulary_ids);
  const patterns = resolveById(unit.phrase_patterns, lesson.content_focus.phrase_ids);

  const vocabPhrases: Phrase[] = vocab.map((item) => ({
    id: item.id,
    romanized: item.spanish,
    english: item.english,
    pronunciation: "",
    category: item.part_of_speech || "vocabulary",
  }));

  const patternPhrases: Phrase[] = patterns.map((pattern) => ({
    id: pattern.id,
    romanized: pattern.spanish,
    english: pattern.english,
    pronunciation: "",
    category: "phrase",
  }));

  // Lead with a sentence so the taught set mixes words and full phrases.
  return interleave(patternPhrases, vocabPhrases);
}

function adaptLesson(unit: PackUnit, packLesson: PackLesson, unitNumber: number): Lesson {
  const phrases = lessonPhrases(unit, packLesson);
  return {
    id: `${unit.id}-l${packLesson.lesson_index}`,
    unitId: unit.id,
    unitNumber,
    title: packLesson.name,
    difficulty: CEFR_DIFFICULTY[unit.cefr] ?? unit.cefr,
    summary: packLesson.goal,
    phrases,
    exercises: [],
    curriculumId: "spanish",
    locale: "es",
    objectives: [packLesson.goal],
  };
}

function adaptUnit(unit: PackUnit, unitNumber: number): Unit {
  return {
    id: unit.id,
    number: unitNumber,
    title: unit.title,
    description: unit.communicative_goal,
    lessons: unit.lesson_sequence.map((lesson) => adaptLesson(unit, lesson, unitNumber)),
    metadata: {
      difficultyBand: CEFR_DIFFICULTY[unit.cefr] ?? unit.cefr,
      estimatedTotalMinutes: unit.lesson_sequence.length * 5,
      tags: unit.grammar_targets ?? [],
    },
  };
}

/** The full research-grounded Spanish course as app units (sorted by section, unit). */
export const spanishCurriculumUnits: Unit[] = [...course.units]
  .sort((a, b) => a.section - b.section || a.unit - b.unit)
  .map((unit, index) => adaptUnit(unit, index + 1));

export const spanishCourseMeta = {
  title: course.title,
  version: course.version,
  legalNote: course.legal_note,
};
