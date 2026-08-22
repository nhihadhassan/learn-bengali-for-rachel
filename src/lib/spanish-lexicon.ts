/**
 * Which word forms count as "already known".
 *
 * Prerequisite checking asks a simple question — can the learner read this
 * phrase yet? — and it used to answer badly. A learner taught `tener` was
 * treated as never having met `tienes`, and `la manzana` did not cover
 * `manzanas`. Those false positives were noisy enough to hide the *real* gaps,
 * which is what the audit exists to find.
 *
 * The split here is deliberate: **irregular things are authored, regular things
 * are computed.** Spanish verb forms are listed in `content/spanish-lexicon.json`
 * because no rule gets you from `ir` to `voy`; plurals and -o/-a gender pairs
 * are derived, because a rule gets you from `manzana` to `manzanas` every time
 * and enumerating them would be busywork that goes stale.
 *
 * This is not a parser and is not trying to become one. It only needs to be
 * right about the vocabulary this course actually teaches.
 */

import rawLexicon from "../../content/spanish-lexicon.json";
import { normalizeWord } from "@/lib/text-tokens";

type RawLexicon = {
  verbs: Array<{ lemma: string; english: string; forms: Record<string, string> }>;
  transparent: { properNouns: string[]; numbers: string[] };
  structureWords: { words: string[] };
};

const lexicon = rawLexicon as unknown as RawLexicon;

/** Inflected form -> the lemma a vocabulary entry would teach. */
const lemmaByForm = new Map<string, string>();

for (const verb of lexicon.verbs) {
  lemmaByForm.set(normalizeWord(verb.lemma), verb.lemma);

  for (const form of Object.keys(verb.forms)) {
    lemmaByForm.set(normalizeWord(form), verb.lemma);
  }
}

/** Which person/number a form expresses — used by grammar drills and the audit. */
const personByForm = new Map<string, { lemma: string; person: string }>();

for (const verb of lexicon.verbs) {
  for (const [form, person] of Object.entries(verb.forms)) {
    personByForm.set(normalizeWord(form), { lemma: verb.lemma, person });
  }
}

const transparentWords = new Set(
  [...lexicon.transparent.properNouns, ...lexicon.transparent.numbers].map(normalizeWord),
);

const structureWords = new Set(lexicon.structureWords.words.map(normalizeWord));

/** The dictionary form of a word, when this course teaches one. */
export function lemmaOf(word: string): string | undefined {
  return lemmaByForm.get(normalizeWord(word));
}

/** `{ lemma, person }` for a conjugated verb form, if it is a known one. */
export function conjugationOf(word: string) {
  return personByForm.get(normalizeWord(word));
}

/**
 * Words no beginner needs taught: names, numerals, and the structural glue
 * (`muy`, `que`, `con`) that is absorbed from context rather than studied.
 */
export function isTransparentWord(word: string): boolean {
  const key = normalizeWord(word);
  return transparentWords.has(key) || structureWords.has(key);
}

/**
 * Regular Spanish inflection, tried in the order that keeps false matches down:
 * plural -s / -es, then the -o/-a gender pair, then both together
 * (`frescas` -> `fresco`).
 */
function regularVariants(word: string): string[] {
  const key = normalizeWord(word);
  const stems = new Set<string>([key]);

  if (key.endsWith("es") && key.length > 4) {
    stems.add(key.slice(0, -2));
  }

  if (key.endsWith("s") && key.length > 3) {
    stems.add(key.slice(0, -1));
  }

  const variants = new Set<string>();

  for (const stem of stems) {
    variants.add(stem);

    if (stem.endsWith("a")) {
      variants.add(`${stem.slice(0, -1)}o`);
    }

    if (stem.endsWith("o")) {
      variants.add(`${stem.slice(0, -1)}a`);
    }
  }

  return [...variants];
}

/**
 * Is `word` covered by something the learner has been taught?
 *
 * `known` holds normalized words drawn from vocabulary entries and phrases the
 * learner has already met — including multi-word entries like `el café`, which
 * contribute both of their words.
 */
export function isKnownForm(word: string, known: ReadonlySet<string>): boolean {
  const key = normalizeWord(word);

  if (!key || known.has(key) || isTransparentWord(key)) {
    return true;
  }

  // A conjugated verb counts once its infinitive has been taught — and the
  // other way round, since a unit sometimes teaches "quiero" before "querer".
  const lemma = lemmaOf(key);

  if (lemma) {
    if (known.has(normalizeWord(lemma))) {
      return true;
    }

    for (const candidate of known) {
      if (lemmaOf(candidate) === lemma) {
        return true;
      }
    }
  }

  for (const variant of regularVariants(key)) {
    if (known.has(variant)) {
      return true;
    }
  }

  return false;
}

/** Every lemma the lexicon knows, for tests and the audit. */
export function allLemmas(): string[] {
  return lexicon.verbs.map((verb) => verb.lemma);
}
