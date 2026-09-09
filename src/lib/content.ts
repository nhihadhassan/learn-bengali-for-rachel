/**
 * Attaches lesson content to the registered courses.
 *
 * **This module is heavy.** It pulls in every curriculum JSON, including the
 * 1.2MB Spanish pack. Import it only where real phrases/exercises are needed
 * (a running lesson, the word bank, practice sessions, the placement test).
 * For navigation, counts, labels and capabilities use the lightweight
 * `@/lib/courses` registry and `@/lib/course-index` outline instead — those are
 * what the app shell and progress store rely on so the whole course catalogue
 * doesn't ship on every route.
 */

import { normalizeAnswer } from "@/lib/answer-checking";
import {
  bengaliContent,
  historyContent,
  malayalamContent,
  spanishPeruContent,
} from "@/lib/core-content";
import { bengaliCurriculumUnits } from "@/lib/bengali-curriculum";
import { COURSES, defaultCourseId, type CourseId } from "@/lib/courses";
import { FEATURES } from "@/lib/feature-flags";
import { spanishCurriculumUnits } from "@/lib/spanish-curriculum";
import type {
  Curriculum,
  CurriculumId,
  LearningContent,
  Lesson,
  Phrase,
  Unit,
} from "@/types/learning";

export const defaultCurriculumId: CurriculumId = defaultCourseId;

function withCurriculum(
  content: LearningContent,
  curriculumId: CurriculumId,
  locale: string,
): Unit[] {
  return content.units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => ({
      ...lesson,
      curriculumId,
      locale: lesson.locale ?? locale,
    })),
  }));
}

export const content = bengaliContent;

export { historyContent, malayalamContent, spanishPeruContent };

/**
 * Where each registered course's units come from. Adding a course means adding
 * a registry entry in `@/lib/courses` plus one line here.
 */
const UNIT_SOURCES: Record<CourseId, (locale: string, id: CourseId) => Unit[]> = {
  bengali: (locale, id) =>
    FEATURES.bengaliCurriculumV2
      ? bengaliCurriculumUnits
      : withCurriculum(bengaliContent, id, locale),
  "spanish-peru": (locale, id) => withCurriculum(spanishPeruContent, id, locale),
  spanish: () => spanishCurriculumUnits,
  malayalam: (locale, id) => withCurriculum(malayalamContent, id, locale),
  history: (locale, id) => withCurriculum(historyContent, id, locale),
};

export const curricula: Curriculum[] = COURSES.map((course) => ({
  id: course.id,
  label: course.label,
  shortLabel: course.shortLabel,
  description: course.description,
  locale: course.locale,
  mode: course.capabilities.kind,
  units: UNIT_SOURCES[course.id](course.locale, course.id),
}));

export const curriculumMap = new Map(
  curricula.map((curriculum) => [curriculum.id, curriculum]),
);

export const units = curriculumMap.get(defaultCurriculumId)?.units ?? [];

export const lessons = curricula.flatMap((curriculum) =>
  curriculum.units.flatMap((unit) => unit.lessons),
);

const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

const curriculumIdByLessonId = new Map(
  curricula.flatMap((curriculum) =>
    curriculum.units.flatMap((unit) =>
      unit.lessons.map((lesson) => [lesson.id, curriculum.id] as const),
    ),
  ),
);

export function getCurriculum(curriculumId: CurriculumId): Curriculum {
  return curriculumMap.get(curriculumId) ?? curricula[0];
}

export function getCurriculumForLesson(lessonId: string): Curriculum {
  const curriculumId = curriculumIdByLessonId.get(lessonId);
  return curriculumId ? getCurriculum(curriculumId) : curricula[0];
}

export function getLessonsForCurriculum(curriculumId: CurriculumId): Lesson[] {
  return getCurriculum(curriculumId).units.flatMap((unit) => unit.lessons);
}

export function getLessonIdsForCurriculum(curriculumId: CurriculumId): Set<string> {
  return new Set(getLessonsForCurriculum(curriculumId).map((lesson) => lesson.id));
}

export function getLesson(lessonId: string): Lesson | undefined {
  return lessonById.get(lessonId);
}

export function getUnit(unitId: string, curriculumId = defaultCurriculumId): Unit | undefined {
  return getCurriculum(curriculumId).units.find((unit) => unit.id === unitId);
}

export function getPhrase(phraseId: string, curriculumId?: CurriculumId): Phrase | undefined {
  const sourceLessons = curriculumId ? getLessonsForCurriculum(curriculumId) : lessons;

  return sourceLessons
    .flatMap((lesson) => lesson.phrases)
    .find((phrase) => phrase.id === phraseId);
}

export function getNextLesson(currentLessonId: string): Lesson | undefined {
  const curriculum = getCurriculumForLesson(currentLessonId);
  const curriculumLessons = curriculum.units.flatMap((unit) => unit.lessons);
  const index = curriculumLessons.findIndex((lesson) => lesson.id === currentLessonId);
  return index >= 0 ? curriculumLessons[index + 1] : undefined;
}

export { normalizeAnswer };
