/**
 * Bengali Curriculum v2 — the course as an app path.
 *
 * **What this replaces.** The original Bengali course was a phrase book: eight
 * units, sixteen lessons, ninety-six phrases, each lesson teaching its own six
 * items and then never mentioning them again. It had no grammar, no
 * conversation, nothing brought back from an earlier unit, and no reason for
 * lesson 2 to feel different from lesson 1.
 *
 * **What it is now.** The same methods the Spanish course was rebuilt with,
 * applied here: a sequenced pack (`content/bengali-curriculum.json`) whose units
 * declare their own lesson sequences, planned cumulatively by
 * `@/lib/curriculum-plan` so every lesson introduces a few items and retrieves
 * older ones, with discovery cards, stories, dialogues, sentence frames and
 * named grammar authored per unit and a scaffold level that falls away across
 * the course.
 *
 * **Why the old file stays.** `content/learn-bengali.json` is not edited, so
 * `FEATURES.bengaliCurriculumV2` is a real rollback rather than a hiding place:
 * off, the course is the original eight units, byte for byte.
 *
 * **Why ids are reused.** Where a v2 unit teaches something v1 also taught, it
 * keeps that item's id. Spaced-repetition memory, the word bank and mistake
 * history are keyed by phrase id, so a learner who already knows `dhonnobad`
 * does not start it again from zero. Lesson ids are new, so the *lessons* read
 * as fresh — which is what you want from a course you intend to replay.
 */

import rawCourse from "../../content/bengali-curriculum.json";
import { getCapabilities } from "@/lib/courses";
import {
  createReviewQueues,
  planUnit,
  taughtWordSet,
  toLessonKind,
  toLessonPlan,
  type PlanItem,
  type PlanUnit,
  type PlannedLesson,
} from "@/lib/curriculum-plan";
import {
  chooseGrammarFocus,
  pickAuthored,
  toDialogueScript,
  toNoticeCards,
  toPatterns,
  toStoryScripts,
  wantsDialogue,
  type AuthoredDialogue,
  type AuthoredNotice,
  type AuthoredPattern,
  type AuthoredStory,
  type SeenPhrase,
} from "@/lib/cumulative-adapter";
import { FEATURES } from "@/lib/feature-flags";
import { getGrammarRule } from "@/lib/grammar-drills";
import { isKnownForm } from "@/lib/bengali-lexicon";
import type { CefrBand } from "@/lib/lesson-profiles";
import type { GrammarFocus, Lesson, Phrase, ScaffoldLevel, Unit } from "@/types/learning";

/** A line of the pack, before it is mapped to the neutral authored shape. */
type PackLine = { bengali: string; english: string; receptive?: boolean; note?: string };

type PackChoice = {
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
  concepts?: string[];
};

type PackVocabulary = {
  id: string;
  bengali: string;
  script: string;
  english: string;
  part_of_speech: string;
  pronunciation?: string;
  emoji?: string;
  /** Understood, not produced. See `Phrase.receptive`. */
  receptive?: boolean;
  /**
   * Which level of address this item belongs to, or `neutral` for the words
   * that have none (nouns, numbers, place names). Carried so the audit can
   * prove a lesson does not teach `apni kemon achen?` and `tomar naam` in the
   * same breath — the mixing this course exists to stop.
   */
  register?: BengaliRegister;
  /** A sentence, in language the learner already has, that uses the word. */
  context_bn?: string;
  context_script?: string;
  context_en?: string;
};

/**
 * Bengali chooses a level of address in almost every sentence with a person in
 * it, and choosing wrong is how a correct sentence lands badly. The course
 * teaches `apni` first — it is what a learner needs for strangers, elders,
 * shopkeepers, hosts and drivers, which is every conversation they will have
 * before they have friends — and gives `tumi` its own unit rather than letting
 * it leak in early.
 */
export type BengaliRegister = "apni" | "tumi" | "neutral";

