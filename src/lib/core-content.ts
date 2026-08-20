/**
 * The hand-authored curricula (Bengali, Spanish for Peru, Malayalam, History).
 *
 * These are the only courses with **pre-authored exercises** — the generated
 * Spanish course builds its questions from phrases at runtime. Mistake review
 * needs those authored exercises to rebuild a multiple-choice question, and it
 * would otherwise have to import `@/lib/content`, dragging the 1.2MB Spanish
 * pack into a screen that cannot use it. This module is the narrow door.
 */

import rawBengali from "../../content/learn-bengali.json";
import rawHistory from "../../content/learn-history.json";
import rawMalayalam from "../../content/learn-malayalam.json";
import rawSpanishPeru from "../../content/learn-spanish-peru.json";
import type { LearningContent, Lesson } from "@/types/learning";

export const bengaliContent = rawBengali as LearningContent;
export const historyContent = rawHistory as LearningContent;
export const malayalamContent = rawMalayalam as LearningContent;
export const spanishPeruContent = rawSpanishPeru as LearningContent;

const authoredContents = [
  bengaliContent,
  spanishPeruContent,
  malayalamContent,
  historyContent,
];

let authoredLessons: Map<string, Lesson> | null = null;

/**
 * A lesson from one of the authored courses, or undefined for generated
 * courses (which have no `exercises` to look up anyway).
 */
export function getAuthoredLesson(lessonId: string): Lesson | undefined {
  authoredLessons ??= new Map(
    authoredContents.flatMap((content) =>
      content.units.flatMap((unit) =>
        unit.lessons.map((lesson) => [lesson.id, lesson] as const),
      ),
    ),
  );

  return authoredLessons.get(lessonId);
}
