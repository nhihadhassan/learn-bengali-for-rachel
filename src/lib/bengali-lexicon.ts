/**
 * Which Bengali word forms count as "already known".
 *
 * The same job `@/lib/spanish-lexicon` does for Spanish, and the same split:
 * **irregular things are authored, regular things are computed.** The
 * difference is where the line falls. Spanish hides its irregularity in verb
 * stems; Bengali hides almost none — a noun takes `-e`, `-r`, `-ke`, `-gulo`
 * and a verb takes `-i`, `-o`, `-e`, `-chi`, `-bo`, `-lam` with near-perfect
 * regularity — so the authored file
 * (`content/bengali-lexicon.json`) is short and the rules do most of the work.
 *
 * What it must get right is the handful of suppletive stems the course
 * genuinely teaches: `acha` present `ach-` against past `chil-`, `jaowa`
 * present `ja-` against perfect `ge-`, `asha` against `eshechi`, and the
 * pronoun table (`ami` → `amar` → `amake`), where a suffix rule would produce
 * confident nonsense.
 *
 * This is not a parser and is not trying to become one. It only needs to be
 * right about the vocabulary this course actually teaches: prerequisite
 * checking asks "can the learner read this sentence yet?", and a false "no"
 * is noise that hides the real gaps the audit exists to find.
 */

import rawLexicon from "../../content/bengali-lexicon.json";
import { normalizeWord } from "@/lib/text-tokens";

