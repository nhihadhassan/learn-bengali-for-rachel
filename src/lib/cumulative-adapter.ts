/**
 * The parts of a cumulative-course adapter that are not about any one language.
 *
 * `spanish-curriculum.ts` grew these first, against a pack whose fields are
 * named `spanish`. When the Bengali course became cumulative too, the choice
 * was to copy four hundred lines or to notice that only the *field names*
 * differed: choosing a unit's grammar focus, hanging authored blocks off the
 * lessons that want them, and turning authored JSON into the app's
 * `{ target, english }` shapes are the same work in either language.
 *
 * So each adapter maps its own pack into the neutral shapes below and everything
 * downstream is shared. Nothing here reads a lexicon or a rule file directly:
 * the resolver and the rule language are passed in, which is what keeps this
 * module honest about being language-agnostic.
 */

import {
  allGrammarRules,
  countPatternEncounters,
  findGrammarRule,
  getGrammarRule,
  toGrammarFocus,
  type GrammarFocusOptions,
  type GrammarLanguage,
} from "@/lib/grammar-drills";
import type { KnownWordResolver } from "@/lib/curriculum-plan";
import type {
  ChoiceQuestion,
  DialogueScript,
  GrammarFocus,
  LanguagePattern,
  NoticeCard,
  StoryScript,
} from "@/types/learning";

/** A line of authored language, in whatever language the pack teaches. */
export type AuthoredLine = {
  target: string;
  english: string;
  /** The learner only has to understand this one, never produce it. */
  receptive?: boolean;
  /** Shown under a discovery example: what to notice about it. */
  note?: string;
};

export type AuthoredChoice = {
  prompt: string;
  options: string[];
  answer: string;
  explanation?: string;
  concepts?: string[];
};

export type AuthoredDialogue = {
  id?: string;
  scenario: string;
  turns: Array<{
    speaker?: string;
    prompt: AuthoredLine;
    reply: AuthoredLine;
    distractors?: string[];
  }>;
};

export type AuthoredNotice = {
  id: string;
  title: string;
  examples: AuthoredLine[];
  question: AuthoredChoice;
};

export type AuthoredStory = {
  id: string;
  title: string;
  setup?: string;
  lines: AuthoredLine[];
  questions: AuthoredChoice[];
};

export type AuthoredPattern = {
  id: string;
  template: string;
  english: string;
  fills: Array<{ target: string; english: string }>;
  concepts?: string[];
};

/** A phrase as the readability and evidence checks want to see it. */
export type SeenPhrase = { romanized: string; english: string };

/** The shape `@/lib/grammar-drills` exposes for an authored rule. */
type RawGrammarRule = NonNullable<ReturnType<typeof getGrammarRule>>;

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

export type GrammarChoiceInput = {
  /** The unit's explicit `grammar_focus`, when it declares one. */
  authoredId?: string;
  /** The unit's `grammar_targets`, used to rank a fallback. */
  targets?: string[];
  /** Which language's rules may be considered. */
  language: GrammarLanguage;
};

export type GrammarChoiceContext = {
  knownWords: ReadonlySet<string>;
  seenPhrases: ReadonlyArray<SeenPhrase>;
  unitPhrases: ReadonlyArray<SeenPhrase>;
  resolveKnown?: KnownWordResolver;
};

/**
 * Which grammar point a unit's grammar lesson teaches.
 *
 * A unit may declare `grammar_focus` explicitly, chosen from what its own
 * language demonstrates. That replaced picking
 * `grammar_targets[(unitNumber - 1) % targets.length]`, which is how a
 * greetings unit ended up teaching noun gender.
 *
 * Two things still stand between an authored choice and the learner: the rule
 * must have enough examples behind it, and the card it produces must be
 * readable with the vocabulary the learner has. If the authored focus fails the
 * gate, the best-supported alternative from the unit's declared targets is used
 * instead.
 *
 * Un-authored units do not rotate either. Their declared targets are ranked by
 * **how much the unit's own sentences demonstrate each one**, which is the same
 * question a person answers when authoring a focus by hand — just asked of the
 * data.
 */
