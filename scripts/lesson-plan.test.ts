/**
 * The cumulative curriculum plan: what a lesson introduces, and what it brings
 * back.
 *
 * These assertions are the reason the plan layer is pure and learner-free —
 * the whole introduction schedule for 131 units can be checked here rather than
 * by playing lessons.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getLessonsForCurriculum } from "@/lib/content";
import {
  MAX_NEW_ITEMS_PER_LESSON,
  createReviewQueues,
  planUnit,
  sharesStem,
  toLessonKind,
  type PlanUnit,
} from "@/lib/curriculum-plan";
import {
  classifyPhrase,
  emptyLearnerSnapshot,
  selectReviewItems,
  type LearnerSnapshot,
} from "@/lib/learner-model";
import { MASTERY_BOX } from "@/lib/review-policy";
import type { Lesson } from "@/types/learning";

const spanish = getLessonsForCurriculum("spanish");
const firstUnits = spanish.filter((lesson) => lesson.unitId.startsWith("es-en-s01-u0"));

function planned(lesson: Lesson) {
  assert.ok(lesson.plan, `${lesson.id} has no plan`);
  return lesson.plan!;
}

test("every Spanish lesson carries a cumulative plan; other courses do not", () => {
  for (const lesson of spanish.slice(0, 60)) {
    assert.ok(lesson.plan, `${lesson.id} should be planned`);
  }

  for (const courseId of ["bengali", "malayalam", "spanish-peru"] as const) {
    for (const lesson of getLessonsForCurriculum(courseId)) {
      assert.equal(
        lesson.plan,
        undefined,
        `${courseId}/${lesson.id} must stay on the phrase-book path`,
      );
    }
  }
});

test("no lesson introduces more new material than the cap", () => {
  for (const lesson of spanish) {
    const plan = planned(lesson);
    assert.ok(
      plan.newPhraseIds.length <= MAX_NEW_ITEMS_PER_LESSON,
      `${lesson.id} introduces ${plan.newPhraseIds.length} new items`,
    );
  }
});

test("a unit introduces all of its material exactly once", () => {
  const unitLessons = new Map<string, Lesson[]>();

  for (const lesson of firstUnits) {
    unitLessons.set(lesson.unitId, [...(unitLessons.get(lesson.unitId) ?? []), lesson]);
  }

  for (const [unitId, lessons] of unitLessons) {
    const introduced = lessons.flatMap((lesson) => planned(lesson).newPhraseIds);
    assert.equal(
      new Set(introduced).size,
      introduced.length,
      `${unitId} introduces an item twice`,
    );
    // Items belong to their own unit; the plan must not "introduce" borrowed ones.
    for (const id of introduced) {
      assert.ok(id.startsWith(unitId), `${unitId} introduces foreign item ${id}`);
    }
  }
});

test("unit review introduces nothing new", () => {
  for (const lesson of spanish) {
    const plan = planned(lesson);

    if (plan.kind !== "review") {
      continue;
    }

    assert.equal(
      plan.newPhraseIds.length,
      0,
      `${lesson.id} is a unit review but introduces new items`,
    );
    assert.ok(plan.reviewPhraseIds.length > 0, `${lesson.id} has nothing to review`);
  }
});

test("every lesson after the very first brings back prior material", () => {
  for (const lesson of spanish.slice(1, 200)) {
    const plan = planned(lesson);
    assert.ok(
      plan.reviewPhraseIds.length > 0,
      `${lesson.id} has no prior material to retrieve`,
    );
  }
});

test("consecutive lessons overlap — a lesson builds on the one before it", () => {
  for (let index = 1; index < firstUnits.length; index += 1) {
    const previous = new Set(firstUnits[index - 1].phrases.map((phrase) => phrase.id));
    const current = firstUnits[index].phrases.map((phrase) => phrase.id);
    const shared = current.filter((id) => previous.has(id)).length;

    assert.ok(
      shared > 0,
      `${firstUnits[index].id} shares nothing with ${firstUnits[index - 1].id}`,
    );
  }
});

test("units past the first interleave material from earlier units", () => {
  const laterUnits = spanish.filter(
    (lesson) => lesson.unitNumber >= 2 && lesson.unitNumber <= 12,
  );
  const withInterleaving = laterUnits.filter(
    (lesson) => (planned(lesson).interleavedPhraseIds ?? []).length > 0,
  );

  assert.ok(
    withInterleaving.length > laterUnits.length * 0.8,
    `only ${withInterleaving.length}/${laterUnits.length} lessons revisit older units`,
  );

  // And the material really does come from somewhere else.
  for (const lesson of withInterleaving.slice(0, 40)) {
    for (const id of planned(lesson).interleavedPhraseIds ?? []) {
      assert.ok(
        !id.startsWith(lesson.unitId),
        `${lesson.id} counts its own item ${id} as interleaved`,
      );
    }
  }
});

test("Section 1 material reappears outside the unit that taught it", () => {
  const introduced = new Map<string, string>();
  const seenIn = new Map<string, Set<string>>();

  for (const lesson of firstUnits) {
    for (const id of planned(lesson).newPhraseIds) {
      introduced.set(id, lesson.unitId);
    }
  }

  for (const lesson of spanish) {
    for (const phrase of lesson.phrases) {
      const units = seenIn.get(phrase.id) ?? new Set<string>();
      units.add(lesson.unitId);
      seenIn.set(phrase.id, units);
    }
  }

  for (const [id, unitId] of introduced) {
    const units = seenIn.get(id) ?? new Set<string>();
    assert.ok(
      units.size > 1,
      `"${id}" is taught in ${unitId} and never seen again (${[...units].join(", ")})`,
    );
  }
});

test("planning is deterministic for the same input", () => {
  const unit: PlanUnit = {
    id: "u2",
    number: 2,
    items: Array.from({ length: 12 }, (_, index) => ({
      id: `u2-v${index}`,
      text: `palabra${index}`,
      kind: "vocabulary" as const,
    })),
  };
  const prior: PlanUnit = {
    id: "u1",
    number: 1,
    items: Array.from({ length: 10 }, (_, index) => ({
      id: `u1-v${index}`,
      text: `antigua${index}`,
      kind: "vocabulary" as const,
    })),
  };

  const first = planUnit(unit, [prior], { sharedQueues: createReviewQueues() });
  const second = planUnit(unit, [prior], { sharedQueues: createReviewQueues() });

  assert.deepEqual(first, second);
});

test("lesson names map to the kinds the profiles are written for", () => {
  assert.equal(toLessonKind("Discover", 1), "discover");
  assert.equal(toLessonKind("Grammar focus", 3), "grammar");
  assert.equal(toLessonKind("Listen and speak", 4), "listen");
  assert.equal(toLessonKind("Use in context", 5), "context");
  assert.equal(toLessonKind("Unit review", 6), "review");
  // An unrecognised name still lands somewhere sensible.
  assert.equal(toLessonKind("Something new", 2), "build");
});

test("conjugated forms count as knowing the infinitive", () => {
  assert.ok(sharesStem("tengo", "tener"));
  assert.ok(sharesStem("vivo", "vivir"));
  assert.ok(sharesStem("quiero", "querer"), "stem-changing verbs too");
  assert.ok(sharesStem("puedo", "poder"));
  assert.ok(!sharesStem("casa", "caro"));
});

// ---------------------------------------------------------------------------
// The learner model's side of the bargain
// ---------------------------------------------------------------------------

function snapshotWith(memory: LearnerSnapshot["memory"], mistakes: string[] = []): LearnerSnapshot {
  return {
    ...emptyLearnerSnapshot(Date.parse("2026-01-10T00:00:00Z")),
    memory,
    recentMistakePhraseIds: mistakes,
  };
}

test("items are classified from the spaced-repetition policy, not a second model", () => {
  const now = Date.parse("2026-01-10T00:00:00Z");
  const snapshot = snapshotWith({
    fresh: { box: 3, dueAt: "2026-02-01T00:00:00Z", lastSeenAt: "2026-01-09T00:00:00Z" },
    overdue: { box: 3, dueAt: "2026-01-01T00:00:00Z", lastSeenAt: "2025-12-20T00:00:00Z" },
    shaky: { box: 1, dueAt: "2026-02-01T00:00:00Z", lastSeenAt: "2026-01-09T00:00:00Z" },
    solid: {
      box: MASTERY_BOX,
      dueAt: "2026-03-01T00:00:00Z",
      lastSeenAt: "2026-01-09T00:00:00Z",
    },
  });
  snapshot.now = now;

  assert.equal(classifyPhrase("unmet", snapshot), "new");
  assert.equal(classifyPhrase("fresh", snapshot), "recent");
  assert.equal(classifyPhrase("overdue", snapshot), "due");
  assert.equal(classifyPhrase("shaky", snapshot), "weak");
  assert.equal(classifyPhrase("solid", snapshot), "strong");
});

test("a recent mistake makes an item weak however strong its box", () => {
  const snapshot = snapshotWith(
    {
      missed: {
        box: MASTERY_BOX,
        dueAt: "2026-03-01T00:00:00Z",
        lastSeenAt: "2026-01-09T00:00:00Z",
      },
    },
    ["missed"],
  );

  assert.equal(classifyPhrase("missed", snapshot), "weak");
});

test("weak and due items are chosen before strong ones", () => {
  const snapshot = snapshotWith({
    strongA: { box: 5, dueAt: "2026-03-01T00:00:00Z", lastSeenAt: "2026-01-09T00:00:00Z" },
    strongB: { box: 5, dueAt: "2026-03-01T00:00:00Z", lastSeenAt: "2026-01-09T00:00:00Z" },
    strongC: { box: 5, dueAt: "2026-03-01T00:00:00Z", lastSeenAt: "2026-01-09T00:00:00Z" },
    weak: { box: 0, dueAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-02T00:00:00Z" },
    due: { box: 3, dueAt: "2026-01-01T00:00:00Z", lastSeenAt: "2025-12-20T00:00:00Z" },
  });

  const chosen = selectReviewItems(
    ["strongA", "strongB", "strongC", "weak", "due"],
    snapshot,
    3,
  );

  assert.equal(chosen[0], "weak");
  assert.ok(chosen.includes("due"));
});

test("mastered material does not take over a session", () => {
  const memory: LearnerSnapshot["memory"] = {};
  const ids: string[] = [];

  for (let index = 0; index < 10; index += 1) {
    const id = `strong-${index}`;
    ids.push(id);
    memory[id] = {
      box: 5,
      dueAt: "2026-03-01T00:00:00Z",
      lastSeenAt: "2026-01-09T00:00:00Z",
    };
  }

  memory.weak = { box: 0, dueAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-02T00:00:00Z" };
  const snapshot = snapshotWith(memory);
  const chosen = selectReviewItems([...ids, "weak"], snapshot, 6);

  const strongCount = chosen.filter((id) => id.startsWith("strong-")).length;
  assert.ok(chosen.includes("weak"));
  // The cap only relaxes when there is nothing else to offer; here there is.
  assert.ok(strongCount <= 5, `${strongCount} of 6 questions were already mastered`);
});

test("a learner we know nothing about still gets the curriculum's order", () => {
  const snapshot = emptyLearnerSnapshot();
  const chosen = selectReviewItems(["a", "b", "c", "d"], snapshot, 3);

  assert.deepEqual(chosen, ["a", "b", "c"]);
});
