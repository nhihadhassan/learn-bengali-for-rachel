import { getCourse, type CourseId } from "@/lib/courses";
import type { Curriculum, LearningContent, Lesson, Unit } from "@/types/learning";

function withCurriculum(
  content: LearningContent,
  curriculumId: CourseId,
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

export function curriculumFromContent(
  content: LearningContent,
  curriculumId: CourseId,
): Curriculum {
  const course = getCourse(curriculumId);

  return {
    id: course.id,
    label: course.label,
    shortLabel: course.shortLabel,
    description: course.description,
    locale: course.locale,
    mode: course.capabilities.kind,
    units: withCurriculum(content, curriculumId, course.locale),
  };
}

export function createAuthoredLessonLookup(content: LearningContent) {
  const authoredLessons = new Map<string, Lesson>(
    content.units.flatMap((unit) =>
      unit.lessons.map((lesson) => [lesson.id, lesson] as const),
    ),
  );

  return (lessonId: string) => authoredLessons.get(lessonId);
}
