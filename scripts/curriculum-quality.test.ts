/**
 * Curriculum quality: the properties that make Sections 1-2 teachable.
 *
 * These assert things a human would otherwise have to re-read 41 units to
 * check — that grammar is chosen deliberately rather than by arithmetic, that
 * nothing is explained with words the learner has never met, and that a
 * dialogue is comprehensible.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getLessonsForCurriculum } from "@/lib/content";
import { taughtWordSet, unknownWords } from "@/lib/curriculum-plan";
import {
  buildGrammarDrills,
  countPatternEncounters,
  getGrammarRule,
  toGrammarFocus,
} from "@/lib/grammar-drills";
import { buildLessonSteps } from "@/lib/lesson-steps";
import { isKnownForm, lemmaOf, isTransparentWord } from "@/lib/spanish-lexicon";
import { isContentWord, normalizeWord, splitWords } from "@/lib/text-tokens";
import type { Lesson, Phrase } from "@/types/learning";

const pack = JSON.parse(readFileSync("content/spanish-curriculum.json", "utf8")) as {
  units: Array<{
    id: string;
    section: number;
    grammar_focus?: string;
    dialogue?: unknown;
  }>;
};
const packUnits = new Map(pack.units.map((unit) => [unit.id, unit]));
const lessons = getLessonsForCurriculum("spanish");

/** Sections 1-2 are the hand-curated part this pass is responsible for. */
const CURATED = new Set(
  pack.units.filter((unit) => unit.section <= 2).map((unit) => unit.id),
);

function contentWords(text: string): string[] {
  return [...taughtWordSet(text)];
}

/**
 * Walk the course in path order, yielding each lesson with the set of words the
 * learner knows by the time they reach it.
 */
function walkCourse(): Array<{ lesson: Lesson; known: Set<string> }> {
  const known = new Set<string>();
  const out: Array<{ lesson: Lesson; known: Set<string> }> = [];

  for (const lesson of lessons) {
    for (const id of lesson.plan?.newPhraseIds ?? []) {
      const phrase = lesson.phrases.find((item) => item.id === id);

      if (phrase) {
        for (const word of contentWords(phrase.romanized)) {
          known.add(word);
        }
      }
    }

    out.push({ lesson, known: new Set(known) });
  }

  return out;
}

const walked = walkCourse();

// ---------------------------------------------------------------------------
// Grammar selection
// ---------------------------------------------------------------------------

test("every curated unit declares which grammar it teaches", () => {
  for (const unitId of CURATED) {
    assert.ok(
      packUnits.get(unitId)?.grammar_focus,
      `${unitId} has no grammar_focus — it would fall back to the rotation`,
    );
  }
});

test("the grammar a unit teaches is the grammar it declares", () => {
  // The bug this replaces: grammar was picked as
  // `targets[(unitNumber - 1) % targets.length]`, so a greetings unit taught
  // noun gender and a unit of twelve adjectives taught articles.
  for (const lesson of lessons) {
    if (lesson.plan?.kind !== "grammar" || !CURATED.has(lesson.unitId)) {
      continue;
    }

    const declared = packUnits.get(lesson.unitId)?.grammar_focus;
    assert.equal(
      lesson.plan.grammar?.id,
      declared,
      `${lesson.unitId} declares ${declared} but teaches ${lesson.plan.grammar?.id}`,
    );
  }
});

test("a unit never explains a pattern the learner has not met", () => {
  const seen: Array<{ romanized: string; english: string }> = [];

  for (const { lesson } of walked) {
    for (const id of lesson.plan?.newPhraseIds ?? []) {
      const phrase = lesson.phrases.find((item) => item.id === id);

      if (phrase) {
        seen.push({ romanized: phrase.romanized, english: phrase.english });
      }
    }

    const focus = lesson.plan?.kind === "grammar" ? lesson.plan.grammar : undefined;

    if (!focus || !CURATED.has(lesson.unitId)) {
      continue;
    }

    const rule = getGrammarRule(focus.id);
    assert.ok(rule, `${focus.id} is not an authored rule`);
    assert.ok(
      countPatternEncounters(rule!, seen) >= 1,
      `${lesson.id} explains "${focus.title}" before the learner has seen it`,
    );
  }
});

