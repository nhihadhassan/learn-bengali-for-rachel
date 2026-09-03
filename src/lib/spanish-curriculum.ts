// Adapts the research-grounded Spanish curriculum pack
// (content/spanish-curriculum.json) into the app's Unit/Lesson/Phrase shape so
// the lesson engine can generate exercises from it. The pack's own pipeline
// (src/curriculum/*) validates and seeds the data; this module is the thin
// read-side bridge that makes those 131 units playable in the UI.
//
// It is also where the course stops being a phrase book. The pack gives every
// lesson in a unit the *same* content focus, so this adapter used to rotate a
// five-item window over it — six lessons, five items each, and nothing from an
// earlier unit ever coming back. It now asks `@/lib/curriculum-plan` for a
// cumulative schedule instead: which few items each lesson introduces, and
// which previously-met items it should bring back. See `Lesson.plan`.

import rawCourse from "../../content/spanish-curriculum.json";
import type {
  Course,
  Lesson as PackLesson,
  Unit as PackUnit,
} from "@/curriculum/types";
import { getCapabilities } from "@/lib/courses";
import type { CefrBand } from "@/lib/lesson-profiles";
import {
  createReviewQueues,
  planUnit,
  toLessonKind,
  toLessonPlan,
  type PlanItem,
  type PlanUnit,
  type PlannedLesson,
} from "@/lib/curriculum-plan";
import { FEATURES } from "@/lib/feature-flags";
import { taughtWordSet } from "@/lib/curriculum-plan";
import {
  allGrammarRules,
  countPatternEncounters,
  findGrammarRule,
  getGrammarRule,
  toGrammarFocus,
  type GrammarFocusOptions,
} from "@/lib/grammar-drills";
import { isKnownForm } from "@/lib/spanish-lexicon";
import {
  PILOT_UNIT_COUNT,
  pilotSection,
  pilotUnits,
  type PilotChoice,
  type PilotDialogue,
  type PilotLessonUses,
  type PilotNotice,
  type PilotStory,
  type PilotUnit,
  type PilotVocabulary,
} from "@/lib/spanish-pilot";
import type {
  ChoiceQuestion,
  DialogueScript,
  GrammarFocus,
  LanguagePattern,
  Lesson,
  NoticeCard,
  Phrase,
  ScaffoldLevel,
  StoryScript,
  Unit,
} from "@/types/learning";

const course = rawCourse as unknown as Course;

/** Authored dialogue, when a unit has one (see the pack schema's `dialogue`). */
type PackDialogue = {
  /** Present on pilot dialogues, so a lesson can ask for one by name. */
  id?: string;
  scenario: string;
  turns: Array<{
    speaker?: string;
    prompt: { spanish: string; english: string; receptive?: boolean };
    reply: { spanish: string; english: string };
    distractors?: string[];
  }>;
};

type PackPattern = {
  id: string;
  template: string;
  english: string;
  fills: Array<{ spanish: string; english: string }>;
  concepts?: string[];
};

/**
 * A unit as this adapter reads it: the pack's own shape, plus the optional
 * fields the pilot units add. One type for both halves of the course is what
 * lets the planner walk them in a single pass — which is what keeps Unit 13's
 * interleaved review working against pilot units.
 */
type PackUnitWithExtras = Omit<
  PackUnit,
  "vocabulary" | "lesson_sequence" | "unit_assessment" | "provenance" | "review_schedule_days"
> & {
  vocabulary: PilotVocabulary[];
  lesson_sequence: Array<
    Pick<PackLesson, "lesson_index" | "name" | "goal"> & { uses?: PilotLessonUses }
  >;
  dialogue?: PackDialogue;
  /** Several short exchanges, so more than one lesson can hold a conversation. */
  dialogues?: PilotDialogue[];
  patterns?: PackPattern[];
  notices?: PilotNotice[];
  stories?: PilotStory[];
  /** Explicit grammar rule id; see `grammarFocusFor`. */
  grammar_focus?: string;
  /** How much support this unit gives; see `ScaffoldLevel`. */
  scaffold?: ScaffoldLevel;
  objective?: string;
};

/** The shape `@/lib/grammar-drills` exposes for an authored rule. */
type RawGrammarRule = NonNullable<ReturnType<typeof getGrammarRule>>;

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
  B2: "Upper intermediate",
};

