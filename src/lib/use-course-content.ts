"use client";

import { useCallback, useEffect, useState } from "react";
import type { CourseId } from "@/lib/courses";
import { loadCourseCurriculum } from "@/lib/course-loader";
import type { Curriculum } from "@/types/learning";

export function useCourseContent(courseId: CourseId, enabled = true) {
  const [result, setResult] = useState<{
    courseId: CourseId;
    curriculum: Curriculum | null;
    error: unknown;
  }>({ courseId, curriculum: null, error: null });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      return () => {
        cancelled = true;
      };
    }

    loadCourseCurriculum(courseId).then(
      (nextCurriculum) => {
        if (!cancelled) {
          setResult({ courseId, curriculum: nextCurriculum, error: null });
        }
      },
      (nextError) => {
        if (!cancelled) {
          setResult({ courseId, curriculum: null, error: nextError });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [courseId, enabled, retryCount]);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  return {
    curriculum: result.courseId === courseId ? result.curriculum : null,
    error: result.courseId === courseId ? result.error : null,
    isLoading:
      enabled &&
      (result.courseId !== courseId || (!result.curriculum && !result.error)),
    retry,
  };
}
