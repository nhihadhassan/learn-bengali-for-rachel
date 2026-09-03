/**
 * Grammar has to be taught, then practised as a *pattern* — not as one more
 * vocabulary question wearing a grammar label.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getLessonsForCurriculum } from "@/lib/content";
import { COURSE_IDS, getCapabilities } from "@/lib/courses";
import {
  allGrammarRules,
  buildGrammarDrills,
  findGrammarRule,
  getGrammarFocus,
} from "@/lib/grammar-drills";
import { buildLessonSteps } from "@/lib/lesson-steps";
import { normalizeWord } from "@/lib/text-tokens";
import type { Phrase } from "@/types/learning";

function phrase(id: string, romanized: string, english: string): Phrase {
  return { id, romanized, english, pronunciation: "", category: "phrase" };
}

const KNOWN = [
  phrase("p1", "Quiero un café, por favor.", "I want a coffee, please."),
  phrase("p2", "Ella es mi hermana.", "She is my sister."),
  phrase("p3", "Está muy caliente.", "It is very hot."),
  phrase("p4", "Vivo en Lima.", "I live in Lima."),
];

test("every authored rule is small enough to teach inside a lesson", () => {
  for (const rule of allGrammarRules()) {
    assert.ok(rule.title.length > 0, `${rule.id} has no title`);
    assert.ok(
      rule.explanation.length <= 260,
      `${rule.id}'s explanation is a lecture (${rule.explanation.length} chars)`,
    );
    assert.ok(rule.examples.length >= 2, `${rule.id} needs examples`);

    for (const example of rule.examples) {
      assert.ok(example.target.length > 0 && example.english.length > 0, rule.id);
    }
  }
});

test("rules resolve from the grammar targets the curriculum declares", () => {
  assert.ok(findGrammarRule("basic noun gender and articles"));
  assert.ok(findGrammarRule("Present Tense Foundations"), "matching is case-insensitive");
  assert.equal(findGrammarRule("no such target"), undefined);
});

test("drills test the pattern: the options are the confusable set", () => {
  const focus = getGrammarFocus("present tense foundations")!;
  const drills = buildGrammarDrills(focus, KNOWN, "seed");

  assert.ok(drills.length > 0, "no drill was produced from known sentences");

  for (const drill of drills) {
    if (drill.kind !== "cloze") {
      continue;
    }

    assert.ok(drill.options.includes(drill.answer));
    assert.ok(drill.options.length >= 2, "a drill with one option is not a question");
    // Every option is a form of the same pattern, not a random other word.
    const shown = `${drill.before} ${drill.after}`.split(/\s+/).map(normalizeWord);
    assert.ok(
      !shown.includes(normalizeWord(drill.answer)),
      "the answer is still visible in the sentence",
    );
    assert.ok(
      !drill.answer.match(/[.,;:!?]$/),
      `the answer carries punctuation: "${drill.answer}"`,
    );
  }
});

test("drills are deterministic", () => {
  const focus = getGrammarFocus("present tense foundations")!;
  assert.deepEqual(
    buildGrammarDrills(focus, KNOWN, "seed"),
    buildGrammarDrills(focus, KNOWN, "seed"),
  );
});

test("a rule with nothing to drill returns nothing rather than a broken question", () => {
  const focus = getGrammarFocus("preterite and imperfect in context")!;
  // None of these sentences contain a past-tense marker.
  assert.deepEqual(buildGrammarDrills(focus, KNOWN, "seed"), []);
});

test("known exceptions are never drilled as if they were the rule", () => {
  const focus = getGrammarFocus("basic noun gender and articles")!;
  const drills = buildGrammarDrills(
    focus,
    [phrase("x1", "el agua", "water"), phrase("x2", "la leche", "milk")],
    "seed",
  );

  for (const drill of drills) {
    assert.notEqual(
      drill.phrase.romanized,
      "el agua",
      "el agua is feminine but takes el — teaching it as the rule is wrong",
    );
  }
});

/** Courses that plan cumulatively — the only ones that name a grammar point. */
const CUMULATIVE = COURSE_IDS.filter(
  (id) => getCapabilities(id).lessonStrategy === "cumulative",
);

test("Grammar focus lessons actually teach and then drill grammar", () => {
  const grammarLessons = CUMULATIVE.flatMap((courseId) =>
    getLessonsForCurriculum(courseId)
      .filter((lesson) => lesson.plan?.kind === "grammar")
      .slice(0, 12),
  );

  assert.ok(grammarLessons.length > 0);
  // Both cumulative courses must be represented, or this test could pass while
  // one of them silently stopped producing grammar lessons at all.
  assert.equal(
    new Set(grammarLessons.map((lesson) => lesson.curriculumId)).size,
    CUMULATIVE.length,
  );

  let withDrills = 0;

  for (const lesson of grammarLessons) {
    const steps = buildLessonSteps(lesson);
    const card = steps.find((step) => step.type === "grammar");

    assert.ok(card, `${lesson.id} has no grammar card`);

    const drills = steps.filter(
      (step) => step.type === "complete" && Boolean(step.grammarNote),
    );

    if (drills.length > 0) {
      withDrills += 1;
      // A grammar drill must come after the explanation, not before it.
      const cardIndex = steps.indexOf(card!);
      const firstDrill = steps.indexOf(drills[0]);
      assert.ok(firstDrill > cardIndex, `${lesson.id} drills before it explains`);
    }
  }

  assert.ok(
    withDrills >= grammarLessons.length / 2,
    `only ${withDrills}/${grammarLessons.length} grammar lessons produced pattern drills`,
  );
});

test("phrase-book courses never get a grammar card", () => {
  // Asked of the registry rather than a hand-written list of ids: when Bengali
  // became cumulative, a hard-coded list would have gone on asserting the old
  // behaviour of a course that no longer had it.
  const phraseBook = COURSE_IDS.filter(
    (id) => getCapabilities(id).lessonStrategy === "simple",
  );

  assert.ok(phraseBook.length > 0);

  for (const courseId of phraseBook) {
    for (const lesson of getLessonsForCurriculum(courseId)) {
      const types = buildLessonSteps(lesson).map((step) => step.type);
      assert.ok(!types.includes("grammar"), `${courseId}/${lesson.id}`);
    }
  }
});