const cumulativeEnabled =
  FEATURES.cumulativeLessons &&
  getCapabilities("spanish").lessonStrategy === "cumulative";

function vocabularyPhrase(item: PilotVocabulary): Phrase {
  return {
    id: item.id,
    romanized: item.spanish,
    english: item.english,
    pronunciation: "",
    emoji: item.emoji,
    // A word introduced inside a sentence the learner can already mostly read
    // is met the way words are actually met. The gloss is still there; it is
    // just no longer the whole teach card.
    context:
      item.context_es && item.context_en
        ? { target: item.context_es, english: item.context_en }
        : undefined,
    // Part of speech doubles as the semantic grouping distractor selection
    // uses, so a noun is offered against other nouns.
    category: item.part_of_speech || "vocabulary",
  };
}

function patternPhrase(item: PackUnit["phrase_patterns"][number]): Phrase {
  return {
    id: item.id,
    romanized: item.spanish,
    english: item.english,
    pronunciation: "",
    category: "phrase",
  };
}

/** Every phrase in the course, keyed by id — review reaches across units. */
const phraseById = new Map<string, Phrase>();

const packUnits: PackUnitWithExtras[] = [...course.units].sort(
  (a, b) => a.section - b.section || a.unit - b.unit,
) as unknown as PackUnitWithExtras[];

/**
 * The path: the pilot's twelve units, then the pack's units 13 onward.
 *
 * The tail is spliced rather than filtered so the seam is a position, not a
 * list of ids — the pilot replaces "the first twelve units of the path",
 * whichever units those happen to be.
 */
const orderedUnits: PackUnitWithExtras[] = FEATURES.spanishPilotV2
  ? [
      ...(pilotUnits as unknown as PackUnitWithExtras[]),
      ...packUnits.slice(PILOT_UNIT_COUNT),
    ]
  : packUnits;

for (const unit of orderedUnits) {
  for (const item of unit.vocabulary) {
    phraseById.set(item.id, vocabularyPhrase(item));
  }
  for (const item of unit.phrase_patterns) {
    phraseById.set(item.id, patternPhrase(item));
  }
}

/** The pack unit as the planner sees it: ids, text and item type. */
function toPlanUnit(unit: PackUnitWithExtras, unitNumber: number): PlanUnit {
  const items: PlanItem[] = [
    ...unit.vocabulary.map((item) => ({
      id: item.id,
      text: item.spanish,
      kind: "vocabulary" as const,
    })),
    ...unit.phrase_patterns.map((item) => ({
      id: item.id,
      text: item.spanish,
      kind: "phrase" as const,
    })),
  ];

  return { id: unit.id, number: unitNumber, items };
}

/**
 * How many phrases must already demonstrate a pattern before it gets explained.
 *
 * Grammar lands when it names something the learner has half-noticed already.
 * Below this many encounters, an explanation is a definition of a thing they
 * have never seen. This is the bar for a rule picked automatically from a
 * unit's declared targets.
 */
const MIN_PATTERN_ENCOUNTERS = 3;

/**
 * An *authored* focus only has to be visible in its own unit.
 *
 * Someone chose that rule for that unit; the gate's job is to catch a pattern
 * with no evidence behind it, not to overrule a teaching decision because a
 * different rule happens to appear more often across the whole course.
 */
const MIN_AUTHORED_ENCOUNTERS = 1;

/**
 * Which grammar point a unit's "Grammar focus" lesson teaches.
 *
 * Sections 1-2 declare `grammar_focus` explicitly, chosen from what the unit's
 * own language demonstrates. That replaced picking
 * `grammar_targets[(unitNumber - 1) % targets.length]`, which is how a
 * greetings unit ended up teaching noun gender and a unit of twelve adjectives
 * ended up teaching articles.
 *
 * Two things still stand between an authored choice and the learner: the rule
 * must have enough examples behind it (`MIN_PATTERN_ENCOUNTERS`), and the card
 * it produces must be readable with the vocabulary they have. If the authored
 * focus fails the gate, the best-supported alternative from the unit's declared
 * targets is used instead.
 *
 * Un-authored units (Sections 3-4) no longer rotate either. Their declared
 * targets are ranked by **how much the unit's own sentences demonstrate each
 * one**, which is the same question a person answers when authoring a focus by
 * hand — just asked of the data. A unit whose phrases are full of `voy a` gets
 * the near-future rule because it earns it, not because of its index.
 */
