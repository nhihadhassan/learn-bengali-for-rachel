/**
 * The course registry is the platform's source of truth: every registered
 * course must be fully described, and every course must have content, an
 * outline entry, and a progress bucket. Adding a course without wiring it up
 * fails here rather than at runtime.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  COURSES,
  COURSE_IDS,
  getCapabilities,
  getCourse,
  getCourseNouns,
  getTargetLanguage,
  isCourseId,
  mapCourses,
  toCourseId,
} from "@/lib/courses";
import { getCourseLessons, getCourseOutline, getCourseSections } from "@/lib/course-index";
import { curricula, getCurriculum, getLessonsForCurriculum } from "@/lib/content";

test("registry ids are unique and match the descriptor list", () => {
  assert.equal(new Set(COURSE_IDS).size, COURSE_IDS.length);
  assert.deepEqual(
    COURSES.map((course) => course.id),
    [...COURSE_IDS],
  );
});

test("every course is fully described", () => {
  for (const course of COURSES) {
    assert.ok(course.label.length > 0, `${course.id} needs a label`);
    assert.ok(course.shortLabel.length > 0, `${course.id} needs a short label`);
    assert.ok(course.description.length > 0, `${course.id} needs a description`);
    assert.match(course.locale, /^[a-z]{2}(-[A-Z]{2})?$/, `${course.id} locale`);
    assert.ok(course.accent.emoji.length > 0, `${course.id} needs an emoji`);
    assert.ok(getCourseNouns(course.id).lesson.length > 0);
  }
});

test("capabilities are declared per course, not inferred from ids", () => {
  // The lesson engine asks "does this course support listening?" — never
  // "is this course Spanish?". These are the answers it relies on.
  assert.equal(getCapabilities("spanish").listening, true);
  assert.equal(getCapabilities("spanish").dialogue, true);
  // Romanized courses stay off: English voices mispronounce them.
  assert.equal(getCapabilities("bengali").listening, false);
  assert.equal(getCapabilities("malayalam").listening, false);
  // Bengali is the only course with a native script alongside romanization.
  assert.equal(getCapabilities("bengali").script, true);
  // History is not a language course and cannot be placement-tested.
  assert.equal(getCapabilities("history").kind, "history");
  assert.equal(getCapabilities("history").placement, false);

  for (const course of COURSES) {
    assert.ok(
      ["language", "history"].includes(course.capabilities.kind),
      `${course.id} has an unknown kind`,
    );
  }
});

test("unknown ids fall back to the default course", () => {
  assert.equal(toCourseId("spanish"), "spanish");
  assert.equal(toCourseId("nope"), "bengali");
  assert.equal(toCourseId(undefined), "bengali");
  assert.equal(isCourseId("history"), true);
  assert.equal(isCourseId("Spanish"), false);
});

test("mapCourses covers exactly the registered courses", () => {
  const record = mapCourses(() => 0);
  assert.deepEqual(Object.keys(record).sort(), [...COURSE_IDS].sort());
});

test("every registered course has content and an outline that agree", () => {
  assert.equal(curricula.length, COURSE_IDS.length);

  for (const courseId of COURSE_IDS) {
    const curriculum = getCurriculum(courseId);
    const outline = getCourseOutline(courseId);
    const contentLessons = getLessonsForCurriculum(courseId);

    assert.equal(curriculum.id, courseId);
    assert.equal(curriculum.label, getCourse(courseId).label);
    assert.ok(curriculum.units.length > 0, `${courseId} has no units`);

    assert.equal(
      outline.unitCount,
      curriculum.units.length,
      `${courseId} outline unit count is stale`,
    );
    assert.equal(
      outline.lessonCount,
      contentLessons.length,
      `${courseId} outline lesson count is stale`,
    );
    assert.deepEqual(
      getCourseLessons(courseId).map((lesson) => lesson.id),
      contentLessons.map((lesson) => lesson.id),
      `${courseId} outline lesson order is stale`,
    );
  }
});

test("lesson ids are globally unique across courses", () => {
  const seen = new Map<string, string>();

  for (const courseId of COURSE_IDS) {
    for (const lesson of getCourseLessons(courseId)) {
      const owner = seen.get(lesson.id);
      assert.equal(
        owner,
        undefined,
        `lesson id ${lesson.id} is claimed by both ${owner} and ${courseId}`,
      );
      seen.set(lesson.id, courseId);
    }
  }
});

test("sections group every unit, with an implicit group for small courses", () => {
  for (const courseId of COURSE_IDS) {
    const sections = getCourseSections(courseId);
    const unitsInSections = sections.reduce(
      (total, section) => total + section.units.length,
      0,
    );

    assert.equal(unitsInSections, getCourseOutline(courseId).unitCount);
    assert.ok(sections.length > 0, `${courseId} produced no sections`);
  }

  // Courses whose packs declare sections carry those; the rest get one
  // implicit group so the path browser has something to render either way.
  assert.equal(getCourseSections("spanish").length, 4);
  assert.equal(getCourseSections("bengali").length, 3);
  assert.equal(getCourseSections("malayalam").length, 1);
  assert.equal(getCourseSections("spanish-peru").length, 1);
});

test("learner-facing copy names each course's own language", () => {
  // A hard-coded "Escribe en español…" placeholder once sat under a prompt
  // reading "Write this in Bengali.", telling the learner to answer in a
  // language the course does not teach. Both strings come from the registry
  // now, so they cannot drift apart again.
  for (const courseId of COURSE_IDS) {
    const language = getTargetLanguage(courseId);
    assert.ok(language.length > 0, `${courseId} needs a target language`);
    assert.ok(
      !/español|Spanish/i.test(language) || courseId.startsWith("spanish"),
      `${courseId} should not describe itself as Spanish`,
    );
  }

  assert.equal(getTargetLanguage("bengali"), "Bengali");
  assert.equal(getTargetLanguage("spanish"), "Spanish");
  // "Spanish for Peru" teaches Spanish; the short label alone would have
  // produced "Write this in Peru."
  assert.equal(getTargetLanguage("spanish-peru"), "Spanish");
  assert.equal(getTargetLanguage("malayalam"), "Malayalam");
});
