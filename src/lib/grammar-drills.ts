/**
 * Turning a grammar rule into practice.
 *
 * The curriculum says *which* pattern a unit is about (`grammar_targets` in the
 * pack, resolved to a rule in `content/spanish-grammar.json`). This module
 * decides *how* to practise it, using sentences the learner has already met.
 *
 * That split is what makes grammar affordable across 131 units: a rule needs
 * one authored entry, not a drill per unit, and the drills it produces are
 * always built from vocabulary the learner has actually seen — so the question
 * tests the pattern rather than a word they've never met.
 *
 * The key idea is `markerGroups`: a confusable set such as
 * `["soy", "eres", "es"]`. A drill blanks whichever member appears in a known
 * sentence and offers the rest of that group as the options. "Ella ___ mi
 * hermana" with *soy / eres / es* cannot be answered by elimination — you have
 * to know how the verb agrees.
 *
 * Every generator may return nothing. A rule with no usable sentence yet
 * degrades to ordinary practice rather than inventing a broken question.
 */

import rawGrammar from "../../content/spanish-grammar.json";
import { unknownWords } from "@/lib/curriculum-plan";
import { makeRng, seededShuffle, type Rng } from "@/lib/rng";
import { normalizeWord, splitWords } from "@/lib/text-tokens";
import type { GrammarFocus, Phrase } from "@/types/learning";

type RawRule = {
  id: string;
  targets: string[];
  title: string;
  explanation: string;
  examples: Array<{ target: string; english: string; note?: string }>;
  drill?: string;
  markerGroups?: string[][];
  /**
   * Phrases this rule must not be drilled on. Spanish has famous exceptions —
   * "el agua" is feminine but takes "el" — and a drill that teaches the
   * exception as the rule is worse than no drill.
   */
  avoidPhrases?: string[];
};

const grammar = rawGrammar as { version: number; rules: RawRule[] };

const ruleByTarget = new Map<string, RawRule>();
for (const rule of grammar.rules) {
  for (const target of rule.targets) {
    ruleByTarget.set(target.trim().toLowerCase(), rule);
  }
}

const ruleById = new Map(grammar.rules.map((rule) => [rule.id, rule]));

/** The rule a unit's declared grammar target maps to, if one is authored. */
export function findGrammarRule(target: string): RawRule | undefined {
  return ruleByTarget.get(target.trim().toLowerCase());
}

/** A rule by its own id — how an explicitly authored `grammar_focus` resolves. */
export function getGrammarRule(id: string): RawRule | undefined {
  return ruleById.get(id);
}

export type GrammarFocusOptions = {
  /**
   * Normalized words the learner has met by this point. Examples containing
   * anything outside this set are dropped — a grammar card that explains a
   * pattern using three unknown words teaches nothing but discouragement.
   */
  knownWords?: ReadonlySet<string>;
  /** How to decide a word is known; see `KnownWordResolver`. */
  resolveKnown?: (word: string, known: ReadonlySet<string>) => boolean;
  /**
   * The unit's own phrases, used to build replacement examples when too few of
   * the authored ones survive filtering.
   */
  unitPhrases?: ReadonlyArray<{ romanized: string; english: string }>;
};

/** Fewer than this many usable examples and the card isn't worth showing. */
const MIN_EXAMPLES = 2;
const MAX_EXAMPLES = 3;

function exampleIsReadable(
  example: { target: string },
  { knownWords, resolveKnown }: GrammarFocusOptions,
): boolean {
  if (!knownWords) {
    return true;
  }

  return unknownWords(example.target, knownWords, resolveKnown).length === 0;
}

/**
 * The teachable form of a rule: what the lesson shows on its grammar card.
 *
 * Rules carry a generous example bank precisely so this can be selective. The
 * authored examples are filtered down to the ones the learner can actually
 * read, and if that leaves too few, the unit's own phrases stand in — a
 * sentence from this very unit is the best possible illustration of its
 * pattern.
 */
export function toGrammarFocus(
  rule: RawRule,
  options: GrammarFocusOptions = {},
): GrammarFocus {
  const readable = rule.examples.filter((example) =>
    exampleIsReadable(example, options),
  );
  const examples = [...readable];

  // Examples pulled from the unit's own phrases skip the readability filter on
  // purpose: the learner is being taught that exact sentence in this very unit,
  // so it is the most readable illustration available by definition.
  if (examples.length < MIN_EXAMPLES && options.unitPhrases) {
    const groups = rule.markerGroups ?? [];

    for (const phrase of options.unitPhrases) {
      if (examples.length >= MIN_EXAMPLES) {
        break;
      }

      const shown = { id: "x", romanized: phrase.romanized, english: phrase.english } as Phrase;
      const demonstrates = groups.some((group) => findMarker(shown, group, new Set()));

      if (demonstrates && !examples.some((item) => item.target === phrase.romanized)) {
        examples.push({ target: phrase.romanized, english: phrase.english });
      }
    }
  }

  return {
    id: rule.id,
    title: rule.title,
    explanation: rule.explanation,
    // Never fall back to unreadable examples: showing none is better than
    // showing a sentence built from words the learner has never met.
    examples: examples.slice(0, MAX_EXAMPLES),
    drill: rule.drill,
  };
}