type PackPhrase = {
  id: string;
  bengali: string;
  script: string;
  english: string;
  pronunciation?: string;
  emoji?: string;
  /** Understood, not produced. See `Phrase.receptive`. */
  receptive?: boolean;
  /** Which level of address this phrase belongs to. See `BengaliRegister`. */
  register?: BengaliRegister;
  context_bn?: string;
  context_script?: string;
  context_en?: string;
};

type PackLesson = {
  lesson_index: number;
  /** The title the learner reads. Not the recipe — see `kind`. */
  name: string;
  /**
   * Which lesson recipe to run. Explicit, so a lesson can be called "Your
   * First Greeting" without the course turning into a visible march of
   * Discover / Build / Grammar / Listen.
   */
  kind?: string;
  goal: string;
  /**
   * The items this lesson introduces, by id. A lesson that names them teaches
   * exactly those; one that does not is scheduled by the planner.
   */
  teaches?: string[];
  /** Narrow per-lesson profile adjustments. See `LessonShape`. */
  shape?: {
    dialogue_turns?: number;
    review_questions?: number;
    practice_questions?: number;
  };
  uses?: { notices?: string[]; stories?: string[]; dialogues?: string[] };
};

type PackUnit = {
  id: string;
  section: number;
  unit: number;
  title: string;
  cefr: string;
  objective: string;
  scaffold?: ScaffoldLevel;
  grammar_targets?: string[];
  grammar_focus?: string;
  vocabulary: PackVocabulary[];
  phrase_patterns: PackPhrase[];
  patterns?: Array<{
    id: string;
    template: string;
    english: string;
    fills: Array<{ bengali: string; english: string }>;
    concepts?: string[];
  }>;
  notices?: Array<{
    id: string;
    title: string;
    examples: PackLine[];
    question: PackChoice;
  }>;
  stories?: Array<{
    id: string;
    title: string;
    setup?: string;
    lines: PackLine[];
    questions: PackChoice[];
  }>;
  dialogues?: Array<{
    id?: string;
    scenario: string;
    turns: Array<{
      speaker?: string;
      prompt: PackLine;
      reply: PackLine;
      distractors?: string[];
    }>;
  }>;
  lesson_sequence: PackLesson[];
};

type PackCourse = {
  course_id: string;
  version: string;
  legal_note: string;
  sections: Array<{ section: number; title: string; description: string }>;
  units: PackUnit[];
};

const course = rawCourse as unknown as PackCourse;

/** The pack's CEFR labels, as the profile table knows them. */
const CEFR_BANDS: Record<string, CefrBand | undefined> = {
  Intro: "Intro",
  A1: "A1",
  A2: "A2",
  B1: "B1",
};

const CEFR_DIFFICULTY: Record<string, string> = {
  Intro: "Intro",
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
};

const cumulativeEnabled =
  FEATURES.cumulativeLessons &&
  getCapabilities("bengali").lessonStrategy === "cumulative";

function line(item: PackLine) {
  return {
    target: item.bengali,
    english: item.english,
    receptive: item.receptive,
    note: item.note,
  };
}

function vocabularyPhrase(item: PackVocabulary): Phrase {
  return {
    id: item.id,
    romanized: item.bengali,
    bengaliScript: item.script,
    english: item.english,
    pronunciation: item.pronunciation ?? "",
    emoji: item.emoji,
    // Host language, driver language, shopkeeper language: understood at speed,
    // never performed. The ladder keeps these out of production formats.
    receptive: item.receptive,
    // A word introduced inside a sentence the learner can already mostly read
    // is met the way words are actually met. The gloss is still there; it is
    // just no longer the whole teach card.
    context:
      item.context_bn && item.context_en
        ? { target: item.context_bn, english: item.context_en }
        : undefined,
    // Part of speech doubles as the semantic grouping distractor selection
    // uses, so a noun is offered against other nouns.
    category: item.part_of_speech || "vocabulary",
  };
}

