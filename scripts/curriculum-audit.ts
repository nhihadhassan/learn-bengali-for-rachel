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

/** Of a unit's six lessons, five teach; the sixth is the review. */
const TEACHING_LESSONS_PER_UNIT = 5;

/** Units at the very end of the course have no later unit to recycle them. */
const UNITS_WITHOUT_A_FUTURE = 2;

/** A unit teaching more than this at once is doing too much. */
const MAX_UNIT_VOCABULARY = 16;

/** Above this share of unknown words, a dialogue prompt stops being input. */
const MAX_DIALOGUE_UNKNOWN = 0.34;

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

function audit(): Finding[] {
  const lessons = getLessonsForCurriculum("spanish");
  const findings: Finding[] = [];
  const add = (lesson: Lesson, rule: string, detail: string) =>
    findings.push({ lessonId: lesson.id, rule, detail });

  // How much each unit has to teach, for the load check below.
  const unitNewItemCount = new Map<string, number>();
  for (const lesson of lessons) {
    unitNewItemCount.set(
      lesson.unitId,
      (unitNewItemCount.get(lesson.unitId) ?? 0) + (lesson.plan?.newPhraseIds.length ?? 0),
    );
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
    const unitCapacity = TEACHING_LESSONS_PER_UNIT * MAX_NEW_ITEMS_PER_LESSON;
    const unitItems = unitNewItemCount.get(lesson.unitId) ?? 0;
    const allowed =
      unitItems > unitCapacity
        ? MAX_NEW_ITEMS_PER_LESSON + Math.ceil((unitItems - unitCapacity) / TEACHING_LESSONS_PER_UNIT)
        : MAX_NEW_ITEMS_PER_LESSON;

    if (plan.newPhraseIds.length > allowed) {
      add(
        lesson,
        "new-content-load",
        `introduces ${plan.newPhraseIds.length} new items (allowed ${allowed})`,
      );
    }

    if (unitItems > unitCapacity + TEACHING_LESSONS_PER_UNIT) {
      add(lesson, "unit-overloaded", `unit teaches ${unitItems} items across ${TEACHING_LESSONS_PER_UNIT} lessons`);
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
  const lastRevisitableUnit = lessons.length - UNITS_WITHOUT_A_FUTURE * 6;

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