export function getGrammarFocus(
  target: string,
  options: GrammarFocusOptions = {},
): GrammarFocus | undefined {
  const rule = findGrammarRule(target);
  return rule ? toGrammarFocus(rule, options) : undefined;
}

/**
 * How many of `phrases` actually demonstrate this rule.
 *
 * The readiness gate: a pattern should be named only after the learner has met
 * it enough times to have noticed it. Explaining "the ending tells you who"
 * before any conjugated verb has appeared is a definition, not a lesson.
 */
export function countPatternEncounters(
  rule: RawRule,
  phrases: ReadonlyArray<{ romanized: string; english: string }>,
): number {
  const groups = rule.markerGroups ?? [];

  if (groups.length === 0) {
    return phrases.length;
  }

  let count = 0;

  for (const phrase of phrases) {
    const shown = { id: "x", romanized: phrase.romanized, english: phrase.english } as Phrase;

    if (groups.some((group) => findMarker(shown, group, new Set()))) {
      count += 1;
    }
  }

  return count;
}

/**
 * A drill the lesson engine can render. Deliberately *not* a `LessonStep`: the
 * engine owns step shapes and ids, and keeping this module free of that import
 * keeps the dependency one-way.
 */
export type GrammarDrill =
  | {
      kind: "pattern";
      /** The frame being practised, e.g. "Quiero ___". */
      phrase: Phrase;
      before: string;
      after: string;
      answer: string;
      options: string[];
      hint: string;
      /** What the frame is called, for the prompt. */
      patternLabel: string;
    }
  | {
      kind: "cloze";
      phrase: Phrase;
      before: string;
      after: string;
      answer: string;
      options: string[];
      hint: string;
      note?: string;
    }
  | { kind: "order"; phrase: Phrase };

/** Where a marker sits inside a phrase, as a token span. */
type MarkerMatch = {
  phrase: Phrase;
  start: number;
  length: number;
  answer: string;
  /** Punctuation that followed the marker; it stays in the sentence. */
  trailing: string;
  group: string[];
};