function grammarFocusFor(
  unit: PackUnitWithExtras,
  context: {
    knownWords: ReadonlySet<string>;
    seenPhrases: ReadonlyArray<{ romanized: string; english: string }>;
    unitPhrases: ReadonlyArray<{ romanized: string; english: string }>;
  },
): GrammarFocus | undefined {
  const focusOptions: GrammarFocusOptions = {
    knownWords: context.knownWords,
    resolveKnown: isKnownForm,
    unitPhrases: context.unitPhrases,
  };

  const candidates: RawGrammarRule[] = [];
  const authored = unit.grammar_focus ? getGrammarRule(unit.grammar_focus) : undefined;

  if (authored) {
    candidates.push(authored);
  }

  // Fallback for un-authored units: rank the declared targets by the evidence
  // this unit puts in front of the learner. Ties keep the pack's own order, so
  // the result is deterministic.
  const targets = unit.grammar_targets ?? [];
  const ranked = targets
    .map((target, index) => ({ rule: findGrammarRule(target), index }))
    .filter((entry): entry is { rule: RawGrammarRule; index: number } => Boolean(entry.rule))
    .map((entry) => ({
      ...entry,
      evidence: countPatternEncounters(entry.rule, context.unitPhrases),
    }))
    .sort((a, b) => b.evidence - a.evidence || a.index - b.index);

  for (const entry of ranked) {
    if (!candidates.includes(entry.rule)) {
      candidates.push(entry.rule);
    }
  }

  // Some units declare targets their own sentences never show — a unit about
  // likes and hobbies declaring "irregular present", for instance. Rather than
  // explain a pattern that is nowhere on screen, look across every authored
  // rule for one this unit genuinely demonstrates.
  if (!authored && ranked[0]?.evidence === 0) {
    const observed = allGrammarRules("spanish")
      .map((rule) => ({
        rule,
        evidence: countPatternEncounters(rule, context.unitPhrases),
      }))
      .filter((entry) => entry.evidence > 0)
      .sort((a, b) => b.evidence - a.evidence || a.rule.id.localeCompare(b.rule.id));

    // Ahead of the evidence-free declared targets, behind nothing else.
    candidates.unshift(...observed.map((entry) => entry.rule).filter((rule) => !candidates.includes(rule)));
  }

  const isReady = (rule: RawGrammarRule) =>
    rule === authored
      ? countPatternEncounters(rule, context.unitPhrases) >= MIN_AUTHORED_ENCOUNTERS
      : countPatternEncounters(rule, context.seenPhrases) >= MIN_PATTERN_ENCOUNTERS;

  // Candidate order *is* the priority: the authored focus first, then the
  // rotation. The readiness gate filters, it does not reorder — letting a
  // merely-ready rule jump the queue is how unit 1 ended up explaining "el and
  // la" instead of the querer pattern it was authored for.
  for (const rule of candidates) {
    if (!isReady(rule)) {
      continue;
    }

    const focus = toGrammarFocus(rule, focusOptions);

    // An authored rule is trusted with a single illustration; a rule picked by
    // the fallback rotation has to show at least two, or it isn't teaching.
    if (focus.examples.length >= (rule === authored ? 1 : 2)) {
      return focus;
    }
  }

  // Nothing has been seen often enough yet. Rather than skip grammar entirely,
  // take the best-illustrated candidate — still in authored-first order.
  for (const rule of candidates) {
    const focus = toGrammarFocus(rule, focusOptions);

    if (focus.examples.length >= 2) {
      return focus;
    }
  }

  return undefined;
}

/** The pack writes a slot as `{}`; the app's type keeps that shape. */
function toPatterns(patterns: PackPattern[] | undefined): LanguagePattern[] | undefined {
  if (!patterns?.length) {
    return undefined;
  }

  return patterns.map((pattern) => ({
    id: pattern.id,
    template: pattern.template,
    english: pattern.english,
    fills: pattern.fills.map((fill) => ({ target: fill.spanish, english: fill.english })),
    concepts: pattern.concepts,
  }));
}

function toChoiceQuestion(question: PilotChoice): ChoiceQuestion {
  return {
    prompt: question.prompt,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    concepts: question.concepts,
  };
}

