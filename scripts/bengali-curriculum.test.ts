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

type PackItem = {
  id: string;
  bengali: string;
  script: string;
  english: string;
  register?: string;
  receptive?: boolean;
};
type PackUnit = {
  id: string;
  unit: number;
  title: string;
  scaffold?: number;
  grammar_focus?: string;
  vocabulary: PackItem[];
  phrase_patterns: PackItem[];
  dialogues?: Array<{
    id?: string;
    turns: Array<{
      speaker?: string;
      prompt: { bengali: string; receptive?: boolean };
      reply: { bengali: string };
    }>;
  }>;
  lesson_sequence: Array<{
    lesson_index: number;
    name: string;
    kind?: string;
    teaches?: string[];
  }>;
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

test("the rebuild carries the old course's core, and says what it drops", () => {
  // This course is a rewrite, not a re-ordering: it was rebuilt around apni
  // rather than tumi, so a v1 entry survives on its merits and not because it
  // existed. What must hold is the *migration* property — that the ids the two
  // courses share still teach the same words, so a learner's spaced-repetition
  // history keeps pointing at the language it was built from. That is asserted
  // by "reused ids keep pointing at the same Bengali" above; this test pins how
  // much of v1 is carried, so dropping more becomes a deliberate act.
  const taught = new Set(items.map((item) => item.id));
  const v1Phrases = v1.units
    .flatMap((unit) => unit.lessons)
    .flatMap((lesson) => lesson.phrases);
  const carried = v1Phrases.filter((phrase) => taught.has(phrase.id));

  assert.ok(
    carried.length >= 24,
    `only ${carried.length} of ${v1Phrases.length} v1 items carried over`,
  );

  // The everyday words a v1 learner is most likely to have practised — the
  // greetings, the food, the wanting — are all still here under their old ids.
  for (const id of [
    "p-u01-l01-greetings-01", // assalamualaikum
    "p-u01-l01-greetings-03", // dhonnobad
    "p-u01-l02-how-are-you-02", // ami bhalo achi
    "p-u03-l01-food-and-water-01", // ami pani chai
    "p-u03-l01-food-and-water-05", // cha
    "p-u02-l01-introduce-yourself-02", // amar naam Rachel
  ]) {
    assert.ok(taught.has(id), `${id} should still be taught`);
  }

  // v1's familiar forms are not lost, they are relocated: tumi belongs to the
  // unit that contrasts it with apni rather than to the first lesson.
  const tumiUnit = pack.units.find((unit) => unit.id === "bn-en-s01-u03");
  const tumiIds = new Set(
    [...(tumiUnit?.vocabulary ?? []), ...(tumiUnit?.phrase_patterns ?? [])].map(
      (item) => item.id,
    ),
  );

  for (const id of [
    "p-u01-l02-how-are-you-01", // tumi kemon acho?
    "p-u02-l01-introduce-yourself-03", // tomar naam ki?
  ]) {
    assert.ok(tumiIds.has(id), `${id} should be taught in the register unit`);
  }
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

test("the course teaches apni before it teaches tumi", () => {
  // The whole point of the rebuild. A learner's first conversations are with
  // strangers, shopkeepers, drivers and hosts, and every one of those wants
  // apni — so meeting tumi first is not a neutral ordering choice, it is
  // teaching the wrong sentence for the situation the learner will be in.
  const firstAt = (register: string) => {
    for (const unit of pack.units) {
      const has = [...unit.vocabulary, ...unit.phrase_patterns].some(
        (item) => item.register === register,
      );

      if (has) {
        return unit.unit;
      }
    }

    return Number.POSITIVE_INFINITY;
  };

  const apni = firstAt("apni");
  const tumi = firstAt("tumi");

  assert.ok(apni < tumi, `apni arrives in unit ${apni}, tumi in unit ${tumi}`);
  assert.equal(apni, 1, "the respectful forms belong in the first unit");

  // tumi is not withheld as an advanced topic; it gets the unit whose subject
  // *is* the contrast, so the learner meets both levels together.
  const tumiUnit = pack.units.find((unit) => unit.unit === tumi);
  assert.ok(
    [...(tumiUnit?.vocabulary ?? []), ...(tumiUnit?.phrase_patterns ?? [])].some(
      (item) => item.register === "apni",
    ),
    "the unit that introduces tumi should show apni beside it",
  );
});

test("every item declares the level of address it belongs to", () => {
  for (const item of items) {
    assert.ok(
      item.register === "apni" || item.register === "tumi" || item.register === "neutral",
      `${item.id} has no register`,
    );
  }
});

test("a receptive item is never something the learner is asked to say", () => {
  // Host language, driver language, shopkeeper language: understood at speed,
  // never performed. If one of these turns up in a production question the
  // course is asking the learner to say a line only the other person says.
  const receptive = new Set(
    items.filter((item) => item.receptive).map((item) => item.id),
  );

  assert.ok(receptive.size > 0, "the course should mark some language receptive");

  const productionTypes = new Set(["produce", "complete", "order", "translate"]);

  for (const lesson of lessons) {
    for (const step of buildLessonSteps(lesson, {})) {
      const phraseId = (step as { phrase?: { id: string } }).phrase?.id;

      if (phraseId && receptive.has(phraseId)) {
        assert.ok(
          !productionTypes.has(step.type),
          `${lesson.id}: ${step.type} on receptive item ${phraseId}`,
        );
      }
    }
  }
});

test("a lesson's title is free of the machinery that builds it", () => {
  // Deriving the recipe from the title is what forced every unit to be a
  // visible march of Discover / Build / Grammar / Listen. Kinds are declared
  // now, so the names can be about the language instead.
  const machinery = /^(discover|build|grammar focus|listen and (understand|speak)|use in context|unit review|capstone|scenario|story)$/i;

  for (const unit of pack.units) {
    for (const lesson of unit.lesson_sequence) {
      assert.ok(lesson.kind, `${unit.id}/${lesson.lesson_index} has no declared kind`);
      assert.ok(
        !machinery.test(lesson.name.trim()),
        `${unit.id}/${lesson.lesson_index} is called "${lesson.name}"`,
      );
    }
  }

  // Nor should the course be the same six lessons fourteen times over.
  const shapes = new Set(
    pack.units.map((unit) =>
      unit.lesson_sequence.map((lesson) => lesson.kind).join(">"),
    ),
  );

  assert.ok(shapes.size > 8, `only ${shapes.size} distinct unit shapes across the course`);
});

test("a lesson teaches the items it says it teaches", () => {
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  for (const unit of pack.units) {
    for (const packLesson of unit.lesson_sequence) {
      const declared = packLesson.teaches ?? [];

      if (declared.length === 0) {
        continue;
      }

      const lesson = byId.get(`${unit.id}-l${packLesson.lesson_index}`);
      assert.ok(lesson, `${unit.id}-l${packLesson.lesson_index} was not built`);

      assert.deepEqual(
        [...(lesson?.plan?.newPhraseIds ?? [])].sort(),
        [...declared].sort(),
        `${lesson?.id} ("${packLesson.name}") teaches something else`,
      );
    }
  }
});

test("later lessons carry more old material than new", () => {
  // The cumulative promise, measured rather than asserted: by the end of the
  // course a lesson should be mostly retrieval.
  const last = lessons.slice(-12);

  for (const lesson of last) {
    const fresh = lesson.plan?.newPhraseIds.length ?? 0;
    const old = lesson.plan?.reviewPhraseIds.length ?? 0;

    assert.ok(old > fresh, `${lesson.id}: ${fresh} new against ${old} revisited`);
  }
});

test("every unit after the first brings back an earlier one", () => {
  for (const lesson of lessons) {
    const unitNumber = Number(lesson.id.match(/-u(\d+)-/)?.[1] ?? 0);

    if (unitNumber <= 1) {
      continue;
    }

    assert.ok(
      (lesson.plan?.interleavedPhraseIds?.length ?? 0) > 0,
      `${lesson.id} revisits nothing from an earlier unit`,
    );
  }
});