function findMarker(
  phrase: Phrase,
  group: readonly string[],
  avoid: ReadonlySet<string>,
): MarkerMatch | null {
  if (avoid.has(normalizeWord(phrase.romanized))) {
    return null;
  }

  const words = splitWords(phrase.romanized);
  const normalized = words.map(normalizeWord);

  // Longest marker first, so "tengo que" wins over "tengo".
  const ordered = [...group].sort(
    (a, b) => splitWords(b).length - splitWords(a).length,
  );

  for (const marker of ordered) {
    const markerWords = splitWords(marker).map(normalizeWord);

    for (let start = 0; start + markerWords.length <= normalized.length; start += 1) {
      const matches = markerWords.every(
        (word, offset) => normalized[start + offset] === word,
      );

      if (matches) {
        const raw = words.slice(start, start + markerWords.length).join(" ");
        const trailing = raw.match(/[.,;:!?"']+$/)?.[0] ?? "";

        return {
          phrase,
          start,
          length: markerWords.length,
          // Keep the phrase's own casing and accents, but not its punctuation:
          // the learner picks "es", never "es.".
          answer: trailing ? raw.slice(0, raw.length - trailing.length) : raw,
          trailing,
          group: [...group],
        };
      }
    }
  }

  return null;
}

function clozeFromMatch(match: MarkerMatch, rng: Rng): GrammarDrill | null {
  const words = splitWords(match.phrase.romanized);
  const answerKey = normalizeWord(match.answer);
  const alternatives = match.group.filter(
    (option) => normalizeWord(option) !== answerKey,
  );

  // A question with no alternatives isn't a question.
  if (alternatives.length === 0) {
    return null;
  }

  const options = seededShuffle(
    [match.answer, ...alternatives.slice(0, 3)],
    rng,
  );

  const rest = words.slice(match.start + match.length).join(" ");

  return {
    kind: "cloze",
    phrase: match.phrase,
    before: words.slice(0, match.start).join(" "),
    after: rest ? `${match.trailing} ${rest}`.trim() : match.trailing,
    answer: match.answer,
    options,
    hint: match.phrase.english,
  };
}

/** Slot fills should be things, not adverbs or connectors. */
const SLOT_CATEGORIES = new Set(["noun", "vocabulary", "adjective"]);

/**
 * Turn a sentence that demonstrates a rule into a substitution exercise.
 *
 * The marker (`Quiero`) stays put and the *slot after it* is blanked, with
 * other things the learner could want offered alongside. Where a cloze drill
 * asks "which form of the verb?", this asks "what else can I say with this
 * frame?" — which is what makes a pattern reusable rather than memorised.
 */
function buildPatternDrills(
  rule: RawRule,
  knownPhrases: readonly Phrase[],
  rng: Rng,
): Extract<GrammarDrill, { kind: "pattern" }>[] {
  const groups = rule.markerGroups ?? [];
  const drills: Extract<GrammarDrill, { kind: "pattern" }>[] = [];

  if (groups.length === 0) {
    return drills;
  }

  // Things that can fill a slot: short items of the same kind, so the choice is
  // "what else could I want?" rather than a grab-bag of any known word.
  const fills = knownPhrases.filter((phrase) => {
    const words = splitWords(phrase.romanized);
    return (
      words.length <= 2 &&
      !phrase.romanized.includes("?") &&
      SLOT_CATEGORIES.has(phrase.category)
    );
  });

  if (fills.length < 3) {
    return drills;
  }

  for (const phrase of seededShuffle(knownPhrases, rng)) {
    if (drills.length >= 1) {
      break;
    }

    const words = splitWords(phrase.romanized);

    if (words.length < 3) {
      continue;
    }

    const match = groups
      .map((group) => findMarker(phrase, group, new Set()))
      .find((found): found is MarkerMatch => Boolean(found));

    if (!match) {
      continue;
    }

    // The slot is what follows the marker, up to the first comma — "Quiero un
    // café, por favor." practises the frame `Quiero ___`, not `Quiero ___, por
    // favor`, and a courtesy tag is not part of the pattern.
    const slotStart = match.start + match.length;
    const tail: string[] = [];

    for (const word of words.slice(slotStart)) {
      tail.push(word);

      if (word.includes(",")) {
        break;
      }
    }

    const rawTail = tail.join(" ");
    const answer = rawTail.replace(/[.,;:!?]+$/, "");
    // Punctuation the slot swallowed belongs back in the sentence, so the frame
    // still reads "Quiero ___, por favor."
    const carried = rawTail.slice(answer.length);

    // One or two words is a slot; more is a sentence, and blanking it stops
    // being a pattern exercise.
    if (!answer || tail.length > 2) {
      continue;
    }

    const alternatives = seededShuffle(
      fills.filter((item) => normalizeWord(item.romanized) !== normalizeWord(answer)),
      rng,
    )
      .slice(0, 3)
      .map((item) => item.romanized);

    if (alternatives.length < 2) {
      continue;
    }

    drills.push({
      kind: "pattern",
      phrase,
      before: words.slice(0, slotStart).join(" "),
      after: `${carried} ${words.slice(slotStart + tail.length).join(" ")}`.trim(),
      answer,
      options: seededShuffle([answer, ...alternatives], rng),
      hint: phrase.english,
      patternLabel: `${words.slice(0, slotStart).join(" ")} …`,
    });
  }

  return drills;
}

/**
 * Build drills for a rule from phrases the learner already knows.
 *
 * `limit` is small by design — a grammar lesson is a couple of pointed
 * questions plus ordinary practice, not a worksheet.
 */
export function buildGrammarDrills(
  focus: GrammarFocus,
  knownPhrases: readonly Phrase[],
  seed: string,
  limit = 3,
): GrammarDrill[] {
  const rule = ruleById.get(focus.id);

  if (!rule || limit <= 0) {
    return [];
  }

  const rng = makeRng(`${seed}-grammar-${rule.id}`);
  const drills: GrammarDrill[] = [];
  const usedPhraseIds = new Set<string>();

  // A pattern drill holds the frame steady and swaps what goes in the slot:
  // "Quiero ___" against café / té / agua. It is the difference between
  // remembering one sentence and owning a structure you can reuse.
  for (const drill of buildPatternDrills(rule, knownPhrases, rng)) {
    if (drills.length >= limit) break;
    usedPhraseIds.add(drill.phrase.id);
    drills.push(drill);
  }

  if (rule.drill === "word-order") {
    for (const phrase of seededShuffle(knownPhrases, rng)) {
      if (drills.length >= limit) break;
      if (splitWords(phrase.romanized).length < 3) continue;

      usedPhraseIds.add(phrase.id);
      drills.push({ kind: "order", phrase });
    }
  }

  // Marker drills are the general case, and also back up `word-order` and
  // `article-choice` when those can't find enough material.
  const groups = rule.markerGroups ?? [];
  const avoid = new Set((rule.avoidPhrases ?? []).map(normalizeWord));
  const candidates: MarkerMatch[] = [];

  for (const group of groups) {
    if (group.length < 2) {
      continue;
    }

    for (const phrase of knownPhrases) {
      const match = findMarker(phrase, group, avoid);

      if (match) {
        candidates.push(match);
      }
    }
  }

  // Longest sentence first: "___ cuenta, por favor." teaches the pattern in
  // context; "___ café" barely does.
  const ordered = seededShuffle(candidates, rng).sort(
    (a, b) =>
      splitWords(b.phrase.romanized).length - splitWords(a.phrase.romanized).length,
  );

  for (const match of ordered) {
    if (drills.length >= limit) {
      break;
    }

    if (usedPhraseIds.has(match.phrase.id)) {
      continue;
    }

    const drill = clozeFromMatch(match, rng);

    if (drill) {
      usedPhraseIds.add(match.phrase.id);
      drills.push(drill);
    }
  }

  return drills;
}

/** Every authored rule — used by the curriculum audit. */
export function allGrammarRules(): RawRule[] {
  return grammar.rules;
}
