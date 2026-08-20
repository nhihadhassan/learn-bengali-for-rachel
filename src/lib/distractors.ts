/**
 * Choosing the *wrong* answers.
 *
 * A multiple-choice question only measures Spanish if the wrong options are
 * plausible. The engine used to pad options with a fixed English filler list
 * (`"please", "rice", "water", "father"`), so a learner could often answer
 * "what does *buenos días* mean?" by noticing that three options were about
 * food. That measures test-taking, not language.
 *
 * Distractors here are *ranked*, not sampled: candidates that share the
 * answer's category, shape, stem or length score higher, so `buenos días` is
 * offered against `buenas tardes` / `buenas noches` / `hasta luego`.
 *
 * Ties are broken with a seeded RNG (`@/lib/rng`) rather than `Math.random()`,
 * so a given lesson always builds the same question and can be asserted in a
 * test.
 */

import { makeRng, seededShuffle, type Rng } from "@/lib/rng";
import { normalizeWord, splitWords } from "@/lib/text-tokens";
import type { Phrase } from "@/types/learning";

/** How many options a multiple-choice question shows, answer included. */
export const OPTION_COUNT = 4;

/** Single word, short phrase, or full sentence — mixing them gives the game away. */
function shapeOf(text: string): "word" | "phrase" | "sentence" {
  const words = splitWords(text).length;

  if (words <= 1) {
    return "word";
  }

  return words <= 2 ? "phrase" : "sentence";
}

function stemOf(word: string): string {
  return normalizeWord(word).slice(0, 4);
}

/**
 * How confusable `candidate` is with `answer`. Higher is a better distractor:
 * it should be wrong, but wrong in a way the learner has to actually know
 * Spanish to rule out.
 */
function confusability(answer: Phrase, candidate: Phrase, side: "target" | "english"): number {
  const answerText = side === "target" ? answer.romanized : answer.english;
  const candidateText = side === "target" ? candidate.romanized : candidate.english;
  const answerWords = splitWords(answerText);
  const candidateWords = splitWords(candidateText);

  let score = 0;

  if (shapeOf(answerText) === shapeOf(candidateText)) {
    score += 5;
  }

  if (answer.category && answer.category === candidate.category) {
    score += 4;
  }

  const first = stemOf(answerWords[0] ?? "");
  const candidateFirst = stemOf(candidateWords[0] ?? "");
  if (first.length >= 3 && first === candidateFirst) {
    // "buenos días" / "buenas tardes", "hasta luego" / "hasta mañana".
    score += 3;
  }

  const last = normalizeWord(answerWords[answerWords.length - 1] ?? "");
  const candidateLast = normalizeWord(candidateWords[candidateWords.length - 1] ?? "");
  if (last.length >= 3 && last === candidateLast) {
    score += 2;
  }

  // Both questions or both statements: a "¿...?" answer among statements is
  // solvable without reading the words.
  if (answerText.includes("?") === candidateText.includes("?")) {
    score += 2;
  }

  const lengthRatio =
    Math.min(answerText.length, candidateText.length) /
    Math.max(answerText.length, candidateText.length, 1);
  if (lengthRatio >= 0.6) {
    score += 2;
  }

  if (answerWords.length === candidateWords.length) {
    score += 1;
  }

  return score;
}

type OptionSide = "target" | "english";

function textOf(phrase: Phrase, side: OptionSide): string {
  return side === "target" ? phrase.romanized : phrase.english;
}

/**
 * The answer plus the most confusable alternatives available, shuffled.
 *
 * Options are de-duplicated by their displayed text, so a phrase that appears
 * in two units can never show up as its own distractor.
 */
function buildOptions(
  answer: Phrase,
  pool: readonly Phrase[],
  side: OptionSide,
  rng: Rng,
  count = OPTION_COUNT,
): string[] {
  const answerText = textOf(answer, side);
  const seen = new Set<string>([normalizeWord(answerText)]);
  const candidates: Array<{ text: string; score: number }> = [];

  for (const phrase of pool) {
    if (phrase.id === answer.id) {
      continue;
    }

    const text = textOf(phrase, side);
    const key = normalizeWord(text);

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push({ text, score: confusability(answer, phrase, side) });
  }

  // Shuffle first so equal-scoring candidates don't always resolve in pool
  // order, then take the best. The sort is stable, so the shuffle survives.
  const ranked = seededShuffle(candidates, rng)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count - 1))
    .map((candidate) => candidate.text);

  return seededShuffle([answerText, ...ranked], rng);
}

export function buildMeaningOptions(
  answer: Phrase,
  pool: readonly Phrase[],
  seed: string,
  count = OPTION_COUNT,
): string[] {
  return buildOptions(answer, pool, "english", makeRng(`${seed}-meaning`), count);
}

export function buildTargetOptions(
  answer: Phrase,
  pool: readonly Phrase[],
  seed: string,
  count = OPTION_COUNT,
): string[] {
  return buildOptions(answer, pool, "target", makeRng(`${seed}-target`), count);
}

/**
 * Word-level distractors for a cloze blank: other content words the learner has
 * met, preferring ones that could grammatically fill the gap (same length, same
 * ending — `-o`/`-a` adjective pairs, `-ar`/`-er` infinitives).
 */
export function buildWordOptions(
  answer: string,
  wordPool: readonly string[],
  seed: string,
  count = OPTION_COUNT,
): string[] {
  const rng = makeRng(`${seed}-word`);
  const answerKey = normalizeWord(answer);
  const seen = new Set<string>([answerKey]);
  const scored: Array<{ text: string; score: number }> = [];

  for (const word of wordPool) {
    const key = normalizeWord(word);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);

    let score = 0;
    if (key.slice(-1) === answerKey.slice(-1)) {
      score += 3;
    }
    if (key.slice(-2) === answerKey.slice(-2)) {
      score += 2;
    }
    if (Math.abs(key.length - answerKey.length) <= 2) {
      score += 2;
    }
    if (key.slice(0, 3) === answerKey.slice(0, 3)) {
      score += 1;
    }

    scored.push({ text: word, score });
  }

  const ranked = seededShuffle(scored, rng)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count - 1))
    .map((item) => item.text);

  return seededShuffle([answer, ...ranked], rng);
}