type RawLexicon = {
  verbs: Array<{ lemma: string; english: string; forms: Record<string, string> }>;
  pronouns: {
    forms: Array<{
      base: string;
      english: string;
      possessive: string;
      objective: string;
    }>;
  };
  transparent: { properNouns: string[]; numbers: string[]; loanwords: string[] };
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

/** Which person a verb form expresses — used by the audit and by tests. */
const personByForm = new Map<string, { lemma: string; person: string }>();

for (const verb of lexicon.verbs) {
  for (const [form, person] of Object.entries(verb.forms)) {
    personByForm.set(normalizeWord(form), { lemma: verb.lemma, person });
  }
}

/**
 * Every form of a pronoun points back at its base, in both directions.
 *
 * A unit that teaches `amar naam` before it ever teaches the bare `ami` is
 * normal — "my name" is more useful than "I" on day one — so `ami` has to
 * count as known once `amar` has been met, not only the other way round.
 */
const pronounBaseByForm = new Map<string, string>();

for (const pronoun of lexicon.pronouns.forms) {
  for (const form of [pronoun.base, pronoun.possessive, pronoun.objective]) {
    pronounBaseByForm.set(normalizeWord(form), pronoun.base);
  }
}

const transparentWords = new Set(
  [
    ...lexicon.transparent.properNouns,
    ...lexicon.transparent.numbers,
    ...lexicon.transparent.loanwords,
  ].map(normalizeWord),
);

const structureWords = new Set(lexicon.structureWords.words.map(normalizeWord));

/** The dictionary form of a word, when this course teaches one. */
export function lemmaOf(word: string): string | undefined {
  return lemmaByForm.get(normalizeWord(word));
}

/** `{ lemma, person }` for an inflected verb form, if it is a known one. */
export function conjugationOf(word: string) {
  return personByForm.get(normalizeWord(word));
}

/** The base pronoun a possessive or objective form belongs to. */
export function pronounBaseOf(word: string): string | undefined {
  return pronounBaseByForm.get(normalizeWord(word));
}

/**
 * Words no beginner needs taught: names, numerals, the English loanwords
 * spoken Bengali uses as they stand (`bus`, `taxi`, `bathroom`), and the
 * structural glue (`ar`, `khub`, `to`) that is absorbed rather than studied.
 */
export function isTransparentWord(word: string): boolean {
  const key = normalizeWord(word);
  return transparentWords.has(key) || structureWords.has(key);
}

/**
 * Endings a Bengali noun takes, longest first.
 *
 * `-te`/`-e` locative, `-r`/`-er` genitive, `-ke` objective, `-gulo`/`-guli`/
 * `-ra`/`-der` plural, and the classifiers `-ta`/`-ti` that turn a bare noun
 * into "the one". They stack — `bari` + `gulo` + `te` — so stripping is
 * iterative rather than a single pass.
 */
const NOUN_SUFFIXES = [
  "gulote", "gulor", "gulo", "guli", "der", "ra",
  "take", "tike", "tar", "tir", "ta", "ti",
  "ke", "te", "er", "r", "y", "e",
];

/** The shortest a stem may be left after stripping. Below this it is noise. */
const MIN_STEM = 2;

/**
 * Endings a Bengali verb takes across the tenses this course uses, longest
 * first: present continuous `-chhi/-chi`, future `-bo/-ben`, past `-lam/-lo`,
 * perfect `-echi/-eche`, the infinitive `-te`, and the plain present.
 */
const VERB_SUFFIXES = [
  "chhilam", "chhile", "chhilo", "chhilen",
  "chhi", "chho", "chhe", "chhen",
  "chi", "cho", "che", "chen",
  "echi", "echo", "eche", "echen",
  "lam", "len", "lo", "le",
  "bo", "be", "ben",
  "un", "te",
  "i", "o", "e", "n", "y",
];

/**
 * Bengali raises a stem vowel before an ending — `shekha` conjugates as
 * `shikhi`, `bojha` as `bujhi`, `dekha` keeps `dekh-`. Undoing the raise both
 * ways lets a taught `shikhchi` cover `shikhbo` without either being authored.
 */
const VOWEL_ALTERNATIONS: Array<[string, string]> = [
  ["i", "e"],
  ["e", "i"],
  ["u", "o"],
  ["o", "u"],
];

function stripSuffixes(word: string, suffixes: readonly string[]): string[] {
  const stems = new Set<string>();

  for (const suffix of suffixes) {
    if (!word.endsWith(suffix) || word.length - suffix.length < MIN_STEM) {
      continue;
    }

    const stem = word.slice(0, word.length - suffix.length);
    stems.add(stem);

    // Endings stack: barigulote is bari + gulo + te. One more pass covers
    // every combination this course produces without a general parser.
    for (const inner of suffixes) {
      if (stem.endsWith(inner) && stem.length - inner.length >= MIN_STEM) {
        stems.add(stem.slice(0, stem.length - inner.length));
      }
    }
  }

  return [...stems];
}

function vowelVariants(stem: string): string[] {
  const variants = new Set<string>([stem]);

  for (const [from, to] of VOWEL_ALTERNATIONS) {
    // Only the first vowel of the stem alternates; later ones are part of the
    // root and swapping them invents words.
    const index = stem.search(/[aeiou]/);

    if (index >= 0 && stem[index] === from) {
      variants.add(`${stem.slice(0, index)}${to}${stem.slice(index + 1)}`);
    }
  }

  return [...variants];
}

/**
 * Every stem `word` could be an inflected form of.
 *
 * Deliberately generous: this answers "has the learner met something this word
 * is built from?", and the cost of an extra candidate is a word wrongly
 * counted as known, while the cost of a missing one is a false gap report that
 * buries a real one.
 */
function stemCandidates(word: string): string[] {
  const stems = new Set<string>();

  for (const stem of [
    ...stripSuffixes(word, NOUN_SUFFIXES),
    ...stripSuffixes(word, VERB_SUFFIXES),
  ]) {
    for (const variant of vowelVariants(stem)) {
      stems.add(variant);
      // Bengali writes both a bare stem and a stem + a: kora / kor, bola / bol.
      stems.add(`${variant}a`);
    }
  }

  return [...stems];
}

/**
 * Is `word` covered by something the learner has been taught?
 *
 * `known` holds normalized words drawn from vocabulary entries and phrases the
 * learner has already met — including multi-word entries like `abar dekha
 * hobe`, which contribute all three of their words.
 */
export function isKnownForm(word: string, known: ReadonlySet<string>): boolean {
  const key = normalizeWord(word);

  if (!key || known.has(key) || isTransparentWord(key)) {
    return true;
  }

  // A pronoun the learner met in any of its forms counts in all of them:
  // teaching `amar naam` teaches `ami` and `amake` too, since the whole point
  // of the possessive lesson is that they are the same word.
  const pronoun = pronounBaseOf(key);

  if (pronoun) {
    for (const candidate of known) {
      if (pronounBaseOf(candidate) === pronoun) {
        return true;
      }
    }
  }

  // A conjugated verb counts once any form of it has been taught — and the
  // other way round, since a unit usually teaches `korchi` long before it
  // names the verb `kora`.
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

  const stems = stemCandidates(key);

  for (const stem of stems) {
    if (known.has(stem)) {
      return true;
    }

    // `barite` is `bari` inflected; so is `barir`. Matching through the lemma
    // map as well catches a stem the course taught only in another form.
    const stemLemma = lemmaOf(stem);

    if (stemLemma && known.has(normalizeWord(stemLemma))) {
      return true;
    }
  }

  // The reverse direction: the learner met `barite` and the sentence uses
  // `bari`. Stripping the *known* word is the only way to see that.
  for (const candidate of known) {
    if (stemCandidates(candidate).includes(key)) {
      return true;
    }
  }

  return false;
}

/** Every lemma the lexicon knows, for tests and the audit. */
export function allLemmas(): string[] {
  return lexicon.verbs.map((verb) => verb.lemma);
}