function patternPhrase(item: PackPhrase): Phrase {
  return {
    id: item.id,
    romanized: item.bengali,
    bengaliScript: item.script,
    english: item.english,
    pronunciation: item.pronunciation ?? "",
    emoji: item.emoji,
    receptive: item.receptive,
    context:
      item.context_bn && item.context_en
        ? { target: item.context_bn, english: item.context_en }
        : undefined,
    category: "phrase",
  };
}

/** Every phrase in the course, keyed by id — review reaches across units. */
const phraseById = new Map<string, Phrase>();

const orderedUnits: PackUnit[] = [...course.units].sort(
  (a, b) => a.section - b.section || a.unit - b.unit,
);

for (const unit of orderedUnits) {
  for (const item of unit.vocabulary) {
    phraseById.set(item.id, vocabularyPhrase(item));
  }
  for (const item of unit.phrase_patterns) {
    phraseById.set(item.id, patternPhrase(item));
  }
}

/** The pack unit as the planner sees it: ids, text and item type. */
function toPlanUnit(unit: PackUnit, unitNumber: number): PlanUnit {
  const items: PlanItem[] = [
    ...unit.vocabulary.map((item) => ({
      id: item.id,
      text: item.bengali,
      kind: "vocabulary" as const,
    })),
    ...unit.phrase_patterns.map((item) => ({
      id: item.id,
      text: item.bengali,
      kind: "phrase" as const,
    })),
  ];

  return { id: unit.id, number: unitNumber, items };
}

function toAuthoredNotices(unit: PackUnit): AuthoredNotice[] | undefined {
  return unit.notices?.map((notice) => ({
    id: notice.id,
    title: notice.title,
    examples: notice.examples.map(line),
    question: notice.question,
  }));
}

function toAuthoredStories(unit: PackUnit): AuthoredStory[] | undefined {
  return unit.stories?.map((story) => ({
    id: story.id,
    title: story.title,
    setup: story.setup,
    lines: story.lines.map(line),
    questions: story.questions,
  }));
}

function toAuthoredDialogues(unit: PackUnit): AuthoredDialogue[] | undefined {
  return unit.dialogues?.map((dialogue) => ({
    id: dialogue.id,
    scenario: dialogue.scenario,
    turns: dialogue.turns.map((turn) => ({
      speaker: turn.speaker,
      prompt: line(turn.prompt),
      reply: line(turn.reply),
      distractors: turn.distractors,
    })),
  }));
}

function toAuthoredPatterns(unit: PackUnit): AuthoredPattern[] | undefined {
  return unit.patterns?.map((pattern) => ({
    id: pattern.id,
    template: pattern.template,
    english: pattern.english,
    fills: pattern.fills.map((fill) => ({ target: fill.bengali, english: fill.english })),
    concepts: pattern.concepts,
  }));
}

/**
 * The lesson's working set: what it introduces, then what it brings back.
 * Everything downstream — the word bank, the "phrases you'll meet" card,
 * encountered-phrase tracking — reads `lesson.phrases`, so the plan's ids have
 * to resolve into it.
 */
function resolvePhrases(ids: readonly string[]): Phrase[] {
  const seen = new Set<string>();
  const phrases: Phrase[] = [];

  for (const id of ids) {
    const phrase = phraseById.get(id);

    if (phrase && !seen.has(id)) {
      seen.add(id);
      phrases.push(phrase);
    }
  }

  return phrases;
}

/**
 * The pre-plan behaviour: the unit's own items, in order.
 *
 * Kept as the fallback for when `FEATURES.cumulativeLessons` is off, so the
 * flag restores a working phrase-book course rather than an empty one.
 */
const TAUGHT_WINDOW = 5;

function rotatedPhrases(unit: PackUnit, lesson: PackLesson): Phrase[] {
  const combined = [
    ...unit.phrase_patterns.map(patternPhrase),
    ...unit.vocabulary.map(vocabularyPhrase),
  ];

  if (combined.length === 0) {
    return combined;
  }

  const offset = ((lesson.lesson_index - 1) * TAUGHT_WINDOW) % combined.length;
  return [...combined.slice(offset), ...combined.slice(0, offset)];
}

