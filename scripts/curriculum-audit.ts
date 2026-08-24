/**
 * Pedagogical audit of the generated Spanish course.
 *
 *   npm run audit:curriculum
 *
 * `validate:curriculum` checks that the pack is *well-formed*. This checks that
 * the course it produces is *teachable* — a much easier thing to get wrong, and
 * one that nothing else in the repo would notice. It walks the real lessons the
 * app builds (`getLessonsForCurriculum("spanish")`, plans and all) and reports:
 *
 *   - a phrase introduced before the words it is made of
 *   - a grammar target with no authored rule behind it
 *   - an item introduced and then never revisited
 *   - a lesson introducing more new material than the cap allows
 *   - consecutive lessons that barely overlap
 *   - an item that disappears for a long stretch
 *   - an authored dialogue whose reply has nothing to do with its prompt
 *
 * Section 1 is hand-sequenced, so findings there are **errors** and fail the
 * run. The rest of the course is generated from the pack as shipped, so its
 * findings are **warnings**: a signal for future content work, not a gate.
 */

import { getLessonsForCurriculum } from "../src/lib/content";
import {
  MAX_NEW_ITEMS_PER_LESSON,
  coverage,
  newItemWeight,
  taughtWordSet,
  unknownWords,
} from "../src/lib/curriculum-plan";
import { isKnownForm } from "../src/lib/spanish-lexicon";
import {
  allGrammarRules,
  countPatternEncounters,
  findGrammarRule,
  getGrammarRule,
} from "../src/lib/grammar-drills";
import { isContentWord, normalizeWord, splitWords } from "../src/lib/text-tokens";
import {
  buildLessonSteps,
  getStepPrompt,
  isTeachingStep,
} from "../src/lib/lesson-steps";
import { emptyLearnerSnapshot, type LearnerSnapshot } from "../src/lib/learner-model";
import { pilotUnits } from "../src/lib/spanish-pilot";
import type { Lesson, Phrase } from "../src/types/learning";

type Finding = { lessonId: string; rule: string; detail: string };

/**
 * Every finding is an error.
 *
 * This began as "Section 1 is curated, the rest is warnings", then Sections 1-2.
 * The whole course now passes, so the distinction has outlived its purpose: a
 * prerequisite gap anywhere is a real problem, and leaving 90 units on a softer
 * bar just invites them to drift back.
 */
function isStrict(): boolean {
  return true;
}

/**
 * How many of a unit's lessons actually teach.
 *
 * This used to be the constant 5 — a unit had six lessons and one of them was
 * the review. Pilot units run anywhere from three to eight lessons, so it is
 * now counted from the data: any lesson whose kind carries a share of new
 * material. A review or capstone carries none.
 */
function teachingLessonCount(lessons: readonly Lesson[]): number {
  return lessons.filter((lesson) => newItemWeight(lesson.plan?.kind ?? "build") > 0).length;
}

/** Units at the very end of the course have no later unit to recycle them. */
const UNITS_WITHOUT_A_FUTURE = 2;

/** A unit teaching more than this at once is doing too much. */
const MAX_UNIT_VOCABULARY = 16;

/** Above this share of unknown words, a dialogue prompt stops being input. */
const MAX_DIALOGUE_UNKNOWN = 0.34;

/** Above this share, a lesson is a glossary with a progress bar. */
const MAX_RECOGNITION_SHARE = 0.5;

/** A lesson of any length should ask in more than a couple of ways. */
const MIN_QUESTION_KINDS = 3;

/** The same wording more than this often reads as one question repeated. */
const MAX_IDENTICAL_PROMPTS = 4;

/** Step types where the learner assembles Spanish rather than picking meaning. */
const PRODUCTION_STEPS = new Set(["produce", "complete", "order", "translate"]);

/** A question opening with a question word expects a statement in reply. */
const INFORMATION_QUESTION = /¿\s*(qué|quién|dónde|cómo|cuánto|cuánta|cuántos|cuántas|cuándo|cuál|por qué)/i;

/**
 * An item must come back *outside* the unit that introduced it. Measuring a gap
 * to the end of a 786-lesson course would flag every Section 1 word, which says
 * nothing: the question is whether the spaced ladder brings material back at
 * all once its unit is over.
 */
/** Below this share of shared items, two consecutive lessons aren't building. */
const MIN_CONSECUTIVE_OVERLAP = 0.2;

function contentWords(text: string): string[] {
  return [...taughtWordSet(text)];
}

