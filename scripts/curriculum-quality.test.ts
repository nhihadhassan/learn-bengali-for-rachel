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
import { getLessonProfile } from "@/lib/lesson-profiles";
import { isKnownForm, lemmaOf, isTransparentWord } from "@/lib/spanish-lexicon";
import { PILOT_UNIT_COUNT, pilotUnits } from "@/lib/spanish-pilot";
import { isContentWord, normalizeWord, splitWords } from "@/lib/text-tokens";
import type { Lesson, Phrase } from "@/types/learning";

const pack = JSON.parse(readFileSync("content/spanish-curriculum.json", "utf8")) as {
  units: Array<{
    id: string;
    section: number;
    unit: number;
    grammar_focus?: string;
    dialogue?: unknown;
    phrase_patterns: Array<{ spanish: string }>;
  }>;
};
/** Every unit the course actually runs — the pilot's, then the pack's tail. */
const packUnits = new Map<string, { id: string; grammar_focus?: string }>([
  ...pack.units.map((unit) => [unit.id, unit] as const),
  ...pilotUnits.map((unit) => [unit.id, unit] as const),
]);
const lessons = getLessonsForCurriculum("spanish");

/** Sections 1-2 are the hand-curated part this pass is responsible for. */
/** The v1 units the pilot took the place of, in path order. */
const PILOT_REPLACED = new Set(
  [...pack.units]
    .sort((a, b) => a.section - b.section || a.unit - b.unit)
    .slice(0, PILOT_UNIT_COUNT)
    .map((unit) => unit.id),
);

/**
 * The units held to the hand-authored bar: the pilot's twelve, plus the v1
 * units of sections 1-2 that are still in the path behind them.
 */
const CURATED = new Set([
  ...pilotUnits.map((unit) => unit.id),
  ...pack.units
    .filter((unit) => unit.section <= 2 && !PILOT_REPLACED.has(unit.id))
    .map((unit) => unit.id),
]);

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

