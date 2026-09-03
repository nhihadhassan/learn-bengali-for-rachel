import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Course, Lesson, Unit } from "./types";

// Resolve content files relative to this module so scripts work from any cwd.
function contentPath(name: string): string {
  return fileURLToPath(new URL(`../../content/${name}`, import.meta.url));
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(contentPath(name), "utf8")) as T;
}

/** Load and parse the Spanish curriculum pack (unvalidated). */
export function loadCurriculumRaw(): unknown {
  return readJson<unknown>("spanish-curriculum.json");
}

/** Load the curriculum typed as Course. Validate separately before trusting it. */
export function loadCurriculum(): Course {
  return loadCurriculumRaw() as Course;
}

/** The JSON Schema the curriculum is validated against. */
export function loadCurriculumSchema(): Record<string, unknown> {
  return readJson<Record<string, unknown>>("spanish-curriculum.schema.json");
}

/** The pilot pack (Spanish Curriculum v2, Units 1-12), unvalidated. */
export function loadPilotRaw(): unknown {
  return readJson<unknown>("spanish-pilot.json");
}

export function loadPilotSchema(): Record<string, unknown> {
  return readJson<Record<string, unknown>>("spanish-pilot.schema.json");
}

/** The Bengali curriculum pack (Bengali Curriculum v2), unvalidated. */
export function loadBengaliRaw(): unknown {
  return readJson<unknown>("bengali-curriculum.json");
}

export function loadBengaliSchema(): Record<string, unknown> {
  return readJson<Record<string, unknown>>("bengali-curriculum.schema.json");
}

interface ExerciseTemplates {
  version: string;
  templates: Record<string, { skills: string[]; prompt: string }>;
  lesson_blueprint: unknown[];
  grading_notes: Record<string, string>;
}

/** Prompts and skill tags per exercise type. */
export function loadExerciseTemplates(): ExerciseTemplates {
  return readJson<ExerciseTemplates>("exercise-templates.json");
}

export function getUnitByExternalId(course: Course, unitId: string): Unit | undefined {
  return course.units.find((unit) => unit.id === unitId);
}

/** Look up a unit by its 1-based (section, unit) coordinates. */
export function getUnitByCoords(
  course: Course,
  section: number,
  unit: number,
): Unit | undefined {
  return course.units.find((item) => item.section === section && item.unit === unit);
}

export function getLesson(unit: Unit, lessonIndex: number): Lesson | undefined {
  return unit.lesson_sequence.find((lesson) => lesson.lesson_index === lessonIndex);
}

export function resolveVocabulary(unit: Unit, ids: string[]) {
  const byId = new Map(unit.vocabulary.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item) => item !== undefined);
}

export function resolvePhrases(unit: Unit, ids: string[]) {
  const byId = new Map(unit.phrase_patterns.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item) => item !== undefined);
}
