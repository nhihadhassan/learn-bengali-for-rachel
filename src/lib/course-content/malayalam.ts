import rawContent from "../../../content/learn-malayalam.json";
import { createAuthoredLessonLookup, curriculumFromContent } from "@/lib/course-content-shared";
import type { LearningContent } from "@/types/learning";

const content = rawContent as LearningContent;

export const curriculum = curriculumFromContent(content, "malayalam");
export const getAuthoredLesson = createAuthoredLessonLookup(content);
