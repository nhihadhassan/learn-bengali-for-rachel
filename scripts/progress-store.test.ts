/**
 * Progress persistence: backward compatibility of saved data, and the
 * learner-local streak calendar.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { applyPracticeDay, normalizeStore } from "@/lib/progress-store";
import { COURSE_IDS } from "@/lib/courses";
import {
  localDayKey,
  previousDayKey,
  relateDayKey,
  shiftedDayKey,
} from "@/lib/date-keys";
import type { ProgressState } from "@/types/learning";

function baseProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    completedLessons: [],
    encounteredPhraseIds: [],
    xp: 0,
    gems: 0,
    streak: 0,
    streakRestoreAvailable: false,
    lastStreakBeforeMiss: 0,
    currentUnit: 1,
    lastPracticeDate: null,
    lastLessonId: null,
    lastStepIndex: 0,
    lastActiveAt: null,
    mistakes: [],
    skippedListening: [],
    phraseMemory: {},
    conceptMemory: {},
    practiceDays: [],
    answeredTotal: 0,
    answeredCorrect: 0,
    ...overrides,
  };
}

test("every registered course gets a progress bucket", () => {
  const store = normalizeStore(null);

  for (const courseId of COURSE_IDS) {
    assert.ok(store.byCurriculum[courseId], `missing bucket for ${courseId}`);
    assert.equal(store.byCurriculum[courseId].xp, 0);
  }
});

test("pre-multi-course saves (a bare ProgressState) become the Bengali bucket", () => {
  const legacy = {
    completedLessons: ["u01-l01-greetings"],
    xp: 240,
    streak: 5,
    currentUnit: 2,
    lastPracticeDate: "2026-08-19",
  };

  const store = normalizeStore(legacy);

  assert.equal(store.activeCurriculumId, "bengali");
  assert.deepEqual(store.byCurriculum.bengali.completedLessons, [
    "u01-l01-greetings",
  ]);
  assert.equal(store.byCurriculum.bengali.xp, 240);
  assert.equal(store.byCurriculum.bengali.streak, 5);
  // Fields added after that save still get safe defaults.
  assert.deepEqual(store.byCurriculum.bengali.phraseMemory, {});
  assert.deepEqual(store.byCurriculum.bengali.mistakes, []);
  assert.equal(store.byCurriculum.spanish.xp, 0);
});

test("saved per-course progress round-trips, including newer fields", () => {
  const saved = {
    activeCurriculumId: "spanish",
    byCurriculum: {
      spanish: baseProgress({
        xp: 90,
        gems: 50,
        completedLessons: ["es-en-p01-u01-l1"],
        phraseMemory: {
          "es-en-s01-u001-v1": {
            box: 3,
            dueAt: "2026-09-01T00:00:00.000Z",
            lastSeenAt: "2026-08-19T00:00:00.000Z",
          },
        },
      }),
    },
  };

  const store = normalizeStore(saved);

  assert.equal(store.activeCurriculumId, "spanish");
  assert.equal(store.byCurriculum.spanish.xp, 90);
  assert.equal(
    store.byCurriculum.spanish.phraseMemory["es-en-s01-u001-v1"].box,
    3,
  );
});

test("unknown course ids in saved data are preserved, not dropped", () => {
  const store = normalizeStore({
    activeCurriculumId: "not-a-course",
    byCurriculum: {
      bengali: baseProgress({ xp: 10 }),
      "retired-course": baseProgress({ xp: 999 }),
    },
  });

  // An unrecognised active id falls back to the default course...
  assert.equal(store.activeCurriculumId, "bengali");
  // ...but its data is not thrown away.
  assert.equal(
    (store.byCurriculum as Record<string, ProgressState>)["retired-course"].xp,
    999,
  );
});

test("corrupt saved values do not crash normalization", () => {
  for (const value of [undefined, "nonsense", 42, []]) {
    const store = normalizeStore(value);
    assert.equal(store.byCurriculum.bengali.xp, 0);
  }
});

test("day keys follow the learner's local calendar, not UTC", () => {
  // 19:30 on 2026-08-20 local time. Under the old toISOString() logic a
  // negative UTC offset would file this under 2026-08-21.
  const evening = new Date(2026, 7, 20, 19, 30, 0);

  assert.equal(localDayKey(evening), "2026-08-20");
  assert.equal(previousDayKey(evening), "2026-08-19");
  assert.equal(shiftedDayKey(-1, evening), "2026-08-19");
});

test("day keys handle month and year boundaries", () => {
  assert.equal(shiftedDayKey(-1, new Date(2027, 0, 1, 9, 0)), "2026-12-31");
  assert.equal(shiftedDayKey(-1, new Date(2026, 2, 1, 9, 0)), "2026-02-28");
  assert.equal(localDayKey(new Date(2026, 8, 5)), "2026-09-05");
});

test("practicing on consecutive local days grows the streak", () => {
  const today = applyPracticeDay(
    baseProgress({ streak: 3, lastPracticeDate: "2026-08-19" }),
    "2026-08-20",
  );

  assert.equal(today.streak, 4);
  assert.equal(today.lastPracticeDate, "2026-08-20");
});

test("practicing twice in one local day does not double-count", () => {
  const progress = baseProgress({ streak: 4, lastPracticeDate: "2026-08-20" });
  const again = applyPracticeDay(progress, "2026-08-20");

  assert.equal(again, progress, "same-day practice must be a no-op");
});

test("missing a day resets the streak and offers a restore", () => {
  const missed = applyPracticeDay(
    baseProgress({ streak: 9, lastPracticeDate: "2026-08-17" }),
    "2026-08-20",
  );

  assert.equal(missed.streak, 1);
  assert.equal(missed.streakRestoreAvailable, true);
  assert.equal(missed.lastStreakBeforeMiss, 9);
});

test("a UTC-era key one day ahead does not wipe the streak", () => {
  // Legacy data: an evening session in a negative-offset timezone was stored
  // under tomorrow's UTC date. Treat it as already-practiced-today.
  const progress = baseProgress({ streak: 12, lastPracticeDate: "2026-08-21" });

  assert.equal(relateDayKey("2026-08-21", "2026-08-20"), "future");
  assert.equal(applyPracticeDay(progress, "2026-08-20").streak, 12);
});

test("the first ever practice day starts the streak at 1", () => {
  const first = applyPracticeDay(baseProgress(), "2026-08-20");

  assert.equal(first.streak, 1);
  assert.equal(first.streakRestoreAvailable, false);
});

test("practice days accumulate without duplicates", () => {
  const day1 = applyPracticeDay(baseProgress(), "2026-08-18");
  const day2 = applyPracticeDay(day1, "2026-08-19");
  const sameDay = applyPracticeDay(day2, "2026-08-19");

  assert.deepEqual(day2.practiceDays, ["2026-08-18", "2026-08-19"]);
  assert.equal(sameDay, day2, "a repeat day must not be appended");
});

test("progress saved before activity tracking existed still loads", () => {
  // These fields were added later; older saves simply do not have them.
  const store = normalizeStore({
    activeCurriculumId: "bengali",
    byCurriculum: { bengali: { xp: 50, streak: 2, completedLessons: ["a"] } },
  });

  assert.deepEqual(store.byCurriculum.bengali.practiceDays, []);
  assert.equal(store.byCurriculum.bengali.answeredTotal, 0);
  assert.equal(store.byCurriculum.bengali.answeredCorrect, 0);
  assert.equal(store.byCurriculum.bengali.xp, 50);
});

test("mistakes saved before they recorded a phrase still load", () => {
  // Written by a build that predates `Mistake.phraseId`. It has to survive
  // intact — mistake recycling treats a mistake with no phrase as simply
  // unattributable, never as a reason to drop the record.
  const store = normalizeStore({
    activeCurriculumId: "spanish",
    byCurriculum: {
      spanish: {
        completedLessons: ["es-en-p01-u01-l1"],
        mistakes: [
          {
            id: "old-1",
            exerciseId: "es-en-p01-u01-l1-recognize-x",
            lessonId: "es-en-p01-u01-l1",
            prompt: "What does this mean?",
            correctAnswer: "coffee",
            wrongAnswer: "tea",
            resolved: false,
            createdAt: "2026-01-02T10:00:00.000Z",
          },
        ],
      },
    },
  });

  const mistakes = store.byCurriculum.spanish.mistakes;

  assert.equal(mistakes.length, 1);
  assert.equal(mistakes[0].id, "old-1");
  assert.equal(mistakes[0].phraseId, undefined);
  assert.equal(store.byCurriculum.spanish.completedLessons.length, 1);
});

test("a mistake that records its phrase round-trips", () => {
  const store = normalizeStore({
    activeCurriculumId: "spanish",
    byCurriculum: {
      spanish: baseProgress({
        mistakes: [
          {
            id: "new-1",
            exerciseId: "step-1",
            lessonId: "es-en-s01-u001-l2",
            phraseId: "es-en-s01-u001-v03",
            prompt: "Which one means coffee?",
            correctAnswer: "el café",
            wrongAnswer: "el té",
            resolved: false,
            createdAt: "2026-02-02T10:00:00.000Z",
          },
        ],
      }),
    },
  });

  assert.equal(store.byCurriculum.spanish.mistakes[0].phraseId, "es-en-s01-u001-v03");
});
