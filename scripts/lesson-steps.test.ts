/**
 * The lesson engine's sequencing rules, checked against real curriculum content.
 *
 * The most important one is non-negotiable and easy to regress: a phrase must
 * never be tested in the step immediately after it is taught.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  TEACH_TEST_LAG,
  buildLessonSteps,
  countCompletedWorkSteps,
  countQuestionSteps,
  countWorkSteps,
  getStepPhraseId,
  getStepPrompt,
  isWorkStep,
  stepDifficulty,
  type LessonStep,
} from "@/lib/lesson-steps";
import { getLessonsForCurriculum } from "@/lib/content";
import { getCapabilities } from "@/lib/courses";
import type { CurriculumId, Lesson } from "@/types/learning";

/** A spread of real lessons across every language course. */
function sampleLessons(courseId: CurriculumId, count = 6): Lesson[] {
  const lessons = getLessonsForCurriculum(courseId);
  const stride = Math.max(1, Math.floor(lessons.length / count));
  return lessons.filter((_, index) => index % stride === 0).slice(0, count);
}

const LANGUAGE_COURSES: CurriculumId[] = [
  "bengali",
  "spanish-peru",
  "spanish",
  "malayalam",
];

const ALL_SAMPLES = LANGUAGE_COURSES.flatMap((courseId) =>
  sampleLessons(courseId).map((lesson) => [courseId, lesson] as const),
);

test("a phrase is never tested in the step right after it is taught", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    const steps = buildLessonSteps(lesson);

    steps.forEach((step, index) => {
      if (step.type !== "learn") {
        return;
      }

      const taughtId = step.phrase.id;

      for (
        let ahead = 1;
        ahead <= TEACH_TEST_LAG && index + ahead < steps.length;
        ahead += 1
      ) {
        const later = steps[index + ahead];

        if (later.type === "learn" || later.type === "intro") {
          continue;
        }

        assert.notEqual(
          getStepPhraseId(later),
          taughtId,
          `${courseId}/${lesson.id}: "${taughtId}" is tested only ${ahead} step(s) after being taught`,
        );
      }
    });
  }
});

test("every taught phrase is checked at some point in the lesson", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    const steps = buildLessonSteps(lesson);
    const taught = steps
      .filter((step): step is Extract<LessonStep, { type: "learn" }> => step.type === "learn")
      .map((step) => step.phrase.id);
    const tested = new Set(
      steps
        .filter((step) => step.type !== "learn" && step.type !== "intro")
        .map(getStepPhraseId),
    );

    for (const phraseId of taught) {
      assert.ok(
        tested.has(phraseId),
        `${courseId}/${lesson.id}: "${phraseId}" is taught but never checked`,
      );
    }
  }
});

test("lessons open with an intro and mix more than one question type", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    const steps = buildLessonSteps(lesson);

    assert.equal(steps[0].type, "intro", `${courseId}/${lesson.id}`);

    const questionTypes = new Set(
      steps
        .filter((step) => step.type !== "intro" && step.type !== "learn")
        .map((step) => step.type),
    );

    assert.ok(
      questionTypes.size >= 2,
      `${courseId}/${lesson.id} only produced ${[...questionTypes].join(", ")}`,
    );
  }
});

test("the practice block climbs in difficulty and ends on an easy win", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    const steps = buildLessonSteps(lesson);
    // The practice block is everything after the last teach card.
    const lastLearn = steps.map((step) => step.type).lastIndexOf("learn");
    const practice = steps.slice(lastLearn + 1);

    if (practice.length < 2) {
      continue;
    }

    const last = practice[practice.length - 1];
    const hardest = Math.max(...practice.map(stepDifficulty));

    if (hardest > 2) {
      assert.ok(
        stepDifficulty(last) <= 2,
        `${courseId}/${lesson.id} ends on a hard step (${last.type})`,
      );
    }
  }
});