/** How many lessons of each kind have already claimed an authored block. */
type BlockCursor = { dialogue: number; notice: number; story: number };

function adaptLesson(
  unit: PackUnit,
  packLesson: PackLesson,
  unitNumber: number,
  planned: PlannedLesson | undefined,
  grammar: GrammarFocus | undefined,
  cursor: BlockCursor,
): Lesson {
  const base = {
    id: `${unit.id}-l${packLesson.lesson_index}`,
    unitId: unit.id,
    unitNumber,
    title: packLesson.name,
    difficulty: CEFR_DIFFICULTY[unit.cefr] ?? unit.cefr,
    summary: packLesson.goal,
    exercises: [],
    curriculumId: "bengali" as const,
    locale: "bn-BD",
    objectives: [packLesson.goal],
  };

  if (!planned) {
    return { ...base, phrases: rotatedPhrases(unit, packLesson) };
  }

  const kind = toLessonKind(packLesson.name, packLesson.lesson_index, packLesson.kind);
  const lessonGrammar = kind === "grammar" ? grammar : undefined;

  const dialogue = wantsDialogue(kind)
    ? toDialogueScript(
        pickAuthored(toAuthoredDialogues(unit), packLesson.uses?.dialogues, cursor.dialogue++)?.[0],
      )
    : undefined;
  const notices =
    kind === "notice"
      ? toNoticeCards(
          pickAuthored(toAuthoredNotices(unit), packLesson.uses?.notices, cursor.notice++),
        )
      : undefined;
  const stories =
    kind === "story" || kind === "capstone"
      ? toStoryScripts(
          pickAuthored(toAuthoredStories(unit), packLesson.uses?.stories, cursor.story++),
        )
      : undefined;

  const plan = toLessonPlan(planned, {
    grammar: lessonGrammar,
    dialogue,
    patterns: toPatterns(toAuthoredPatterns(unit)),
    notices,
    stories,
    band: CEFR_BANDS[unit.cefr],
    scaffold: unit.scaffold,
    shape: packLesson.shape
      ? {
          maxDialogueTurns: packLesson.shape.dialogue_turns,
          reviewQuestionTarget: packLesson.shape.review_questions,
          practiceQuestions: packLesson.shape.practice_questions,
        }
      : undefined,
  });

  return {
    ...base,
    phrases: resolvePhrases([...plan.newPhraseIds, ...plan.reviewPhraseIds]),
    plan,
    // Rendered by the lesson intro's "What you'll learn" panel.
    grammar: lessonGrammar
      ? [{ point: lessonGrammar.title, notes: lessonGrammar.explanation }]
      : undefined,
  };
}

const sectionByNumber = new Map(
  course.sections.map((section) => [
    section.section,
    { number: section.section, title: section.title, description: section.description },
  ]),
);

function adaptUnit(
  unit: PackUnit,
  unitNumber: number,
  plannedLessons: PlannedLesson[] | undefined,
  grammar: GrammarFocus | undefined,
): Unit {
  const cursor: BlockCursor = { dialogue: 0, notice: 0, story: 0 };

  return {
    id: unit.id,
    number: unitNumber,
    title: unit.title,
    description: unit.objective,
    section: sectionByNumber.get(unit.section),
    lessons: unit.lesson_sequence.map((lesson, index) =>
      adaptLesson(unit, lesson, unitNumber, plannedLessons?.[index], grammar, cursor),
    ),
    metadata: {
      difficultyBand: CEFR_DIFFICULTY[unit.cefr] ?? unit.cefr,
      estimatedTotalMinutes: unit.lesson_sequence.length * 5,
      tags: unit.grammar_targets ?? [],
    },
  };
}

/**
 * The words the unit's grammar lesson is built around, so the planner can make
 * sure the learner meets them before that lesson explains them.
 */
