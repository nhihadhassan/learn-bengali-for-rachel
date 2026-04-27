import rawContent from "../../content/learn-bengali.json";
import { normalizeAnswer } from "@/lib/answer-checking";
import type { LearningContent, Lesson, Phrase, Unit } from "@/types/learning";

export const content = rawContent as LearningContent;

export const units = content.units;

export const lessons = units.flatMap((unit) => unit.lessons);

export function getLesson(lessonId: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === lessonId);
}

export function getUnit(unitId: string): Unit | undefined {
  return units.find((unit) => unit.id === unitId);
}

export function getPhrase(phraseId: string): Phrase | undefined {
  return lessons
    .flatMap((lesson) => lesson.phrases)
    .find((phrase) => phrase.id === phraseId);
}

export function getNextLesson(currentLessonId: string): Lesson | undefined {
  const index = lessons.findIndex((lesson) => lesson.id === currentLessonId);
  return index >= 0 ? lessons[index + 1] : undefined;
}

export { normalizeAnswer };