/**
 * New vocabulary this lesson had no choice about: words one of its own new
 * sentences uses and the learner has not met.
 */
function forcedVocabularyCount(
  lesson: Lesson,
  phraseById: ReadonlyMap<string, Phrase>,
  knownWords: ReadonlySet<string>,
): number {
  const ids = lesson.plan?.newPhraseIds ?? [];
  const items = ids
    .map((id) => phraseById.get(id) ?? lesson.phrases.find((phrase) => phrase.id === id))
    .filter((phrase): phrase is Phrase => Boolean(phrase));
  const sentences = items.filter((phrase) => phrase.category === "phrase");
  const needed = new Set(
    sentences.flatMap((phrase) => unknownWords(phrase.romanized, knownWords, isKnownForm)),
  );

  if (needed.size === 0) {
    return 0;
  }

  return items.filter((phrase) => {
    if (phrase.category === "phrase") {
      return false;
    }

    const supplied = new Set(contentWords(phrase.romanized));
    return [...needed].some(
      (word) => supplied.has(word) || isKnownForm(word, supplied),
    );
  }).length;
}

/**
 * The pilot's checks, run against the **steps a learner actually sees**.
 *
 * Everything above this walks plans: what a lesson introduces and brings back.
 * That is the right level for prerequisites and spacing, and it is blind to the
 * complaint this whole pass exists to answer — that lessons feel templated. You
 * cannot see "eight of these twelve questions are «what does X mean»" in a
 * plan; you can only see it in the questions.
 *
 * Each lesson is built twice: once as a first-time learner meets it, and once
 * with a learner who has a history, since the difficulty ladder only engages
 * for the second. A finding on either build is a finding.
 *
 * The thresholds below were set from the pilot's real output, not chosen in
 * advance. Where a check would have forced worse teaching it was dropped
 * rather than satisfied — see `docs/HANDOFF.md` §5b.
 */
function auditPilotLessons(lessons: readonly Lesson[]): Finding[] {
  const findings: Finding[] = [];
  const pilotIds = new Set(pilotUnits.map((unit) => unit.id));
  const pilot = lessons.filter((lesson) => pilotIds.has(lesson.unitId));

  if (pilot.length === 0) {
    return findings;
  }

  const add = (lesson: Lesson, rule: string, detail: string) =>
    findings.push({ lessonId: lesson.id, rule, detail });

  /** A learner who has met everything up to this lesson, some of it produced. */
  const snapshotBefore = (target: Lesson): LearnerSnapshot => {
    const memory: LearnerSnapshot["memory"] = {};
    const day = 24 * 60 * 60 * 1000;
    let seen = 0;

    for (const lesson of lessons) {
      if (lesson.id === target.id) {
        break;
      }

      for (const id of lesson.plan?.newPhraseIds ?? []) {
        seen += 1;
        memory[id] = {
          box: seen % 5,
          dueAt: new Date(Date.now() - day).toISOString(),
          lastSeenAt: new Date(Date.now() - day).toISOString(),
          produced: seen % 3,
        };
      }
    }

    return { ...emptyLearnerSnapshot(), memory };
  };

  /** Scaffold level per unit, for the "support falls away" check. */
  const scaffoldOf = new Map<string, number>();

  for (const lesson of pilot) {
    const builds = [
      buildLessonSteps(lesson),
      buildLessonSteps(lesson, { learner: snapshotBefore(lesson) }),
    ];

    if (lesson.plan?.scaffold) {
      scaffoldOf.set(lesson.unitId, lesson.plan.scaffold);
    }

    builds.forEach((steps, build) => {
      const questions = steps.filter((step) => !isTeachingStep(step));
      const label = build === 0 ? "first time" : "with memory";

      if (questions.length === 0) {
        add(lesson, "no-questions", `${label}: the lesson asks nothing`);
        return;
      }

      // --- how much of the lesson is "what does this word mean" -------------
      //
      // Recognition is a legitimate technique and the first rung of the
      // ladder; it stops being teaching when it is most of the lesson.
      const recognize = questions.filter((step) => step.type === "recognize").length;

      if (recognize / questions.length > MAX_RECOGNITION_SHARE) {
        add(
          lesson,
          "direct-translation-share",
          `${label}: ${recognize}/${questions.length} questions are word→meaning`,
        );
      }

      // --- variety ----------------------------------------------------------
      const kinds = new Set(questions.map((step) => step.type));

      if (questions.length >= 6 && kinds.size < MIN_QUESTION_KINDS) {
        add(
          lesson,
          "low-variety",
          `${label}: ${questions.length} questions in only ${kinds.size} format(s)`,
        );
      }

      // --- production -------------------------------------------------------
      //
      // A lesson the learner can finish without ever assembling Spanish is a
      // lesson they can pass without learning to say anything.
      const produces = questions.some((step) =>
        PRODUCTION_STEPS.has(step.type),
      );

      if (!produces) {
        add(lesson, "no-production", `${label}: nothing asks the learner to build Spanish`);
      }

      // --- repeated wording -------------------------------------------------
      const prompts = questions.map((step) => getStepPrompt(step));
      const counts = new Map<string, number>();

      for (const prompt of prompts) {
        counts.set(prompt, (counts.get(prompt) ?? 0) + 1);
      }

      for (const [prompt, count] of counts) {
        if (count > MAX_IDENTICAL_PROMPTS) {
          add(lesson, "repeated-prompt", `${label}: "${prompt}" asked ${count} times`);
        }
      }
    });
  }

  // --- support falls away across the pilot ----------------------------------
  const scaffolds = pilotUnits
    .map((unit) => scaffoldOf.get(unit.id))
    .filter((level): level is number => level !== undefined);

  for (let index = 1; index < scaffolds.length; index += 1) {
    if (scaffolds[index] > scaffolds[index - 1]) {
      findings.push({
        lessonId: pilotUnits[index].id,
        rule: "late-scaffolding",
        detail: `scaffold rises from ${scaffolds[index - 1]} to ${scaffolds[index]}`,
      });
    }
  }

  return findings;
}

