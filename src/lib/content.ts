import rawContent from "../../content/learn-bengali.json";
import rawHistoryContent from "../../content/learn-history.json";
import rawSpanishContent from "../../content/learn-spanish-peru.json";
import { normalizeAnswer } from "@/lib/answer-checking";
import type {
  Curriculum,
  CurriculumId,
  LearningContent,
  Lesson,
  Phrase,
  Unit,
} from "@/types/learning";

export const defaultCurriculumId: CurriculumId = "bengali";

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

export const content = rawContent as LearningContent;
export const historyContent = rawHistoryContent as LearningContent;
export const spanishPeruContent = rawSpanishContent as LearningContent;

export const curricula: Curriculum[] = [
  {
    id: "bengali",
    label: "Bengali",
    shortLabel: "Bengali",
    description: "Simple spoken Bengali phrases for everyday conversation.",
    locale: "bn-BD",
    mode: "language",
    units: withCurriculum(content, "bengali", "bn-BD"),
  },
  {
    id: "spanish-peru",
    label: "Spanish for Peru",
    shortLabel: "Spanish",
    description: "Travel Spanish for Peru: taxis, food, hotels, tours, and emergencies.",
    locale: "es-PE",
    mode: "language",
    travelTheme: "Peru travel",
    units: withCurriculum(spanishPeruContent, "spanish-peru", "es-PE"),
  },
  {
    id: "history",
    label: "History",
    shortLabel: "History",
    description: "Bite-size story lessons about causes, turning points, and consequences.",
    locale: "en-US",
    mode: "history",
    units: withCurriculum(historyContent, "history", "en-US"),
  },
];

export const curriculumMap = new Map(
  curricula.map((curriculum) => [curriculum.id, curriculum]),
);

export const units = curriculumMap.get(defaultCurriculumId)?.units ?? [];

export const lessons = curricula.flatMap((curriculum) =>
  curriculum.units.flatMap((unit) => unit.lessons),
);

export function getCurriculum(curriculumId: CurriculumId): Curriculum {
  return curriculumMap.get(curriculumId) ?? curricula[0];
}

export function getCurriculumForLesson(lessonId: string): Curriculum {
  return (
    curricula.find((curriculum) =>
      curriculum.units.some((unit) =>
        unit.lessons.some((lesson) => lesson.id === lessonId),
      ),
    ) ?? curricula[0]
  );
}

export function getLessonsForCurriculum(curriculumId: CurriculumId): Lesson[] {
  return getCurriculum(curriculumId).units.flatMap((unit) => unit.lessons);
}

export function getLessonIdsForCurriculum(curriculumId: CurriculumId): Set<string> {
  return new Set(getLessonsForCurriculum(curriculumId).map((lesson) => lesson.id));
}

export function getLesson(lessonId: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === lessonId);
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
