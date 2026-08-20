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

/** The teachable form of a rule: what the lesson shows on its grammar card. */
export function toGrammarFocus(rule: RawRule): GrammarFocus {
  return {
    id: rule.id,
    title: rule.title,
    explanation: rule.explanation,
    examples: rule.examples,
    drill: rule.drill,
  };
}

export function getGrammarFocus(target: string): GrammarFocus | undefined {
  const rule = findGrammarRule(target);
  return rule ? toGrammarFocus(rule) : undefined;
}

/**
 * A drill the lesson engine can render. Deliberately *not* a `LessonStep`: the
 * engine owns step shapes and ids, and keeping this module free of that import
 * keeps the dependency one-way.
 */
export type GrammarDrill =
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
