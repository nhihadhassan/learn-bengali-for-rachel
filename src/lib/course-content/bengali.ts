import rawContent from "../../../content/learn-bengali.json";
import { bengaliCurriculumUnits } from "@/lib/bengali-curriculum";
import { getCourse } from "@/lib/courses";
import { createAuthoredLessonLookup, curriculumFromContent } from "@/lib/course-content-shared";
import { FEATURES } from "@/lib/feature-flags";
import type { LearningContent } from "@/types/learning";

const content = rawContent as LearningContent;
const course = getCourse("bengali");

export const curriculum = FEATURES.bengaliCurriculumV2
  ? {
      id: course.id,
      label: course.label,
      shortLabel: course.shortLabel,
      description: course.description,
      locale: course.locale,
      mode: course.capabilities.kind,
      units: bengaliCurriculumUnits,
    }
  : curriculumFromContent(content, "bengali");

/**
 * Mistake review still looks the v1 lessons up by id.
 *
 * A learner who made a mistake before the rebuild has it stored against a v1
 * lesson id, and that lesson's authored exercises are the only way to rebuild
 * the question. v2 lesson ids simply miss, which is the same "no authored
 * exercises" path the generated courses already take.
 */
export const getAuthoredLesson = createAuthoredLessonLookup(content);
