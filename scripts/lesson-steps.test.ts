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
  MIN_RECYCLE_GAP,
  isTeachingStep,
  TEACH_TEST_LAG,
  adaptUpcomingSteps,
  applyMistakeRecycling,
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
import { getCurriculum, getLessonsForCurriculum } from "@/lib/content";
import { getCapabilities } from "@/lib/courses";
import type { CurriculumId, Lesson, LessonKind } from "@/types/learning";

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

  // The Spanish course declares both, and the lesson types built around them
  // should use them. Sampling by stride found whichever lessons the arithmetic
  // landed on, which stopped being dialogue lessons as soon as units carried
  // different lesson sequences.
  const spanishTypes = new Set(
    [lessonOfKind("listen", 3), lessonOfKind("context", 2)].flatMap((lesson) =>
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

// ---------------------------------------------------------------------------
// The cumulative engine
// ---------------------------------------------------------------------------

const SPANISH_LESSONS = getLessonsForCurriculum("spanish");
const SPANISH_UNITS = getCurriculum("spanish").units;

/**
 * Lessons are addressed by **where they are and what they are**, never by id.
 *
 * Ids move: the pilot curriculum replaced the first twelve units of the path,
 * and every test that named `es-en-s01-u001-l1` broke at once — which was the
 * right alarm and the wrong coupling. What these tests actually mean is "a
 * Discover lesson from a unit that has a backlog behind it".
 */
function unitAt(position: number) {
  const unit = SPANISH_UNITS[position - 1];
  assert.ok(unit, `no unit at path position ${position}`);
  return unit;
}

function lessonOfKind(kind: LessonKind, position: number): Lesson {
  const lesson = unitAt(position).lessons.find((item) => item.plan?.kind === kind);
  assert.ok(lesson, `unit ${position} has no ${kind} lesson`);
  return lesson!;
}

/** The first unit that still runs the pack's original six-lesson sequence. */
const SIX_KIND_UNIT = (() => {
  const wanted: LessonKind[] = ["discover", "build", "grammar", "listen", "context", "review"];
  const unit = SPANISH_UNITS.find((item) =>
    wanted.every((kind) => item.lessons.some((lesson) => lesson.plan?.kind === kind)),
  );
  assert.ok(unit, "no unit runs the six-lesson sequence");
  return unit!;
})();

function sixKindLesson(kind: LessonKind): Lesson {
  const lesson = SIX_KIND_UNIT.lessons.find((item) => item.plan?.kind === kind);
  assert.ok(lesson, `no ${kind} lesson`);
  return lesson!;
}

function questionTypes(lesson: Lesson): string[] {
  return buildLessonSteps(lesson)
    .filter((step) => step.type !== "intro" && step.type !== "learn")
    .map((step) => step.type);
}

test("the six lesson types produce meaningfully different sessions", () => {
  const kinds: LessonKind[] = ["discover", "build", "grammar", "listen", "context", "review"];
  const profiles = kinds.map((kind) => {
    const lesson = sixKindLesson(kind);
    return { id: lesson.id, kind: lesson.plan?.kind, types: questionTypes(lesson) };
  });

  // Discover leans on recognition and listening, not on production formats.
  const discover = profiles[0];
  assert.equal(discover.kind, "discover");
  assert.ok(
    !discover.types.includes("translate") && !discover.types.includes("order"),
    `Discover should not open with sentence construction: ${discover.types.join(" ")}`,
  );

  // Build is where pieces get combined.
  const build = profiles[1];
  assert.equal(build.kind, "build");
  assert.ok(
    build.types.some((type) => type === "order" || type === "translate"),
    `Build produced ${build.types.join(" ")}`,
  );

  // Listen and speak is audio-dominant.
  const listen = profiles[3];
  assert.equal(listen.kind, "listen");
  const listenCount = listen.types.filter((type) => type === "listen").length;
  assert.ok(listenCount >= 3, `only ${listenCount} listening questions`);
  assert.ok(
    listenCount > buildLessonSteps(sixKindLesson("discover")).filter((s) => s.type === "listen").length,
    "Listen and speak should out-listen Discover",
  );

  // Use in context runs a dialogue.
  const context = profiles[4];
  assert.equal(context.kind, "context");
  assert.ok(context.types.includes("dialogue"), `context produced ${context.types.join(" ")}`);

  // Unit review teaches nothing and reviews everything.
  const review = sixKindLesson("review");
  assert.equal(review.plan?.kind, "review");
  assert.ok(
    !buildLessonSteps(review).some((step) => step.type === "learn"),
    "Unit review should not introduce anything",
  );

  // No two of the six have the same question profile.
  const signatures = new Set(profiles.map((profile) => profile.types.join(",")));
  assert.equal(signatures.size, profiles.length, "two lesson types generated the same session");
});

test("a planned lesson checks older material before it has taught anything new", () => {
  // A unit past the first has a backlog to draw on.
  const lesson = lessonOfKind("discover", 2);
  const steps = buildLessonSteps(lesson);
  const newIds = new Set(lesson.plan?.newPhraseIds ?? []);
  const firstQuestion = steps.find(
    (step) => step.type !== "intro" && step.type !== "learn" && step.type !== "grammar",
  );

  assert.ok(firstQuestion, "no questions were generated");
  const phraseId = getStepPhraseId(firstQuestion!);
  assert.ok(phraseId && !newIds.has(phraseId), "the first question is about brand-new material");
});

test("lesson length stays near five minutes", () => {
  for (const lesson of SPANISH_LESSONS.slice(0, 60)) {
    const steps = buildLessonSteps(lesson);
    assert.ok(
      steps.length >= 8 && steps.length <= 20,
      `${lesson.id} generated ${steps.length} steps`,
    );
  }
});

test("generation is stable: the same lesson builds the same session", () => {
  for (const lesson of SIX_KIND_UNIT.lessons) {
    const first = buildLessonSteps(lesson).map((step) => `${step.type}:${step.id}`);
    const second = buildLessonSteps(lesson).map((step) => `${step.type}:${step.id}`);
    assert.deepEqual(first, second, `${lesson.id} is not deterministic`);
  }
});

test("a mistake comes back later, in a different format, without lengthening the lesson", () => {
  const lesson = lessonOfKind("build", 3);
  const steps = buildLessonSteps(lesson);
  const missedIndex = steps.findIndex(
    (step, index) => index > 0 && step.type === "recognize",
  );
  const missed = steps[missedIndex];
  const phraseId = getStepPhraseId(missed);
  assert.ok(phraseId);

  const after = applyMistakeRecycling(steps, missedIndex, missed, lesson);

  assert.equal(after.length, steps.length, "recycling changed the number of steps");

  const changed = after.findIndex((step, index) => step.id !== steps[index].id);
  assert.ok(changed > missedIndex, "nothing was recycled");
  assert.ok(
    changed - missedIndex >= MIN_RECYCLE_GAP,
    `the missed item came back after only ${changed - missedIndex} steps`,
  );
  assert.equal(getStepPhraseId(after[changed]), phraseId);
  assert.notEqual(after[changed].type, missed.type, "same question, asked again");
});

test("a second mistake takes the next slot rather than overwriting the first", () => {
  const lesson = lessonOfKind("build", 3);
  const steps = buildLessonSteps(lesson);
  const firstIndex = steps.findIndex((step, index) => index > 0 && step.type === "recognize");
  const once = applyMistakeRecycling(steps, firstIndex, steps[firstIndex], lesson);

  const secondIndex = once.findIndex(
    (step, index) => index > firstIndex && step.type === "produce",
  );

  if (secondIndex < 0) {
    return;
  }

  const twice = applyMistakeRecycling(once, secondIndex, once[secondIndex], lesson);
  const recycled = twice.filter(
    (step, index) => step.id !== steps[index]?.id,
  );

  assert.equal(twice.length, steps.length);
  assert.ok(recycled.length >= 1);
});

test("an unattributable mistake is left alone rather than mis-recycled", () => {
  const lesson = lessonOfKind("discover", 2);
  const steps = buildLessonSteps(lesson);

  assert.equal(applyMistakeRecycling(steps, 0, steps[0], lesson), steps);
});

test("a struggling learner gets scaffolding back; a confident one does not", () => {
  // Softening is refused when the easier version is a question the lesson has
  // already asked — a learner who misses three in a row should not be handed
  // the same cloze three times. So this asserts the rule across a sample:
  // a clean run never changes anything, softening happens somewhere, and every
  // softening that does happen keeps the lesson's length and the slot's id.
  let softened = 0;

  for (const lesson of SPANISH_LESSONS.slice(0, 120)) {
    const steps = buildLessonSteps(lesson);
    const hardIndex = steps.findIndex(
      (step) => step.type === "translate" || step.type === "listen" || step.type === "order",
    );

    if (hardIndex < 0) {
      continue;
    }

    assert.equal(
      adaptUpcomingSteps(steps, hardIndex, { recentResults: [true, true, true, true] }, lesson),
      steps,
      `${lesson.id}: a clean run should change nothing`,
    );

    const struggling = adaptUpcomingSteps(
      steps,
      hardIndex,
      { recentResults: [true, false, false, true] },
      lesson,
    );

    if (struggling === steps) {
      continue;
    }

    softened += 1;
    assert.equal(struggling.length, steps.length, `${lesson.id} changed length`);
    assert.equal(struggling[hardIndex].id, steps[hardIndex].id, "the slot keeps its identity");
    assert.ok(
      stepDifficulty(struggling[hardIndex]) <= stepDifficulty(steps[hardIndex]),
      "the replacement should be no harder",
    );
  }

  assert.ok(softened > 0, "no lesson softened a hard question after two misses");
});

test("dialogue turns build one conversation rather than unrelated prompts", () => {
  const lesson = lessonOfKind("context", 2);
  const dialogue = buildLessonSteps(lesson).filter(
    (step): step is Extract<LessonStep, { type: "dialogue" }> => step.type === "dialogue",
  );

  assert.ok(dialogue.length >= 2, "an authored scenario should run several turns");

  dialogue.forEach((step, index) => {
    assert.equal(step.scenario, dialogue[0].scenario, "turns drifted to another scenario");
    assert.equal(step.turnIndex, index);
    assert.equal((step.history ?? []).length, index * 2, "the conversation so far is missing");
    assert.ok(step.options.includes(step.answer));
    // A question is answered by something that is not another question.
    if (step.promptRomanized.includes("?")) {
      assert.ok(!step.answer.includes("?"), `"${step.answer}" answers a question with a question`);
    }
  });
});

test("a practice session over a planned lesson teaches nothing", () => {
  const steps = buildLessonSteps(lessonOfKind("build", 3), { reviewMode: true });

  assert.ok(steps.length > 0);
  assert.ok(!steps.some((step) => step.type === "intro" || step.type === "learn"));
});

test("turning the flag off restores the phrase-book lesson shape", () => {
  const lesson = lessonOfKind("discover", 2);
  const { plan, ...withoutPlan } = lesson;
  void plan;

  const steps = buildLessonSteps(withoutPlan as Lesson);

  assert.equal(steps[0].type, "intro");
  assert.ok(steps.some((step) => step.type === "learn"));
  assert.ok(!steps.some((step) => step.type === "grammar"));
});

test("a lesson never asks the same question twice", () => {
  // Every part of a planned lesson — warm-up checks, grammar drills, the
  // practice block, the recycle slots, the closer — draws from one shared
  // record of what has been asked. This is what stops a lesson turning into
  // five "complete the sentence" questions about the same sentence.
  for (const lesson of SPANISH_LESSONS.slice(0, 240)) {
    // Only steps that ask about a *phrase* can repeat each other. A story's
    // comprehension questions and a pattern prediction are about meaning, not
    // about an item, so they have no phrase id to collide on.
    const asked = buildLessonSteps(lesson)
      .filter((step) => !isTeachingStep(step) && getStepPhraseId(step) !== undefined)
      .map((step) => `${step.type}:${getStepPhraseId(step)}`);

    assert.equal(
      new Set(asked).size,
      asked.length,
      `${lesson.id} repeats a question: ${asked.join(" ")}`,
    );
  }
});
