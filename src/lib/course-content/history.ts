import rawContent from "../../../content/learn-history.json";
import { createAuthoredLessonLookup, curriculumFromContent } from "@/lib/course-content-shared";
import type { LearningContent } from "@/types/learning";

const content = rawContent as LearningContent;

export const curriculum = curriculumFromContent(content, "history");
export const getAuthoredLesson = createAuthoredLessonLookup(content);
