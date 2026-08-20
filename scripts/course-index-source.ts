/**
 * Builds the course navigation index from the full curriculum content.
 *
 * Kept separate from the CLI entry point so the drift test can rebuild the
 * index in memory and compare it against the committed file.
 */
import { COURSES } from "@/lib/courses";
import { getCurriculum } from "@/lib/content";
import type { CourseIndex } from "@/lib/course-index";

export const courseIndexPath = "content/course-index.json";

export function buildCourseIndex(): CourseIndex {
  const courses = COURSES.map((course) => {
    const curriculum = getCurriculum(course.id);
    const units = curriculum.units.map((unit) => ({
      id: unit.id,
      number: unit.number,
      title: unit.title,
      description: unit.description,
      ...(unit.section ? { section: unit.section } : {}),
      lessons: unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        difficulty: lesson.difficulty,
        phraseCount: lesson.phrases.length,
        // History chapters carry an icon the path uses; language lessons don't.
        ...(lesson.history?.icon ? { icon: lesson.history.icon } : {}),
      })),
    }));

    return [
      course.id,
      {
        id: course.id,
        unitCount: units.length,
        lessonCount: units.reduce((total, unit) => total + unit.lessons.length, 0),
        units,
      },
    ] as const;
  });

  return {
    version: 1,
    courses: Object.fromEntries(courses) as CourseIndex["courses"],
  };
}
