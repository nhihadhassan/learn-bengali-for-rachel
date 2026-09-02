import { getCourse } from "@/lib/courses";
import { spanishCurriculumUnits } from "@/lib/spanish-curriculum";

const course = getCourse("spanish");

export const curriculum = {
  id: course.id,
  label: course.label,
  shortLabel: course.shortLabel,
  description: course.description,
  locale: course.locale,
  mode: course.capabilities.kind,
  units: spanishCurriculumUnits,
};