test("step ids are unique so answers cannot be attributed to the wrong step", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    const ids = buildLessonSteps(lesson).map((step) => step.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${courseId}/${lesson.id} produced duplicate step ids`,
    );
  }
});

test("multiple-choice steps always offer the right answer plus alternatives", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    for (const step of buildLessonSteps(lesson)) {
      if (step.type === "recognize") {
        assert.ok(step.options.includes(step.phrase.english), `${courseId}/${step.id}`);
        assert.ok(step.options.length >= 2, `${courseId}/${step.id} has one option`);
      }

      if (step.type === "produce") {
        assert.ok(step.options.includes(step.phrase.romanized), `${courseId}/${step.id}`);
        assert.ok(step.options.length >= 2, `${courseId}/${step.id} has one option`);
      }

      if (step.type === "complete") {
        assert.ok(step.options.includes(step.answer), `${courseId}/${step.id}`);
        // The blanked word must not still be visible in the sentence halves.
        const shown = `${step.before} ${step.after}`.split(/\s+/);
        assert.ok(!shown.includes(step.answer), `${courseId}/${step.id} shows its answer`);
      }

      if (step.type === "dialogue") {
        assert.ok(step.options.includes(step.answer), `${courseId}/${step.id}`);
        assert.ok(step.options.length >= 3, `${courseId}/${step.id} needs real choices`);
      }

      if (step.type === "order" || step.type === "translate" || step.type === "listen") {
        for (const word of step.phrase.romanized.split(/\s+/)) {
          assert.ok(
            step.tokens.includes(word),
            `${courseId}/${step.id} word bank is missing "${word}"`,
          );
        }
      }

      assert.ok(getStepPrompt(step).length > 0, `${courseId}/${step.id} has no prompt`);
    }
  }
});

test("audio steps appear only for courses whose capabilities allow them", () => {
  for (const [courseId, lesson] of ALL_SAMPLES) {
    const capabilities = getCapabilities(courseId);
    const types = new Set(buildLessonSteps(lesson).map((step) => step.type));

    if (!capabilities.listening) {
      assert.ok(
        !types.has("listen"),
        `${courseId} does not support listening but produced a listen step`,
      );
    }

    if (!capabilities.dialogue) {
      assert.ok(
        !types.has("dialogue"),
        `${courseId} does not support dialogue but produced a dialogue step`,
      );
    }
  }

  // The Spanish course declares both, and its lessons should use them.
  const spanishTypes = new Set(
    sampleLessons("spanish", 4).flatMap((lesson) =>
      buildLessonSteps(lesson).map((step) => step.type),
    ),
  );
  assert.ok(spanishTypes.has("listen"), "Spanish lessons should include listening");
  assert.ok(spanishTypes.has("dialogue"), "Spanish lessons should include dialogue");
});

test("review sessions skip teaching and go straight to checks", () => {
  const lesson = sampleLessons("spanish", 1)[0];
  const steps = buildLessonSteps(lesson, { reviewMode: true });

  assert.ok(steps.length > 0);
  assert.ok(!steps.some((step) => step.type === "intro"));
  assert.ok(!steps.some((step) => step.type === "learn"));
});

test("progress ignores the intro card, so a lesson starts at 0%", () => {
  const lesson = sampleLessons("bengali", 1)[0];
  const steps = buildLessonSteps(lesson);

  assert.equal(isWorkStep(steps[0]), false, "the intro is not work");
  assert.equal(countWorkSteps(steps), steps.length - 1);
  // Sitting on the intro means nothing is done yet.
  assert.equal(countCompletedWorkSteps(steps, 0), 0);
  // After the intro, one work step is done for each step advanced past.
  assert.equal(countCompletedWorkSteps(steps, 1), 0);
  assert.equal(countCompletedWorkSteps(steps, 2), 1);
  assert.equal(countCompletedWorkSteps(steps, steps.length), countWorkSteps(steps));

  assert.ok(countQuestionSteps(steps) > 0);
  assert.ok(countQuestionSteps(steps) < countWorkSteps(steps));
});

test("a lesson with no phrases degrades gracefully instead of throwing", () => {
  const empty: Lesson = {
    id: "empty-lesson",
    unitId: "u",
    unitNumber: 1,
    title: "Empty",
    difficulty: "intro",
    summary: "Nothing here yet.",
    phrases: [],
    exercises: [],
    curriculumId: "bengali",
  };

  const steps = buildLessonSteps(empty);

  assert.equal(steps.length, 1);
  assert.equal(steps[0].type, "intro");
  assert.equal(countWorkSteps(steps), 0);
});
