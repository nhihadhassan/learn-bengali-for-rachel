/**
 * The committed course index is generated from the full curriculum content. If
 * content changes and nobody reruns `npm run build:course-index`, navigation
 * would silently show a stale course — so this test rebuilds it in memory and
 * compares.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { buildCourseIndex, courseIndexPath } from "./course-index-source";
import {
  getCourseLessonIds,
  getCourseSections,
  isLargeCourse,
  locateLesson,
  findFollowingLesson,
} from "@/lib/course-index";
import type { CourseId } from "@/lib/courses";
import { getLessonsForCurriculum } from "@/lib/content";

test("the committed course index is up to date with content", () => {
  const committed = JSON.parse(
    readFileSync(join(process.cwd(), courseIndexPath), "utf8"),
  );

  assert.deepEqual(
    committed,
    JSON.parse(JSON.stringify(buildCourseIndex())),
    `${courseIndexPath} is stale — run: npm run build:course-index`,
  );
});

test("the index carries no phrase or exercise payload", () => {
  const raw = readFileSync(join(process.cwd(), courseIndexPath), "utf8");
  const index = JSON.parse(raw);
  const lesson = index.courses.spanish.units[0].lessons[0];

  const allowedKeys = ["difficulty", "icon", "id", "phraseCount", "summary", "title"];
  for (const key of Object.keys(lesson)) {
    assert.ok(allowedKeys.includes(key), `unexpected key "${key}" in the index`);
  }
  // A guard on the whole point of this file: it must stay far smaller than the
  // 1.2MB Spanish pack it replaces on navigation routes.
  assert.ok(
    raw.length < 400_000,
    `course index grew to ${raw.length} bytes — it must stay lightweight`,
  );
});

test("lessons can be located and followed without loading content", () => {
  const spanishLessons = getLessonsForCurriculum("spanish");
  const first = spanishLessons[0];
  const located = locateLesson(first.id);

  assert.ok(located);
  assert.equal(located.courseId, "spanish");
  assert.equal(located.lessonIndex, 0);
  assert.equal(located.lesson.title, first.title);
  assert.equal(findFollowingLesson(first.id)?.id, spanishLessons[1].id);
  assert.equal(
    findFollowingLesson(spanishLessons[spanishLessons.length - 1].id),
    undefined,
    "the last lesson has nothing after it",
  );
  assert.equal(locateLesson("does-not-exist"), undefined);
});

test("course lesson id sets match content exactly", () => {
  const ids = getCourseLessonIds("bengali");
  const fromContent = getLessonsForCurriculum("bengali").map((lesson) => lesson.id);

  assert.equal(ids.size, fromContent.length);
  for (const id of fromContent) {
    assert.ok(ids.has(id), `${id} missing from the index`);
  }
});

test("the path stays browsable as a course grows", () => {
  // Three presentations, and which one a course gets follows from its size
  // rather than from its name. Bengali crossed from "show me everything" to
  // "show me where I am" when it went from sixteen lessons to sixty-eight;
  // nothing else moved.
  const shape = (courseId: CourseId) => {
    const units = getCourseSections(courseId).flatMap((section) => section.units);
    const lessons = units.reduce((total, unit) => total + unit.lessons.length, 0);

    return { units: units.length, lessons };
  };

  assert.equal(isLargeCourse("spanish"), true, "131 units needs the window");
  assert.equal(isLargeCourse("bengali"), false, "14 units does not");

  // The small courses stay small enough to read in one scroll.
  for (const courseId of ["malayalam", "spanish-peru", "history"] as const) {
    assert.ok(
      shape(courseId).lessons <= 24,
      `${courseId} would now collapse its units`,
    );
  }

  // Bengali is past that, so its path opens the current unit rather than all
  // fourteen. If this ever fails the course shrank, and the wall is back.
  assert.ok(
    shape("bengali").lessons > 24,
    "Bengali should be past the browsable-at-a-glance size",
  );
});
