/**
 * Which lexicon answers "has the learner met this word?" — per course.
 *
 * `curriculum-plan` and the lesson engine stay language-agnostic by taking a
 * `KnownWordResolver` rather than importing a lexicon. This is the one place
 * that knows which resolver belongs to which course, so adding a language means
 * adding a row here instead of a branch anywhere else.
 *
 * Courses with no lexicon fall back to the planner's three-character stem
 * heuristic, which is the documented default and good enough for a phrase book
 * with no prerequisite chain to get wrong.
 */

import { isKnownForm as isKnownBengaliForm } from "@/lib/bengali-lexicon";
import type { CourseId } from "@/lib/courses";
import type { KnownWordResolver } from "@/lib/curriculum-plan";
import { isKnownForm as isKnownSpanishForm } from "@/lib/spanish-lexicon";

const RESOLVERS: Partial<Record<CourseId, KnownWordResolver>> = {
  spanish: isKnownSpanishForm,
  // Spanish for Peru is the same language; the lexicon is about words, not
  // about which course happens to teach them.
  "spanish-peru": isKnownSpanishForm,
  bengali: isKnownBengaliForm,
};

/**
 * The resolver for a course, or `undefined` when it has no lexicon — which is
 * what `curriculum-plan` expects for "use the stem heuristic".
 */
export function knownFormsFor(courseId: string | undefined): KnownWordResolver | undefined {
  return courseId ? RESOLVERS[courseId as CourseId] : undefined;
}