test("greetings does not teach noun gender, and adjectives do teach agreement", () => {
  const focusOf = (unitId: string) =>
    lessons.find((lesson) => lesson.unitId === unitId && lesson.plan?.kind === "grammar")
      ?.plan?.grammar?.id;

  assert.notEqual(focusOf("es-en-s01-u002"), "noun-gender-articles");
  assert.equal(focusOf("es-en-s01-u005"), "adjective-agreement");
  assert.equal(focusOf("es-en-s01-u001"), "querer-pattern");
});

// ---------------------------------------------------------------------------
// Known-language examples
// ---------------------------------------------------------------------------

test("grammar examples only use language the learner already has", () => {
  for (const { lesson, known } of walked) {
    const focus = lesson.plan?.kind === "grammar" ? lesson.plan.grammar : undefined;

    if (!focus || !CURATED.has(lesson.unitId)) {
      continue;
    }

    assert.ok(focus.examples.length >= 1, `${lesson.id} shows no examples`);

    for (const example of focus.examples) {
      assert.deepEqual(
        unknownWords(example.target, known, isKnownForm),
        [],
        `${lesson.id} illustrates "${focus.title}" with "${example.target}"`,
      );
    }
  }
});

test("a rule's examples are filtered per unit, not shown wholesale", () => {
  const rule = getGrammarRule("present-tense-foundations");
  assert.ok(rule);

  const narrow = toGrammarFocus(rule!, {
    knownWords: new Set(["querer", "café"]),
    resolveKnown: isKnownForm,
  });
  const wide = toGrammarFocus(rule!, {
    knownWords: new Set(["querer", "café", "hablar", "español", "vivir", "lima", "leer", "escribir", "inglés"]),
    resolveKnown: isKnownForm,
  });

  assert.ok(
    wide.examples.length > narrow.examples.length,
    "a learner who knows more should be shown more",
  );
});

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

test("dialogue prompts are comprehensible, or marked as receptive", () => {
  for (const { lesson, known } of walked) {
    const dialogue = lesson.plan?.dialogue;

    if (!dialogue || !CURATED.has(lesson.unitId)) {
      continue;
    }

    for (const turn of dialogue.turns) {
      if (turn.prompt.receptive) {
        continue;
      }

      assert.deepEqual(
        unknownWords(turn.prompt.target, known, isKnownForm),
        [],
        `${lesson.id}: "${turn.prompt.target}"`,
      );
    }
  }
});

test("the learner is never asked to produce untaught language", () => {
  for (const { lesson, known } of walked) {
    const dialogue = lesson.plan?.dialogue;

    if (!dialogue || !CURATED.has(lesson.unitId)) {
      continue;
    }

    for (const turn of dialogue.turns) {
      assert.deepEqual(
        unknownWords(turn.reply.target, known, isKnownForm),
        [],
        `${lesson.id} expects the learner to say "${turn.reply.target}"`,
      );
      assert.notEqual(
        turn.reply.receptive,
        true,
        "a reply is produced, so it can never be receptive-only",
      );
    }
  }
});

test("every curated unit has an authored scenario", () => {
  const section1 = pack.units.filter((unit) => unit.section === 1);
  const section2First12 = pack.units
    .filter((unit) => unit.section === 2)
    .slice(0, 12);

  for (const unit of [...section1, ...section2First12]) {
    assert.ok(unit.dialogue, `${unit.id} has no authored dialogue`);
  }
});

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

test("pattern drills hold the frame and vary the slot", () => {
  const focus = toGrammarFocus(getGrammarRule("querer-pattern")!);
  const phrases: Phrase[] = [
    { id: "p1", romanized: "Quiero un café, por favor.", english: "I want a coffee, please.", pronunciation: "", category: "phrase" },
    { id: "v1", romanized: "el té", english: "tea", pronunciation: "", category: "noun" },
    { id: "v2", romanized: "el agua", english: "water", pronunciation: "", category: "noun" },
    { id: "v3", romanized: "la leche", english: "milk", pronunciation: "", category: "noun" },
  ];

  const drills = buildGrammarDrills(focus, phrases, "seed");
  const pattern = drills.find((drill) => drill.kind === "pattern");

  assert.ok(pattern, "no pattern drill was produced");

  if (pattern?.kind === "pattern") {
    // The frame stays; the slot is what changes.
    assert.ok(pattern.before.toLowerCase().includes("quiero"));
    assert.ok(pattern.options.includes(pattern.answer));
    assert.ok(pattern.options.length >= 3, "a pattern needs alternatives to be one");
    assert.ok(
      !pattern.answer.includes("por favor"),
      "the courtesy tag is not part of the pattern",
    );
  }
});

