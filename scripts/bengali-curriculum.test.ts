/**
 * Bengali Curriculum v2: the properties that make it teachable.
 *
 * The Spanish equivalents live in `curriculum-quality.test.ts`; these are the
 * ones specific to this course — the lexicon that decides what counts as
 * already known, the register the course teaches in, the script every item has
 * to carry for pronunciation, and the promise that rebuilding the course did
 * not quietly drop anything the old one taught.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isKnownForm, lemmaOf, isTransparentWord, pronounBaseOf } from "@/lib/bengali-lexicon";
import { getLessonsForCurriculum } from "@/lib/content";
import { getCapabilities } from "@/lib/courses";
import { taughtWordSet, unknownWords } from "@/lib/curriculum-plan";
import { allGrammarRules, getGrammarRule } from "@/lib/grammar-drills";
import { buildLessonSteps } from "@/lib/lesson-steps";
import { isContentWord, normalizeWord, splitWords } from "@/lib/text-tokens";
import type { Lesson } from "@/types/learning";

type PackItem = { id: string; bengali: string; script: string; english: string };
type PackUnit = {
  id: string;
  unit: number;
  title: string;
  scaffold?: number;
  grammar_focus?: string;
  vocabulary: PackItem[];
  phrase_patterns: PackItem[];
  dialogues?: Array<{
    turns: Array<{
      speaker?: string;
      prompt: { bengali: string; receptive?: boolean };
      reply: { bengali: string };
    }>;
  }>;
  lesson_sequence: Array<{ lesson_index: number; name: string }>;
};

const pack = JSON.parse(readFileSync("content/bengali-curriculum.json", "utf8")) as {
  units: PackUnit[];
};

const v1 = JSON.parse(readFileSync("content/learn-bengali.json", "utf8")) as {
  units: Array<{ lessons: Array<{ phrases: Array<{ id: string; romanized: string }> }> }>;
};

const lessons = getLessonsForCurriculum("bengali");
const items = pack.units.flatMap((unit) => [...unit.vocabulary, ...unit.phrase_patterns]);

test("the course is registered as cumulative and gets conversations", () => {
  const capabilities = getCapabilities("bengali");

  assert.equal(capabilities.lessonStrategy, "cumulative");
  assert.equal(capabilities.dialogue, true);
  // Listening stays off: "tap what you hear" is only fair where a Bengali
  // voice is reliably installed, and on most desktops it is not.
  assert.equal(capabilities.listening, false);
  assert.equal(capabilities.script, true);
});

test("every item carries the Bengali script, so pronunciation reads Bengali", () => {
  for (const item of items) {
    assert.ok(item.script.length > 0, `${item.id} has no script`);
    // The Bengali block, the zero-width joiners its conjuncts need (র‍্যাচেল),
    // and the punctuation and spaces a sentence needs.
    assert.match(
      item.script,
      /^[\u0980-\u09FF\u200C\u200D\s,.?!…'"-]+$/u,
      `${item.id}: ${item.script}`,
    );
  }

  for (const lesson of lessons) {
    for (const phrase of lesson.phrases) {
      assert.ok(phrase.bengaliScript, `${lesson.id}/${phrase.id} lost its script`);
    }
  }
});

test("rebuilding the course did not drop anything the old one taught", () => {
  // The handoff constraint: v2 replaces the whole path, and a learner part-way
  // through v1 keeps their memory of an item only if v2 still teaches it.
  const taught = new Set(items.map((item) => item.id));
  const dropped = v1.units
    .flatMap((unit) => unit.lessons)
    .flatMap((lesson) => lesson.phrases)
    .filter((phrase) => !taught.has(phrase.id));

  // "ami khushi" and "amar naam..." are the two v1 entries v2 does not carry:
  // the first is a duplicate of the same sentence in another v1 unit, and the
  // second is a fragment ending in an ellipsis rather than a phrase.
  assert.deepEqual(
    dropped.map((phrase) => phrase.id).sort(),
    ["p-u02-l01-introduce-yourself-04", "p-u06-l01-visiting-home-06"],
  );
});

test("reused ids keep pointing at the same Bengali", () => {
  const v1ById = new Map(
    v1.units
      .flatMap((unit) => unit.lessons)
      .flatMap((lesson) => lesson.phrases)
      .map((phrase) => [phrase.id, phrase.romanized] as const),
  );

  for (const item of items) {
    const original = v1ById.get(item.id);

    if (!original) {
      continue;
    }

    // Spelling may be corrected (shikchi → shikhchi); the item must still be
    // the same word, or the learner's memory of it is being reassigned.
    assert.ok(
      isKnownForm(splitWords(item.bengali)[0], taughtWordSet(original)) ||
        normalizeWord(item.bengali) === normalizeWord(original),
      `${item.id}: "${original}" became "${item.bengali}"`,
    );
  }
});

test("support falls away and never comes back", () => {
  const scaffolds = pack.units
    .map((unit) => unit.scaffold)
    .filter((level): level is number => level !== undefined);

  assert.equal(scaffolds.length, pack.units.length, "every unit declares a scaffold");

  for (let index = 1; index < scaffolds.length; index += 1) {
    assert.ok(
      scaffolds[index] <= scaffolds[index - 1],
      `${pack.units[index].id} raises the scaffold to ${scaffolds[index]}`,
    );
  }
});

test("a unit that names a grammar rule names one that exists", () => {
  const bengaliRules = new Set(allGrammarRules("bengali").map((rule) => rule.id));

  assert.ok(bengaliRules.size > 0);

  for (const unit of pack.units) {
    if (!unit.grammar_focus) {
      continue;
    }

    assert.ok(getGrammarRule(unit.grammar_focus), `${unit.id}: ${unit.grammar_focus}`);
    assert.ok(
      bengaliRules.has(unit.grammar_focus),
      `${unit.id} declares a rule from another language`,
    );
  }
});

test("every unit that runs a grammar lesson gets a card to show", () => {
  const grammarLessons = lessons.filter((lesson) => lesson.plan?.kind === "grammar");

  assert.ok(grammarLessons.length > 0, "no Bengali unit teaches grammar");

  for (const lesson of grammarLessons) {
    assert.ok(lesson.plan?.grammar, `${lesson.id} has no rule to teach`);
    assert.ok(
      (lesson.plan?.grammar?.examples.length ?? 0) >= 1,
      `${lesson.id} has nothing to illustrate the rule with`,
    );
  }
});

test("a sentence is fully readable when the learner is asked to build it", () => {
  const known = new Set<string>();

  for (const lesson of lessons) {
    for (const id of lesson.plan?.newPhraseIds ?? []) {
      const phrase = lesson.phrases.find((item) => item.id === id);

      if (!phrase) {
        continue;
      }

      if (phrase.category === "phrase" && splitWords(phrase.romanized).length > 1) {
        assert.deepEqual(
          unknownWords(phrase.romanized, known, isKnownForm),
          [],
          `${lesson.id}: "${phrase.romanized}"`,
        );
      }

      for (const word of taughtWordSet(phrase.romanized)) {
        known.add(word);
      }
    }
  }
});

test("nobody switches between tumi and apni mid-conversation", () => {
  // tumi and apni are different relationships, not synonyms, and the course
  // exists partly to stop a learner mixing them — so it must not mix them
  // itself. The unit is the *speaker*, not the dialogue: a scene where a
  // friend's mother uses apni and the friend uses tumi is exactly right, and a
  // check on the whole exchange would forbid it. What must hold is that each
  // person keeps one level, and that a reply answers in the level it was asked
  // in.
  const TUMI = /\b(tumi|tomar|tomake|acho|koro|bolo|dao|jao|thako|khao|esho|khabe|korcho)\b/i;
  const APNI =
    /\b(apni|apnar|apnake|achen|korun|bolun|din|boshun|boshte|ashun|thakun|khaben|jaben|ashben|chan|korben)\b/i;
  const register = (line: string) =>
    APNI.test(line) ? "apni" : TUMI.test(line) ? "tumi" : null;

  for (const unit of pack.units) {
    for (const dialogue of unit.dialogues ?? []) {
      const bySpeaker = new Map<string, string>();

      for (const turn of dialogue.turns) {
        const speaker = turn.speaker ?? "them";
        const asked = register(turn.prompt.bengali);
        const answered = register(turn.reply.bengali);

        if (asked) {
          const held = bySpeaker.get(speaker);
          assert.ok(
            held === undefined || held === asked,
            `${unit.id}: ${speaker} switches from ${held} to ${asked} — "${turn.prompt.bengali}"`,
          );
          bySpeaker.set(speaker, asked);
        }

        assert.ok(
          !asked || !answered || asked === answered,
          `${unit.id}: "${turn.prompt.bengali}" (${asked}) answered with "${turn.reply.bengali}" (${answered})`,
        );
      }
    }
  }
});

test("the lexicon knows the forms this course actually teaches", () => {
  // Conjugations resolve to the verb, in both directions.
  assert.equal(lemmaOf("korchi"), "kora");
  assert.equal(lemmaOf("korben"), "kora");
  assert.equal(lemmaOf("gechi"), "jaowa");
  assert.equal(lemmaOf("eshechi"), "asha");
  assert.equal(lemmaOf("nei"), "acha");

  // Pronouns carry across their possessive and objective forms.
  assert.equal(pronounBaseOf("amar"), "ami");
  assert.equal(pronounBaseOf("tomake"), "tumi");
  assert.ok(isKnownForm("ami", new Set(["amar"])), "teaching amar teaches ami");

  // Case endings are stripped by rule, not authored.
  assert.ok(isKnownForm("barite", new Set(["bari"])), "bari + te");
  assert.ok(isKnownForm("bari", new Set(["barite"])), "and the other way round");
  assert.ok(isKnownForm("bondhur", new Set(["bondhu"])), "bondhu + r");

  // Names, numerals and the loanwords spoken Bengali uses as they stand.
  assert.ok(isTransparentWord("dhaka"));
  assert.ok(isTransparentWord("panch"));
  assert.ok(isTransparentWord("taxi"));

  // And it does not simply say yes to everything.
  assert.equal(isKnownForm("shomossha", new Set(["bari"])), false);
});

test("no two units teach the same set of phrases", () => {
  const seen = new Map<string, string>();

  for (const unit of pack.units) {
    const key = [...unit.phrase_patterns.map((item) => item.bengali)].sort().join("|");

    if (!key) {
      continue;
    }

    const previous = seen.get(key);
    assert.equal(previous, undefined, `${unit.id} repeats ${previous}'s phrase set`);
    seen.set(key, unit.id);
  }
});

test("every lesson a learner opens produces real work", () => {
  for (const lesson of lessons) {
    const steps = buildLessonSteps(lesson as Lesson);

    assert.ok(steps.length > 0, `${lesson.id} builds no steps`);
    assert.ok(
      steps.some((step) => step.type !== "intro" && step.type !== "learn"),
      `${lesson.id} teaches without ever asking`,
    );

    for (const step of steps) {
      if (step.type === "listen") {
        assert.fail(`${lesson.id} asks a listening question, but Bengali has no audio`);
      }
    }
  }
});

test("prompts name Bengali, not the course label", () => {
  const prompts = lessons
    .flatMap((lesson) => buildLessonSteps(lesson as Lesson))
    .flatMap((step) => ("prompt" in step && typeof step.prompt === "string" ? [step.prompt] : []));

  assert.ok(prompts.length > 0);

  for (const prompt of prompts) {
    assert.ok(!prompt.includes("Spanish"), `a Bengali lesson asks: "${prompt}"`);
    assert.ok(!prompt.includes("{language}"), `unfilled placeholder: "${prompt}"`);
  }

  assert.ok(
    prompts.some((prompt) => prompt.includes("Bengali")),
    "no prompt ever names the language being learned",
  );
});

test("questions are built from words worth testing", () => {
  // A cloze that blanks a two-letter particle tests eyesight, not Bengali.
  for (const lesson of lessons) {
    for (const step of buildLessonSteps(lesson as Lesson)) {
      if (step.type === "complete" && !step.grammarNote) {
        assert.ok(
          isContentWord(step.answer),
          `${lesson.id} blanks "${step.answer}"`,
        );
      }
    }
  }
});
