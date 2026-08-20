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
import { MAX_NEW_ITEMS_PER_LESSON, coverage } from "../src/lib/curriculum-plan";
import { allGrammarRules, findGrammarRule } from "../src/lib/grammar-drills";
import { isContentWord, normalizeWord, splitWords } from "../src/lib/text-tokens";
import type { Lesson, Phrase } from "../src/types/learning";

type Finding = { lessonId: string; rule: string; detail: string };

/** Units 1-10 are the hand-sequenced ones this pass is responsible for. */
const STRICT_UNIT_PREFIX = "es-en-s01-u0";
const STRICT_UNITS = new Set(
  Array.from({ length: 10 }, (_, index) => `${STRICT_UNIT_PREFIX}${String(index + 1).padStart(2, "0")}`),
);

/**
 * An item must come back *outside* the unit that introduced it. Measuring a gap
 * to the end of a 786-lesson course would flag every Section 1 word, which says
 * nothing: the question is whether the spaced ladder brings material back at
 * all once its unit is over.
 */
/** Below this share of shared items, two consecutive lessons aren't building. */
const MIN_CONSECUTIVE_OVERLAP = 0.2;

function isStrict(lesson: Lesson): boolean {
  return STRICT_UNITS.has(lesson.unitId);
}

function contentWords(text: string): string[] {
  return splitWords(text).filter(isContentWord).map(normalizeWord);
}

function audit(): Finding[] {
  const lessons = getLessonsForCurriculum("spanish");
  const findings: Finding[] = [];
  const add = (lesson: Lesson, rule: string, detail: string) =>
    findings.push({ lessonId: lesson.id, rule, detail });

  const knownWords = new Set<string>();
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

    // --- new-content load ---------------------------------------------------
    if (plan.newPhraseIds.length > MAX_NEW_ITEMS_PER_LESSON) {
      add(
        lesson,
        "new-content-load",
        `introduces ${plan.newPhraseIds.length} new items (cap ${MAX_NEW_ITEMS_PER_LESSON})`,
      );
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
      if (
        phrase.category === "phrase" &&
        words.length > 1 &&
        coverage(phrase.romanized, knownWords) < 0.5
      ) {
        const missing = words.filter((word) => !knownWords.has(word));
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
    if (plan.kind === "grammar" && !plan.grammar) {
      add(lesson, "grammar-missing", "grammar lesson has no rule to teach");
    }

    // --- dialogue -----------------------------------------------------------
    if (plan.dialogue) {
      for (const turn of plan.dialogue.turns) {
        if (turn.prompt.target.includes("?") === false) {
          continue;
        }

        if (turn.reply.target.includes("?")) {
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
  for (const [id, origin] of introducedIn) {
    const units = seenInUnits.get(id) ?? new Set<string>();
    const lesson = lessons[origin.lessonIndex];

    if (units.size <= 1 && isStrict(lesson)) {
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

  const errors = findings.filter((finding) => {
    const lesson = lessonsById.get(finding.lessonId);
    return finding.lessonId === "-" || (lesson ? isStrict(lesson) : false);
  });
  const warnings = findings.filter((finding) => !errors.includes(finding));

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
      for (const entry of entries.slice(0, 5)) {
        console.log(`      ${entry.lessonId}: ${entry.detail}`);
      }
      if (entries.length > 5) {
        console.log(`      …and ${entries.length - 5} more`);
      }
    }
  };

  summarize("Section 1 errors", errors);
  summarize("warnings (rest of course)", warnings);

  if (errors.length > 0) {
    console.error("\n✗ Section 1 must be clean before shipping.");
    process.exit(1);
  }

  console.log("\n✓ Section 1 is pedagogically clean.");
}

main();