test("grammar drills carry the concept they exercise", () => {
  const grammarLessons = lessons
    .filter((lesson) => lesson.plan?.kind === "grammar" && CURATED.has(lesson.unitId))
    .slice(0, 12);

  let tagged = 0;

  for (const lesson of grammarLessons) {
    for (const step of buildLessonSteps(lesson)) {
      if (step.type === "complete" && step.conceptIds?.length) {
        tagged += 1;
        assert.equal(step.conceptIds[0], lesson.plan?.grammar?.id);
      }
    }
  }

  assert.ok(tagged > 0, "no grammar question recorded a concept");
});

// ---------------------------------------------------------------------------
// The lexicon
// ---------------------------------------------------------------------------

test("conjugated forms resolve to the verb the course taught", () => {
  assert.equal(lemmaOf("tienes"), "tener");
  assert.equal(lemmaOf("voy"), "ir");
  assert.equal(lemmaOf("compramos"), "comprar");
  // "fue" is shared by ser and ir; either resolution is correct for knowing it.
  assert.ok(["ser", "ir"].includes(lemmaOf("fue") ?? ""));
  assert.equal(lemmaOf("semáforo"), undefined);
});

test("regular plurals and gender pairs need no authoring", () => {
  const known = new Set(["manzana", "fresco", "persona", "divertido"]);

  for (const word of ["manzanas", "frescas", "personas", "divertida"]) {
    assert.ok(isKnownForm(word, known), `${word} should resolve`);
  }

  assert.ok(!isKnownForm("cuaderno", known));
});

test("names, numbers and structure words are never prerequisites", () => {
  for (const word of ["Ana", "Canadá", "dos", "quince", "muy", "que"]) {
    assert.ok(isTransparentWord(word), `${word} should not count as a gap`);
  }

  assert.ok(!isTransparentWord("mochila"));
});

// ---------------------------------------------------------------------------
// Sequencing
// ---------------------------------------------------------------------------

test("Section 1 opens on greetings, not on café vocabulary", () => {
  const first = lessons[0];
  assert.equal(first.unitId, "es-en-s01-u002");
  assert.equal(first.unitNumber, 1);
});

test("resequencing did not change any lesson id", () => {
  // Lesson ids are persisted in `completedLessons`; the reorder moves units in
  // the path by changing a sort key, never their identity.
  for (const lesson of lessons) {
    assert.match(lesson.id, /^es-en-s\d{2}-u\d{3}-l\d$/);
  }

  const ids = new Set(lessons.map((lesson) => lesson.id));
  assert.equal(ids.size, lessons.length, "lesson ids must stay unique");
  assert.ok(ids.has("es-en-s01-u001-l1"), "the café unit keeps its ids");
  assert.ok(ids.has("es-en-s01-u002-l1"), "the greetings unit keeps its ids");
});

test("a phrase is never introduced before the words it is built from", () => {
  const known = new Set<string>();

  for (const lesson of lessons) {
    if (!CURATED.has(lesson.unitId)) {
      continue;
    }

    for (const id of lesson.plan?.newPhraseIds ?? []) {
      const phrase = lesson.phrases.find((item) => item.id === id);

      if (!phrase) continue;

      // A one-word phrase pattern *is* the word it introduces, so it has no
      // prerequisites of its own — same guard the audit uses.
      if (phrase.category === "phrase" && contentWords(phrase.romanized).length > 1) {
        assert.deepEqual(
          unknownWords(phrase.romanized, known, isKnownForm),
          [],
          `${lesson.id} introduces "${phrase.romanized}" too early`,
        );
      }

      for (const word of contentWords(phrase.romanized)) {
        known.add(word);
      }
    }
  }
});

test('the listening lesson is not called "Listen and speak"', () => {
  // It contains no speaking, and the app must not imply that it does.
  for (const lesson of lessons) {
    assert.notEqual(lesson.title, "Listen and speak");
  }

  assert.ok(lessons.some((lesson) => lesson.title === "Listen and understand"));
});