function toNoticeCards(notices: PilotNotice[] | undefined): NoticeCard[] | undefined {
  if (!notices?.length) {
    return undefined;
  }

  return notices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    examples: notice.examples.map((example) => ({
      target: example.spanish,
      english: example.english,
      note: example.note,
    })),
    question: toChoiceQuestion(notice.question),
  }));
}

function toStoryScripts(stories: PilotStory[] | undefined): StoryScript[] | undefined {
  if (!stories?.length) {
    return undefined;
  }

  return stories.map((story) => ({
    id: story.id,
    title: story.title,
    setup: story.setup,
    lines: story.lines.map((line) => ({
      target: line.spanish,
      english: line.english,
      receptive: line.receptive,
    })),
    questions: story.questions.map(toChoiceQuestion),
  }));
}

/** Lesson kinds that hold a conversation. */
function wantsDialogue(kind: string): boolean {
  return kind === "context" || kind === "scenario" || kind === "capstone";
}

/**
 * Which authored block this lesson gets.
 *
 * A lesson may name what it wants (`uses`), and otherwise the nth lesson that
 * wants a dialogue gets the nth dialogue — so a unit with two conversations
 * spreads them across its two conversation lessons without any wiring, and a
 * unit with one gives that one to whoever asks.
 */
function pickAuthored<T>(
  available: readonly T[] | undefined,
  wanted: string[] | undefined,
  occurrence: number,
): T[] | undefined {
  if (!available?.length) {
    return undefined;
  }

  if (wanted?.length) {
    const chosen = available.filter((item) => {
      const id = (item as { id?: string }).id;
      return id !== undefined && wanted.includes(id);
    });

    return chosen.length > 0 ? chosen : undefined;
  }

  return [available[occurrence % available.length]];
}

