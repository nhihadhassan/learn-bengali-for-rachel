/**
 * Word-level text helpers shared by both exercise-building paths: the runtime
 * lesson engine (`@/lib/lesson-steps`) and the offline curriculum pipeline
 * (`src/curriculum/generators.ts`).
 *
 * They used to be copy-pasted in both places, which meant the pipeline's tests
 * could pass while real lessons blanked a different word. One definition now.
 */

/** Split a phrase into whitespace-delimited words, dropping empties. */
export function splitWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

/** Strip punctuation and case so words can be compared. Accents are kept. */
export function normalizeWord(word: string): string {
  return word.replace(/[¿?¡!.,;:]/g, "").toLowerCase();
}

/**
 * Function words that make poor answers: blanking "el" or "the" teaches
 * nothing, and they give themselves away as distractors. Covers the Spanish
 * courses plus the English glosses used by the romanized courses.
 */
export const FUNCTION_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en",
  "y", "o", "a", "al", "es", "mi", "tu", "su", "con", "por", "para", "que",
  "se", "lo", "le", "me", "te", "no", "sí", "muy", "más", "esta", "este",
  "the", "an", "of", "in", "to", "is",
]);

/** Words too short or too functional to be worth testing on. */
export function isContentWord(word: string): boolean {
  const normalized = normalizeWord(word);
  return normalized.length >= 3 && !FUNCTION_WORDS.has(normalized);
}

/**
 * Which word to blank out in a cloze exercise: the longest real content word,
 * falling back to the last word when a phrase is all function words.
 */
export function pickBlankIndex(words: string[]): number {
  let best = -1;
  let bestLength = -1;

  for (let index = 0; index < words.length; index += 1) {
    if (!isContentWord(words[index])) {
      continue;
    }

    if (words[index].length > bestLength) {
      bestLength = words[index].length;
      best = index;
    }
  }

  return best >= 0 ? best : words.length - 1;
}

/** Fisher-Yates copy. */
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

/**
 * Shuffle a word bank so it never comes back in the original order — otherwise
 * an "arrange the words" exercise can present itself already solved.
 */
export function shuffleTokens(words: string[]): string[] {
  if (words.length < 2) {
    return words;
  }

  const original = words.join(" ");

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shuffled = shuffle(words);

    if (shuffled.join(" ") !== original) {
      return shuffled;
    }
  }

  return [...words].reverse();
}