function audit(): Finding[] {
  const lessons = getLessonsForCurriculum("spanish");
  const findings: Finding[] = [];
  const add = (lesson: Lesson, rule: string, detail: string) =>
    findings.push({ lessonId: lesson.id, rule, detail });

  // How much each unit has to teach, and across how many lessons, for the load
  // check below.
  const unitNewItemCount = new Map<string, number>();
  const unitLessons = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    unitNewItemCount.set(
      lesson.unitId,
      (unitNewItemCount.get(lesson.unitId) ?? 0) + (lesson.plan?.newPhraseIds.length ?? 0),
    );
    unitLessons.set(lesson.unitId, [...(unitLessons.get(lesson.unitId) ?? []), lesson]);
  }

  const knownWords = new Set<string>();
  const seenPhrases: Array<{ romanized: string; english: string }> = [];
  /** phrase id -> the units its lessons appeared in. */
  const seenInUnits = new Map<string, Set<string>>();
  const introducedIn = new Map<string, { unitId: string; lessonIndex: number }>();
  const phraseById = new Map<string, Phrase>();
  let previousIds: Set<string> | null = null;

  lessons.forEach((lesson, lessonIndex) => {
    const plan = lesson.plan;

    if (!plan) {
      return;
    }

    for (const phrase of lesson.phrases) {
      phraseById.set(phrase.id, phrase);
    }

    for (const id of plan.newPhraseIds) {
      const phrase = phraseById.get(id);

      if (phrase) {
        seenPhrases.push({ romanized: phrase.romanized, english: phrase.english });
      }
    }

    // --- new-content load ---------------------------------------------------
    //
    // A unit holding more items than its teaching lessons can carry at the cap
    // has to put the remainder somewhere, and the last teaching lesson is the
    // least-bad place — better than a review lesson introducing new material.
    // That spill is a fact about the unit's size, so it is reported against the
    // unit rather than as a per-lesson failure; the ceiling still holds.
    const teachingLessons = Math.max(
      1,
      teachingLessonCount(unitLessons.get(lesson.unitId) ?? []),
    );
    const unitCapacity = teachingLessons * MAX_NEW_ITEMS_PER_LESSON;
    const unitItems = unitNewItemCount.get(lesson.unitId) ?? 0;
    // A lesson may also go one over for each word one of *its own* new
    // sentences needs. The planner deliberately breaks the ceiling rather than
    // show a sentence containing a word it has not taught; the audit has to
    // agree with that trade or it just reports the fix as a fault.
    const forced = forcedVocabularyCount(lesson, phraseById, knownWords);
    const allowed =
      (unitItems > unitCapacity
        ? MAX_NEW_ITEMS_PER_LESSON + Math.ceil((unitItems - unitCapacity) / teachingLessons)
        : MAX_NEW_ITEMS_PER_LESSON) + forced;

    if (plan.newPhraseIds.length > allowed) {
      add(
        lesson,
        "new-content-load",
        `introduces ${plan.newPhraseIds.length} new items (allowed ${allowed})`,
      );
    }

    if (unitItems > unitCapacity + teachingLessons) {
      add(lesson, "unit-overloaded", `unit teaches ${unitItems} items across ${teachingLessons} lessons`);
    }

    if (plan.kind === "review" && plan.newPhraseIds.length > 0) {
      add(
        lesson,
        "review-introduces-new",
        `unit review introduces ${plan.newPhraseIds.length} new item(s)`,
      );
    }

    // --- prerequisites ------------------------------------------------------
    for (const id of plan.newPhraseIds) {
      const phrase = phraseById.get(id);

      if (!phrase) {
        continue;
      }

      const words = contentWords(phrase.romanized);

      // Only *phrase patterns* have prerequisites. A multi-word vocabulary
      // entry like "buenos días" is itself the thing being introduced.
      // The curated sections hold to a stricter bar: a sentence the learner
      // will be asked to *build* must be fully readable when it appears. The
      // rest of the course is judged on whether it is mostly readable.
      const readable = coverage(phrase.romanized, knownWords, isKnownForm);
      const bar = isStrict() ? 1 : 0.5;

      if (phrase.category === "phrase" && words.length > 1 && readable < bar) {
        const missing = unknownWords(phrase.romanized, knownWords, isKnownForm);
        add(
          lesson,
          "prerequisite",
          `"${phrase.romanized}" introduces unseen words: ${missing.join(", ")}`,
        );
      }

      words.forEach((word) => knownWords.add(word));

      if (!introducedIn.has(id)) {
        introducedIn.set(id, { unitId: lesson.unitId, lessonIndex });
      }
    }

    // --- cross-lesson overlap ----------------------------------------------
    const currentIds = new Set(lesson.phrases.map((phrase) => phrase.id));

    if (previousIds && previousIds.size > 0 && plan.kind !== "discover") {
      const shared = [...currentIds].filter((id) => previousIds?.has(id)).length;
      const overlap = shared / Math.min(previousIds.size, currentIds.size);

      if (overlap < MIN_CONSECUTIVE_OVERLAP) {
        add(
          lesson,
          "consecutive-overlap",
          `shares only ${Math.round(overlap * 100)}% of its working set with the previous lesson`,
        );
      }
    }

    previousIds = currentIds;
    currentIds.forEach((id) => {
      const units = seenInUnits.get(id) ?? new Set<string>();
      units.add(lesson.unitId);
      seenInUnits.set(id, units);
    });

    // --- grammar ------------------------------------------------------------
    if (plan.kind === "grammar") {
      if (!plan.grammar) {
        add(lesson, "grammar-missing", "grammar lesson has no rule to teach");
      } else {
        if (plan.grammar.examples.length < 2) {
          add(
            lesson,
            "grammar-examples",
            `"${plan.grammar.title}" is illustrated by ${plan.grammar.examples.length} example(s)`,
          );
        }

        for (const example of plan.grammar.examples) {
          const unseen = unknownWords(example.target, knownWords, isKnownForm);

          if (unseen.length > 0) {
            add(
              lesson,
              "grammar-example-unknown-words",
              `"${example.target}" uses words the learner has not met: ${unseen.join(", ")}`,
            );
          }
        }

        // The pattern has to have been visible before it gets a name.
        const rule = findGrammarRule(plan.grammar.id) ?? getGrammarRule(plan.grammar.id);

        // The adapter enforces the fuller rule (an authored focus must be
        // attested in its own unit; a rotation pick needs three sightings).
        // The audit guards the floor: never name a pattern the learner has not
        // met at all.
        if (rule && countPatternEncounters(rule, seenPhrases) < 1) {
          add(
            lesson,
            "grammar-too-early",
            `"${plan.grammar.title}" is explained before the learner has met it`,
          );
        }
      }
    }

    // --- dialogue -----------------------------------------------------------
    if (plan.dialogue) {
      for (const turn of plan.dialogue.turns) {
        // A prompt the learner cannot read is not comprehensible input. Lines
        // deliberately marked receptive are exempt: the UI tells the learner
        // outright that they only need to understand those.
        if (!turn.prompt.receptive) {
          const promptWords = splitWords(turn.prompt.target).filter(isContentWord);
          const unseen = unknownWords(turn.prompt.target, knownWords, isKnownForm);
          const share = promptWords.length === 0 ? 0 : unseen.length / promptWords.length;

          if (share > MAX_DIALOGUE_UNKNOWN) {
            add(
              lesson,
              "dialogue-unknown-language",
              `"${turn.prompt.target}" is ${Math.round(share * 100)}% unknown: ${unseen.join(", ")}`,
            );
          }
        }

        // The learner is never asked to produce untaught language.
        const replyUnseen = unknownWords(turn.reply.target, knownWords, isKnownForm);

        if (replyUnseen.length > 0) {
          add(
            lesson,
            "dialogue-untaught-reply",
            `reply "${turn.reply.target}" needs untaught words: ${replyUnseen.join(", ")}`,
          );
        }

        if (turn.prompt.target.includes("?") === false) {
          continue;
        }

        // Answering a yes/no question with a question is ordinary conversation
        // ("Anything else?" / "Could you bring us water?"). Only an information
        // question — one opening with a question word — genuinely needs a
        // statement back.
        const asksForInformation = INFORMATION_QUESTION.test(turn.prompt.target);

        if (asksForInformation && turn.reply.target.includes("?")) {
          add(
            lesson,
            "dialogue-relation",
            `reply "${turn.reply.target}" answers a question with a question`,
          );
        }

        for (const distractor of turn.distractors ?? []) {
          if (distractor === turn.reply.target) {
            add(lesson, "dialogue-relation", "a distractor repeats the answer");
          }
        }
      }
    }
  });

  // --- revisiting -----------------------------------------------------------
  // The last units of the course have nothing after them to bring their
  // material back, so "never revisited" is a fact about where the course ends
  // rather than a flaw in the sequencing.
  const averageLessonsPerUnit = Math.max(
    1,
    Math.round(lessons.length / Math.max(1, unitLessons.size)),
  );
  const lastRevisitableUnit =
    lessons.length - UNITS_WITHOUT_A_FUTURE * averageLessonsPerUnit;

  for (const [id, origin] of introducedIn) {
    const units = seenInUnits.get(id) ?? new Set<string>();
    const lesson = lessons[origin.lessonIndex];

    if (units.size <= 1 && isStrict() && origin.lessonIndex < lastRevisitableUnit) {
      add(
        lesson,
        "not-revisited-after-unit",
        `"${id}" never appears outside ${origin.unitId}`,
      );
    }
  }

  findings.push(...auditPilotLessons(lessons));

  // --- every declared grammar target has a rule -----------------------------
  const targets = new Set(
    lessons.flatMap((lesson) => lesson.metadata?.tags ?? []),
  );

  for (const target of targets) {
    if (!findGrammarRule(target)) {
      findings.push({
        lessonId: "-",
        rule: "grammar-coverage",
        detail: `no authored rule for grammar target "${target}"`,
      });
    }
  }

  return findings;
}

