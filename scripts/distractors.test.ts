/**
 * Wrong answers have to be plausible, or a multiple-choice question measures
 * test-taking rather than Spanish.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildMeaningOptions, buildTargetOptions, buildWordOptions } from "@/lib/distractors";
import { getLessonsForCurriculum } from "@/lib/content";
import { buildLessonSteps } from "@/lib/lesson-steps";
import { splitWords } from "@/lib/text-tokens";
import type { Phrase } from "@/types/learning";

function phrase(id: string, romanized: string, english: string, category = "noun"): Phrase {
  return { id, romanized, english, pronunciation: "", category };
}

const GREETINGS = [
  phrase("g1", "buenos días", "good morning", "expression"),
  phrase("g2", "buenas tardes", "good afternoon", "expression"),
  phrase("g3", "buenas noches", "good evening", "expression"),
  phrase("g4", "hasta luego", "see you later", "expression"),
];
const FOOD = [
  phrase("f1", "el café", "coffee"),
  phrase("f2", "el padre", "father"),
  phrase("f3", "el agua", "water"),
];

test("distractors come from the answer's own family, not a filler list", () => {
  const options = buildTargetOptions(GREETINGS[0], [...FOOD, ...GREETINGS.slice(1)], "seed");

  assert.ok(options.includes("buenos días"));
  const wrong = options.filter((option) => option !== "buenos días");
  const fromFamily = wrong.filter((option) => option.startsWith("buenas") || option.startsWith("hasta"));

  assert.ok(
    fromFamily.length >= 2,
    `expected greeting distractors, got ${wrong.join(", ")}`,
  );
});

test("the old hardcoded English fillers are gone", () => {
  const options = buildMeaningOptions(GREETINGS[0], [...GREETINGS.slice(1), ...FOOD], "seed");

  // "rice" and "father" were in the filler list; only real pool items may appear.
  const pool = new Set(
    [...GREETINGS, ...FOOD].map((item) => item.english),
  );
  for (const option of options) {
    assert.ok(pool.has(option), `"${option}" came from nowhere in the content`);
  }
});

test("a sentence answer is not the only sentence on screen", () => {
  const sentence = phrase("s1", "Quiero un café, por favor.", "I want a coffee, please.", "phrase");
  const pool = [
    phrase("s2", "La cuenta, por favor.", "The bill, please.", "phrase"),
    phrase("s3", "Para mí, un té.", "A tea for me.", "phrase"),
    ...FOOD,
  ];

  const options = buildTargetOptions(sentence, pool, "seed");
  const sentences = options.filter((option) => splitWords(option).length >= 3);

  assert.ok(sentences.length >= 2, `only one option was a sentence: ${options.join(" | ")}`);
});

test("a question is not the only question on screen", () => {
  const question = phrase("q1", "¿Cuánto cuesta?", "How much does it cost?", "phrase");
  const pool = [
    phrase("q2", "¿De dónde eres?", "Where are you from?", "phrase"),
    phrase("q3", "¿Dónde está el baño?", "Where is the bathroom?", "phrase"),
    phrase("s1", "Hace mucho frío.", "It is very cold.", "phrase"),
  ];

  const options = buildTargetOptions(question, pool, "seed");
  const questions = options.filter((option) => option.includes("?"));

  assert.ok(questions.length >= 2, `only one option was a question: ${options.join(" | ")}`);
});

test("options are unique and always contain the answer", () => {
  const duplicated = [...GREETINGS, ...GREETINGS];

  for (const answer of GREETINGS) {
    const options = buildTargetOptions(answer, duplicated, `seed-${answer.id}`);
    assert.ok(options.includes(answer.romanized));
    assert.equal(new Set(options).size, options.length);
    assert.ok(options.length <= 4);
  }
});

test("generation is deterministic for a given seed", () => {
  const a = buildTargetOptions(GREETINGS[0], [...GREETINGS.slice(1), ...FOOD], "same");
  const b = buildTargetOptions(GREETINGS[0], [...GREETINGS.slice(1), ...FOOD], "same");
  const c = buildTargetOptions(GREETINGS[0], [...GREETINGS.slice(1), ...FOOD], "different");

  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("cloze distractors could grammatically fill the gap", () => {
  const options = buildWordOptions("caliente", ["frío", "leche", "azúcar", "taza"], "seed");

  assert.ok(options.includes("caliente"));
  assert.equal(new Set(options).size, options.length);
});

test("real lessons never show an option twice", () => {
  for (const lesson of getLessonsForCurriculum("spanish").slice(0, 40)) {
    for (const step of buildLessonSteps(lesson)) {
      if (step.type === "recognize" || step.type === "produce" || step.type === "dialogue") {
        assert.equal(
          new Set(step.options).size,
          step.options.length,
          `${step.id} repeats an option`,
        );
      }

      if (step.type === "complete") {
        assert.equal(
          new Set(step.options).size,
          step.options.length,
          `${step.id} repeats an option`,
        );
        assert.ok(
          !step.answer.match(/[.,;:!?]$/),
          `${step.id} asks the learner to pick punctuation ("${step.answer}")`,
        );
      }
    }
  }
});