function grammarWordsFor(unit: PackUnit): string[] {
  const rule = unit.grammar_focus ? getGrammarRule(unit.grammar_focus) : undefined;
  return (rule?.markerGroups ?? []).flat();
}

/** Every word a taught item gives the learner; see `taughtWordSet`. */
function contentWordsOf(text: string): string[] {
  return [...taughtWordSet(text)];
}

function buildUnits(): Unit[] {
  const planUnits = orderedUnits.map((unit, index) => toPlanUnit(unit, index + 1));
  // Shared across the course so the cursor into an old unit's material is
  // continuous: every later unit that reaches back to unit 2 picks up where the
  // last one left off instead of re-drawing the same few items.
  const reviewQueues = createReviewQueues();

  // Walked in path order so each unit sees exactly what the learner has met
  // before it: the words that make an example readable, and the phrases that
  // decide whether a pattern has been seen often enough to name.
  const knownWords = new Set<string>();
  const seenPhrases: SeenPhrase[] = [];

  return orderedUnits.map((unit, index) => {
    const planned = cumulativeEnabled
      ? planUnit(planUnits[index], planUnits.slice(0, index), {
          lessonKinds: unit.lesson_sequence.map((lesson) =>
            toLessonKind(lesson.name, lesson.lesson_index, lesson.kind),
          ),
          sharedQueues: reviewQueues,
          resolveKnown: isKnownForm,
          grammarWords: grammarWordsFor(unit),
          assignedItems: unit.lesson_sequence.map(
            (lesson) => lesson.teaches ?? [],
          ),
          // Fourteen units, not a hundred and thirty-one: this course has far
          // fewer chances to bring a word back, so each one has to carry more.
          interleaveScale: 3,
        })
      : undefined;

    const byId = new Map<string, SeenPhrase>();
    for (const item of unit.vocabulary) {
      byId.set(item.id, { romanized: item.bengali, english: item.english });
    }
    for (const item of unit.phrase_patterns) {
      byId.set(item.id, { romanized: item.bengali, english: item.english });
    }

    // What the learner knows *when the grammar lesson runs* — not what the unit
    // will eventually have taught. A card shown in lesson 3 may only use the
    // items lessons 1-3 introduced, which is a stricter and more honest bar.
    const grammarIndex = planned?.findIndex((lesson) => lesson.kind === "grammar") ?? -1;
    const introducedByGrammar = (planned ?? [])
      .slice(0, grammarIndex >= 0 ? grammarIndex + 1 : 0)
      .flatMap((lesson) => lesson.newPhraseIds)
      .map((id) => byId.get(id))
      .filter((item): item is SeenPhrase => Boolean(item));

    const knownAtGrammar = new Set(knownWords);
    for (const item of introducedByGrammar) {
      for (const word of contentWordsOf(item.romanized)) {
        knownAtGrammar.add(word);
      }
    }

    // A unit need not contain a grammar lesson at all — grammar arrives when a
    // unit has demonstrated something worth naming, not because a slot is
    // called "Grammar focus".
    const grammar =
      cumulativeEnabled && grammarIndex >= 0
        ? chooseGrammarFocus(
            {
              authoredId: unit.grammar_focus,
              targets: unit.grammar_targets,
              language: "bengali",
            },
            {
              knownWords: knownAtGrammar,
              seenPhrases: [...seenPhrases, ...introducedByGrammar],
              unitPhrases: introducedByGrammar,
              resolveKnown: isKnownForm,
            },
          )
        : undefined;

    const unitPhrases = [...byId.values()];
    for (const item of unitPhrases) {
      for (const word of contentWordsOf(item.romanized)) {
        knownWords.add(word);
      }
    }
    seenPhrases.push(...unitPhrases);

    return adaptUnit(unit, index + 1, planned, grammar);
  });
}

/** The Bengali course as app units, in path order. */
export const bengaliCurriculumUnits: Unit[] = buildUnits();

export const bengaliCourseMeta = {
  id: course.course_id,
  version: course.version,
  legalNote: course.legal_note,
};