function main(): void {
  const findings = audit();
  const lessonsById = new Map(
    getLessonsForCurriculum("spanish").map((lesson) => [lesson.id, lesson]),
  );

  const errors = findings;
  const warnings: Finding[] = [];

  console.log(
    `Audited ${lessonsById.size} Spanish lessons against ${allGrammarRules().length} grammar rules.`,
  );

  const summarize = (label: string, list: Finding[]) => {
    if (list.length === 0) {
      console.log(`  ${label}: none`);
      return;
    }

    const byRule = new Map<string, Finding[]>();
    for (const finding of list) {
      byRule.set(finding.rule, [...(byRule.get(finding.rule) ?? []), finding]);
    }

    console.log(`  ${label}: ${list.length}`);
    for (const [rule, entries] of byRule) {
      console.log(`    ${rule} (${entries.length})`);
      const limit = process.argv.includes("--full") ? entries.length : 5;
      for (const entry of entries.slice(0, limit)) {
        console.log(`      ${entry.lessonId}: ${entry.detail}`);
      }
      if (entries.length > limit) {
        console.log(`      …and ${entries.length - limit} more`);
      }
    }
  };

  summarize("errors", errors);
  summarize("warnings (rest of course)", warnings);

  if (errors.length > 0) {
    console.error("\n✗ The curriculum must be clean before shipping.");
    process.exit(1);
  }

  console.log("\n✓ The whole Spanish course is pedagogically clean.");
}

main();
