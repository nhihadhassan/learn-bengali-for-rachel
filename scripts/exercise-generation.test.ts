/**
 * Tests for the deterministic exercise generators, anchored on Section 1 Unit 1.
 *
 *   npm run test:exercise-generation
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getLesson, getUnitByCoords, loadCurriculum } from "../src/curriculum/loader";
import {
  generateDialogueResponse,
  generateFillBlank,
  generateMatchPairs,
  generateWordBankTranslation,
} from "../src/curriculum/generators";
import { normalizeAnswer } from "../src/curriculum/generators";
import { buildSeedBundle } from "../src/curriculum/seed";
import { validateCurriculum } from "../src/curriculum/validate";

const course = loadCurriculum();
const unit = getUnitByCoords(course, 1, 1);
assert.ok(unit, "Section 1 Unit 1 must exist");
// Lesson 1 focuses on Unit 1's vocabulary and phrases; use it for every generator.
const lesson = getLesson(unit, 1);
assert.ok(lesson, "Unit 1 lesson 1 must exist");

test("the real curriculum validates against its schema", () => {
  const result = validateCurriculum(course);
  assert.equal(result.valid, true, result.errors.slice(0, 5).join("; "));
});

test("Section 1 Unit 1 is the café unit we expect", () => {
  assert.equal(unit.id, "es-en-s01-u001");
  assert.ok(unit.vocabulary.length >= 5);
  assert.ok(unit.phrase_patterns.length >= 2);
});

test("match_pairs is deterministic and well-formed", () => {
  const a = generateMatchPairs(unit, lesson);
  const b = generateMatchPairs(unit, lesson);
  assert.deepEqual(a, b, "same inputs must yield identical output");

  assert.equal(a.type, "match_pairs");
  assert.equal(a.pairs?.length, 5);
  for (const pair of a.pairs ?? []) {
    assert.ok(pair.spanish.length > 0 && pair.english.length > 0);
  }
  assert.ok(Array.isArray(a.acceptable_answers));
  assert.ok(a.acceptable_answers.length > 0);
});

test("fill_blank blanks a real content word and offers it as an option", () => {
  const a = generateFillBlank(unit, lesson);
  const b = generateFillBlank(unit, lesson);
  assert.deepEqual(a, b);

  assert.equal(a.type, "fill_blank");
  assert.ok(a.sentence && a.sentence.length > 0);
  assert.ok(Array.isArray(a.options) && a.options.length === 4);

  // The correct (normalized) answer must be among the options and acceptable.
  const answer = a.acceptable_answers.find((value) => a.options?.includes(value));
  assert.ok(answer, "an acceptable answer must appear in the options");

  // The blanked word is removed from the visible sentence halves.
  const shown = `${a.before ?? ""} ${a.after ?? ""}`;
  assert.ok(!shown.split(/\s+/).map(normalizeAnswer).includes(normalizeAnswer(answer)));
});

test("word_bank_translation tokens contain every correct word", () => {
  const a = generateWordBankTranslation(unit, lesson);
  const b = generateWordBankTranslation(unit, lesson);
  assert.deepEqual(a, b);

  assert.equal(a.type, "word_bank_translation");
  assert.ok(a.english_prompt && a.english_prompt.length > 0);
  assert.ok(Array.isArray(a.tokens));

  const correct = a.acceptable_answers[0];
  const tokenSet = new Set((a.tokens ?? []).map(normalizeAnswer));
  for (const word of correct.split(/\s+/)) {
    assert.ok(tokenSet.has(normalizeAnswer(word)), `token bank must include "${word}"`);
  }
});

test("dialogue_response options include the acceptable reply", () => {
  const a = generateDialogueResponse(unit, lesson);
  const b = generateDialogueResponse(unit, lesson);
  assert.deepEqual(a, b);

  assert.equal(a.type, "dialogue_response");
  assert.ok(a.dialogue_prompt?.spanish && a.dialogue_prompt.english);
  assert.ok(Array.isArray(a.options) && a.options.length > 0);

  const normalizedOptions = (a.options ?? []).map(normalizeAnswer);
  const matched = a.acceptable_answers.some((value) => normalizedOptions.includes(normalizeAnswer(value)));
  assert.ok(matched, "an acceptable answer must be selectable among the options");
});

test("acceptable_answers is always an array (never a bare string)", () => {
  for (const gen of [generateMatchPairs, generateFillBlank, generateWordBankTranslation, generateDialogueResponse]) {
    const exercise = gen(unit, lesson);
    assert.ok(Array.isArray(exercise.acceptable_answers));
  }
});

test("buildSeedBundle keeps external ids, generates internal uuids, preserves provenance", () => {
  const bundle = buildSeedBundle(course);

  assert.equal(bundle.course.external_id, course.course_id);
  assert.notEqual(bundle.course.id, bundle.course.external_id);
  assert.equal(bundle.units.length, course.units.length);

  const seededUnit = bundle.units.find((item) => item.external_id === "es-en-s01-u001");
  assert.ok(seededUnit);
  // Internal id is a well-formed uuid distinct from the external id.
  assert.match(seededUnit.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  // Provenance survives untouched.
  assert.deepEqual(seededUnit.provenance, unit.provenance);

  // Internal ids are deterministic across builds.
  const again = buildSeedBundle(course);
  assert.equal(again.units[0].id, bundle.units[0].id);
  assert.ok(bundle.exercises.length > 0, "at least one exercise should be generated");
});
