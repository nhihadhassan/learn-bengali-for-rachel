/**
 * The spaced-repetition policy has one definition. These tests pin its
 * behaviour and check it still matches the review schedule the curricula
 * declare in their content, so the two cannot drift apart again.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_REVIEW_DAYS,
  MASTERY_BOX,
  MAX_BOX,
  REVIEW_INTERVAL_DAYS,
  applyResult,
  countDue,
  isDue,
  isMastered,
  nextBox,
  seedKnownMemory,
  selectReviewPhraseIds,
  summarizeMemory,
} from "@/lib/review-policy";
import { curricula } from "@/lib/content";
import type { PhraseMemory } from "@/types/learning";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 20, 12, 0, 0);

function memory(box: number, dueOffsetDays: number, seenOffsetDays = 0): PhraseMemory {
  return {
    box,
    dueAt: new Date(NOW + dueOffsetDays * DAY_MS).toISOString(),
    lastSeenAt: new Date(NOW + seenOffsetDays * DAY_MS).toISOString(),
  };
}

test("the policy ladder matches the review schedule declared in content", () => {
  const declared = curricula
    .flatMap((curriculum) => curriculum.units)
    .flatMap((unit) => unit.lessons)
    .map((lesson) => lesson.reviewSchedule?.initialReviewDays)
    .filter((days): days is number[] => Array.isArray(days));

  assert.ok(declared.length > 0, "expected some lessons to declare a schedule");

  for (const days of declared) {
    assert.deepEqual(
      days,
      [...INITIAL_REVIEW_DAYS],
      "content review schedule has drifted from @/lib/review-policy",
    );
  }
});

test("box 0 is due immediately and the ladder only grows", () => {
  assert.equal(REVIEW_INTERVAL_DAYS[0], 0);

  for (let box = 1; box <= MAX_BOX; box += 1) {
    assert.ok(
      REVIEW_INTERVAL_DAYS[box] > REVIEW_INTERVAL_DAYS[box - 1],
      `interval for box ${box} must exceed box ${box - 1}`,
    );
  }
});

test("correct answers promote, misses demote, and both clamp", () => {
  assert.equal(nextBox(0, true), 1);
  assert.equal(nextBox(3, true), 4);
  assert.equal(nextBox(MAX_BOX, true), MAX_BOX, "cannot climb past the top box");
  assert.equal(nextBox(2, false), 1);
  assert.equal(nextBox(0, false), 0, "cannot fall below box 0");
});

test("a correct answer schedules the next review by its box interval", () => {
  const first = applyResult(undefined, true, NOW);

  assert.equal(first.box, 1);
  assert.equal(
    new Date(first.dueAt).getTime(),
    NOW + REVIEW_INTERVAL_DAYS[1] * DAY_MS,
  );
  assert.equal(new Date(first.lastSeenAt).getTime(), NOW);
});

test("a miss makes the phrase due immediately", () => {
  const missed = applyResult(memory(4, 20), false, NOW);

  assert.equal(missed.box, 3);
  assert.equal(new Date(missed.dueAt).getTime(), NOW);
  assert.equal(isDue(missed, NOW), true);
});

test("placement seeds phrases as known but not yet proven", () => {
  const seeded = seedKnownMemory(NOW);

  assert.ok(seeded.box > 0 && seeded.box < MASTERY_BOX);
  assert.equal(isDue(seeded, NOW), false, "seeded phrases should not be due now");
});

test("review selection prefers due items, weakest first", () => {
  const ids = selectReviewPhraseIds(
    {
      strongAndDue: memory(3, -1, -10),
      weakAndDue: memory(1, -2, -3),
      notDue: memory(0, 5, -1),
    },
    10,
    NOW,
  );

  assert.deepEqual(ids, ["weakAndDue", "strongAndDue"]);
});

test("with nothing due, practice still offers the weakest items", () => {
  const ids = selectReviewPhraseIds(
    {
      strong: memory(5, 20, -2),
      weaker: memory(2, 3, -4),
    },
    10,
    NOW,
  );

  assert.deepEqual(ids, ["weaker", "strong"], "review must never be a dead end");
});

test("selection respects the limit and empty memory", () => {
  assert.deepEqual(selectReviewPhraseIds({}, 5, NOW), []);
  assert.equal(
    selectReviewPhraseIds(
      Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [`p${index}`, memory(0, -1, -index)]),
      ),
      12,
      NOW,
    ).length,
    12,
  );
});

test("summary reports tracked, due, strong and average strength", () => {
  const summary = summarizeMemory(
    {
      a: memory(MAX_BOX, 10),
      b: memory(0, -1),
    },
    NOW,
  );

  assert.equal(summary.tracked, 2);
  assert.equal(summary.due, 1);
  assert.equal(summary.strong, 1);
  assert.equal(summary.averageStrength, 50);
  assert.deepEqual(summarizeMemory({}, NOW), {
    tracked: 0,
    due: 0,
    strong: 0,
    averageStrength: 0,
  });
});

test("mastery needs a long interval survived, not one lucky answer", () => {
  assert.equal(isMastered(memory(MASTERY_BOX, 1)), true);
  assert.equal(isMastered(memory(MASTERY_BOX - 1, 1)), false);
  assert.equal(countDue({ a: memory(1, -1), b: memory(1, 1) }, NOW), 1);
});
