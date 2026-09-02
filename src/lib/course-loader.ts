import type { CourseId } from "@/lib/courses";
import type { Curriculum, Lesson } from "@/types/learning";

type CurriculumModule = { curriculum: Curriculum };
type AuthoredModule = { getAuthoredLesson: (lessonId: string) => Lesson | undefined };

/**
 * Explicit import boundaries keep course JSON out of the common client graph.
 * Do not replace these with a directory glob or a static barrel import.
 */
const curriculumLoaders: Record<CourseId, () => Promise<CurriculumModule>> = {
  bengali: () => import("@/lib/course-content/bengali"),
  "spanish-peru": () => import("@/lib/course-content/spanish-peru"),
  spanish: () => import("@/lib/course-content/spanish"),
  malayalam: () => import("@/lib/course-content/malayalam"),
  history: () => import("@/lib/course-content/history"),
};

const authoredLoaders: Partial<Record<CourseId, () => Promise<AuthoredModule>>> = {
  bengali: () => import("@/lib/course-content/bengali"),
  "spanish-peru": () => import("@/lib/course-content/spanish-peru"),
  malayalam: () => import("@/lib/course-content/malayalam"),
  history: () => import("@/lib/course-content/history"),
};

const curriculumCache = new Map<CourseId, Promise<Curriculum>>();
const authoredCache = new Map<CourseId, Promise<AuthoredModule>>();

export function loadCourseCurriculum(courseId: CourseId): Promise<Curriculum> {
  const cached = curriculumCache.get(courseId);

  if (cached) {
    return cached;
  }

  const promise = curriculumLoaders[courseId]().then((module) => module.curriculum);
  const retryablePromise = promise.catch((error) => {
    curriculumCache.delete(courseId);
    throw error;
  });
  curriculumCache.set(courseId, retryablePromise);
  return retryablePromise;
}

/**
 * Authored exercise review only needs one of the four hand-authored courses.
 * The generated Spanish course intentionally has no loader here, so a Spanish
 * mistake never pulls its large curriculum pack into the review route.
 */
export function loadAuthoredLesson(
  courseId: CourseId,
  lessonId: string,
): Promise<Lesson | undefined> {
  const loader = authoredLoaders[courseId];

  if (!loader) {
    return Promise.resolve(undefined);
  }

  let modulePromise = authoredCache.get(courseId);

  if (!modulePromise) {
    modulePromise = loader().catch((error) => {
      authoredCache.delete(courseId);
      throw error;
    });
    authoredCache.set(courseId, modulePromise);
  }

  return modulePromise.then((module) => module.getAuthoredLesson(lessonId));
}