test("a unit that runs a grammar lesson declares which grammar it teaches", () => {
  // Not every unit has a grammar lesson: the pilot names a pattern only when
  // the pattern is worth naming, and discovers the rest. But a unit that *does*
  // schedule one must say which rule, or it falls back to the rotation that
  // gave a greetings unit noun gender.
  const withGrammarLesson = new Set(
    lessons
      .filter((lesson) => lesson.plan?.kind === "grammar" && CURATED.has(lesson.unitId))
      .map((lesson) => lesson.unitId),
  );

  assert.ok(withGrammarLesson.size > 0, "no curated unit runs a grammar lesson");

  for (const unitId of withGrammarLesson) {
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

test("a unit with a grammar lesson teaches the rule it declares", () => {
  // The pilot units that carry an explicit grammar lesson are the ones whose
  // pattern is worth naming outright rather than discovering. Both are checked
  // by id because both are hand-authored decisions, not derived ones.
  const focusOf = (unitId: string) =>
    lessons.find((lesson) => lesson.unitId === unitId && lesson.plan?.kind === "grammar")
      ?.plan?.grammar?.id;

  assert.equal(focusOf("es-en-p01-u06"), "noun-gender-articles");
  assert.equal(focusOf("es-en-p01-u10"), "estar-location-hay");

  // And no unit runs a grammar lesson it never declared one for.
  for (const unit of pilotUnits) {
    const taught = focusOf(unit.id);

    if (taught) {
      assert.equal(taught, unit.grammar_focus, `${unit.id} teaches an undeclared rule`);
    }
  }
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
    // A grammar lesson can carry two kinds of tagged question: drills from the
    // rule it explains, and the unit's own authored sentence frames, which
    // exercise their own concept. Both are legitimate; a concept from neither
    // would mean a question is being tallied against a skill it never tested.
    const allowed = new Set(
      [
        lesson.plan?.grammar?.id,
        ...(lesson.plan?.patterns ?? []).flatMap((pattern) => pattern.concepts ?? []),
      ].filter((id): id is string => Boolean(id)),
    );

    for (const step of buildLessonSteps(lesson)) {
      if (step.type === "complete" && step.conceptIds?.length) {
        tagged += 1;
        assert.ok(
          allowed.has(step.conceptIds[0]),
          `${lesson.id} tags a question with "${step.conceptIds[0]}", which it never exercises`,
        );
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

test("the course opens on the pilot's first unit", () => {
  const first = lessons[0];
  assert.equal(first.unitId, pilotUnits[0].id);
  assert.equal(first.unitNumber, 1);
});

test("the pilot replaced the head of the path and left the tail alone", () => {
  // Lesson ids are persisted in `completedLessons`. The pilot units are new, so
  // they carry new ids; every unit behind them must keep the id it has always
  // had, or a learner's progress past unit 12 would quietly detach.
  const pilotIds = new Set(pilotUnits.map((unit) => unit.id));

  for (const lesson of lessons) {
    const pattern = pilotIds.has(lesson.unitId)
      ? /^es-en-p01-u\d{2}-l\d$/
      : /^es-en-s\d{2}-u\d{3}-l\d$/;

    assert.match(lesson.id, pattern);
  }

  const ids = new Set(lessons.map((lesson) => lesson.id));
  assert.equal(ids.size, lessons.length, "lesson ids must stay unique");

  // The v1 units the pilot did *not* replace are all still here.
  const remaining = pack.units.filter((unit) => !PILOT_REPLACED.has(unit.id));
  for (const unit of remaining) {
    assert.ok(
      lessons.some((lesson) => lesson.unitId === unit.id),
      `${unit.id} fell out of the path`,
    );
  }
});

test("a phrase is never introduced before the words it is built from", () => {
  const known = new Set<string>();

  for (const lesson of lessons) {
    // Every lesson *contributes* to what the learner knows; only the curated
    // ones are held to the bar. Walking only the curated ones is what made a
    // v1 unit look like it introduced `ella` cold when a pilot unit two hours
    // earlier had taught it.
    const checked = CURATED.has(lesson.unitId);

    for (const id of lesson.plan?.newPhraseIds ?? []) {
      const phrase = lesson.phrases.find((item) => item.id === id);

      if (!phrase) continue;

      // A one-word phrase pattern *is* the word it introduces, so it has no
      // prerequisites of its own — same guard the audit uses.
      if (checked && phrase.category === "phrase" && contentWords(phrase.romanized).length > 1) {
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

// ---------------------------------------------------------------------------
// Course-wide guarantees
//
// Sections 3-4 are not hand-authored, so these assert the *rules* that keep
// them honest rather than the content itself.
// ---------------------------------------------------------------------------

test("no two units teach the same set of phrases", () => {
  // 46 units — a third of the course — once shared a phrase set with another.
  // "Me gusta leer." was introduced as new material in five different places.
  const byPhraseSet = new Map<string, string[]>();

  for (const unit of pack.units) {
    const key = [...unit.phrase_patterns.map((p) => p.spanish)].sort().join("|");
    byPhraseSet.set(key, [...(byPhraseSet.get(key) ?? []), unit.id]);
  }

  const duplicates = [...byPhraseSet.values()].filter((ids) => ids.length > 1);

  assert.deepEqual(
    duplicates,
    [],
    `units share a phrase set: ${duplicates.map((ids) => ids.join(" = ")).join("; ")}`,
  );
});

test("every unit teaches grammar its own sentences demonstrate", () => {
  // The rotation is gone: an un-authored unit ranks its declared targets by the
  // evidence it puts in front of the learner, and falls back to any rule it
  // does demonstrate rather than explaining one that is nowhere on screen.
  let unitSeen: Array<{ romanized: string; english: string }> = [];
  let currentUnit = "";

  for (const lesson of lessons) {
    if (lesson.unitId !== currentUnit) {
      currentUnit = lesson.unitId;
      unitSeen = [];
    }

    for (const id of lesson.plan?.newPhraseIds ?? []) {
      const phrase = lesson.phrases.find((item) => item.id === id);

      if (phrase) {
        unitSeen.push({ romanized: phrase.romanized, english: phrase.english });
      }
    }

    if (lesson.plan?.kind !== "grammar") {
      continue;
    }

    const focus = lesson.plan.grammar;
    assert.ok(focus, `${lesson.id} has no grammar to teach`);

    const rule = getGrammarRule(focus!.id);
    assert.ok(rule, `${lesson.id} teaches an unauthored rule "${focus!.id}"`);
    assert.ok(
      countPatternEncounters(rule!, unitSeen) >= 1,
      `${lesson.id} explains "${focus!.title}" with no example in front of the learner`,
    );
  }
});

test("every 'Use in context' lesson actually has a conversation", () => {
  // A quarter of them used to produce no dialogue at all, which left the lesson
  // type indistinguishable from ordinary practice.
  for (const lesson of lessons) {
    if (lesson.plan?.kind !== "context") {
      continue;
    }

    const turns = buildLessonSteps(lesson).filter((step) => step.type === "dialogue");

    assert.ok(
      turns.length > 0,
      `${lesson.id} is a context lesson with no dialogue`,
    );
  }
});

test("authored patterns hold their frame and offer real alternatives", () => {
  const withPatterns = lessons.filter((lesson) => lesson.plan?.patterns?.length);
  assert.ok(withPatterns.length > 0, "no lesson carries authored patterns");

  let seen = 0;

  for (const lesson of withPatterns) {
    for (const pattern of lesson.plan!.patterns!) {
      assert.ok(
        pattern.template.includes("{}"),
        `${pattern.id} has no slot to vary`,
      );
      assert.ok(
        pattern.fills.length >= 3,
        `${pattern.id} offers ${pattern.fills.length} fills; a frame needs alternatives`,
      );
    }

    for (const step of buildLessonSteps(lesson)) {
      if (step.type !== "complete" || !step.prompt.startsWith("Use the pattern")) {
        continue;
      }

      seen += 1;
      assert.ok(step.options.includes(step.answer), `${step.id} omits its answer`);
      assert.ok(step.options.length >= 3, `${step.id} has no alternatives`);
      // The frame is the constant; only the slot changes.
      assert.ok(step.before.length > 0, `${step.id} has an empty frame`);
    }
  }

  assert.ok(seen > 0, "authored patterns never produced a question");
});

test("later sections take the scaffolding away", () => {
  // The Intro shape should not still be running at A2: the English hint comes
  // off, and word banks carry more decoys.
  const intro = getLessonProfile("build", "Intro");
  const a2 = getLessonProfile("build", "A2");

  assert.equal(intro.showMeaningHint, true);
  assert.equal(a2.showMeaningHint, false);
  assert.ok(
    a2.wordBankPadding > intro.wordBankPadding,
    "an A2 word bank should be less generous than an Intro one",
  );

  // A band supplies only what it changes; the rest is inherited.
  assert.equal(a2.kind, intro.kind);
  assert.equal(getLessonProfile("build").showMeaningHint, intro.showMeaningHint);
});

test("a unit review introduces nothing, even in an overloaded unit", () => {
  for (const lesson of lessons) {
    if (lesson.plan?.kind === "review") {
      assert.equal(
        lesson.plan.newPhraseIds.length,
        0,
        `${lesson.id} is a review but introduces new material`,
      );
    }
  }
});

test("conjugated and inflected forms resolve without being authored", () => {
  // Regular morphology is derived, so only irregulars need the authored map.
  const known = new Set(["funcionar", "hablar", "vivir", "comprar", "cambiar"]);

  for (const form of ["funciona", "hablamos", "vivió", "compraba", "cambiando"]) {
    assert.ok(isKnownForm(form, known), `${form} should resolve`);
  }

  // An attached object pronoun is not a different word.
  assert.ok(isKnownForm("cambiarlo", known));
  assert.ok(!isKnownForm("olvidar", known));
});