export function chooseGrammarFocus(
  input: GrammarChoiceInput,
  context: GrammarChoiceContext,
): GrammarFocus | undefined {
  const focusOptions: GrammarFocusOptions = {
    knownWords: context.knownWords,
    resolveKnown: context.resolveKnown,
    unitPhrases: context.unitPhrases,
  };

  const candidates: RawGrammarRule[] = [];
  const authored = input.authoredId ? getGrammarRule(input.authoredId) : undefined;

  if (authored) {
    candidates.push(authored);
  }

  // Fallback for un-authored units: rank the declared targets by the evidence
  // this unit puts in front of the learner. Ties keep the pack's own order, so
  // the result is deterministic.
  const ranked = (input.targets ?? [])
    .map((target, index) => ({ rule: findGrammarRule(target, input.language), index }))
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

  // Some units declare targets their own sentences never show. Rather than
  // explain a pattern that is nowhere on screen, look across every authored
  // rule *for this language* for one this unit genuinely demonstrates.
  if (!authored && ranked[0]?.evidence === 0) {
    const observed = allGrammarRules(input.language)
      .map((rule) => ({ rule, evidence: countPatternEncounters(rule, context.unitPhrases) }))
      .filter((entry) => entry.evidence > 0)
      .sort((a, b) => b.evidence - a.evidence || a.rule.id.localeCompare(b.rule.id));

    // Ahead of the evidence-free declared targets, behind nothing else.
    candidates.unshift(
      ...observed.map((entry) => entry.rule).filter((rule) => !candidates.includes(rule)),
    );
  }

  const isReady = (rule: RawGrammarRule) =>
    rule === authored
      ? countPatternEncounters(rule, context.unitPhrases) >= MIN_AUTHORED_ENCOUNTERS
      : countPatternEncounters(rule, context.seenPhrases) >= MIN_PATTERN_ENCOUNTERS;

  // Candidate order *is* the priority: the authored focus first, then the
  // ranking. The readiness gate filters, it does not reorder — letting a merely
  // ready rule jump the queue is how a unit ends up explaining articles instead
  // of the pattern it was authored for.
  for (const rule of candidates) {
    if (!isReady(rule)) {
      continue;
    }

    const focus = toGrammarFocus(rule, focusOptions);

    // An authored rule is trusted with a single illustration; a rule picked by
    // the fallback has to show at least two, or it isn't teaching.
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

/** Lesson kinds that hold a conversation. */
export function wantsDialogue(kind: string): boolean {
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
export function pickAuthored<T>(
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

export function toChoiceQuestion(question: AuthoredChoice): ChoiceQuestion {
  return {
    prompt: question.prompt,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    concepts: question.concepts,
  };
}

export function toNoticeCards(notices: AuthoredNotice[] | undefined): NoticeCard[] | undefined {
  if (!notices?.length) {
    return undefined;
  }

  return notices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    examples: notice.examples.map((example) => ({
      target: example.target,
      english: example.english,
      note: example.note,
    })),
    question: toChoiceQuestion(notice.question),
  }));
}

export function toStoryScripts(stories: AuthoredStory[] | undefined): StoryScript[] | undefined {
  if (!stories?.length) {
    return undefined;
  }

  return stories.map((story) => ({
    id: story.id,
    title: story.title,
    setup: story.setup,
    lines: story.lines.map((line) => ({
      target: line.target,
      english: line.english,
      receptive: line.receptive,
    })),
    questions: story.questions.map(toChoiceQuestion),
  }));
}

export function toDialogueScript(
  dialogue: AuthoredDialogue | undefined,
): DialogueScript | undefined {
  if (!dialogue?.turns?.length) {
    return undefined;
  }

  return {
    scenario: dialogue.scenario,
    turns: dialogue.turns.map((turn) => ({
      speaker: turn.speaker,
      prompt: {
        target: turn.prompt.target,
        english: turn.prompt.english,
        receptive: turn.prompt.receptive,
      },
      reply: { target: turn.reply.target, english: turn.reply.english },
      distractors: turn.distractors,
    })),
  };
}

/** The pack writes a slot as `{}`; the app's type keeps that shape. */
export function toPatterns(
  patterns: AuthoredPattern[] | undefined,
): LanguagePattern[] | undefined {
  if (!patterns?.length) {
    return undefined;
  }

  return patterns.map((pattern) => ({
    id: pattern.id,
    template: pattern.template,
    english: pattern.english,
    fills: pattern.fills.map((fill) => ({ target: fill.target, english: fill.english })),
    concepts: pattern.concepts,
  }));
}