function toDialogueScript(dialogue: PackDialogue | undefined): DialogueScript | undefined {
  if (!dialogue?.turns?.length) {
    return undefined;
  }

  return {
    scenario: dialogue.scenario,
    turns: dialogue.turns.map((turn) => ({
      speaker: turn.speaker,
      prompt: {
        target: turn.prompt.spanish,
        english: turn.prompt.english,
        receptive: turn.prompt.receptive,
      },
      reply: { target: turn.reply.spanish, english: turn.reply.english },
      distractors: turn.distractors,
    })),
  };
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
 * The pre-plan behaviour: rotate a five-item window over the unit's focus list.
 * Kept as the fallback for when `FEATURES.cumulativeLessons` is off, which is
 * the documented way to restore the previous experience without a revert.
 */
const TAUGHT_WINDOW = 5;

function rotatedPhrases(
  unit: PackUnitWithExtras,
  lesson: Pick<PackLesson, "lesson_index">,
): Phrase[] {
  const vocab = unit.vocabulary.map(vocabularyPhrase);
  const patterns = unit.phrase_patterns.map(patternPhrase);
  const combined: Phrase[] = [];

  for (let index = 0; index < Math.max(vocab.length, patterns.length); index += 1) {
    if (index < patterns.length) combined.push(patterns[index]);
    if (index < vocab.length) combined.push(vocab[index]);
  }

  if (combined.length === 0) {
    return combined;
  }

  const offset = ((lesson.lesson_index - 1) * TAUGHT_WINDOW) % combined.length;
  return [...combined.slice(offset), ...combined.slice(0, offset)];
}

/** How many lessons of each kind have already claimed an authored block. */
type BlockCursor = { dialogue: number; notice: number; story: number };

function adaptLesson(
  unit: PackUnitWithExtras,
  packLesson: PackUnitWithExtras["lesson_sequence"][number],
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
    curriculumId: "spanish" as const,
    locale: "es",
    objectives: [packLesson.goal],
  };

  if (!planned) {
    return { ...base, phrases: rotatedPhrases(unit, packLesson) };
  }

  const kind = toLessonKind(packLesson.name, packLesson.lesson_index);
  const lessonGrammar = kind === "grammar" ? grammar : undefined;

  // A unit's conversations, discovery cards and stories are handed out to the
  // lessons that want them, in order. The pack's single `dialogue` is the
  // one-conversation case of the same rule.
  const dialogues = unit.dialogues ?? (unit.dialogue ? [unit.dialogue] : undefined);
  const dialogue = wantsDialogue(kind)
    ? toDialogueScript(
        pickAuthored(dialogues, packLesson.uses?.dialogues, cursor.dialogue++)?.[0],
      )
    : undefined;
  const notices =
    kind === "notice"
      ? toNoticeCards(pickAuthored(unit.notices, packLesson.uses?.notices, cursor.notice++))
      : undefined;
  const stories =
    kind === "story" || kind === "capstone"
      ? toStoryScripts(pickAuthored(unit.stories, packLesson.uses?.stories, cursor.story++))
      : undefined;

  const plan = toLessonPlan(planned, {
    grammar: lessonGrammar,
    dialogue,
    patterns: toPatterns(unit.patterns),
    notices,
    stories,
    band: CEFR_BANDS[unit.cefr],
    scaffold: unit.scaffold,
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

/** Section metadata from the pack, keyed by section number. */
const sectionByNumber = new Map(
  [...(course.sections ?? []), ...(FEATURES.spanishPilotV2 ? [pilotSection] : [])].map(
    (section) => [
      section.section,
      {
        number: section.section,
        title: section.title_es,
        description: section.description,
      },
    ],
  ),
);

function adaptUnit(
  unit: PackUnitWithExtras,
  unitNumber: number,
  plannedLessons: PlannedLesson[] | undefined,
  grammar: GrammarFocus | undefined,
): Unit {
  const cursor: BlockCursor = { dialogue: 0, notice: 0, story: 0 };

  return {
    id: unit.id,
    number: unitNumber,
    title: unit.title,
    description: unit.objective ?? unit.communicative_goal,
    // Sections are the course's four big chapters; the path browser uses them
    // to keep 131 units navigable.
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
  const seenPhrases: Array<{ romanized: string; english: string }> = [];

  return orderedUnits.map((unit, index) => {
    const planned = cumulativeEnabled
      ? planUnit(planUnits[index], planUnits.slice(0, index), {
          lessonKinds: unit.lesson_sequence.map((lesson) =>
            toLessonKind(lesson.name, lesson.lesson_index),
          ),
          sharedQueues: reviewQueues,
          resolveKnown: isKnownForm,
          grammarWords: grammarWordsFor(unit),
        })
      : undefined;

    const byId = new Map<string, { romanized: string; english: string }>();
    for (const item of unit.vocabulary) {
      byId.set(item.id, { romanized: item.spanish, english: item.english });
    }
    for (const item of unit.phrase_patterns) {
      byId.set(item.id, { romanized: item.spanish, english: item.english });
    }

    // What the learner knows *when the grammar lesson runs* — not what the unit
    // will eventually have taught. A card shown in lesson 3 may only use the
    // items lessons 1-3 introduced, which is a stricter and more honest bar.
    const grammarIndex = planned?.findIndex((lesson) => lesson.kind === "grammar") ?? -1;
    const introducedByGrammar = (planned ?? [])
      .slice(0, grammarIndex >= 0 ? grammarIndex + 1 : 0)
      .flatMap((lesson) => lesson.newPhraseIds)
      .map((id) => byId.get(id))
      .filter((item): item is { romanized: string; english: string } => Boolean(item));

    const knownAtGrammar = new Set(knownWords);
    for (const item of introducedByGrammar) {
      for (const word of contentWordsOf(item.romanized)) {
        knownAtGrammar.add(word);
      }
    }

    // A pilot unit need not contain a grammar lesson at all — grammar arrives
    // when a unit has demonstrated something worth naming, not because the
    // third slot is called "Grammar focus".
    const grammar = cumulativeEnabled && grammarIndex >= 0
      ? grammarFocusFor(unit, {
          knownWords: knownAtGrammar,
          seenPhrases: [...seenPhrases, ...introducedByGrammar],
          unitPhrases: introducedByGrammar,
        })
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

/**
 * The words the unit's grammar lesson is built around, so the planner can make
 * sure the learner meets them before that lesson explains them.
 */
function grammarWordsFor(unit: PackUnitWithExtras): string[] {
  const rule = unit.grammar_focus ? getGrammarRule(unit.grammar_focus) : undefined;
  return (rule?.markerGroups ?? []).flat();
}

/** Every word a taught item gives the learner; see `taughtWordSet`. */
function contentWordsOf(text: string): string[] {
  return [...taughtWordSet(text)];
}

/** The full research-grounded Spanish course as app units (sorted by section, unit). */
export const spanishCurriculumUnits: Unit[] = buildUnits();

export const spanishCourseMeta = {
  title: course.title,
  version: course.version,
  legalNote: course.legal_note,
};
