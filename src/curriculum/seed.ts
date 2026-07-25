import { createHash } from "node:crypto";
import { generateLessonExercises } from "./generators";
import type { Course, GeneratedExercise, SeedBundle } from "./types";

// A fixed namespace so internal UUIDs are stable across runs but distinct from
// any external id. UUIDv5-style: sha1(namespace + name), formatted and versioned.
const NAMESPACE = "learn-bengali-rachel:spanish-curriculum";

/** Deterministic internal id derived from a stable external id (UUIDv5-style). */
export function internalId(externalId: string): string {
  const hash = createHash("sha1").update(`${NAMESPACE}:${externalId}`).digest("hex");
  const bytes = hash.slice(0, 32).split("");
  // Set version (5) and variant bits so this is a well-formed UUID.
  bytes[12] = "5";
  const variant = parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const hex = bytes.join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function record(externalId: string) {
  return { id: internalId(externalId), external_id: externalId };
}

/**
 * Build a normalized, database-ready seed bundle from the curriculum course.
 * External ids come straight from the pack; internal ids are generated
 * deterministically. Every unit's provenance is preserved verbatim.
 */
export function buildSeedBundle(course: Course): SeedBundle {
  const bundle: SeedBundle = {
    course: {
      ...record(course.course_id),
      course_id: course.course_id,
      title: course.title,
      version: course.version,
      target: course.target,
    },
    sections: [],
    units: [],
    vocabulary_items: [],
    phrase_patterns: [],
    lessons: [],
    exercises: [],
  };

  for (const section of course.sections) {
    bundle.sections.push({
      ...record(`${course.course_id}-s${section.section}`),
      course_id: course.course_id,
      section: section.section,
      cefr: section.cefr,
    });
  }

  for (const unit of course.units) {
    bundle.units.push({
      ...record(unit.id),
      course_id: course.course_id,
      section: unit.section,
      unit: unit.unit,
      title: unit.title,
      cefr: unit.cefr,
      review_schedule_days: unit.review_schedule_days,
      provenance: unit.provenance,
    });

    for (const item of unit.vocabulary) {
      bundle.vocabulary_items.push({
        ...record(item.id),
        unit_external_id: unit.id,
        spanish: item.spanish,
        english: item.english,
        part_of_speech: item.part_of_speech,
      });
    }

    for (const phrase of unit.phrase_patterns) {
      bundle.phrase_patterns.push({
        ...record(phrase.id),
        unit_external_id: unit.id,
        spanish: phrase.spanish,
        english: phrase.english,
      });
    }

    for (const lesson of unit.lesson_sequence) {
      const lessonExternalId = `${unit.id}-l${lesson.lesson_index}`;
      bundle.lessons.push({
        ...record(lessonExternalId),
        unit_external_id: unit.id,
        lesson_index: lesson.lesson_index,
        name: lesson.name,
        goal: lesson.goal,
      });

      const generated: GeneratedExercise[] = generateLessonExercises(unit, lesson);
      for (const exercise of generated) {
        bundle.exercises.push({
          ...record(exercise.external_id),
          lesson_external_id: lessonExternalId,
          type: exercise.type,
          payload: exercise,
        });
      }
    }
  }

  return bundle;
}
