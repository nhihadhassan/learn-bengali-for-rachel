import rawContent from "../../../content/learn-bengali.json";
import { createAuthoredLessonLookup, curriculumFromContent } from "@/lib/course-content-shared";
import type { LearningContent } from "@/types/learning";

const content = rawContent as LearningContent;

export const curriculum = curriculumFromContent(content, "bengali");
export const getAuthoredLesson = createAuthoredLessonLookup(content);
